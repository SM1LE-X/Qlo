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
import { MetricHUD } from "@/components/ui/metric-hud";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { WalletPassCard } from "@/components/ui/wallet-pass-card";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
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

        <div className="lg:col-span-5 space-y-2.5">
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
          <div className="flex items-center justify-between px-1 text-[11px] font-mono-tabular text-[#71717A]">
            <span>Interactive Health Sovereignty Pass · Tap card to inspect proof stub</span>
            <span className="text-[#0F766E] font-medium">Poseidon BN254</span>
          </div>
        </div>
      </section>

      {/* 2. Porcelain Protocol Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard accent="emerald" className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-[#52525B]">R1CS Constraints</div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F766E]">
            <NumberTicker value={zkeyInfo?.manifest.nConstraints ?? 4349} />
          </div>
          <div className="text-[11px] font-mono-tabular text-[#71717A]">
            Fits 8,192 PPOT ptau_13
          </div>
        </SpotlightCard>

        <SpotlightCard accent="emerald" className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-[#52525B]">PHI Exposed On-Chain</div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#047857]">
            <NumberTicker value={0} suffix=" bytes" />
          </div>
          <div className="text-[11px] font-mono-tabular text-[#71717A]">
            ICD-10, CPT &amp; Rx stay local
          </div>
        </SpotlightCard>

        <SpotlightCard accent="neutral" className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-[#52525B]">Treasury Escrow</div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
            <NumberTicker value={liveEscrowEth} decimals={4} suffix=" ETH" />
          </div>
          <div className="text-[11px] font-mono-tabular text-[#71717A]">
            {IS_CHAIN_DEPLOYED ? "Live Base Sepolia" : "Local Sandbox Treasury"}
          </div>
        </SpotlightCard>

        <SpotlightCard accent="amber" className="p-5 space-y-1.5">
          <div className="text-xs font-medium text-[#52525B]">Claims Auto-Settled</div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#B45309]">
            <NumberTicker value={liveClaims} />
          </div>
          <div className="text-[11px] font-mono-tabular text-[#71717A]">
            Deterministic nullifiers active
          </div>
        </SpotlightCard>
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

      {/* 5. Three-Party Zero-PHI Dataflow Architecture */}
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

      {/* 6. Enterprise Compliance & Security Pillars */}
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
    </div>
  );
}
