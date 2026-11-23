"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileLock2,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LivePrivacyStage } from "@/components/home/live-privacy-stage";
import { AnimatedZkFlow } from "@/components/ui/animated-beam";
import { MetricHUD } from "@/components/ui/metric-hud";
import { NumberTicker } from "@/components/ui/number-ticker";
import { PaymentNotificationBanner } from "@/components/ui/payment-notification-banner";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { StatCard } from "@/components/ui/stat-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerAddressUrl } from "@/lib/contracts";
import { loadLocalChainMirror } from "@/lib/localState";
import { fetchRelayState } from "@/lib/relayClient";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth } from "@/lib/utils";

const STEPS = [
  {
    number: "01",
    role: "Patient Sovereign Studio",
    href: "/patient",
    icon: FileLock2,
    accentChip: "text-[#0F766E] bg-[#F0FDFA] border-[#99F6E4]",
    spotlight: "emerald" as const,
    outputTag: "AES-256-GCM · ECDH P-256 · CIDv1",
    headline: "Lock your bill & control access",
    description:
      "Scan or enter a medical bill on your own device, inspect your 3D encrypted policy pass, and grant or revoke temporary hospital access on-chain anytime.",
    cta: "Start Step 1: Patient",
  },
  {
    number: "02",
    role: "Hospital Prover Workbench",
    href: "/hospital",
    icon: Cpu,
    accentChip: "text-[#0F4C81] bg-[#F0F9FF] border-[#BAE6FD]",
    spotlight: "neutral" as const,
    outputTag: "Groth16 BN254 · 4,349 R1CS · < 3s",
    headline: "Prove validity & settle ETH",
    description:
      "Unwrap the patient-authorized record locally, prove all 8 accreditation, policy, procedure, and annual-cap rules in your browser, and collect instant escrow payout.",
    cta: "Open Step 2: Hospital",
  },
  {
    number: "03",
    role: "Insurer Forensic Audit",
    href: "/insurer",
    icon: Landmark,
    accentChip: "text-[#047857] bg-[#ECFDF5] border-[#A7F3D0]",
    spotlight: "emerald" as const,
    outputTag: "Live Calldata Scanner · X12 835 ERA",
    headline: "Verify payouts with zero leaks",
    description:
      "Fund the ClaimsVault escrow, track every settled claim automatically, and inspect raw Ethereum Sepolia calldata confirming 0 bytes of diagnoses or prescriptions.",
    cta: "Open Step 3: Insurer",
  },
] as const;

