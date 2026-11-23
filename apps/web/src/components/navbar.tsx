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
    <header className="sticky top-0 z-40 border-b border-[#1E242D] bg-[#090B0E]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2B3340] bg-[#111419] transition-colors group-hover:border-[#10B981]/50">
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
                  stroke="#F3F4F6"
                  strokeWidth="2.2"
                />
                <path
                  d="M16.2 16.2L20.5 20.5"
                  stroke="#10B981"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="11.5" cy="11.5" r="2.2" fill="#10B981" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[#F3F4F6]">
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
              className="hidden lg:inline-flex h-8 items-center gap-2 rounded-lg border border-[#1E242D] bg-[#111419] px-2.5 text-xs text-[#94A3B8] hover:border-[#2B3340] hover:text-[#F3F4F6] transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-[#64748B]" />
              <kbd className="font-mono-tabular text-[10px] text-[#64748B]">
                ⌘K
              </kbd>
            </button>
          ) : null}

          <WalletAuthControls roles={roles} />
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="flex md:hidden items-center overflow-x-auto border-t border-[#1E242D] bg-[#090B0E] px-4 py-1.5">
        <WorkflowStepSwitcher pathname={pathname} />
      </div>
    </header>
  );
}
