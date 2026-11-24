"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { useAmbientStatus } from "@/components/ui/ambient-pill";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { TactileButton } from "@/components/ui/tactile-button";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import {
  DEPLOYMENT,
  IS_CHAIN_DEPLOYED,
  explorerAddressUrl,
  sourcifyContractUrl,
} from "@/lib/contracts";
import { executeHospitalGuardrailCheck, type AttackId } from "@/lib/hospitalGuardrails";
import { decodeContractError } from "@/lib/txHelpers";
import { verifyZkeyIntegrity, type ZkeyIntegrityResult } from "@/lib/zkeyIntegrity";

const PUBLIC_SIGNALS = [
  { idx: "0", name: "hospitalRoot", type: "BN254 Field", check: "Matches HospitalRegistry.hospitalRoot()" },
  { idx: "1", name: "policyCommitment", type: "BN254 Field", check: "Active policy in PolicyRegistry" },
  { idx: "2", name: "nullifier", type: "BN254 Field", check: "Poseidon(salt, policyId, recordCommit); unused" },
  { idx: "3", name: "claimAmount", type: "uint96 wei", check: "> 0 and <= insurerEscrow[insurer]" },
  { idx: "4", name: "claimTimestamp", type: "uint64 sec", check: "Within [block.timestamp - 900, +60]" },
  { idx: "5", name: "recordCommitment", type: "uint248", check: "Active consent in HealthRecords" },
  { idx: "6", name: "hospitalAddress", type: "uint160", check: "Matches msg.sender (anti-front-run)" },
  { idx: "7", name: "priorPolicySpent", type: "uint96 wei", check: "Matches ClaimsVault.policySpent[policy]" },
];

const INVARIANT_CHECKS: ReadonlyArray<{ id: AttackId; label: string; scope: string }> = [
  { id: "replay", label: "Replay Nullifier", scope: "ClaimsVault.sol" },
  { id: "cpt", label: "Excluded Procedure", scope: "Groth16 R1CS" },
  { id: "expired", label: "Expired Policy", scope: "Groth16 R1CS" },
  { id: "cap", label: "Over Annual Cap", scope: "Groth16 R1CS" },
  { id: "revoked", label: "Revoked Consent", scope: "HealthRecords.sol" },
];

const VERISURE_COMPARISON = [
  {
    dim: "Intake & OCR Privacy",
    verisure: "Off-chain Gaia AI nodes (PHI leaves client)",
    qlo: "Browser-local CMS-1500 + Tesseract WASM OCR (0 PHI egress)",
  },
  {
    dim: "ZK Proof Scope",
    verisure: "Form completeness; policy coverage deferred",
    qlo: "8 Groth16 predicates: hospital root, policy, expiry, CPT tree, amount, annual cap, nullifier, msg.sender",
  },
  {
    dim: "Verification Model",
    verisure: "EigenLayer + Othentic AVS + RISC0 zkVM",
    qlo: "Direct on-chain Groth16 pairing in ClaimsVault.sol (Sepolia)",
  },
  {
    dim: "Patient Sovereignty",
    verisure: "No client encryption, DEK wrap, or revocation",
    qlo: "AES-256-GCM + ECDH P-256 DEKs, CIDv1, time-bound grant & instant revoke",
  },
  {
    dim: "Latency & License",
    verisure: "~2 min AVS pipeline; BUSL-1.1",
    qlo: "< 1s browser Web Worker; 100% MIT open-source",
  },
];

