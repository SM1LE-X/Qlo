"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED, explorerAddressUrl } from "@/lib/contracts";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { Navbar } from "./navbar";
import { TactileButton } from "./ui/tactile-button";

/**
 * Clean, single-column focused shell shared by all routes.
 * No cluttered sidebars, no duplicate steppers, no decorative milestone rails.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const roles = useWalletRoles();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {roles.wrongChain ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-xs text-[#92400E]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0" />
              <span>
                Your wallet is on Chain ID {roles.chainId}. Switch to <strong>Ethereum Sepolia (11155111)</strong> to continue.
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
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#92400E]">
            <span>Low Sepolia ETH balance ({roles.balanceEth} ETH). Top up free testnet ETH to send transactions.</span>
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

      <footer className="border-t border-[#E4E4E7] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 text-xs text-[#71717A]">
          <div>
            <span className="font-semibold text-[#09090B]">Qlo</span> · Private Health Insurance Claims on Ethereum Sepolia
          </div>
          <div className="flex items-center gap-4">
            <Link href="/story" className="hover:text-[#09090B] transition-colors">
              Contracts &amp; ZK Details
            </Link>
            {IS_CHAIN_DEPLOYED ? (
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#0F766E] hover:underline"
              >
                ClaimsVault on Etherscan <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
