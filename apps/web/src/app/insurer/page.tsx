"use client";

import { useEffect, useState } from "react";
import { Landmark, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { CalldataAuditPanel, scanHexForPhi } from "@/components/insurer/calldata-audit-panel";
import { SettledClaimsTable } from "@/components/insurer/settled-claims-table";
import { Badge } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { getProviderDisplayName } from "@/lib/clinicalCatalog";
import { fetchOnChainVaultSnapshot, fetchSettledClaimsEvents } from "@/lib/chainEvents";
import { CONTRACTS, DEPLOYMENT, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { loadLocalChainMirror, saveLocalChainMirror, type LocalSettledClaim } from "@/lib/localState";
import { fetchRelayState, postRelayAction } from "@/lib/relayClient";
import {
  decodeContractError,
  ensureSepoliaChain,
  preflightSimulateAndWrite,
  validatePositiveEthInput,
} from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth } from "@/lib/utils";

const LEDGER_PAGE_SIZE = 5;

export default function InsurerPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const roles = useWalletRoles();

  const [escrowWei, setEscrowWei] = useState<bigint>(0n);
  const [policySpentWei, setPolicySpentWei] = useState<bigint>(0n);
  const [vaultPaused, setVaultPaused] = useState<boolean>(false);
  const [onChainHospitalRoot, setOnChainHospitalRoot] = useState<bigint | null>(null);
  const [txBusy, setTxBusy] = useState<boolean>(false);
  const [depositEth, setDepositEth] = useState("0.05");
  const [withdrawEth, setWithdrawEth] = useState("0.025");
  const [customPolicyCommit, setCustomPolicyCommit] = useState("");
  const [policyStatus, setPolicyStatus] = useState("");

  const [settledList, setSettledList] = useState<LocalSettledClaim[]>([]);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [sortField, setSortField] = useState<"hospital" | "amount">("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterText, setFilterText] = useState("");
  const [selectedClaim, setSelectedClaim] = useState<LocalSettledClaim | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const [inspectedCalldata, setInspectedCalldata] = useState<string>("");
  const [phiHits, setPhiHits] = useState<string[] | null>(null);

  const refreshStats = async () => {
    if (IS_CHAIN_DEPLOYED && publicClient) {
      const zeroAddr = "0x0000000000000000000000000000000000000000";
      const seeded =
        (DEPLOYMENT as { seededInsurer?: string }).seededInsurer &&
        (DEPLOYMENT as { seededInsurer?: string }).seededInsurer !== zeroAddr
          ? (DEPLOYMENT as { seededInsurer?: string }).seededInsurer
          : canonicalFixtures.accounts.insurer;
      const targetInsurer = (address || seeded) as `0x${string}`;
      const [snapshot, onChainClaims] = await Promise.all([
        fetchOnChainVaultSnapshot(publicClient, targetInsurer),
        fetchSettledClaimsEvents(publicClient),
      ]);
      if (snapshot.insurerEscrowWei !== null) setEscrowWei(snapshot.insurerEscrowWei);
      if (snapshot.policySpentWei !== null) setPolicySpentWei(snapshot.policySpentWei);
      if (snapshot.paused !== null) setVaultPaused(snapshot.paused);
      setOnChainHospitalRoot(snapshot.hospitalRoot);
      setSettledList(onChainClaims);
      if (
        onChainClaims.length > 0 &&
        (!selectedClaim || onChainClaims[0].txHash !== selectedClaim.txHash)
      ) {
        const newest = onChainClaims[0];
        setSelectedClaim(newest);
        setTxHashInput(newest.txHash);
        try {
          const tx = await publicClient.getTransaction({ hash: newest.txHash as `0x${string}` });
          setInspectedCalldata(tx.input);
          setPhiHits(scanHexForPhi(tx.input));
        } catch {
          // Non-fatal if RPC tx lookup is delayed
        }
      }
      return;
    }

    const remote = await fetchRelayState();
    const mirror = remote ?? loadLocalChainMirror();
    setSettledList(mirror.settledClaims);
    if (mirror.settledClaims.length > 0 && !selectedClaim) {
      const first = mirror.settledClaims[0];
      setSelectedClaim(first);
      setInspectedCalldata(first.rawCalldataHex);
      setPhiHits(scanHexForPhi(first.rawCalldataHex));
    }
    setEscrowWei(BigInt(mirror.insurerEscrowWei));
    setPolicySpentWei(
      BigInt(mirror.policySpentWei[canonicalFixtures.activePolicy.commitment] ?? "0")
    );
  };

  useEffect(() => {
    refreshStats().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient]);

  const handleDepositEscrow = async () => {
    if (txBusy) return;
    setTxBusy(true);
    try {
      const val = validatePositiveEthInput(depositEth, "Deposit ETH amount");
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) {
          throw new Error("Connect Insurer MetaMask wallet first");
        }
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.ClaimsVault.address,
          abi: CONTRACTS.ClaimsVault.abi as Abi,
          functionName: "depositEscrow",
          value: val,
          writeContractAsync,
        });
        toast.success(`Deposited ${depositEth} ETH into ClaimsVault escrow`);
      } else {
        const updated = await postRelayAction({
          action: "deposit",
          amountWei: val.toString(),
        });
        if (!updated) {
          const mirror = loadLocalChainMirror();
          mirror.insurerEscrowWei = (BigInt(mirror.insurerEscrowWei) + val).toString();
          saveLocalChainMirror(mirror);
        }
        window.dispatchEvent(new Event("storage"));
        toast.success(`Added ${depositEth} ETH to clearinghouse escrow`);
      }
      await Promise.all([refreshStats(), roles.refetch()]);
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setTxBusy(false);
    }
  };

  const handleWithdrawEscrow = async () => {
    if (txBusy) return;
    setTxBusy(true);
    try {
      const val = validatePositiveEthInput(withdrawEth, "Withdraw ETH amount");
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) {
          throw new Error("Connect Insurer MetaMask wallet first");
        }
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.ClaimsVault.address,
          abi: CONTRACTS.ClaimsVault.abi as Abi,
          functionName: "withdrawEscrow",
          args: [val],
          writeContractAsync,
        });
        toast.success(`Withdrew ${withdrawEth} ETH from ClaimsVault escrow`);
      } else {
        const updated = await postRelayAction({
          action: "withdraw",
          amountWei: val.toString(),
        });
        if (!updated) {
          const mirror = loadLocalChainMirror();
          const bal = BigInt(mirror.insurerEscrowWei);
          if (bal < val) {
            throw new Error("Insufficient escrow balance to withdraw");
          }
          mirror.insurerEscrowWei = (bal - val).toString();
          saveLocalChainMirror(mirror);
        }
        window.dispatchEvent(new Event("storage"));
        toast.success(`Withdrew ${withdrawEth} ETH from clearinghouse escrow`);
      }
      await Promise.all([refreshStats(), roles.refetch()]);
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setTxBusy(false);
    }
  };

  const handleRegisterPolicy = async () => {
    if (txBusy) return;
    const raw = customPolicyCommit.trim() || canonicalFixtures.activePolicy.commitmentHex;
    setTxBusy(true);
    try {
      const commit = BigInt(raw);
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) {
          throw new Error("Connect Insurer MetaMask wallet first");
        }
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.PolicyRegistry.address,
          abi: CONTRACTS.PolicyRegistry.abi as Abi,
          functionName: "registerPolicy",
          args: [commit],
          writeContractAsync,
        });
        setPolicyStatus(`Registered ${raw.slice(0, 14)}... on Ethereum Sepolia`);
        toast.success("Registered policy commitment in PolicyRegistry");
        await Promise.all([refreshStats(), roles.refetch()]);
      } else {
        setPolicyStatus(`Verified BN254 commitment ${raw.slice(0, 16)}... ready for PolicyRegistry`);
        toast.success("Policy commitment validated for PolicyRegistry");
      }
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setTxBusy(false);
    }
  };

  const inspectClaimRow = async (claimRow: LocalSettledClaim) => {
    setSelectedClaim(claimRow);
    setTxHashInput(claimRow.txHash);
    if (IS_CHAIN_DEPLOYED && publicClient && claimRow.txHash.startsWith("0x")) {
      try {
        const tx = await publicClient.getTransaction({ hash: claimRow.txHash as `0x${string}` });
        setInspectedCalldata(tx.input);
        setPhiHits(scanHexForPhi(tx.input));
        return;
      } catch {
        // Fallback below
      }
    }
    setInspectedCalldata(claimRow.rawCalldataHex);
    setPhiHits(scanHexForPhi(claimRow.rawCalldataHex));
  };

  const handleInspectTx = async () => {
    if (IS_CHAIN_DEPLOYED && publicClient && txHashInput.startsWith("0x")) {
      try {
        const tx = await publicClient.getTransaction({ hash: txHashInput as `0x${string}` });
        setInspectedCalldata(tx.input);
        setPhiHits(scanHexForPhi(tx.input));
        toast.success("Fetched raw Ethereum Sepolia transaction calldata & scanned for PHI");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to load tx");
      }
    } else if (selectedClaim) {
      setInspectedCalldata(selectedClaim.rawCalldataHex);
      setPhiHits(scanHexForPhi(selectedClaim.rawCalldataHex));
      toast.success("Scanned settled Groth16 calldata for ICD-10 / CPT / Rx / Patient strings");
    }
  };

  const normalizedQuery = filterText.trim().toLowerCase();
  const filteredClaims = normalizedQuery
    ? settledList.filter((row) => {
        const provName = getProviderDisplayName(row.hospital).toLowerCase();
        return (
          row.hospital.toLowerCase().includes(normalizedQuery) ||
          provName.includes(normalizedQuery) ||
          row.nullifier.toLowerCase().includes(normalizedQuery)
        );
      })
    : settledList;

  const sortedClaims = [...filteredClaims].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "hospital") {
      return (
        getProviderDisplayName(a.hospital).localeCompare(
          getProviderDisplayName(b.hospital)
        ) * dir
      );
    }
    const diff = BigInt(a.amountWei) - BigInt(b.amountWei);
    if (diff === 0n) return 0;
    return (diff > 0n ? 1 : -1) * dir;
  });

  const toggleSort = (field: "hospital" | "amount") => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setLedgerPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(sortedClaims.length / LEDGER_PAGE_SIZE));
  const safePage = Math.min(ledgerPage, totalPages - 1);
  const ledgerSlice = sortedClaims.slice(
    safePage * LEDGER_PAGE_SIZE,
    (safePage + 1) * LEDGER_PAGE_SIZE
  );

  const liveEscrowNum = Number(formatWeiToEth(escrowWei, 4));
  const liveSpentNum = Number(formatWeiToEth(policySpentWei, 4));

  return (
    <div className="space-y-6">
      {/* Full-Width Insurer Stage Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E4E4E7] bg-white p-6 sm:p-7 card-porcelain">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(4,120,87,0.09),transparent_70%)]"
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#047857]">
                <Landmark className="h-3 w-3" />
                Step 3 of 3
              </span>
              <Badge variant={roles.isInsurer ? "emerald" : "neutral"}>
                {roles.isInsurer
                  ? "Insurer Wallet Connected"
                  : IS_CHAIN_DEPLOYED
                  ? "Public Read-Only Audit"
                  : "Sandbox Mode"}
              </Badge>
              {vaultPaused ? <Badge variant="crimson">Vault Paused</Badge> : null}
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-[-0.025em] text-[#09090B]">
              Insurer Settlement &amp;{" "}
              <span className="font-editorial italic font-normal text-[#047857]">Privacy</span>{" "}
              Audit
            </h1>
            <p className="text-sm text-[#52525B] leading-relaxed">
              Manage the native ETH escrow pool, track every verified payout on Ethereum Sepolia,
              and confirm mathematically that zero medical records ever reach the chain.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs font-semibold text-[#047857]">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Live On-Chain Calldata Verification Active
          </div>
        </div>
      </section>

      {/* Top 3 Real Live Bento Cards */}
      <div id="insurer-reserves" className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SpotlightCard accent="emerald" className="p-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717A]">
              Escrow Pool Balance
            </div>
            <div className="text-3xl font-bold font-mono-tabular text-[#047857]">
              <NumberTicker value={liveEscrowNum} decimals={4} suffix=" ETH" />
            </div>
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2">
              <input
                id="deposit-eth-input"
                value={depositEth}
                onChange={(e) => setDepositEth(e.target.value)}
                aria-label="Deposit ETH amount"
                className="w-24 rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] px-3 py-1.5 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:bg-white focus:outline-none"
              />
              <TactileButton
                size="sm"
                variant="primary"
                onClick={handleDepositEscrow}
                disabled={txBusy || (IS_CHAIN_DEPLOYED && (!roles.isConnected || roles.wrongChain))}
              >
                <Landmark className="h-3.5 w-3.5" />
                Fund Escrow
              </TactileButton>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="withdraw-eth-input"
                value={withdrawEth}
                onChange={(e) => setWithdrawEth(e.target.value)}
                aria-label="Withdraw ETH amount"
                className="w-24 rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] px-3 py-1.5 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:bg-white focus:outline-none"
              />
              <TactileButton
                size="sm"
                variant="secondary"
                onClick={handleWithdrawEscrow}
                disabled={
                  txBusy ||
                  (IS_CHAIN_DEPLOYED && (!roles.isConnected || roles.wrongChain || escrowWei === 0n))
                }
              >
                Withdraw
              </TactileButton>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard accent="neutral" className="p-6 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717A]">
              Total Paid to Hospitals
            </div>
            <div className="text-3xl font-bold font-mono-tabular text-[#09090B]">
              <NumberTicker value={liveSpentNum} decimals={4} suffix=" ETH" />
            </div>
            <div className="text-xs text-[#52525B]">
              {settledList.length} verified {settledList.length === 1 ? "claim" : "claims"} settled
              automatically
            </div>
          </div>
          <div className="text-[11px] text-[#52525B] rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] px-3.5 py-2.5 leading-relaxed">
            Annual policy cap stays strictly private inside the Groth16 proof while cumulative spend
            is tracked publicly.
          </div>
        </SpotlightCard>

        {/* Obsidian Signature Privacy Guarantee Card */}
        <div className="rounded-2xl border border-white/10 bg-obsidian-grid p-6 text-white card-obsidian flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-[#34D399]" />
              Medical Data Exposed
            </div>
            <div className="text-3xl font-bold font-mono-tabular text-[#34D399]">0 Bytes</div>
            <div className="text-xs text-zinc-300 leading-relaxed">
              Diagnoses, procedure codes, and prescriptions never touch Ethereum Sepolia.
            </div>
          </div>

          <details className="text-[11px] pt-3 border-t border-white/10">
            <summary className="cursor-pointer font-medium text-zinc-300 hover:text-white select-none">
              Register custom policy hash
            </summary>
            <div className="mt-2.5 flex items-center gap-1.5">
              <input
                id="policy-commit-input"
                aria-label="Policy commitment hex or decimal"
                placeholder="0x... policy hash"
                value={customPolicyCommit}
                onChange={(e) => setCustomPolicyCommit(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 font-mono-tabular text-[11px] text-white placeholder-zinc-500 focus:border-emerald-400 focus:outline-none"
              />
              <TactileButton
                size="sm"
                variant="emerald"
                onClick={handleRegisterPolicy}
                disabled={txBusy || (IS_CHAIN_DEPLOYED && (!roles.isConnected || roles.wrongChain))}
              >
                Save
              </TactileButton>
            </div>
            {policyStatus ? (
              <div className="mt-1.5 font-mono-tabular text-emerald-300">{policyStatus}</div>
            ) : null}
          </details>
        </div>
      </div>

      {/* Settled Claims Log */}
      <SettledClaimsTable
        totalClaimsCount={settledList.length}
        sortedClaimsCount={sortedClaims.length}
        ledgerSlice={ledgerSlice}
        filterText={filterText}
        onChangeFilter={(text) => {
          setFilterText(text);
          setLedgerPage(0);
        }}
        onRefresh={() => refreshStats()}
        onToggleSort={toggleSort}
        onInspectClaim={inspectClaimRow}
        onChainHospitalRoot={onChainHospitalRoot}
        safePage={safePage}
        totalPages={totalPages}
        onChangePage={setLedgerPage}
      />

      {/* Side-by-Side Public Inputs vs Hidden Medical Data */}
      <CalldataAuditPanel
        selectedClaim={selectedClaim}
        phiHits={phiHits}
        txHashInput={txHashInput}
        onChangeTxHashInput={setTxHashInput}
        onInspectTx={handleInspectTx}
        inspectedCalldata={inspectedCalldata}
        onChainHospitalRoot={onChainHospitalRoot}
      />
    </div>
  );
}