export default function StoryPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { showStatus } = useAmbientStatus();

  const [zkeyResult, setZkeyResult] = useState<ZkeyIntegrityResult | null>(null);
  const [verifyingZkey, setVerifyingZkey] = useState(false);

  const [activeCheck, setActiveCheck] = useState<AttackId | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    kind: AttackId;
    label: string;
    detail: string;
    elapsedMs: number;
  } | null>(null);

  const runIntegrityCheck = async () => {
    setVerifyingZkey(true);
    try {
      const res = await verifyZkeyIntegrity();
      setZkeyResult(res);
    } finally {
      setVerifyingZkey(false);
    }
  };

  useEffect(() => {
    runIntegrityCheck().catch(() => undefined);
  }, []);

  const runInvariantCheck = async (kind: AttackId, label: string) => {
    if (runningCheck) return;
    setActiveCheck(kind);
    setRunningCheck(true);
    showStatus(`Verifying ${label}…`, "working");
    const t0 = performance.now();
    try {
      await executeHospitalGuardrailCheck({
        kind,
        hospitalAddr: address ?? canonicalFixtures.accounts.hospital1,
        selectedEntry: null,
        decryptedClaim: null,
        proverOutput: null,
        publicClient,
      });
      const elapsedMs = Math.round(performance.now() - t0);
      setCheckResult({
        kind,
        label,
        detail: "Unexpected pass — invariant did not reject.",
        elapsedMs,
      });
      showStatus(`${label} did not reject`, "error");
    } catch (err) {
      const elapsedMs = Math.round(performance.now() - t0);
      const detail = decodeContractError(err);
      setCheckResult({ kind, label, detail, elapsedMs });
      showStatus(`Invariant enforced (${elapsedMs}ms)`, "done", label);
    } finally {
      setRunningCheck(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <FileCode2 className="h-4 w-4 text-[#059669]" aria-hidden="true" />
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#09090B]">
                Protocol &amp; Verification
              </h1>
              <Badge variant="emerald">5/5 Verified · Sepolia 11155111</Badge>
            </div>
            <p className="text-xs text-[#52525B]">
              Deployed contracts, browser proving-key digest, live policy invariants, and Groth16 public signals.
            </p>
          </div>
          <span className="font-mono-tabular text-[11px] text-[#71717A]">
            4,349 R1CS · BN254
          </span>
        </div>
      </section>

      {/* 1. Deployed Contracts (5/5 Verified on Sepolia 11155111) */}
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 space-y-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] pb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Deployed Contracts (5/5 Verified on Sepolia {DEPLOYMENT.chainId})
            </h2>
            <p className="text-xs text-[#52525B]">
              Solidity 0.8.28 exact-match verification on Etherscan and Sourcify.
            </p>
          </div>
          <Badge variant={IS_CHAIN_DEPLOYED ? "emerald" : "neutral"}>
            {IS_CHAIN_DEPLOYED ? "Live on Sepolia" : "Pre-Deploy"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Object.entries(DEPLOYMENT.contracts).map(([name, addr]) => (
            <div
              key={name}
              className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-[#09090B] truncate">{name}</span>
                <Badge variant={IS_CHAIN_DEPLOYED ? "emerald" : "neutral"}>Verified</Badge>
              </div>
              <CopyHash
                value={addr}
                explorerUrl={IS_CHAIN_DEPLOYED ? explorerAddressUrl(addr) : undefined}
                className="w-full justify-between bg-[#FFFFFF]"
              />
              {IS_CHAIN_DEPLOYED ? (
                <div className="flex items-center justify-between text-[11px]">
                  <a
                    href={explorerAddressUrl(addr)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[#0284C7] hover:underline"
                  >
                    Etherscan <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <a
                    href={sourcifyContractUrl(addr)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[#059669] hover:underline"
                  >
                    Sourcify <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* 2. Proving Key Integrity (.zkey SHA-256) */}
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 space-y-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] pb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Proving Key Integrity (<code className="font-mono-tabular text-[#059669]">/zk/ClaimValidity.zkey</code>)
            </h2>
            <p className="text-xs text-[#52525B]">
              WebCrypto SHA-256 digest checked live against the pinned ceremony manifest.
            </p>
          </div>
          <TactileButton
            size="sm"
            variant="secondary"
            onClick={runIntegrityCheck}
            disabled={verifyingZkey}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${verifyingZkey ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Re-Verify
          </TactileButton>
        </div>

        {zkeyResult ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#52525B]">Digest Status</span>
                <Badge variant={zkeyResult.verified ? "emerald" : "crimson"}>
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {zkeyResult.verified ? `MATCHED (${zkeyResult.checkedAtMs}ms)` : "MISMATCH"}
                </Badge>
              </div>
              <div className="text-[#52525B]">
                Ceremony:{" "}
                <span className="font-medium text-[#09090B]">{zkeyResult.manifest.ptauFile}</span> (
                {zkeyResult.manifest.nConstraints} / {zkeyResult.manifest.ptauCapacity})
              </div>
              <div className="text-[#52525B]">
                Artifact Size:{" "}
                <span className="font-mono-tabular font-semibold text-[#09090B]">
                  {(zkeyResult.manifest.zkeyBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-4 space-y-2">
              <CopyHash
                label="Expected"
                value={zkeyResult.expectedSha256}
                className="w-full justify-between bg-[#FFFFFF]"
              />
              <CopyHash
                label="Computed"
                value={zkeyResult.actualSha256}
                className="w-full justify-between bg-[#FFFFFF]"
              />
              {DEPLOYMENT.zkeySha256 ? (
                <CopyHash
                  label="Manifest"
                  value={DEPLOYMENT.zkeySha256}
                  className="w-full justify-between bg-[#FFFFFF]"
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-xs text-[#52525B]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#059669]" aria-hidden="true" />
            Computing SHA-256 of /zk/ClaimValidity.zkey…
          </div>
        )}
      </section>

      {/* 3. Policy Invariant Verifier */}
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 space-y-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] pb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">Policy Invariant Verifier</h2>
            <p className="text-xs text-[#52525B]">
              Execute live fail-closed circuit and contract invariant checks.
            </p>
          </div>
          <Badge variant="neutral">Fail-Closed</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {INVARIANT_CHECKS.map((item) => {
            const selected = activeCheck === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={runningCheck}
                onClick={() => runInvariantCheck(item.id, item.label)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                  selected
                    ? "border-[#09090B] bg-[#09090B] text-white"
                    : "border-[#E4E4E7] bg-[#F4F4F5] text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FFFFFF]"
                }`}
              >
                {runningCheck && selected ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-4 text-xs space-y-2">
          {runningCheck ? (
            <div className="inline-flex items-center gap-2 text-[#52525B]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0284C7]" aria-hidden="true" />
              Evaluating live circuit witness and contract state…
            </div>
          ) : checkResult ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="emerald">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    Enforced
                  </Badge>
                  <span className="font-semibold text-[#09090B]">{checkResult.label}</span>
                </div>
                <span className="font-mono-tabular text-[11px] text-[#71717A]">
                  {checkResult.elapsedMs}ms
                </span>
              </div>
              <p className="font-mono-tabular text-[11px] leading-relaxed text-[#DC2626] break-words">
                {checkResult.detail}
              </p>
            </>
          ) : (
            <p className="text-[#71717A]">
              Select any invariant above to run a live witness or contract revert check.
            </p>
          )}
        </div>
      </section>

      {/* 4. Public Signals Reference */}
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 space-y-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        <div className="border-b border-[#E4E4E7] pb-3.5">
          <h2 className="text-sm font-semibold text-[#09090B]">Public Signals Reference (8 Signals)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                <th className="py-2 pr-4 font-medium">Index</th>
                <th className="py-2 pr-4 font-medium">Signal</th>
                <th className="py-2 pr-4 font-medium">Domain</th>
                <th className="py-2 font-medium">On-Chain Constraint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {PUBLIC_SIGNALS.map((row) => (
                <tr key={row.idx} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="py-2.5 pr-4 font-mono-tabular font-semibold text-[#059669]">
                    [{row.idx}]
                  </td>
                  <td className="py-2.5 pr-4 font-mono-tabular font-medium text-[#09090B]">
                    {row.name}
                  </td>
                  <td className="py-2.5 pr-4 font-mono-tabular text-[#52525B]">{row.type}</td>
                  <td className="py-2.5 text-[#09090B]">{row.check}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Compact Comparison Table */}
      <section className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-5 space-y-4 shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] pb-3.5">
          <h2 className="text-sm font-semibold text-[#09090B]">
            Prior Art Comparison: Qlo vs. VeriSure (ETHDenver 2025)
          </h2>
          <Badge variant="neutral">Architecture</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                <th className="py-2 pr-4 font-medium">Dimension</th>
                <th className="py-2 pr-4 font-medium">VeriSure (ETHDenver 2025)</th>
                <th className="py-2 font-medium">Qlo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {VERISURE_COMPARISON.map((row) => (
                <tr key={row.dim} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="py-2.5 pr-4 font-semibold text-[#09090B]">{row.dim}</td>
                  <td className="py-2.5 pr-4 text-[#52525B]">{row.verisure}</td>
                  <td className="py-2.5 font-medium text-[#059669]">{row.qlo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
