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
  Zap,
} from "lucide-react";
import { LivePrivacyStage } from "@/components/home/live-privacy-stage";
import { AnimatedZkFlow } from "@/components/ui/animated-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerAddressUrl } from "@/lib/contracts";
import { loadLocalChainMirror } from "@/lib/localState";
import { fetchRelayState } from "@/lib/relayClient";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth } from "@/lib/utils";

const STEPS = [
  {
    number: "01",
    role: "Patient Vault",
    href: "/patient",
    icon: FileLock2,
    accentChip: "text-[#0F766E] bg-[#F0FDFA] border-[#99F6E4]",
    spotlight: "emerald" as const,
    outputTag: "AES-256-GCM · ECDH P-256 · CIDv1",
    headline: "Lock your bill & control access",
    description:
      "Scan or enter a medical bill on your own device, encrypt it with a private key nobody else holds, and grant or revoke temporary hospital access on-chain anytime.",
    cta: "Start Step 1: Patient",
  },
  {
    number: "02",
    role: "Hospital Prover",
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
    role: "Insurer Audit",
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
    <div className="space-y-12 lg:space-y-16 py-2 lg:py-4">
      {/* FULL-CANVAS ASYMMETRIC SPLIT HERO */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        <div className="lg:col-span-6 space-y-6">
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

          <h1 className="text-4xl sm:text-5xl xl:text-[3.65rem] font-bold tracking-[-0.03em] text-[#09090B] leading-[1.05]">
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
            Patients encrypt their own health bills and control access with a single click.
            Hospitals prove claim eligibility in browser-local zero knowledge and get paid
            automatically. Insurers audit every payout without ever seeing a diagnosis.
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

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-[#52525B]">
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
              100% open-source · $0 stack
            </span>
          </div>
        </div>

        <div className="lg:col-span-6">
          <LivePrivacyStage />
        </div>
      </section>

      {/* FULL-WIDTH LIVE PROTOCOL TELEMETRY STRIP */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-3xl border border-[#E4E4E7] bg-white p-5 sm:p-6 card-porcelain">
        <div className="space-y-1 px-2">
          <div className="text-xs font-medium text-[#71717A]">Insurer Escrow Pool</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[#09090B]">
            <NumberTicker value={liveEscrowNum} decimals={4} suffix=" ETH" />
          </div>
          <div className="text-[11px] text-[#52525B]">
            {IS_CHAIN_DEPLOYED ? "Live in Sepolia ClaimsVault" : "Sandbox escrow pool"}
          </div>
        </div>

        <div className="space-y-1 px-2 lg:border-l lg:border-[#F4F4F5] lg:pl-6">
          <div className="text-xs font-medium text-[#71717A]">Verified Claims Paid</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[#09090B]">
            <NumberTicker value={liveClaims} decimals={0} />
          </div>
          <div className="text-[11px] text-[#52525B]">Settled automatically via Groth16</div>
        </div>

        <div className="space-y-1 px-2 lg:border-l lg:border-[#F4F4F5] lg:pl-6">
          <div className="text-xs font-medium text-[#71717A] flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-[#047857]" />
            Medical Data On-Chain
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[#047857]">
            0 bytes
          </div>
          <div className="text-[11px] text-[#52525B]">
            Diagnoses &amp; prescriptions stay encrypted
          </div>
        </div>

        <div className="space-y-1 px-2 lg:border-l lg:border-[#F4F4F5] lg:pl-6">
          <div className="text-xs font-medium text-[#71717A] flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[#0F766E]" />
            Claim Adjudication Time
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[#09090B]">
            &lt; 3 sec
          </div>
          <div className="text-[11px] text-[#52525B]">
            vs. 14–30 days on legacy EDI clearinghouses
          </div>
        </div>
      </section>

      {/* FULL-WIDTH 3-STEP INTERACTIVE FLOW */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0F766E]">
              Complete End-to-End Flow
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
              Three focused workspaces. One zero-knowledge pipeline.
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
