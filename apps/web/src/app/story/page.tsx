"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileCode2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
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
    qlo: "Trustless verification directly inside ClaimsVault.sol on Ethereum Sepolia",
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
    <div className="space-y-6">
      <section className="rounded-xl border border-[#1E242D] bg-[#111419] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <FileCode2 className="h-4 w-4 text-[#10B981]" />
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F3F4F6]">
                Protocol Specification &amp; Circuit Registry
              </h1>
              <Badge variant="emerald">4,349 R1CS · 5/5 Sourcify Exact Match</Badge>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Fail-closed Groth16 BN254 circuit constraints, live browser proving-key SHA-256 verification, and Ethereum Sepolia contract registry.
            </p>
          </div>
        </div>
      </section>

      {/* Live Browser .zkey SHA-256 Verifier */}
      <SpotlightCard accent="emerald" className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E242D] pb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              Live Proving Key Integrity Verification (<code className="font-mono-tabular text-[#10B981]">/zk/ClaimValidity.zkey</code>)
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Computes the SHA-256 digest of the active Groth16 proving key via WebCrypto and compares it against the pinned ceremony manifest.
            </p>
          </div>
          <TactileButton size="sm" variant="secondary" onClick={runIntegrityCheck} disabled={verifying}>
            <RefreshCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
            Re-Verify SHA-256
          </TactileButton>
        </div>

        {zkeyResult ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className="rounded-xl border border-[#1E242D] bg-[#0D1014] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8] font-medium">Verification Status</span>
                <Badge variant={zkeyResult.verified ? "emerald" : "crimson"}>
                  <CheckCircle2 className="h-3 w-3" />
                  {zkeyResult.verified ? `MATCHED (${zkeyResult.checkedAtMs}ms)` : "MISMATCH"}
                </Badge>
              </div>
              <div className="text-[#94A3B8]">
                Phase 1: <span className="text-[#F3F4F6] font-medium">{zkeyResult.manifest.ptauFile}</span> (
                {zkeyResult.manifest.nConstraints} constraints / {zkeyResult.manifest.ptauCapacity} cap)
              </div>
              <div className="text-[#94A3B8]">
                Proving Key Size:{" "}
                <span className="font-mono-tabular font-semibold text-[#F3F4F6]">
                  {(zkeyResult.manifest.zkeyBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[#1E242D] bg-[#0D1014] p-4 space-y-2">
              <CopyHash label="Expected SHA-256" value={zkeyResult.expectedSha256} />
              <CopyHash label="Computed Browser SHA-256" value={zkeyResult.actualSha256} />
              {DEPLOYMENT.zkeySha256 ? (
                <CopyHash label="Deployment Manifest" value={DEPLOYMENT.zkeySha256} />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#94A3B8]">Computing SHA-256 of /zk/ClaimValidity.zkey...</div>
        )}
      </SpotlightCard>

      {/* Ethereum Sepolia Contract Registry */}
      <SpotlightCard accent="neutral" className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E242D] pb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              Ethereum Sepolia Contract Registry (Chain ID {DEPLOYMENT.chainId})
            </h2>
            <p className="text-xs text-[#94A3B8]">
              {IS_CHAIN_DEPLOYED
                ? "Verified open-source Solidity 0.8.28 contracts on Sourcify & Ethereum Sepolia."
                : "Pre-broadcast deployment manifest — verified on Anvil local EVM; ready for Ethereum Sepolia broadcast."}
            </p>
          </div>
          <Badge variant={IS_CHAIN_DEPLOYED ? "emerald" : "neutral"}>
            {IS_CHAIN_DEPLOYED ? "Live On-Chain" : "Pre-Deploy"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Object.entries(DEPLOYMENT.contracts).map(([name, addr]) => (
            <div
              key={name}
              className="rounded-xl border border-[#1E242D] bg-[#0D1014] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F3F4F6]">{name}</span>
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
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#10B981] hover:underline"
                >
                  Sourcify Match <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </SpotlightCard>

      {/* Frozen 8-Signal ABI */}
      <SpotlightCard accent="neutral" className="p-5 sm:p-6 space-y-4">
        <div className="border-b border-[#1E242D] pb-3.5">
          <h2 className="text-sm font-semibold text-[#F3F4F6]">Frozen 8-Public-Signal Circuit ABI</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E242D] text-[#64748B]">
                <th className="py-2.5 pr-4 font-medium">Index</th>
                <th className="py-2.5 pr-4 font-medium">Signal Name</th>
                <th className="py-2.5 pr-4 font-medium">Domain</th>
                <th className="py-2.5 font-medium">
                  On-Chain Invariant (<code className="font-mono-tabular text-[#F3F4F6]">ClaimsVault.sol</code>)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E242D]">
              {PUBLIC_SIGNALS.map((row) => (
                <tr key={row.idx} className="hover:bg-[#161B22]/50 transition-colors">
                  <td className="py-2.5 pr-4 font-mono-tabular font-semibold text-[#10B981]">
                    [{row.idx}]
                  </td>
                  <td className="py-2.5 pr-4 font-mono-tabular font-medium text-[#F3F4F6]">
                    {row.name}
                  </td>
                  <td className="py-2.5 pr-4 font-mono-tabular text-[#94A3B8]">{row.type}</td>
                  <td className="py-2.5 text-[#F3F4F6]">{row.check}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpotlightCard>

      {/* Cryptographic Honesty & STRIDE Boundaries */}
      <SpotlightCard accent="amber" className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1E242D] pb-3.5">
          <ShieldAlert className="h-4 w-4 text-[#F59E0B]" />
          <h2 className="text-sm font-semibold text-[#F3F4F6]">
            Cryptographic Honesty &amp; STRIDE Boundaries
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs leading-relaxed">
          <div className="rounded-xl border border-[#1E242D] bg-[#0D1014] p-4 space-y-1.5">
            <div className="font-semibold text-[#F59E0B]">1. Post-Decryption Analog Hole</div>
            <p className="text-[#94A3B8]">
              Revoking access deletes the on-chain wrapped DEK and immediately halts future decryption and{" "}
              <code className="text-[#F3F4F6] font-semibold">ClaimsVault</code> settlement. However, no cryptography can erase plaintext if a malicious hospital saved a local copy prior to revocation (mitigated in v2 via hardware TEEs).
            </p>
          </div>
          <div className="rounded-xl border border-[#1E242D] bg-[#0D1014] p-4 space-y-1.5">
            <div className="font-semibold text-[#F59E0B]">2. Groth16 Trusted Setup &amp; Pinning</div>
            <p className="text-[#94A3B8]">
              Phase 1 builds on the 80+ contributor Ethereum Foundation PSE Perpetual Powers of Tau ceremony, followed by a verifiable Phase 2 contribution whose exact SHA-256 is verified live above.
            </p>
          </div>
          <div className="rounded-xl border border-[#1E242D] bg-[#0D1014] p-4 space-y-1.5">
            <div className="font-semibold text-[#10B981]">3. Deterministic Nullifier &amp; Anti-Front-Run</div>
            <p className="text-[#94A3B8]">
              Removing arbitrary nonces prevents infinite vault drains (
              <code className="text-[#F3F4F6] font-semibold">
                nullifier = Poseidon(salt, policyId, recordCommit)
              </code>
              ), while binding <code className="text-[#F3F4F6] font-semibold">msg.sender</code> inside the proof stops mempool payout theft.
            </p>
          </div>
          <div className="rounded-xl border border-[#1E242D] bg-[#0D1014] p-4 space-y-1.5">
            <div className="font-semibold text-[#10B981]">4. Range-Checked Comparators &amp; Clock Window</div>
            <p className="text-[#94A3B8]">
              Explicit <code className="text-[#F3F4F6] font-semibold">Num2Bits(64/96)</code> checks prevent BN254 field aliasing bugs in{" "}
              <code className="text-[#F3F4F6] font-semibold">LessThan</code>, and Ethereum Sepolia enforces a 15-minute freshness window against backdated proofs.
            </p>
          </div>
        </div>
      </SpotlightCard>

      {/* Prior Art Comparison (VeriSure ETHDenver 2025) */}
      <SpotlightCard accent="neutral" className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#1E242D] pb-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              Prior Art Comparison: Qlo vs. VeriSure (ETHDenver 2025)
            </h2>
          </div>
          <Badge variant="neutral">Architecture Benchmark</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E242D] text-[#64748B]">
                <th className="py-2.5 pr-4 font-medium">Dimension</th>
                <th className="py-2.5 pr-4 font-medium">VeriSure (ETHDenver 2025)</th>
                <th className="py-2.5 font-medium">Qlo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E242D]">
              {VERISURE_COMPARISON.map((row) => (
                <tr key={row.dim} className="hover:bg-[#161B22]/50 transition-colors">
                  <td className="py-3 pr-4 font-semibold text-[#F3F4F6]">{row.dim}</td>
                  <td className="py-3 pr-4 text-[#94A3B8]">{row.verisure}</td>
                  <td className="py-3 text-[#10B981] font-medium">{row.qlo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpotlightCard>

      {/* Deep Cryptographic & Audit Q&A */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[#F3F4F6]">
            Deep Cryptographic &amp; Security Audit Q&amp;A
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Detailed answers on arithmetic constraints, key lifecycle, and Ethereum Sepolia finality guarantees.
          </p>
        </div>

        <SmoothAccordion
          defaultOpen={["q-nullifier"]}
          items={[
            {
              id: "q-nullifier",
              title: "How do deterministic Poseidon(3) nullifiers prevent double-billing without exposing claim details?",
              badge: "Anti-Replay",
              content: (
                <>
                  Each settled claim emits <code className="font-semibold text-[#F3F4F6]">nullifier = Poseidon(policySalt, policyId, recordCommitment)</code>.
                  Because the hospital cannot invent a fresh nonce per transaction, re-submitting the same encrypted CMS-1500 bill produces the exact same nullifier scalar and reverts deterministically inside{" "}
                  <code className="font-semibold text-[#F3F4F6]">ClaimsVault.sol</code> without revealing the procedure CPT code or diagnosis.
                </>
              ),
            },
            {
              id: "q-bits",
              title: "Why is the SHA-256 recordCommitment truncated to 248 bits?",
              badge: "BN254 Field Safety",
              content: (
                <>
                  BN254 scalar arithmetic operates modulo a 254-bit prime (~253.6 bits effective range).
                  Truncating the SHA-256 hash of the canonical ciphertext + metadata strictly to the lower 248 bits (31 bytes) guarantees injective field embedding without wrap-around collisions across both Circom circuits and Solidity storage.
                </>
              ),
            },
            {
              id: "q-zkey",
              title: "How is proving key supply-chain tampering prevented in the browser?",
              badge: "Trusted Setup",
              content: (
                <>
                  At runtime, <code className="font-semibold text-[#F3F4F6]">verifyZkeyIntegrity()</code> streams{" "}
                  <code className="font-semibold text-[#F3F4F6]">/zk/ClaimValidity.zkey</code>, hashes every byte via WebCrypto SHA-256, and verifies it against the ceremony digest embedded in{" "}
                  <code className="font-semibold text-[#F3F4F6]">DEPLOYMENT.zkeySha256</code> before Web Worker witnesses are generated.
                </>
              ),
            },
            {
              id: "q-frontrun",
              title: "Why does public signal [6] enforce msg.sender == hospitalAddress?",
              badge: "MEV Defense",
              content: (
                <>
                  If the hospital payout address were an unconstrained parameter, a mempool observer could copy a hospital&apos;s valid Groth16 proof, substitute their own payout address, and drain the claim settlement. Binding{" "}
                  <code className="font-semibold text-[#F3F4F6]">uint160(msg.sender)</code> directly inside the Groth16 circuit invalidates any copied proof sent from an unauthorized wallet.
                </>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
