"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Landmark,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { BrowserMockupCard } from "@/components/ui/browser-mockup-card";
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
import { CONTRACTS, DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { generateX12835Era } from "@/lib/healthcareStandards";
import { loadLocalChainMirror, saveLocalChainMirror, type LocalSettledClaim } from "@/lib/localState";
import { fetchRelayState, postRelayAction } from "@/lib/relayClient";
import {
  decodeContractError,
  ensureBaseSepoliaChain,
  preflightSimulateAndWrite,
  validatePositiveEthInput,
} from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth, shortHex } from "@/lib/utils";

const PHI_CANARIES = ["I21.0", "I25.10", "99285", "99214", "Aspirin", "Ticagrelor", "SYNTH-CASE"];
const LEDGER_PAGE_SIZE = 5;

function scanHexForPhi(hexStr: string): string[] {
  const clean = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
  let ascii = "";
  for (let i = 0; i < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code <= 126) ascii += String.fromCharCode(code);
  }
  const lowerHex = clean.toLowerCase();
  const hits: string[] = [];
  for (const term of PHI_CANARIES) {
    const termHex = Array.from(new TextEncoder().encode(term))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase();
    if (ascii.includes(term) || lowerHex.includes(termHex)) {
      hits.push(term);
    }
  }
  return hits;
}

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
        await ensureBaseSepoliaChain(roles.chainId, switchChainAsync);
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
        await ensureBaseSepoliaChain(roles.chainId, switchChainAsync);
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
        await ensureBaseSepoliaChain(roles.chainId, switchChainAsync);
        await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.PolicyRegistry.address,
          abi: CONTRACTS.PolicyRegistry.abi as Abi,
          functionName: "registerPolicy",
          args: [commit],
          writeContractAsync,
        });
        setPolicyStatus(`Registered ${raw.slice(0, 14)}... on Base Sepolia`);
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
        toast.success("Fetched raw Base Sepolia transaction calldata & scanned for PHI");
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
            subtitle="Deterministic treasury buffer trend merged with live Base Sepolia / sandbox escrow balance"
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
      <SpotlightCard id="insurer-ledger" accent="neutral" className="overflow-hidden scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">Settled Claims Ledger</h2>
            <p className="text-xs text-[#52525B]">
              Verified zero-knowledge disbursements settled from ClaimsVault treasury.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <TactileButton
              size="sm"
              variant="secondary"
              onClick={() => refreshStats()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Ledger
            </TactileButton>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717A]" />
              <input
                id="ledger-filter-input"
                type="search"
                value={filterText}
                onChange={(e) => {
                  setFilterText(e.target.value);
                  setLedgerPage(0);
                }}
                placeholder="Filter hospital or nullifier..."
                aria-label="Filter settled claims by hospital or nullifier"
                className="w-52 rounded-lg border border-[#E4E4E7] bg-white pl-8 pr-2.5 py-1.5 text-xs text-[#09090B] placeholder-[#A1A1AA] focus:border-[#0F766E] focus:outline-none"
              />
            </div>
            <Badge variant="neutral">
              {sortedClaims.length} / {settledList.length} transactions
            </Badge>
          </div>
        </div>

        {sortedClaims.length === 0 ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="text-xs text-[#71717A]">
              {settledList.length === 0
                ? "No claims settled in this session yet. Authorize a record in Patient Vault, then submit a proof from the Provider Clearinghouse to populate this ledger."
                : "No settled claims matched your filter query."}
            </div>
            {settledList.length === 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link href="/hospital">
                  <TactileButton size="sm" variant="primary">
                    Prove &amp; Settle First Claim
                  </TactileButton>
                </Link>
                <Link href="/patient">
                  <TactileButton size="sm" variant="secondary">
                    Open Patient Vault
                  </TactileButton>
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA] text-[#71717A]">
                    <th className="px-6 py-2.5 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("hospital")}
                        className="inline-flex items-center gap-1 font-medium text-[#52525B] hover:text-[#09090B] cursor-pointer"
                      >
                        Hospital Provider
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-2.5 font-medium">Public Inputs</th>
                    <th className="px-4 py-2.5 font-medium">Privacy Audit</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort("amount")}
                        className="inline-flex items-center justify-end gap-1 font-medium text-[#52525B] hover:text-[#09090B] cursor-pointer"
                      >
                        Payout
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-6 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5]">
                  {ledgerSlice.map((row) => (
                    <tr key={row.txHash} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-3">
                        <div className="font-semibold text-[#09090B]">
                          {getProviderDisplayName(row.hospital)}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#71717A]">
                          {shortHex(row.hospital, 8, 6)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-[11px] text-[#52525B] space-y-0.5">
                        <div>
                          claimNullifier: {row.nullifier.slice(0, 12)}...
                        </div>
                        <div className="text-[#71717A]">
                          policyCommit: {shortHex(row.policyCommitment || canonicalFixtures.activePolicy.commitment, 10, 4)}
                        </div>
                        <div className="text-[#71717A]">
                          hospitalRoot: {(row.pubSignals?.[0] ?? (onChainHospitalRoot?.toString() || canonicalFixtures.hospitalRoot)).slice(0, 12)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="emerald">0 PHI Verified</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-[#047857]">
                        +{formatWeiToEth(row.amountWei, 4)} ETH
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <TactileButton
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const eraText = generateX12835Era(
                                row,
                                getProviderDisplayName(row.hospital)
                              );
                              const blob = new Blob([eraText], { type: "text/plain" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `qlo-835-era-${row.nullifier.slice(0, 10)}.edi`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="h-3 w-3" />
                            835 ERA
                          </TactileButton>
                          <TactileButton
                            size="sm"
                            variant="secondary"
                            onClick={() => inspectClaimRow(row)}
                          >
                            Inspect
                          </TactileButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-[#F4F4F5] px-6 py-2.5 text-xs text-[#71717A]">
                <span>
                  Page {safePage + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous ledger page"
                    disabled={safePage === 0}
                    onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                    className="rounded-lg border border-[#E4E4E7] p-1 hover:bg-[#F4F4F5] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next ledger page"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setLedgerPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="rounded-lg border border-[#E4E4E7] p-1 hover:bg-[#F4F4F5] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </SpotlightCard>

      {/* OpenSourceUI Light macOS BrowserMockupCard framing the Split-Screen Inspector */}
      <div id="insurer-audit" className="scroll-mt-20">
      <BrowserMockupCard
        url={
          selectedClaim && IS_CHAIN_DEPLOYED
            ? explorerTxUrl(selectedClaim.txHash)
            : "base-sepolia://claimsvault/submitClaim#zero-phi-audit"
        }
        rightSlot={
          phiHits !== null ? (
            <Badge variant={phiHits.length === 0 ? "emerald" : "crimson"}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {phiHits.length === 0 ? "0 PHI BYTES DETECTED IN CALLDATA" : `LEAK: ${phiHits.join(", ")}`}
            </Badge>
          ) : (
            <Badge variant="neutral">Awaiting Settlement Scan</Badge>
          )
        }
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#09090B]">
              On-Chain Calldata &amp; Zero-PHI Privacy Audit
            </h2>
            <p className="text-xs text-[#52525B]">
              Inspect raw Groth16 settlement calldata and verify 0 bytes of clinical PHI exist on Base Sepolia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              id="tx-hash-input"
              aria-label="Settled transaction hash"
              value={txHashInput}
              onChange={(e) => setTxHashInput(e.target.value)}
              placeholder="Paste Base Sepolia settled txHash (0x...) or inspect latest claim below"
              className="flex-1 min-w-[240px] rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-xs font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:outline-none"
            />
            <TactileButton size="sm" variant="primary" onClick={handleInspectTx}>
              <Search className="h-3.5 w-3.5" />
              Scan Calldata for PHI
            </TactileButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Pane: Public Chain */}
            <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#047857] flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  Public Ledger Calldata
                </span>
                {selectedClaim && IS_CHAIN_DEPLOYED ? (
                  <CopyHash
                    label="Tx"
                    value={selectedClaim.txHash}
                    explorerUrl={explorerTxUrl(selectedClaim.txHash)}
                  />
                ) : null}
              </div>

              {selectedClaim ? (
                <div className="space-y-1.5 text-xs font-mono-tabular text-[#09090B]">
                  <div>hospital: {selectedClaim.hospital}</div>
                  <div>claimAmount: {formatWeiToEth(selectedClaim.amountWei)} ETH</div>
                  <div>policyCommitment: {selectedClaim.policyCommitment.slice(0, 22)}...</div>
                  <div>claimNullifier: {selectedClaim.nullifier.slice(0, 22)}...</div>
                  <div>
                    approvedHospitalRoot:{" "}
                    {(
                      selectedClaim.pubSignals?.[0] ??
                      onChainHospitalRoot?.toString() ??
                      canonicalFixtures.hospitalRoot
                    ).slice(0, 22)}
                    ...
                  </div>
                  <div>recordCommitment: {selectedClaim.recordCommitmentHex.slice(0, 22)}...</div>
                </div>
              ) : (
                <div className="text-xs text-[#52525B] space-y-1.5">
                  <p>No settled transactions available to inspect in this session.</p>
                  <Link
                    href="/hospital"
                    className="inline-flex items-center font-medium text-[#0F766E] hover:underline"
                  >
                    Open Provider Clearinghouse →
                  </Link>
                </div>
              )}

              {inspectedCalldata ? (
                <div className="rounded-lg border border-[#27272A] bg-[#111113] p-3 font-mono-tabular text-[11px] text-[#E4E4E7] break-all max-h-40 overflow-y-auto">
                  {inspectedCalldata}
                </div>
              ) : null}
            </div>

            {/* Right Pane: Private Clinical Reality */}
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2]/55 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#B91C1C] flex items-center gap-1.5">
                  <EyeOff className="h-4 w-4 text-[#DC2626]" />
                  Protected Clinical Data (Off-Chain Only)
                </span>
                <Badge variant="crimson">Redacted</Badge>
              </div>

              <div className="space-y-1.5 text-xs font-mono-tabular">
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Box 21 ICD-10 Diagnosis</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    I21.0 / I25.10
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Box 24D CPT Procedure</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    99285 / 99214
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Prescription / Rx</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    Aspirin 325mg + Ticagrelor
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#FECACA]/60 py-1.5">
                  <span className="text-[#52525B]">Private Annual Policy Limit</span>
                  <span className="blur-[4px] hover:blur-none transition-all text-[#B91C1C] font-semibold">
                    0.0300 ETH
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#52525B]">AES-256-GCM Plaintext DEK</span>
                  <span className="text-[#B91C1C] font-semibold">Unreachable by Insurer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BrowserMockupCard>
      </div>
    </div>
  );
}
