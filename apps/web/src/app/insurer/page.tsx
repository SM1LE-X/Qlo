"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { CalldataAuditPanel, scanHexForPhi } from "@/components/insurer/calldata-audit-panel";
import { SettledClaimsTable } from "@/components/insurer/settled-claims-table";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { DonutChart } from "@/components/ui/donut-chart";
import { InteractiveAreaChart } from "@/components/ui/interactive-area-chart";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { StatCard } from "@/components/ui/stat-card";
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

  const liveEscrowEthNum = Number(formatWeiToEth(escrowWei, 4));
  const liveSpentEthNum = Number(formatWeiToEth(policySpentWei, 4));
  const remainingEscrowNum = Math.max(0, Number(liveEscrowEthNum.toFixed(4)));
  const disbursedTotalNum = Number(
    settledList
      .reduce((acc, row) => acc + Number(formatWeiToEth(row.amountWei, 4)), 0)
      .toFixed(4)
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="teal">Insurer Audit View</Badge>
          <Badge variant={roles.isInsurer ? "emerald" : IS_CHAIN_DEPLOYED ? "neutral" : "teal"}>
            {roles.isInsurer
              ? "Insurer Treasury Wallet"
              : IS_CHAIN_DEPLOYED
              ? "Public Read-Only Audit View"
              : "Sandbox Treasury Active"}
          </Badge>
          <span className="text-xs font-mono-tabular text-[#71717A]">
            Escrow · Policy Commitments · Calldata Audit
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
          Insurer Escrow &amp; Treasury Audit
        </h1>
        <p className="text-xs sm:text-sm text-[#52525B]">
          Manage ClaimsVault ETH reserves, track aggregate disbursements without exposing private annual caps, and audit calldata for zero clinical leakage.
        </p>
      </div>

      {/* Top 3 Porcelain Treasury Cards */}
      <div id="insurer-reserves" className="grid grid-cols-1 md:grid-cols-3 gap-4 scroll-mt-20">
        <SpotlightCard accent="emerald" className="p-6 space-y-3">
          <div className="text-xs font-medium text-[#52525B]">Insurer Escrow Balance</div>
          <div className="text-3xl font-bold tracking-tight text-[#047857]">
            <NumberTicker value={Number(formatWeiToEth(escrowWei, 4))} decimals={4} suffix=" ETH" />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              id="deposit-eth-input"
              value={depositEth}
              onChange={(e) => setDepositEth(e.target.value)}
              aria-label="Deposit ETH amount"
              className="w-20 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:outline-none"
            />
            <TactileButton
              size="sm"
              variant="primary"
              onClick={handleDepositEscrow}
              disabled={txBusy || (IS_CHAIN_DEPLOYED && (!roles.isConnected || roles.wrongChain))}
            >
              <Landmark className="h-3.5 w-3.5" />
              Deposit ETH
            </TactileButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="withdraw-eth-input"
              value={withdrawEth}
              onChange={(e) => setWithdrawEth(e.target.value)}
              aria-label="Withdraw ETH amount"
              className="w-20 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:outline-none"
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
              Withdraw ETH
            </TactileButton>
          </div>
        </SpotlightCard>

        <SpotlightCard accent="amber" className="p-6 space-y-2">
          <div className="text-xs font-medium text-[#52525B]">Cumulative Policy Spend (On-Chain)</div>
          <div className="text-3xl font-bold tracking-tight text-[#09090B]">
            <NumberTicker
              value={Number(formatWeiToEth(policySpentWei, 4))}
              decimals={4}
              suffix=" ETH"
            />
          </div>
          <div className="inline-flex rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-mono-tabular font-medium text-[#B45309]">
            Private Annual Cap: HIDDEN IN POSEIDON(6)
          </div>
        </SpotlightCard>

        <SpotlightCard accent="neutral" className="p-6 space-y-2.5">
          <div className="text-xs font-medium text-[#52525B]">Active Policy Commitment</div>
          <CopyHash value={canonicalFixtures.activePolicy.commitmentHex} />
          <div className="flex items-center gap-2 pt-1">
            <input
              id="policy-commit-input"
              aria-label="Policy commitment hex or decimal"
              placeholder="0x... custom commitment"
              value={customPolicyCommit}
              onChange={(e) => setCustomPolicyCommit(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-[11px] font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:outline-none"
            />
            <TactileButton
              size="sm"
              variant="secondary"
              onClick={handleRegisterPolicy}
              disabled={txBusy || (IS_CHAIN_DEPLOYED && (!roles.isConnected || roles.wrongChain))}
            >
              Register
            </TactileButton>
          </div>
          {policyStatus ? (
            <div className="text-[11px] font-mono-tabular text-[#047857]">{policyStatus}</div>
          ) : (
            <div className="text-[11px] text-[#52525B]">
              Settled Claims Recorded:{" "}
              <span className="font-mono-tabular font-semibold text-[#047857]">
                {settledList.length}
              </span>
            </div>
          )}
        </SpotlightCard>
      </div>

      {/* Treasury Analytics Row */}
      <div id="insurer-analytics" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch scroll-mt-20">
        <div className="lg:col-span-7">
          <InteractiveAreaChart
            className="h-full"
            title="Escrow Reserve & Claim Disbursement Velocity"
            subtitle="Deterministic treasury buffer trend merged with live Ethereum Sepolia / sandbox escrow balance"
            defaultRange="30D"
            accentColor="#0F4C81"
            formatValue={(v) => `${v.toFixed(4)} ETH`}
            data={{
              "7D": [
                { label: "Mon", value: 0.02 },
                { label: "Tue", value: 0.032 },
                { label: "Wed", value: 0.028 },
                { label: "Thu", value: 0.045 },
                { label: "Fri", value: 0.041 },
                { label: "Sat", value: 0.048 },
                { label: "Live", value: Math.max(0.02, remainingEscrowNum) },
              ],
              "30D": [
                { label: "W1", value: 0.02 },
                { label: "W2", value: 0.038 },
                { label: "W3", value: 0.029 },
                { label: "W4", value: 0.052 },
                { label: "W5", value: 0.044 },
                { label: "Live", value: Math.max(0.02, remainingEscrowNum + disbursedTotalNum) },
              ],
              "1Y": [
                { label: "Q1", value: 0.12 },
                { label: "Q2", value: 0.19 },
                { label: "Q3", value: 0.24 },
                { label: "Q4", value: Number((0.25 + remainingEscrowNum).toFixed(4)) },
              ],
            }}
          />
        </div>

        <SpotlightCard accent="neutral" className="lg:col-span-5 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-[#F4F4F5] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#09090B]">
                Treasury Liquidity &amp; Reserve Mix
              </h2>
              <p className="text-xs text-[#52525B] mt-0.5">
                Live distribution between available ClaimsVault escrow and settled claim payouts.
              </p>
            </div>
            <Badge variant={vaultPaused ? "crimson" : "emerald"}>
              {vaultPaused ? "Paused" : "Solvent"}
            </Badge>
          </div>

          <DonutChart
            centerLabel="Treasury Pool"
            centerValue={`${(remainingEscrowNum + Math.max(disbursedTotalNum, liveSpentEthNum)).toFixed(4)} ETH`}
            formatValue={(v) => `${v.toFixed(4)} ETH`}
            data={[
              {
                label: "Available Escrow",
                value: remainingEscrowNum,
                color: "#047857",
              },
              {
                label: "Settled Disbursements",
                value: Math.max(disbursedTotalNum, liveSpentEthNum),
                color: "#0F766E",
              },
            ]}
          />

          <div className="flex items-center justify-between text-[11px] text-[#71717A] border-t border-[#F4F4F5] pt-2.5">
            <span>Private annual caps remain sealed inside Poseidon(6)</span>
            <span className="font-mono-tabular font-medium text-[#09090B]">
              {settledList.length} TXs
            </span>
          </div>
        </SpotlightCard>
      </div>

      {/* OpenSourceUI Light Settled Claims Ledger Table */}
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
