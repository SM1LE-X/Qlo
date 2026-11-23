"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  DEPLOYMENT,
  IS_CHAIN_DEPLOYED,
  explorerAddressUrl,
  sourcifyContractUrl,
} from "@/lib/contracts";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { Navbar } from "./navbar";
import { CommandMenu } from "./ui/command-menu";
import { TactileButton } from "./ui/tactile-button";

export function AppShell({ children }: { children: ReactNode }) {
  const roles = useWalletRoles();
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#090B0E] text-[#F3F4F6]">
      <Navbar onOpenCommandMenu={() => setCommandOpen(true)} />

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {roles.wrongChain ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-4 py-3 text-xs text-[#FCD34D]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0" />
              <span>
                Wallet connected to Chain ID{" "}
                <span className="font-mono-tabular font-semibold">{roles.chainId}</span>. Switch to{" "}
                <strong className="text-[#F3F4F6]">Ethereum Sepolia (11155111)</strong> to sign transactions.
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
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/8 px-4 py-2.5 text-xs text-[#FCD34D]">
            <span>
              Low Sepolia ETH balance (
              <span className="font-mono-tabular font-semibold">{roles.balanceEth} ETH</span>). Fund gas on
              testnet to submit transactions.
            </span>
            <a
              href="https://www.alchemy.com/faucets/ethereum-sepolia"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#F59E0B] hover:underline"
            >
              Sepolia Faucet <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        {children}
      </main>

      <footer className="mt-10 border-t border-[#1E242D] bg-[#090B0E]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8 text-[11px] font-mono-tabular text-[#64748B]">
          <span>Qlo Protocol · Ethereum Sepolia (11155111) · Groth16 BN254</span>

          {IS_CHAIN_DEPLOYED ? (
            <div className="flex flex-wrap items-center gap-4 text-[#94A3B8]">
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#F3F4F6] transition-colors"
              >
                ClaimsVault <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.Groth16Verifier)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#F3F4F6] transition-colors"
              >
                Groth16Verifier <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.HealthRecords)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#F3F4F6] transition-colors"
              >
                HealthRecords <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={sourcifyContractUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#10B981] hover:underline"
              >
                Sourcify <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
