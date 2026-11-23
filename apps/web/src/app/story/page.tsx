"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import {
  DEPLOYMENT,
  IS_CHAIN_DEPLOYED,
  explorerAddressUrl,
  sourcifyContractUrl,
} from "@/lib/contracts";
import { verifyZkeyIntegrity, type ZkeyIntegrityResult } from "@/lib/zkeyIntegrity";

const PUBLIC_SIGNALS = [
  { idx: "0", name: "hospitalRoot", type: "BN254 Field", check: "Matches HospitalRegistry.hospitalRoot()" },
  { idx: "1", name: "policyCommitment", type: "BN254 Field", check: "Active insurer policy in PolicyRegistry" },
  { idx: "2", name: "nullifier", type: "BN254 Field", check: "Deterministic Poseidon(salt, policyId, recordCommit); unused" },
  { idx: "3", name: "claimAmount", type: "uint96 wei", check: "> 0 and <= insurerEscrow[insurer]" },
  { idx: "4", name: "claimTimestamp", type: "uint64 sec", check: "Within [block.timestamp - 900, block.timestamp + 60]" },
  { idx: "5", name: "recordCommitment", type: "uint248", check: "Active non-revoked consent in HealthRecords" },
  { idx: "6", name: "hospitalAddress", type: "uint160", check: "Matches msg.sender (anti-front-run)" },
  { idx: "7", name: "priorPolicySpent", type: "uint96 wei", check: "Matches ClaimsVault.policySpent[policyCommitment]" },
];

const VERISURE_COMPARISON = [
  {
    dim: "Intake & OCR Privacy",
    verisure: "Next.js + off-chain Gaia AI nodes (PHI leaves client)",
    qlo: "100% browser-local CMS-1500 intake + Tesseract WASM OCR (0 PHI sent to external servers)",
  },
  {
    dim: "What ZK Proves",
    verisure: "Form completeness; policy coverage deferred as future work",
    qlo: "8 real Groth16 predicates: hospital set, policy commitment, expiry, covered CPT Merkle tree, positive amount, cumulative annual cap, deterministic nullifier, anti-front-run sender",
  },
  {
    dim: "Verification Trust Model",
    verisure: "EigenLayer + Othentic AVS operators + RISC0 zkVM",
    qlo: "Trustless L2 verification directly inside ClaimsVault.sol on Base Sepolia",
  },
  {
    dim: "Patient Data Sovereignty",
    verisure: "No client encryption, DEK wrap, or consent revocation",
    qlo: "AES-256-GCM + ECDH P-256 wrapped DEKs, IPFS CIDv1, time-bound grant & instant revoke enforced on-chain",
  },
  {
    dim: "Proving Speed & Cost",
    verisure: "~2 min AVS pipeline; BUSL-1.1 performer",
    qlo: "< 3s in browser Web Worker; $0 cash cost; 100% MIT open-source",
  },
];

