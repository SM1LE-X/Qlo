"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AlertTriangle, ExternalLink, Lock } from "lucide-react";
import { useActiveRole } from "@/components/role-context";
import {
  DEPLOYMENT,
  IS_CHAIN_DEPLOYED,
  explorerAddressUrl,
  sourcifyContractUrl,
} from "@/lib/contracts";
import { ROLE_META, roleForPathname } from "@/lib/roles";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { Navbar } from "./navbar";
import { CommandMenu } from "./ui/command-menu";
import { TactileButton } from "./ui/tactile-button";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const roles = useWalletRoles();
  const { activeMeta, mode, canAccess, setActiveRole } = useActiveRole();
  const [commandOpen, setCommandOpen] = useState(false);

  const portalRole = roleForPathname(pathname);
  const showRoleBoundary = Boolean(portalRole && !canAccess(portalRole));
  const portalMeta = portalRole ? ROLE_META[portalRole] : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#09090B]">
      <Navbar onOpenCommandMenu={() => setCommandOpen(true)} />

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {roles.wrongChain ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/35 bg-[#FFFBEB] px-4 py-3 text-xs text-[#B45309]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0" />
              <span>
                Wallet connected to Chain ID{" "}
                <span className="font-mono-tabular font-semibold">{roles.chainId}</span>. Switch to{" "}
                <strong className="text-[#09090B]">Ethereum Sepolia (11155111)</strong> to sign transactions.
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
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/25 bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#B45309]">
            <span>
              Low Sepolia ETH balance (
              <span className="font-mono-tabular font-semibold">{roles.balanceEth} ETH</span>). Fund gas on
              testnet to submit transactions.
            </span>
            <a
              href="https://www.alchemy.com/faucets/ethereum-sepolia"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#B45309] hover:underline"
            >
              Sepolia Faucet <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        {showRoleBoundary && portalMeta ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D4D4D8] bg-[#FAFAFA] px-4 py-2.5 text-xs text-[#52525B]">
            <div className="flex items-center gap-2.5">
              <Lock className="h-3.5 w-3.5 text-[#B45309] shrink-0" />
              <span>
                Signed in as <strong className="text-[#09090B]">{activeMeta.accountName}</strong> · Viewing{" "}
                <strong className="text-[#09090B]">{portalMeta.accountName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {mode === "sandbox" ? (
                <button
                  type="button"
                  onClick={() => setActiveRole(portalMeta.id)}
                  className="rounded-md border border-[#D4D4D8] bg-[#F4F4F5] px-2.5 py-1 text-[11px] font-medium text-[#09090B] hover:border-[#059669]/50 transition-colors cursor-pointer"
                >
                  Sign in as {portalMeta.accountName}
                </button>
              ) : null}
              <Link
                href="/slack"
                className="rounded-md border border-[#E4E4E7] px-2.5 py-1 text-[11px] text-[#52525B] hover:text-[#09090B] transition-colors"
              >
                Open {activeMeta.channelName}
              </Link>
            </div>
          </div>
        ) : null}

        {children}
      </main>

      <footer className="mt-10 border-t border-[#E4E4E7] bg-[#FAFAFA]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8 text-[11px] font-mono-tabular text-[#71717A]">
          <span>Qlo Protocol · Ethereum Sepolia (11155111) · Groth16 BN254</span>

          {IS_CHAIN_DEPLOYED ? (
            <div className="flex flex-wrap items-center gap-4 text-[#52525B]">
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#09090B] transition-colors"
              >
                ClaimsVault <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.Groth16Verifier)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#09090B] transition-colors"
              >
                Groth16Verifier <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={explorerAddressUrl(DEPLOYMENT.contracts.HealthRecords)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#09090B] transition-colors"
              >
                HealthRecords <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={sourcifyContractUrl(DEPLOYMENT.contracts.ClaimsVault)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#059669] hover:underline"
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
