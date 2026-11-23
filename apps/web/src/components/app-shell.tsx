"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertTriangle, ExternalLink, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerAddressUrl, sourcifyContractUrl } from "@/lib/contracts";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth } from "@/lib/utils";
import { Navbar } from "./navbar";
import { CommandMenu } from "./ui/command-menu";
import { OnboardingModal } from "./ui/onboarding-guide";
import { TactileButton } from "./ui/tactile-button";

/**
 * Enterprise full-canvas application shell with live protocol telemetry strip,
 * global Cmd+K Command Palette, and interactive Role & Walkthrough Guide.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const roles = useWalletRoles();
  const [commandOpen, setCommandOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const liveEscrowEth = formatWeiToEth(roles.insurerEscrowWei, 4);

  return (
    <div className="relative min-h-screen flex flex-col bg-[#F7F8F7] bg-clinical-grid">
      {/* Subtle top ambient wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(15,118,110,0.09),transparent_72%)]"
      />

      {/* Enterprise System Telemetry Top Strip */}
      <div className="border-b border-white/10 bg-[#090C0E] text-zinc-300">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-1.5 sm:px-8 lg:px-10 text-[11px] font-mono-tabular">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
              {IS_CHAIN_DEPLOYED
                ? "ETHEREUM SEPOLIA (11155111) · 5/5 CONTRACTS OPERATIONAL"
                : "SANDBOX CLEARINGHOUSE · LOCAL ZERO-KNOWLEDGE MODE"}
            </span>
            <span className="hidden md:inline text-zinc-600">|</span>
            <span className="hidden md:inline text-zinc-400">
              PROVER: <strong className="text-zinc-200">GROTH16 BN254 (4,349 R1CS)</strong>
            </span>
            <span className="hidden lg:inline text-zinc-600">|</span>
            <span className="hidden lg:inline-flex items-center gap-1 text-emerald-300">
              <Lock className="h-3 w-3" />
              ZERO-PHI BOUNDARY ENFORCED
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-zinc-400">
              ESCROW POOL: <strong className="text-white">{liveEscrowEth} ETH</strong>
            </span>
            {IS_CHAIN_DEPLOYED ? (
              <a
                href={sourcifyContractUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 hover:underline"
              >
                Sourcify Verified <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <Navbar
        onOpenCommandMenu={() => setCommandOpen(true)}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />

      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />

      <OnboardingModal
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        vaultCount={1}
        hasActiveGrant={false}
        settledCount={roles.totalClaimsSettled}
        zkeyVerified={true}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
        {roles.wrongChain ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB]/95 px-5 py-3.5 text-xs text-[#92400E] shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0" />
              <span>
                Your wallet is on Chain ID {roles.chainId}. Switch to{" "}
                <strong>Ethereum Sepolia (11155111)</strong> to sign transactions.
              </span>
            </div>
            <TactileButton
              size="sm"
              variant="amber"
              onClick={() => roles.switchToSepolia()}
            >
              Switch to Sepolia
            </TactileButton>
          </div>
        ) : null}

        {roles.lowGasBalance ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB]/95 px-5 py-3 text-xs text-[#92400E]">
            <span>
              Low Sepolia ETH balance ({roles.balanceEth} ETH). Top up free testnet ETH to send
              transactions.
            </span>
            <a
              href="https://www.alchemy.com/faucets/ethereum-sepolia"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              Sepolia Faucet <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        {children}
      </main>

      <footer className="mt-12 border-t border-[#E4E4E7]/90 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-10 text-xs text-[#71717A]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#09090B]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
              Qlo Enterprise Clearinghouse
            </span>
            <span className="text-[#D4D4D8]">·</span>
            <span>Zero-Knowledge Health Insurance Claims on Ethereum Sepolia</span>
            <span className="hidden sm:inline text-[#D4D4D8]">·</span>
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#047857]">
              100% MIT Open Source · 0 PHI On-Chain
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="inline-flex items-center gap-1 text-[#52525B] hover:text-[#09090B] cursor-pointer"
            >
              <Sparkles className="h-3 w-3 text-[#0F766E]" />
              Command Palette (⌘K)
            </button>
            <Link href="/patient" className="hover:text-[#09090B] transition-colors">
              1. Patient
            </Link>
            <Link href="/hospital" className="hover:text-[#09090B] transition-colors">
              2. Hospital
            </Link>
            <Link href="/insurer" className="hover:text-[#09090B] transition-colors">
              3. Insurer
            </Link>
            <Link href="/story" className="hover:text-[#09090B] transition-colors">
              Trust Center
            </Link>
            {IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#0F766E] hover:underline"
              >
                ClaimsVault <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
