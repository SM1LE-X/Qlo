"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerAddressUrl } from "@/lib/contracts";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { Navbar } from "./navbar";
import { TactileButton } from "./ui/tactile-button";

/**
 * Full-canvas architectural shell shared across all Qlo routes.
 * Uses the full viewport width cleanly (up to 1440px) with subtle blueprint grid & ambient clinical wash.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const roles = useWalletRoles();

  return (
    <div className="relative min-h-screen flex flex-col bg-[#F7F8F7] bg-clinical-grid">
      {/* Subtle top ambient wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(15,118,110,0.09),transparent_72%)]"
      />

      <Navbar />

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

      <footer className="mt-10 border-t border-[#E4E4E7]/90 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-10 text-xs text-[#71717A]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#09090B]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
              Qlo Protocol
            </span>
            <span className="text-[#D4D4D8]">·</span>
            <span>Zero-Knowledge Health Insurance Claims on Ethereum Sepolia</span>
            <span className="hidden sm:inline text-[#D4D4D8]">·</span>
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#047857]">
              100% MIT Open Source · 0 PHI On-Chain
            </span>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/patient" className="hover:text-[#09090B] transition-colors">
              Patient
            </Link>
            <Link href="/hospital" className="hover:text-[#09090B] transition-colors">
              Hospital
            </Link>
            <Link href="/insurer" className="hover:text-[#09090B] transition-colors">
              Insurer
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
