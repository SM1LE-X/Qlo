"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  FileLock2,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useReadContracts } from "wagmi";
import { AnimatedZkFlow } from "@/components/ui/animated-beam";
import { Badge } from "@/components/ui/card";
import { InteractiveAreaChart } from "@/components/ui/interactive-area-chart";
import { MetricHUD } from "@/components/ui/metric-hud";
import { NumberTicker } from "@/components/ui/number-ticker";
import { OnboardingModal } from "@/components/ui/onboarding-guide";
import { PaymentNotificationBanner } from "@/components/ui/payment-notification-banner";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { StatCard } from "@/components/ui/stat-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { WalletPassCard } from "@/components/ui/wallet-pass-card";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { ACCREDITED_PROVIDERS, COVERED_CLINICAL_SCHEDULE } from "@/lib/clinicalCatalog";
import { CONTRACTS, DEPLOYMENT, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { loadLocalChainMirror } from "@/lib/localState";
import { motionTransitions } from "@/lib/motion-tokens";
import { formatWeiToEth } from "@/lib/utils";
import { verifyZkeyIntegrity, type ZkeyIntegrityResult } from "@/lib/zkeyIntegrity";

const WORKSPACE_TABS = [
  {
    id: "patient",
    label: "Patient Vault",
    href: "/patient",
    cta: "Launch Patient Vault",
    headline: "Client-side CMS-1500 OCR & patient-controlled key delegation",
    summary:
      "Patients parse bills locally with Tesseract WASM, encrypt records via AES-256-GCM into IndexedDB + IPFS CIDv1, wrap data encryption keys (DEKs) with ephemeral ECDH P-256 for time-bounded hospital access, and revoke keys on-chain in one click.",
    icon: FileLock2,
    guarantees: [
      "0 plaintext clinical bytes leave browser memory",
      "Time-bounded grants (10m–30d) enforced by HealthRecords.sol",
      "Instant access revocation deletes wrapped DEK & halts claims",
    ],
  },
  {
    id: "hospital",
    label: "Provider Clearinghouse",
    href: "/hospital",
    cta: "Open Provider Clearinghouse",
    headline: "Sub-second Web Worker Groth16 proving with automatic ETH payout",
    summary:
      "Accredited hospitals unwrap patient-granted DEKs locally, construct 20-signal Poseidon Merkle witnesses inside an off-thread WASM Web Worker, verify 8 strict eligibility predicates, and settle directly against ClaimsVault without EDI intermediaries.",
    icon: Cpu,
    guarantees: [
      "Verifies accredited hospital Merkle membership + msg.sender binding",
      "Checks covered CPT tree, expiry, and private cumulative annual cap",
      "Deterministic nullifier prevents duplicate claim drains",
    ],
  },
  {
    id: "insurer",
    label: "Payer Treasury",
    href: "/insurer",
    cta: "Open Payer Treasury",
    headline: "Autonomous escrow settlement with live Zero-PHI calldata auditing",
    summary:
      "Health insurers fund native ETH escrow, register opaque Poseidon policy commitments preserving private annual caps, track aggregate spend on-chain, and audit every settled transaction inside the Split-Screen Calldata Inspector.",
    icon: Landmark,
    guarantees: [
      "Private annual policy ceiling stays blind in Poseidon(6)",
      "Reentrancy-guarded, Ownable2Step pausable treasury escrow",
      "Automated canary scan proves 0 ICD-10 / CPT / Rx bytes on-chain",
    ],
  },
] as const;

const COMPLIANCE_PILLARS = [
  {
    title: "Zero-PHI On-Chain Calldata",
    detail:
      "Diagnosis codes (ICD-10), CPT procedure schedules, prescriptions, and annual caps remain strictly off-chain inside AES-256-GCM envelopes—only 8 BN254 public field signals reach Base Sepolia.",
    icon: Lock,
  },
  {
    title: "Sub-Second Browser Groth16",
    detail:
      "Compiled to 4,349 R1CS constraints under EF PSE Perpetual Powers of Tau, generating verifiable proofs inside WebAssembly in ~400ms with zero external proving servers.",
    icon: Cpu,
  },
  {
    title: "Cryptographic Consent Revocation",
    detail:
      "Patients control wrapped DEK lifetimes on-chain. Calling revokeAccess() clears encrypted keys immediately and forces ClaimsVault settlement to revert fail-closed.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  const [zkeyInfo, setZkeyInfo] = useState<ZkeyIntegrityResult | null>(null);
  const [localStats, setLocalStats] = useState({ escrowEth: 1.0, claims: 0 });
  const [activeWorkspace, setActiveWorkspace] = useState<"patient" | "hospital" | "insurer">("patient");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    verifyZkeyIntegrity().then(setZkeyInfo).catch(() => undefined);
    const syncMirror = () => {
      const mirror = loadLocalChainMirror();
      setLocalStats({
        escrowEth: Number(formatWeiToEth(mirror.insurerEscrowWei, 4)),
        claims: mirror.settledClaims.length,
      });
    };
    syncMirror();
    window.addEventListener("storage", syncMirror);
    return () => window.removeEventListener("storage", syncMirror);
  }, []);

  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const seededInsurer =
    (DEPLOYMENT as { seededInsurer?: string }).seededInsurer &&
    (DEPLOYMENT as { seededInsurer?: string }).seededInsurer !== zeroAddr
      ? (DEPLOYMENT as { seededInsurer?: string }).seededInsurer
      : canonicalFixtures.accounts.insurer;

  const { data: chainReads } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.ClaimsVault.address,
        abi: CONTRACTS.ClaimsVault.abi,
        functionName: "totalClaimsSettled",
      },
      {
        address: CONTRACTS.ClaimsVault.address,
        abi: CONTRACTS.ClaimsVault.abi,
        functionName: "insurerEscrow",
        args: [seededInsurer as `0x${string}`],
      },
    ],
    query: {
      enabled: IS_CHAIN_DEPLOYED,
    },
  });

  const liveClaims =
    IS_CHAIN_DEPLOYED && chainReads?.[0]?.result !== undefined
      ? Number(chainReads[0].result)
      : localStats.claims;
  const liveEscrowEth =
    IS_CHAIN_DEPLOYED && chainReads?.[1]?.result !== undefined
      ? Number(formatWeiToEth(chainReads[1].result as bigint, 4))
      : localStats.escrowEth;

  return (
    <div className="space-y-12 pt-2">
      {/* 1. Asymmetric Product Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">
              <Sparkles className="h-3 w-3" />
              Base Sepolia · Client-Side Groth16
            </Badge>
            <Badge variant="neutral">MIT Licensed · Open Architecture</Badge>
            {zkeyInfo?.verified ? (
              <Badge variant="emerald">
                <CheckCircle2 className="h-3 w-3" />
                {zkeyInfo.manifest.nConstraints.toLocaleString()} R1CS Verified
              </Badge>
            ) : null}
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.08] text-[#09090B]">
            Zero-Knowledge Health Claims. Verified Coverage, Zero Exposed PHI.
          </h1>

          <p className="text-sm sm:text-base text-[#52525B] max-w-2xl leading-relaxed">
            Qlo replaces legacy EDI intermediaries with client-side{" "}
            <span className="text-[#09090B] font-semibold">AES-256-GCM</span> encrypted clinical records,
            on-device <span className="text-[#09090B] font-semibold">CMS-1500 OCR</span>,
            and an <span className="text-[#0F766E] font-semibold">8-predicate Groth16 clearinghouse</span> verifying
            facility accreditation, covered CPT schedules, and private annual caps on Base Sepolia.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/patient">
              <TactileButton variant="primary" size="lg">
                Open Patient Vault
                <ArrowRight className="h-4 w-4" />
              </TactileButton>
            </Link>
            <TactileButton variant="secondary" size="lg" onClick={() => setGuideOpen(true)}>
              <Compass className="h-4 w-4 text-[#0F766E]" />
              Guided Walkthrough
            </TactileButton>
            <Link
              href="/story"
              className="px-2 py-1 text-xs font-medium text-[#52525B] hover:text-[#09090B] transition-colors"
            >
              Security Trust Center →
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <WalletPassCard
            policyId={canonicalFixtures.activePolicy.policyId}
            patientAlias="SYNTH-CASE-042"
            icd10Code="I21.0"
            cptCode="99285"
            claimAmountEth="0.01"
            encrypted={true}
            recordCommitmentHex={canonicalFixtures.activePolicy.commitmentHex}
            targetHospital={canonicalFixtures.accounts.hospital1}
          />
          <PaymentNotificationBanner
            appName="Qlo Clearinghouse"
            amount="0.0100 ETH"
            from="ClaimsVault Escrow → Metro Cardiac Center"
            time="Instant ZK Finality"
            showTriggerLabel="Show settlement alert"
          />
          <div className="flex items-center justify-between px-1 text-[11px] font-mono-tabular text-[#71717A]">
            <span>Inspect commitment · Encrypted Policy Pass</span>
            <span className="text-[#0F766E] font-medium">Poseidon BN254</span>
          </div>
        </div>
      </section>

      {/* 2. Porcelain Protocol Metrics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="R1CS Constraints"
          valueText={<NumberTicker value={zkeyInfo?.manifest.nConstraints ?? 4349} />}
          sublabel="Fits 8,192 PPOT ptau_13"
          deltaText="53% Cap"
          deltaTone="teal"
          trend={[6120, 5680, 5140, 4820, 4510, 4349]}
          trendLabels={["v0.1", "v0.3", "v0.5", "v0.7", "v0.9", "Frozen"]}
          accentColor="#0F766E"
        />

        <StatCard
          label="PHI Exposed On-Chain"
          valueText={<NumberTicker value={0} suffix=" bytes" />}
          sublabel="ICD-10, CPT & Rx stay local"
          deltaText="Zero-PHI"
          deltaTone="emerald"
          trend={[0, 0, 0, 0, 0, 0]}
          trendLabels={["Intake", "OCR", "Encrypt", "Grant", "Prove", "Settle"]}
          accentColor="#047857"
        />

        <StatCard
          label="Treasury Escrow"
          valueText={<NumberTicker value={liveEscrowEth} decimals={4} suffix=" ETH" />}
          sublabel={IS_CHAIN_DEPLOYED ? "Live Base Sepolia" : "Local Sandbox Treasury"}
          deltaText="Solvent 100%"
          deltaTone="neutral"
          trend={[0.02, 0.04, 0.035, 0.045, 0.05, Math.max(0.02, liveEscrowEth)]}
          trendLabels={["T-5", "T-4", "T-3", "T-2", "T-1", "Now"]}
          accentColor="#0F4C81"
        />

        <StatCard
          label="Claims Auto-Settled"
          valueText={<NumberTicker value={liveClaims} />}
          sublabel="Deterministic nullifiers active"
          deltaText="0 Replays"
          deltaTone="amber"
          trend={[1, 2, 4, 6, 9, Math.max(1, liveClaims)]}
          trendLabels={["T-5", "T-4", "T-3", "T-2", "T-1", "Session"]}
          accentColor="#B45309"
        />
      </section>

      {/* 3. Three Independent Stakeholder Portals Showcase */}
      <SpotlightCard accent="neutral" className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F4F4F5] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#09090B]">
              Built for Three Independent Organizations
            </h2>
            <p className="text-xs text-[#52525B]">
              Each party signs in to an isolated portal with strict role separation—encrypted payloads, wrapped DEKs, and settlements synchronize live across browser windows via our Zero-PHI relay.
            </p>
          </div>
          <Badge variant="teal">Cross-Browser Live Sync</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {WORKSPACE_TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const roleLabels = [
              { actor: "Person 1 · Member", sees: "Plaintext CMS-1500, ICD-10, Rx & Consent Keys", hidden: "Hospital Prover & Insurer Reserve Ops" },
              { actor: "Person 2 · Billing / RCM", sees: "Authorized Records, Groth16 Prover & 837P / FHIR", hidden: "Revoked Records & Payer Private Annual Cap" },
              { actor: "Person 3 · Health Plan Ops", sees: "Treasury Escrow, Ledger, 835 ERA & Calldata Scan", hidden: "Member ICD-10 Diagnoses, CPT Codes & Rx" },
            ][idx];
            return (
              <div
                key={tab.id}
                onMouseEnter={() => setActiveWorkspace(tab.id)}
                className={`flex flex-col justify-between rounded-2xl border p-5 space-y-4 transition-colors ${
                  activeWorkspace === tab.id
                    ? "border-[#0F766E]/50 bg-[#F0FDFA]/30"
                    : "border-[#E4E4E7] bg-[#FAFAFA]"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4E4E7] bg-white text-[#0F766E]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="rounded-full border border-[#E4E4E7] bg-white px-2.5 py-0.5 text-[10px] font-mono-tabular font-semibold text-[#52525B]">
                      {roleLabels.actor}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#09090B]">{tab.label}</h3>
                    <p className="mt-1 text-xs text-[#52525B] leading-relaxed">{tab.headline}</p>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-[#E4E4E7] bg-white p-3 text-[11px]">
                    <div>
                      <span className="font-semibold text-[#047857]">Sees: </span>
                      <span className="text-[#52525B]">{roleLabels.sees}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#B45309]">Isolated From: </span>
                      <span className="text-[#71717A]">{roleLabels.hidden}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link href={tab.href} className="flex-1">
                    <TactileButton variant={idx === 0 ? "primary" : "emerald"} size="sm" className="w-full">
                      Enter Portal
                      <ArrowRight className="h-3.5 w-3.5" />
                    </TactileButton>
                  </Link>
                  <a
                    href={tab.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[#E4E4E7] bg-white px-2.5 text-[11px] font-medium text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors whitespace-nowrap"
                  >
                    New Tab ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </SpotlightCard>

      {/* 4. Interactive Benchmark Telemetry */}
      <MetricHUD />

      {/* 5. Clearinghouse Analytics & Covered Clinical Schedule */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7">
          <InteractiveAreaChart
            className="h-full"
            title="Clearinghouse Settlement Activity"
            subtitle="Simulated 30-day baseline merged with live verified settlements from this session."
            defaultRange="30D"
            formatValue={(v) => `${v} claims`}
            data={{
              "7D": [
                { label: "Mon", value: 18 },
                { label: "Tue", value: 24 },
                { label: "Wed", value: 21 },
                { label: "Thu", value: 31 },
                { label: "Fri", value: 29 },
                { label: "Sat", value: 26 },
                { label: "Today", value: 34 + liveClaims },
              ],
              "30D": [
                { label: "W1", value: 68 },
                { label: "W2", value: 94 },
                { label: "W3", value: 82 },
                { label: "W4", value: 118 },
                { label: "W5", value: 109 },
                { label: "Current", value: 136 + liveClaims },
              ],
              "1Y": [
                { label: "Q1", value: 310 },
                { label: "Q2", value: 445 },
                { label: "Q3", value: 590 },
                { label: "Q4", value: 720 + liveClaims },
              ],
            }}
          />
        </div>

        <SpotlightCard accent="emerald" className="lg:col-span-5 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-[#F4F4F5] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#09090B]">
                Covered Clinical Benefit Schedule
              </h3>
              <p className="text-xs text-[#52525B] mt-0.5">
                {COVERED_CLINICAL_SCHEDULE.length} approved CPT codes · {ACCREDITED_PROVIDERS.length} accredited facilities
              </p>
            </div>
            <Badge variant="emerald">Poseidon Depth 6</Badge>
          </div>

          <div className="space-y-2">
            {COVERED_CLINICAL_SCHEDULE.slice(0, 5).map((item) => (
              <div
                key={item.code}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-[#09090B]">{item.title}</div>
                  <div className="text-[11px] text-[#71717A]">{item.category} · {item.copayTier}</div>
                </div>
                <span className="shrink-0 rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#0F766E]">
                  CPT {item.code}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[#71717A]">Unlisted CPT codes fail proof verification.</span>
            <Link href="/patient" className="font-medium text-[#0F766E] hover:underline shrink-0">
              View all in Portal →
            </Link>
          </div>
        </SpotlightCard>
      </section>

      {/* 6. End-to-End Zero-PHI Data Boundary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono-tabular uppercase tracking-[0.16em] text-[#52525B]">
            End-to-End Zero-PHI Data Boundary
          </h2>
          <Link href="/story" className="text-xs font-medium text-[#0F766E] hover:underline">
            Read formal protocol specification →
          </Link>
        </div>
        <AnimatedZkFlow />
      </section>

      {/* 7. Enterprise Compliance & Security Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COMPLIANCE_PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <SpotlightCard key={pillar.title} accent="neutral" className="p-6 space-y-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-[#0F766E]">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#09090B]">{pillar.title}</h3>
              <p className="text-xs text-[#52525B] leading-relaxed">{pillar.detail}</p>
            </SpotlightCard>
          );
        })}
      </section>

      {/* 8. Enterprise Governance & Clearinghouse FAQ */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Platform Architecture &amp; Privacy Guarantees
            </h2>
            <p className="text-xs text-[#52525B]">
              How Qlo enforces strict confidentiality while verifying payer solvency on Base Sepolia.
            </p>
          </div>
          <Link href="/story" className="text-xs font-medium text-[#0F766E] hover:underline">
            Inspect circuit invariants →
          </Link>
        </div>

        <SmoothAccordion
          defaultOpen={["faq-phi"]}
          items={[
            {
              id: "faq-phi",
              title: "Does any diagnosis code, CPT procedure, or medication string ever touch Base Sepolia?",
              badge: "0 Bytes PHI",
              content: (
                <>
                  No. OCR executes inside the browser via same-origin Tesseract WASM. Records are sealed with AES-256-GCM before persisting to IndexedDB or IPFS CIDv1, and ClaimsVault accepts only 8 Groth16 public scalars containing cryptographic commitments, deterministic nullifiers, and ETH payout bounds.
                </>
              ),
            },
            {
              id: "faq-cap",
              title: "How does Qlo enforce annual benefit caps without leaking a member's coverage limit?",
              badge: "Private Accounting",
              content: (
                <>
                  Each policy&apos;s annual ceiling stays inside a private 6-input Poseidon commitment preimage. During settlement, ClaimsVault supplies the cumulative on-chain spend as public input <code className="font-semibold text-[#09090B]">priorPolicySpent</code>, and the Groth16 circuit proves cumulative outlay remains within the member&apos;s private policy limit.
                </>
              ),
            },
            {
              id: "faq-revoke",
              title: "What happens when a member revokes a provider consent grant?",
              badge: "Instant Control",
              content: (
                <>
                  HealthRecords deletes the hospital&apos;s wrapped ECDH P-256 key and clears the grant timestamp on-chain. Any subsequent decryption or claim settlement referencing that record deterministically reverts inside ClaimsVault.
                </>
              ),
            },
            {
              id: "faq-oss",
              title: "Can organizations audit, fork, and deploy Qlo with zero licensing fees?",
              badge: "MIT License",
              content: (
                <>
                  Every Circom circuit, Solidity smart contract, local OCR asset, and Next.js clearinghouse workspace is open-source under the MIT license—with zero proprietary clearinghouse fees or vendor lock-in.
                </>
              ),
            },
          ]}
        />
      </section>

      <OnboardingModal
        open={guideOpen}
        onOpenChange={setGuideOpen}
        vaultCount={localStats.claims > 0 ? 1 : 0}
        hasActiveGrant={false}
        settledCount={liveClaims}
        zkeyVerified={Boolean(zkeyInfo?.verified)}
      />
    </div>
  );
}
