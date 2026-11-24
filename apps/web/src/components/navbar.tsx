"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { WalletAuthControls, WorkflowStepSwitcher } from "./wallet-auth-bar";

export function Navbar({
  onOpenCommandMenu,
  onOpenOnboarding: _onOpenOnboarding,
}: {
  onOpenCommandMenu?: () => void;
  onOpenOnboarding?: () => void;
}) {
  const pathname = usePathname();
  const roles = useWalletRoles();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4E4E7] bg-[#FFFFFF]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#09090B] transition-colors group-hover:border-[#09090B]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="11.5"
                  cy="11.5"
                  r="6.5"
                  stroke="#FFFFFF"
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
            <span className="text-[15px] font-semibold tracking-tight text-[#09090B]">
              Qlo
            </span>
          </Link>

          <div className="hidden md:block">
            <WorkflowStepSwitcher pathname={pathname} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenCommandMenu ? (
            <button
              type="button"
              onClick={onOpenCommandMenu}
              aria-label="Open command menu (Ctrl+K)"
              className="hidden lg:inline-flex h-8 items-center gap-2 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 text-xs text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-[#71717A]" />
              <kbd className="font-mono-tabular text-[10px] text-[#71717A]">
                ⌘K
              </kbd>
            </button>
          ) : null}

          <WalletAuthControls roles={roles} />
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="flex md:hidden items-center overflow-x-auto border-t border-[#E4E4E7] bg-[#FFFFFF] px-4 py-1.5">
        <WorkflowStepSwitcher pathname={pathname} />
      </div>
    </header>
  );
}