export default function StoryPage() {
  const [zkeyResult, setZkeyResult] = useState<ZkeyIntegrityResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const runIntegrityCheck = async () => {
    setVerifying(true);
    try {
      const res = await verifyZkeyIntegrity();
      setZkeyResult(res);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    runIntegrityCheck().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Badge variant="teal">Security Trust Center · Cryptography &amp; Threat Model</Badge>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#09090B]">
          How Qlo Enforces Privacy &amp; Policy Coverage End-to-End
        </h1>
        <p className="text-sm text-[#52525B] max-w-3xl leading-relaxed">
          Every assumption was red-teamed before implementation: arbitrary-nonce nullifiers were eliminated,
          256-bit hashes were safely truncated to 248 bits for BN254, and cumulative annual limits are enforced privately.
        </p>
      </section>

      {/* Live Browser .zkey SHA-256 Verifier */}
      <SpotlightCard accent="emerald" className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Live Browser Artifact Integrity Check (`/zk/ClaimValidity.zkey`)
            </h2>
            <p className="text-xs text-[#52525B]">
              Re-hashes the live Groth16 proving key via WebCrypto SHA-256 and matches it against the pinned ceremony manifest.
            </p>
          </div>
          <TactileButton size="sm" variant="secondary" onClick={runIntegrityCheck} disabled={verifying}>
            <RefreshCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
            Re-Verify SHA-256
          </TactileButton>
        </div>

        {zkeyResult ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#52525B] font-medium">Verification Status</span>
                <Badge variant={zkeyResult.verified ? "emerald" : "crimson"}>
                  <CheckCircle2 className="h-3 w-3" />
                  {zkeyResult.verified ? `MATCHED (${zkeyResult.checkedAtMs}ms)` : "MISMATCH"}
                </Badge>
              </div>
              <div className="text-[#52525B]">
                Phase 1: <span className="text-[#09090B] font-medium">{zkeyResult.manifest.ptauFile}</span> (
                {zkeyResult.manifest.nConstraints} constraints / {zkeyResult.manifest.ptauCapacity} cap)
              </div>
              <div className="text-[#52525B]">
                Proving Key Size:{" "}
                <span className="font-mono-tabular font-semibold text-[#09090B]">
                  {(zkeyResult.manifest.zkeyBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-2">
              <CopyHash label="Expected SHA-256" value={zkeyResult.expectedSha256} />
              <CopyHash label="Computed Browser SHA-256" value={zkeyResult.actualSha256} />
              {DEPLOYMENT.zkeySha256 ? (
                <CopyHash label="Deployment Manifest" value={DEPLOYMENT.zkeySha256} />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#52525B]">Computing SHA-256 of /zk/ClaimValidity.zkey...</div>
        )}
      </SpotlightCard>

      {/* Base Sepolia Contract Registry (cleanly housed in Trust Center) */}
      <SpotlightCard accent="neutral" className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Base Sepolia Contract Registry (Chain ID {DEPLOYMENT.chainId})
            </h2>
            <p className="text-xs text-[#52525B]">
              {IS_CHAIN_DEPLOYED
                ? "Verified open-source Solidity 0.8.28 contracts on Sourcify & Base Sepolia."
                : "Pre-broadcast deployment manifest — verified on Anvil local EVM; ready for Base Sepolia broadcast."}
            </p>
          </div>
          <Badge variant={IS_CHAIN_DEPLOYED ? "emerald" : "neutral"}>
            {IS_CHAIN_DEPLOYED ? "Live On-Chain" : "Pre-Deploy"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(DEPLOYMENT.contracts).map(([name, addr]) => (
            <div
              key={name}
              className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#09090B]">{name}</span>
                <Badge variant={IS_CHAIN_DEPLOYED ? "emerald" : "neutral"}>
                  {IS_CHAIN_DEPLOYED ? "Verified" : "Pending Deploy"}
                </Badge>
              </div>
              <CopyHash
                value={addr}
                explorerUrl={IS_CHAIN_DEPLOYED ? explorerAddressUrl(addr) : undefined}
              />
              {IS_CHAIN_DEPLOYED ? (
                <a
                  href={sourcifyContractUrl(addr)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F766E] hover:underline"
                >
                  Sourcify Match <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </SpotlightCard>

      {/* Frozen 8-Signal ABI */}
      <SpotlightCard accent="neutral" className="p-6 space-y-4">
        <div className="border-b border-[#F4F4F5] pb-3">
          <h2 className="text-sm font-semibold text-[#09090B]">Frozen 8-Public-Signal Circuit ABI</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                <th className="py-2.5 pr-4 font-medium">Index</th>
                <th className="py-2.5 pr-4 font-medium">Signal Name</th>
                <th className="py-2.5 pr-4 font-medium">Domain</th>
                <th className="py-2.5 font-medium">On-Chain Invariant (`ClaimsVault.sol`)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F5]">
              {PUBLIC_SIGNALS.map((row) => (
                <tr key={row.idx} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="py-2.5 pr-4 font-mono-tabular font-semibold text-[#0F766E]">
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
      </SpotlightCard>

      {/* Cryptographic Honesty & STRIDE Boundaries */}
      <SpotlightCard accent="amber" className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#F4F4F5] pb-3">
          <ShieldAlert className="h-4 w-4 text-[#B45309]" />
          <h2 className="text-sm font-semibold text-[#09090B]">
            Cryptographic Honesty &amp; STRIDE Boundaries
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-1.5">
            <div className="font-semibold text-[#B45309]">1. Post-Decryption Analog Hole</div>
            <p className="text-[#52525B]">
              Revoking access deletes the on-chain wrapped DEK and immediately halts future decryption and{" "}
              <code className="text-[#09090B] font-semibold">ClaimsVault</code> settlement. However, no cryptography can erase plaintext if a malicious hospital saved a local copy prior to revocation (mitigated in v2 via hardware TEEs).
            </p>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-1.5">
            <div className="font-semibold text-[#B45309]">2. Groth16 Trusted Setup &amp; Pinning</div>
            <p className="text-[#52525B]">
              Phase 1 builds on the 80+ contributor Ethereum Foundation PSE Perpetual Powers of Tau ceremony, followed by a verifiable Phase 2 contribution whose exact SHA-256 is verified live above.
            </p>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-1.5">
            <div className="font-semibold text-[#047857]">3. Deterministic Nullifier &amp; Anti-Front-Run</div>
            <p className="text-[#52525B]">
              Removing arbitrary nonces prevents infinite vault drains (
              <code className="text-[#09090B] font-semibold">
                nullifier = Poseidon(salt, policyId, recordCommit)
              </code>
              ), while binding <code className="text-[#09090B] font-semibold">msg.sender</code> inside the proof stops mempool payout theft.
            </p>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-1.5">
            <div className="font-semibold text-[#047857]">4. Range-Checked Comparators &amp; Clock Window</div>
            <p className="text-[#52525B]">
              Explicit <code className="text-[#09090B] font-semibold">Num2Bits(64/96)</code> checks prevent BN254 field aliasing bugs in{" "}
              <code className="text-[#09090B] font-semibold">LessThan</code>, and Base Sepolia enforces a 15-minute freshness window against backdated proofs.
            </p>
          </div>
        </div>
      </SpotlightCard>

      {/* Prior Art Comparison (VeriSure ETHDenver 2025) */}
      <SpotlightCard accent="neutral" className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
            <h2 className="text-sm font-semibold text-[#09090B]">
              Prior Art Comparison: Qlo vs. VeriSure (ETHDenver 2025)
            </h2>
          </div>
          <Badge variant="neutral">Architecture Benchmark</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                <th className="py-2.5 pr-4 font-medium">Dimension</th>
                <th className="py-2.5 pr-4 font-medium">VeriSure (ETHDenver 2025)</th>
                <th className="py-2.5 font-medium">Qlo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F5]">
              {VERISURE_COMPARISON.map((row) => (
                <tr key={row.dim} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="py-3 pr-4 font-semibold text-[#09090B]">{row.dim}</td>
                  <td className="py-3 pr-4 text-[#52525B]">{row.verisure}</td>
                  <td className="py-3 text-[#047857] font-medium">{row.qlo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpotlightCard>
    </div>
  );
}
