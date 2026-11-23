"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { cn } from "@/lib/utils";
import { WalletAuthControls, WorkflowStepSwitcher } from "./wallet-auth-bar";

/**
 * Single clean persistent top bar shared across every Qlo page:
 * Brand | 1. Patient -> 2. Hospital -> 3. Insurer | How it Works | Sepolia | Connect Wallet
 */
export function Navbar() {
  const pathname = usePathname();
  const roles = useWalletRoles();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4E4E7] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#09090B] text-white font-mono-tabular font-bold text-sm">
              Q
            </div>
            <span className="text-base font-bold tracking-tight text-[#09090B]">Qlo</span>
          </Link>

          <div className="hidden md:block">
            <WorkflowStepSwitcher pathname={pathname} />
          </div>

          <Link
            href="/story"
            className={cn(
              "hidden lg:inline-flex items-center text-xs font-medium transition-colors whitespace-nowrap",
              pathname === "/story"
                ? "text-[#0F766E] font-semibold"
                : "text-[#71717A] hover:text-[#09090B]"
            )}
          >
            How it works
          </Link>
        </div>

        <WalletAuthControls roles={roles} />
      </div>

      {/* Clean mobile 3-step bar */}
      <div className="flex md:hidden justify-center border-t border-[#F4F4F5] px-3 py-2 bg-[#FAFAFA]">
        <WorkflowStepSwitcher pathname={pathname} />
      </div>
    </header>
  );
}
