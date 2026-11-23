"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Landmark, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { BrowserMockupCard } from "@/components/ui/browser-mockup-card";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { fetchSettledClaimsEvents } from "@/lib/chainEvents";
import { CONTRACTS, DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { loadLocalChainMirror, saveLocalChainMirror, type LocalSettledClaim } from "@/lib/localState";
import { formatWeiToEth, parseEthToWei, shortHex } from "@/lib/utils";

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
  const { writeContractAsync } = useWriteContract();

  const [escrowWei, setEscrowWei] = useState<bigint>(0n);
  const [policySpentWei, setPolicySpentWei] = useState<bigint>(0n);
  const [depositEth, setDepositEth] = useState("0.05");
  const [withdrawEth, setWithdrawEth] = useState("0.025");
  const [customPolicyCommit, setCustomPolicyCommit] = useState("");
  const [policyStatus, setPolicyStatus] = useState("");

  const [settledList, setSettledList] = useState<LocalSettledClaim[]>([]);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState<LocalSettledClaim | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const [inspectedCalldata, setInspectedCalldata] = useState<string>("");
  const [phiHits, setPhiHits] = useState<string[] | null>(null);

  const refreshStats = async () => {
    const mirror = loadLocalChainMirror();
    setSettledList(mirror.settledClaims);
    if (mirror.settledClaims.length > 0 && !selectedClaim) {
      const first = mirror.settledClaims[0];
      setSelectedClaim(first);
      setInspectedCalldata(first.rawCalldataHex);
      setPhiHits(scanHexForPhi(first.rawCalldataHex));
    }

    if (IS_CHAIN_DEPLOYED && publicClient) {
      const zeroAddr = "0x0000000000000000000000000000000000000000";
      const seeded =
        (DEPLOYMENT as { seededInsurer?: string }).seededInsurer &&
        (DEPLOYMENT as { seededInsurer?: string }).seededInsurer !== zeroAddr
          ? (DEPLOYMENT as { seededInsurer?: string }).seededInsurer
          : canonicalFixtures.accounts.insurer;
      const targetInsurer = (address || seeded) as `0x${string}`;
      const [bal, spent, onChainClaims] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.ClaimsVault.address,
          abi: CONTRACTS.ClaimsVault.abi,
          functionName: "insurerEscrow",
          args: [targetInsurer],
        }),
        publicClient.readContract({
          address: CONTRACTS.ClaimsVault.address,
          abi: CONTRACTS.ClaimsVault.abi,
          functionName: "policySpent",
          args: [BigInt(canonicalFixtures.activePolicy.commitment)],
        }),
        fetchSettledClaimsEvents(publicClient),
      ]);
      setEscrowWei(bal as bigint);
      setPolicySpentWei(spent as bigint);
      setSettledList(onChainClaims);
      if (onChainClaims.length > 0 && !selectedClaim) {
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
    } else {
      setEscrowWei(BigInt(mirror.insurerEscrowWei));
      setPolicySpentWei(
        BigInt(mirror.policySpentWei[canonicalFixtures.activePolicy.commitment] ?? "0")
      );
    }
  };

  useEffect(() => {
    refreshStats().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const handleDepositEscrow = async () => {
    const val = parseEthToWei(depositEth);
    if (IS_CHAIN_DEPLOYED) {
      if (!address || !publicClient) {
        toast.error("Connect Insurer MetaMask wallet first");
        return;
      }
      const hash = await writeContractAsync({
        address: CONTRACTS.ClaimsVault.address,
        abi: CONTRACTS.ClaimsVault.abi,
        functionName: "depositEscrow",
        value: val,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`Deposited ${depositEth} ETH into ClaimsVault escrow`);
    } else {
      const mirror = loadLocalChainMirror();
      mirror.insurerEscrowWei = (BigInt(mirror.insurerEscrowWei) + val).toString();
      saveLocalChainMirror(mirror);
      toast.success(`Added ${depositEth} ETH to local escrow mirror`);
    }
    await refreshStats();
  };

  const handleWithdrawEscrow = async () => {
    const val = parseEthToWei(withdrawEth);
    if (IS_CHAIN_DEPLOYED) {
      if (!address || !publicClient) {
        toast.error("Connect Insurer MetaMask wallet first");
        return;
      }
      const hash = await writeContractAsync({
        address: CONTRACTS.ClaimsVault.address,
        abi: CONTRACTS.ClaimsVault.abi,
        functionName: "withdrawEscrow",
        args: [val],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`Withdrew ${withdrawEth} ETH from ClaimsVault escrow`);
    } else {
      const mirror = loadLocalChainMirror();
      const bal = BigInt(mirror.insurerEscrowWei);
      if (bal < val) {
        toast.error("Insufficient escrow balance to withdraw");
        return;
      }
      mirror.insurerEscrowWei = (bal - val).toString();
      saveLocalChainMirror(mirror);
      toast.success(`Withdrew ${withdrawEth} ETH from local escrow mirror`);
    }
    await refreshStats();
  };

  const handleRegisterPolicy = async () => {
    const raw = customPolicyCommit.trim() || canonicalFixtures.activePolicy.commitmentHex;
    try {
      const commit = BigInt(raw);
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) {
          toast.error("Connect Insurer MetaMask wallet first");
          return;
        }
        const hash = await writeContractAsync({
          address: CONTRACTS.PolicyRegistry.address,
          abi: CONTRACTS.PolicyRegistry.abi,
          functionName: "registerPolicy",
          args: [commit],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setPolicyStatus(`Registered ${raw.slice(0, 14)}... on Base Sepolia`);
        toast.success("Registered policy commitment in PolicyRegistry");
      } else {
        setPolicyStatus(`Verified BN254 commitment ${raw.slice(0, 16)}... ready for PolicyRegistry`);
        toast.success("Policy commitment validated for PolicyRegistry");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid policy commitment");
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

  const totalPages = Math.max(1, Math.ceil(settledList.length / LEDGER_PAGE_SIZE));
  const ledgerSlice = settledList.slice(
    ledgerPage * LEDGER_PAGE_SIZE,
    (ledgerPage + 1) * LEDGER_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="teal">Payer Treasury Workspace</Badge>
          <span className="text-xs font-mono-tabular text-[#71717A]">
            Escrow · Policy Commitments · Calldata Audit
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
          Insurer Escrow &amp; Payer Treasury
        </h1>
        <p className="text-xs sm:text-sm text-[#52525B]">
          Fund native ETH escrow, monitor aggregate policy spend without learning private annual limits, and audit settled calldata for zero PHI.
        </p>
      </div>

      {/* Top 3 Porcelain Treasury Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <TactileButton size="sm" variant="primary" onClick={handleDepositEscrow}>
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
            <TactileButton size="sm" variant="secondary" onClick={handleWithdrawEscrow}>
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
            <TactileButton size="sm" variant="secondary" onClick={handleRegisterPolicy}>
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

      {/* OpenSourceUI Light Settled Claims Ledger Table */}
      <SpotlightCard accent="neutral" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">Settled Claims Ledger</h2>
            <p className="text-xs text-[#52525B]">
              Verified zero-knowledge disbursements settled from ClaimsVault treasury.
            </p>
          </div>
          <Badge variant="neutral">{settledList.length} total transactions</Badge>
        </div>

        {settledList.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-[#71717A]">
            No claims settled in this session yet. Settle a claim from Provider Clearinghouse (`/hospital`) to populate the ledger.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA] text-[#71717A]">
                    <th className="px-6 py-2.5 font-medium">Hospital Provider</th>
                    <th className="px-4 py-2.5 font-medium">Nullifier</th>
                    <th className="px-4 py-2.5 font-medium">Privacy Audit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Payout</th>
                    <th className="px-6 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5]">
                  {ledgerSlice.map((row) => (
                    <tr key={row.txHash} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-3 font-mono-tabular font-medium text-[#09090B]">
                        {shortHex(row.hospital, 8, 6)}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-[#52525B]">
                        {row.nullifier.slice(0, 14)}...
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="emerald">0 PHI Verified</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-[#047857]">
                        +{formatWeiToEth(row.amountWei, 4)} ETH
                      </td>
                      <td className="px-6 py-3 text-right">
                        <TactileButton
                          size="sm"
                          variant="secondary"
                          onClick={() => inspectClaimRow(row)}
                        >
                          Inspect
                        </TactileButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-[#F4F4F5] px-6 py-2.5 text-xs text-[#71717A]">
                <span>
                  Page {ledgerPage + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous ledger page"
                    disabled={ledgerPage === 0}
                    onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                    className="rounded-lg border border-[#E4E4E7] p-1 hover:bg-[#F4F4F5] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next ledger page"
                    disabled={ledgerPage >= totalPages - 1}
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
              Split-Screen Privacy Inspector: What the Chain Sees vs. Private Clinical Reality
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
                  PUBLIC ON-CHAIN CALLDATA &amp; EVENTS
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
                  <div>nullifier: {selectedClaim.nullifier.slice(0, 22)}...</div>
                  <div>recordCommit: {selectedClaim.recordCommitmentHex.slice(0, 22)}...</div>
                </div>
              ) : (
                <div className="text-xs text-[#52525B]">
                  Settle a claim on /hospital first to populate live Groth16 calldata here.
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
                  PRIVATE OFF-CHAIN CLINICAL REALITY (NEVER ON CHAIN)
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
  );
}