export default function HomePage() {
  const roles = useWalletRoles();
  const [sandboxStats, setSandboxStats] = useState({ escrowEth: 0.02, claims: 0 });

  useEffect(() => {
    if (IS_CHAIN_DEPLOYED) return;
    let active = true;
    const sync = async () => {
      const mirror = (await fetchRelayState()) ?? loadLocalChainMirror();
      if (!active) return;
      setSandboxStats({
        escrowEth: Number(formatWeiToEth(mirror.insurerEscrowWei, 4)),
        claims: mirror.settledClaims.length,
      });
    };
    sync();
    return () => {
      active = false;
    };
  }, []);

  const liveEscrowNum = IS_CHAIN_DEPLOYED
    ? Number(formatWeiToEth(roles.insurerEscrowWei, 4))
    : sandboxStats.escrowEth;
  const liveClaims = IS_CHAIN_DEPLOYED ? roles.totalClaimsSettled : sandboxStats.claims;

  return (
    <div className="space-y-10 lg:space-y-12 py-1 lg:py-2">
      {/* FULL-CANVAS ASYMMETRIC SPLIT HERO */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        <div className="lg:col-span-6 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4D4D8] bg-white px-3.5 py-1.5 text-xs font-medium text-[#3F3F46] shadow-2xs">
            <span
              className={`h-2 w-2 rounded-full ${
                IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#F59E0B]"
              }`}
            />
            {IS_CHAIN_DEPLOYED
              ? "Live on Ethereum Sepolia · 5/5 Sourcify Verified Contracts"
              : "Local Sandbox Mode · No Wallet Required"}
          </div>

          <h1 className="text-4xl sm:text-5xl xl:text-[3.55rem] font-bold tracking-[-0.03em] text-[#09090B] leading-[1.05]">
            Automatic insurance payouts.{" "}
            <span className="block mt-1">
              Zero{" "}
              <span className="font-editorial italic font-normal text-[#0F766E] tracking-normal text-[1.12em]">
                exposed
              </span>{" "}
              medical records.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-[#52525B] max-w-xl leading-relaxed">
            Enterprise zero-knowledge healthcare clearinghouse. Patients seal bills with AES-256-GCM
            on-device and grant revocable ECDH access; hospitals prove 8 coverage predicates in
            browser-local Groth16 and settle native ETH automatically.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/patient">
              <TactileButton variant="primary" size="lg">
                Start Step 1: Patient
                <ArrowRight className="h-4 w-4" />
              </TactileButton>
            </Link>
            <Link href="/insurer">
              <TactileButton variant="secondary" size="lg">
                <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
                Inspect Live Sepolia Audit
              </TactileButton>
            </Link>
          </div>

          <PaymentNotificationBanner
            appName="Ethereum Sepolia Settlement Feed"
            amount="+0.0050 ETH"
            from="ClaimsVault Escrow (Tx 0xf8cb...2ed0 · 0 PHI Bytes)"
            time="Verified On-Chain"
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs text-[#52525B]">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E]" />
              574ms browser Groth16 proof
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-[#0F766E]" />
              0 bytes PHI on-chain
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#0F766E]" />
              HL7 FHIR R4 &amp; X12 837P/835 ready
            </span>
          </div>
        </div>

        <div className="lg:col-span-6">
          <LivePrivacyStage />
        </div>
      </section>

      {/* ENTERPRISE TELEMETRY KPI ROW (WITH SCRUBBABLE DETERMINISTIC SPARKLINES) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Insurer Escrow Pool"
          valueText={<NumberTicker value={liveEscrowNum} decimals={4} suffix=" ETH" />}
          deltaText="Funded Live"
          deltaTone="emerald"
          sublabel={IS_CHAIN_DEPLOYED ? "Live in Sepolia ClaimsVault" : "Sandbox escrow balance"}
          trend={[0.02, 0.02, 0.015, 0.02]}
          trendLabels={["Genesis", "Pre-Claim", "Settled #1", "Replenished"]}
          accentColor="#047857"
        />

        <StatCard
          label="Verified Claims Paid"
          valueText={<NumberTicker value={liveClaims} decimals={0} />}
          deltaText="100% Automated"
          deltaTone="teal"
          sublabel="Settled atomically via BN254 pairing"
          trend={[0, 1, 1, Math.max(1, liveClaims)]}
          trendLabels={["Deploy", "Record #1", "Grant #1", "Settled"]}
          accentColor="#0F766E"
        />

        <StatCard
          label="Medical Data On-Chain"
          valueText={<span className="text-[#047857]">0 bytes</span>}
          deltaText="Zero-PHI Enforced"
          deltaTone="emerald"
          sublabel="ICD-10, CPT & Rx never leave device"
          trend={[0, 0, 0, 0]}
          trendLabels={["Intake", "Register", "Grant", "Settle"]}
          accentColor="#047857"
        />

        <StatCard
          label="Groth16 Proving Latency"
          valueText="574 ms"
          deltaText="4,349 R1CS"
          deltaTone="teal"
          sublabel="vs. 14–30 days on legacy EDI clearinghouses"
          trend={[18, 96, 195, 360, 495, 574]}
          trendLabels={["Witness", "Poseidon", "Merkle", "MSM", "Verify", "Ready"]}
          accentColor="#0F4C81"
        />
      </section>

      {/* FULL-WIDTH 3-STEP INTERACTIVE FLOW */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0F766E]">
              Enterprise Operating Workflow
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
              Three role-authenticated workspaces. One zero-knowledge pipeline.
            </h2>
          </div>
          <Link
            href="/story"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline"
          >
            Read Cryptographic Specification &amp; STRIDE Threat Model
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Link key={step.href} href={step.href} className="group block h-full">
                <SpotlightCard
                  accent={step.spotlight}
                  className="h-full p-6 sm:p-7 flex flex-col justify-between transition-transform duration-200 group-hover:-translate-y-0.5"
                >
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${step.accentChip}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-editorial text-4xl leading-none text-[#D4D4D8] group-hover:text-[#0F766E]/60 transition-colors">
                        {step.number}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">
                        {step.role}
                      </div>
                      <h3 className="text-lg font-bold tracking-tight text-[#09090B]">
                        {step.headline}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#52525B] leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 space-y-4">
                    <div className="rounded-xl border border-[#F4F4F5] bg-[#FAFAFA] px-3 py-2 font-mono-tabular text-[11px] text-[#52525B]">
                      {step.outputTag}
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] group-hover:translate-x-1 transition-transform">
                      {step.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </SpotlightCard>
              </Link>
            );
          })}
        </div>
      </section>

      {/* INTERACTIVE PROTOCOL TELEMETRY & BENCHMARK HUD */}
      <MetricHUD />

      {/* FULL-WIDTH ARCHITECTURAL PIPELINE & WHY QLO */}
      <section className="rounded-3xl border border-white/10 bg-obsidian-grid p-6 sm:p-8 lg:p-10 text-white card-obsidian space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="font-mono-tabular text-[11px] uppercase tracking-[0.16em] text-emerald-300">
              Architectural Proof · Zero-PHI Clearinghouse
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Replace centralized medical honeypots with verifiable math.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Legacy EDI clearinghouses concentrate unencrypted records for weeks—creating
              billion-dollar breach surfaces. Qlo moves encryption and proving into the browser
              while settling native ETH directly on Ethereum Sepolia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/story">
              <TactileButton variant="emerald" size="sm">
                Open Trust Center
                <ArrowRight className="h-3.5 w-3.5" />
              </TactileButton>
            </Link>
            {IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200 hover:bg-white/10 transition-colors"
              >
                Verified Contracts <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>

        <AnimatedZkFlow tone="obsidian" />
      </section>
    </div>
  );
}
