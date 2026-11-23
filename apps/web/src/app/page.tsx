"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Cpu, FileLock2, Landmark, Lock, ShieldCheck } from "lucide-react";
import { TactileButton } from "@/components/ui/tactile-button";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { loadLocalChainMirror } from "@/lib/localState";
import { fetchRelayState } from "@/lib/relayClient";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth } from "@/lib/utils";

const STEPS = [
  {
    number: "Step 1",
    role: "Patient",
    href: "/patient",
    icon: FileLock2,
    accent: "text-[#0F766E] bg-[#F0FDFA] border-[#99F6E4]",
    headline: "Lock your record & control access",
    description:
      "Enter a sample medical bill, encrypt it on your device so nobody else can read it, and grant or revoke access for your hospital anytime.",
    cta: "Open Patient Dashboard",
  },
  {
    number: "Step 2",
    role: "Hospital",
    href: "/hospital",
    icon: Cpu,
    accent: "text-[#0F4C81] bg-[#F0F9FF] border-[#BAE6FD]",
    headline: "Prove the claim & get paid",
    description:
      "Unlock the shared medical record, prove it meets policy rules using a zero-knowledge proof in your browser, and receive automatic ETH payout.",
    cta: "Open Hospital Portal",
  },
  {
    number: "Step 3",
    role: "Insurer",
    href: "/insurer",
    icon: Landmark,
    accent: "text-[#047857] bg-[#ECFDF5] border-[#A7F3D0]",
    headline: "Audit payouts with zero medical leaks",
    description:
      "Fund the escrow pool, view every verified payout on Ethereum Sepolia, and confirm zero diagnoses or prescriptions ever reach the blockchain.",
    cta: "Open Insurer Audit",
  },
] as const;

export default function HomePage() {
  const roles = useWalletRoles();
  const [sandboxStats, setSandboxStats] = useState({ escrowEth: "0.0200", claims: 0 });

  useEffect(() => {
    if (IS_CHAIN_DEPLOYED) return;
    let active = true;
    const sync = async () => {
      const mirror = (await fetchRelayState()) ?? loadLocalChainMirror();
      if (!active) return;
      setSandboxStats({
        escrowEth: formatWeiToEth(mirror.insurerEscrowWei, 4),
        claims: mirror.settledClaims.length,
      });
    };
    sync();
    return () => {
      active = false;
    };
  }, []);

  const liveEscrowEth = IS_CHAIN_DEPLOYED
    ? formatWeiToEth(roles.insurerEscrowWei, 4)
    : sandboxStats.escrowEth;
  const liveClaims = IS_CHAIN_DEPLOYED ? roles.totalClaimsSettled : sandboxStats.claims;

  return (
    <div className="space-y-12 py-4">
      {/* Focused Hero */}
      <section className="mx-auto max-w-3xl text-center space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-white px-3.5 py-1 text-xs font-medium text-[#52525B] shadow-2xs">
          <span
            className={`h-2 w-2 rounded-full ${
              IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#F59E0B]"
            }`}
          />
          {IS_CHAIN_DEPLOYED
            ? "Live on Ethereum Sepolia · Verified Contracts"
            : "Local Sandbox Mode · No Wallet Required"}
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#09090B] leading-[1.1]">
          Automatic insurance payouts. Zero exposed medical records.
        </h1>

        <p className="text-sm sm:text-base text-[#52525B] max-w-2xl mx-auto leading-relaxed">
          Patients encrypt their own health bills and control who can view them. Hospitals prove a claim is valid with zero-knowledge math and get paid automatically. Insurers verify every payout without ever seeing a diagnosis.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/patient">
            <TactileButton variant="primary" size="lg">
              Start Step 1: Patient
              <ArrowRight className="h-4 w-4" />
            </TactileButton>
          </Link>
          <Link href="/story">
            <TactileButton variant="secondary" size="lg">
              <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
              How the Privacy Works
            </TactileButton>
          </Link>
        </div>
      </section>

      {/* 3 Simple Steps */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.href}
              href={step.href}
              className="group flex flex-col justify-between rounded-2xl border border-[#E4E4E7] bg-white p-6 transition-all hover:border-[#09090B]/30 hover:shadow-md"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${step.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-[#71717A]">
                    {step.number} · {step.role}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base font-semibold text-[#09090B]">{step.headline}</h2>
                  <p className="text-xs text-[#52525B] leading-relaxed">{step.description}</p>
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] group-hover:translate-x-0.5 transition-transform">
                {step.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          );
        })}
      </section>

      {/* Live Protocol Snapshot (3 Real Numbers Only) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-2xl border border-[#E4E4E7] bg-white p-5">
        <div className="space-y-0.5 px-2">
          <div className="text-xs text-[#71717A]">Insurer Escrow Pool</div>
          <div className="text-xl font-bold font-mono-tabular text-[#09090B]">
            {liveEscrowEth} ETH
          </div>
          <div className="text-[11px] text-[#52525B]">
            {IS_CHAIN_DEPLOYED ? "Live in Sepolia ClaimsVault" : "Sandbox escrow balance"}
          </div>
        </div>

        <div className="space-y-0.5 px-2 sm:border-l sm:border-[#F4F4F5] sm:pl-6">
          <div className="text-xs text-[#71717A]">Verified Claims Paid</div>
          <div className="text-xl font-bold font-mono-tabular text-[#09090B]">{liveClaims}</div>
          <div className="text-[11px] text-[#52525B]">Paid automatically by smart contract</div>
        </div>

        <div className="space-y-0.5 px-2 sm:border-l sm:border-[#F4F4F5] sm:pl-6">
          <div className="text-xs text-[#71717A] flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-[#047857]" />
            Medical Data Sent On-Chain
          </div>
          <div className="text-xl font-bold font-mono-tabular text-[#047857]">0 bytes</div>
          <div className="text-[11px] text-[#52525B]">
            Diagnoses &amp; prescriptions stay encrypted off-chain
          </div>
        </div>
      </section>
    </div>
  );
}
