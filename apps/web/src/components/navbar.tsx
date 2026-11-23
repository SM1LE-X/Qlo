"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, Search, ShieldCheck } from "lucide-react";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { loadLocalChainMirror } from "@/lib/localState";
import { fetchRelayState } from "@/lib/relayClient";
import { listVaultEntries } from "@/lib/storage";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { cn } from "@/lib/utils";
import { verifyZkeyIntegrity } from "@/lib/zkeyIntegrity";
import { CommandMenu } from "./ui/command-menu";
import { OnboardingModal } from "./ui/onboarding-guide";
import { WalletAuthControls, WorkflowStepSwitcher } from "./wallet-auth-bar";

/**
 * Persistent light header for Qlo's public routes (/ and /story):
 * renders the 3-step switcher (1. Patient -> 2. Hospital -> 3. Insurer),
 * automatic contract role badges, Ethereum Sepolia chain status, and a single
 * wallet-only Connect Wallet control.
 */
export function Navbar() {
  const pathname = usePathname();
  const roles = useWalletRoles();

  const [zkeyStatus, setZkeyStatus] = useState<"checking" | "verified" | "mismatch">("checking");
  const [zkeySha, setZkeySha] = useState<string>("");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStats, setOnboardingStats] = useState({
    vaultCount: 0,
    hasActiveGrant: false,
    settledCount: 0,
  });

  useEffect(() => {
    let active = true;
    verifyZkeyIntegrity()
      .then((res) => {
        if (!active) return;
        setZkeyStatus(res.verified ? "verified" : "mismatch");
        setZkeySha(res.actualSha256);
      })
      .catch(() => {
        if (active) setZkeyStatus("mismatch");
      });

    const syncOnboarding = async () => {
      const remote = !IS_CHAIN_DEPLOYED ? await fetchRelayState() : null;
      const mirror = remote ?? loadLocalChainMirror();
      const now = Math.floor(Date.now() / 1000);
      const hasActiveGrant = Object.values(mirror.grants).some((g) => g.expiresAt > now);
      const items = await listVaultEntries().catch(() => []);
      if (!active) return;
      setOnboardingStats({
        vaultCount: items.length,
        hasActiveGrant,
        settledCount: mirror.settledClaims.length,
      });
    };

    syncOnboarding();
    window.addEventListener("storage", syncOnboarding);
    return () => {
      active = false;
      window.removeEventListener("storage", syncOnboarding);
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E4E4E7]/85 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#09090B] text-white font-mono-tabular font-bold text-sm shadow-xs">
                Q
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold tracking-tight text-[#09090B]">Qlo</div>
                <div className="text-[10px] font-medium text-[#71717A] whitespace-nowrap">
                  ZK Clearinghouse
                </div>
              </div>
            </Link>

            <WorkflowStepSwitcher pathname={pathname} layoutId="qlo-public-step-nav" />

            <Link
              href="/story"
              className={cn(
                "hidden lg:inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                pathname === "/story"
                  ? "border-[#0F766E]/40 bg-[#F0FDFA] text-[#0F766E]"
                  : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Trust Center
            </Link>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              aria-label="Open onboarding guide"
              className="hidden sm:inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#E4E4E7] bg-white px-2 py-1 text-[11px] font-medium text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-[#0F766E]" />
              <span>Guide</span>
            </button>

            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              aria-label="Open command menu"
              className="hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-2 py-1 text-[11px] font-mono-tabular text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors cursor-pointer"
            >
              <Search className="h-3 w-3" />
              <kbd className="rounded bg-[#E4E4E7]/70 px-1 text-[10px]">⌘K</kbd>
            </button>

            <WalletAuthControls roles={roles} zkeyStatus={zkeyStatus} zkeySha={zkeySha} />
          </div>
        </div>
      </header>

      <CommandMenu
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />
      <OnboardingModal
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        vaultCount={onboardingStats.vaultCount}
        hasActiveGrant={onboardingStats.hasActiveGrant}
        settledCount={IS_CHAIN_DEPLOYED ? roles.totalClaimsSettled : onboardingStats.settledCount}
        zkeyVerified={zkeyStatus === "verified"}
      />
    </>
  );
}
