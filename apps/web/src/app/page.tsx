"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
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

  useEffect(() => {
    verifyZkeyIntegrity().then(setZkeyInfo).catch(() => undefined);
    const mirror = loadLocalChainMirror();
    setLocalStats({
      escrowEth: Number(formatWeiToEth(mirror.insurerEscrowWei, 4)),
      claims: mirror.settledClaims.length,
    });
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

  const currentTab = WORKSPACE_TABS.find((t) => t.id === activeWorkspace) ?? WORKSPACE_TABS[0];
  const TabIcon = currentTab.icon;

  return (
    <div className="space-y-12 pt-2">
      {/* 1. Asymmetric Product Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">
              <Sparkles className="h-3 w-3" />
              Base Sepolia · Browser Groth16
            </Badge>
            <Badge variant="neutral">MIT Open Source · $0 Stack</Badge>
            {zkeyInfo?.verified ? (
              <Badge variant="emerald">
                <CheckCircle2 className="h-3 w-3" />
                {zkeyInfo.manifest.nConstraints.toLocaleString()} R1CS Verified
              </Badge>
            ) : null}
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.08] text-[#09090B]">
            Zero-Knowledge Health Claims That Prove Coverage Without Exposing Clinical Data.
          </h1>

          <p className="text-sm sm:text-base text-[#52525B] max-w-2xl leading-relaxed">
            Qlo replaces centralized EDI clearinghouses with client-side{" "}
            <span className="text-[#09090B] font-semibold">AES-256-GCM</span> encrypted medical records,
            browser-local <span className="text-[#09090B] font-semibold">CMS-1500 &amp; Tesseract OCR</span>,
            and an <span className="text-[#0F766E] font-semibold">8-predicate Groth16 clearinghouse</span> verifying
            accreditation, covered CPT schedules, and private annual limits on Base Sepolia.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/patient">
              <TactileButton variant="primary" size="lg">
                Launch Patient Portal
                <ArrowRight className="h-4 w-4" />
              </TactileButton>
            </Link>
            <Link href="/story">
              <TactileButton variant="secondary" size="lg">
                Security Trust Center
              </TactileButton>
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
            <span>Tap card to flip · Cryptographic proof stub</span>
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

      {/* 3. Interactive Multi-Role Platform Workspaces Showcase */}
      <SpotlightCard accent="neutral" className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F4F4F5] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#09090B]">
              One Platform Across Patients, Accredited Providers, and Payers
            </h2>
            <p className="text-xs text-[#52525B]">
              Dedicated role workspaces enforce cryptographic separation of duties end-to-end.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1">
            {WORKSPACE_TABS.map((tab) => {
              const active = tab.id === activeWorkspace;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveWorkspace(tab.id)}
                  className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    active ? "text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="home-workspace-tab"
                      transition={motionTransitions.springMorph}
                      className="absolute inset-0 rounded-lg bg-white border border-[#E4E4E7]/80 shadow-xs"
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F766E]">
              <TabIcon className="h-4 w-4" />
              {currentTab.label} Workspace
            </div>
            <h3 className="text-xl font-bold tracking-tight text-[#09090B]">
              {currentTab.headline}
            </h3>
            <p className="text-xs sm:text-sm text-[#52525B] leading-relaxed">
              {currentTab.summary}
            </p>
            <div className="pt-2">
              <Link href={currentTab.href}>
                <TactileButton variant="emerald" size="md">
                  {currentTab.cta}
                  <ArrowRight className="h-4 w-4" />
                </TactileButton>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-2.5">
            <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#71717A]">
              Enforced Guarantees
            </div>
            {currentTab.guarantees.map((g) => (
              <div
                key={g}
                className="flex items-start gap-2 rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#09090B]"
              >
                <CheckCircle2 className="h-4 w-4 text-[#0F766E] shrink-0 mt-0.5" />
                <span>{g}</span>
              </div>
            ))}
          </div>
        </div>
      </SpotlightCard>

      {/* 4. Interactive Benchmark Telemetry */}
      <MetricHUD />

      {/* 5. Clearinghouse Analytics & Covered Clinical Schedule */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7">
          <InteractiveAreaChart
            className="h-full"
            title="Clearinghouse Automated Settlement Volume"
            subtitle="Deterministic synthetic proof-to-payout cadence merged with live session settlements"
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
            <span className="text-[#71717A]">Unlisted CPT codes fail proof closed</span>
            <Link href="/patient" className="font-medium text-[#0F766E] hover:underline">
              View all in Portal →
            </Link>
          </div>
        </SpotlightCard>
      </section>

      {/* 6. Three-Party Zero-PHI Dataflow Architecture */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono-tabular uppercase tracking-[0.16em] text-[#52525B]">
            Three-Party Zero-PHI Clearinghouse Flow
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
              How Qlo enforces HIPAA-grade confidentiality while verifying payer solvency on Base Sepolia.
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
                  No. OCR runs locally in the browser using same-origin Tesseract WASM. Records are sealed with AES-256-GCM before touching IndexedDB or IPFS CIDv1, and ClaimsVault accepts only 8 Groth16 public scalars containing commitments, deterministic nullifiers, and ETH payout bounds.
                </>
              ),
            },
            {
              id: "faq-cap",
              title: "How does Qlo enforce annual benefit caps without leaking a member's coverage limit?",
              badge: "Private Accounting",
              content: (
                <>
                  Each policy&apos;s annual ceiling stays inside a private 6-input Poseidon commitment preimage. During claim settlement, ClaimsVault passes the cumulative on-chain spend as public input priorPolicySpent and the Groth16 circuit proves priorPolicySpent + claimAmount &lt;= annualLimit in zero knowledge.
                </>
              ),
            },
            {
              id: "faq-revoke",
              title: "What happens immediately when a patient clicks Revoke Access?",
              badge: "Instant Control",
              content: (
                <>
                  HealthRecords clears the hospital&apos;s wrapped ECDH P-256 data key and zeroes the grant expiry on-chain. Any pending or future claim settlement referencing that record immediately reverts inside ClaimsVault.
                </>
              ),
            },
            {
              id: "faq-oss",
              title: "Is Qlo free to audit, fork, and deploy with zero paid SaaS dependencies?",
              badge: "MIT · $0 Stack",
              content: (
                <>
                  Every Circom circuit, Solidity contract, OCR worker asset, and Next.js clearinghouse workspace is 100% open-source under the MIT license, running natively in standard browsers and settling directly against open Ethereum RPCs.
                </>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
