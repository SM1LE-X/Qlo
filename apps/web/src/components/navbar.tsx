"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { cn } from "@/lib/utils";
import { WalletAuthControls, WorkflowStepSwitcher } from "./wallet-auth-bar";

/**
 * Full-width translucent architectural navigation bar shared across every Qlo route.
 */
export function Navbar() {
  const pathname = usePathname();
  const roles = useWalletRoles();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4E4E7]/85 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-10">
        <div className="flex items-center gap-5 min-w-0">
          <Link href="/" className="group flex items-center gap-2.5 shrink-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#090C0E] text-white shadow-[0_2px_10px_-2px_rgba(9,12,14,0.38)] transition-transform group-hover:scale-[1.03]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-white"
              >
                <circle
                  cx="11.5"
                  cy="11.5"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
                <path
                  d="M16.2 16.2L20.5 20.5"
                  stroke="#34D399"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="11.5" cy="11.5" r="2.2" fill="#34D399" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[17px] font-bold tracking-tight text-[#09090B]">Qlo</span>
              <span className="hidden sm:block text-[10px] font-medium tracking-wide text-[#71717A] mt-0.5">
                ZK Health Claims
              </span>
            </div>
          </Link>

          <div className="hidden md:block">
            <WorkflowStepSwitcher pathname={pathname} />
          </div>

          <Link
            href="/story"
            className={cn(
              "hidden lg:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
              pathname === "/story"
                ? "bg-[#F0FDFA] text-[#0F766E] font-semibold"
                : "text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F5F4]"
            )}
          >
            How it works
          </Link>
        </div>

        <WalletAuthControls roles={roles} />
      </div>

      {/* Mobile 3-step bar */}
      <div className="flex md:hidden justify-center border-t border-[#F4F4F5] px-3 py-2 bg-[#F7F8F7]/90">
        <WorkflowStepSwitcher pathname={pathname} />
      </div>
    </header>
  );
}
