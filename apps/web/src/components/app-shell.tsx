"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Compass,
  Cpu,
  ExternalLink,
  FileCode2,
  FileLock2,
  FileText,
  KeyRound,
  Landmark,
  Menu,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { loadLocalChainMirror, type LocalChainMirror } from "@/lib/localState";
import { motionTransitions } from "@/lib/motion-tokens";
import { fetchRelayState } from "@/lib/relayClient";
import { listVaultEntries } from "@/lib/storage";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { cn, formatWeiToEth, shortHex } from "@/lib/utils";
import { verifyZkeyIntegrity } from "@/lib/zkeyIntegrity";
import { Navbar } from "./navbar";
import { CommandMenu } from "./ui/command-menu";
import {
  ONBOARDING_DISMISSED_KEY,
  OnboardingChecklistRail,
  OnboardingModal,
} from "./ui/onboarding-guide";
import { TactileButton } from "./ui/tactile-button";
import { WalletAuthControls, WorkflowStepSwitcher } from "./wallet-auth-bar";

interface PortalNavSection {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  pill?: string;
}

interface PortalProfile {
  brand: string;
  subBrand: string;
  roleTitle: string;
  roleRule: string;
  badgeColor: string;
  accentText: string;
}

const PORTAL_PROFILES: Record<string, PortalProfile> = {
  "/patient": {
    brand: "Qlo Care",
    subBrand: "Patient Dashboard",
    roleTitle: "Patient Wallet Auth",
    roleRule: "Client AES-256-GCM & Consent Keys",
    badgeColor: "bg-[#0F766E]",
    accentText: "text-[#0F766E]",
  },
  "/hospital": {
    brand: "Qlo Clearinghouse",
    subBrand: "Hospital Claims Portal",
    roleTitle: "Hospital Merkle Auth",
    roleRule: "Poseidon(addr, NPI) · Prover",
    badgeColor: "bg-[#0F4C81]",
    accentText: "text-[#0F4C81]",
  },
  "/insurer": {
    brand: "Qlo Treasury",
    subBrand: "Insurer Audit View",
    roleTitle: "Insurer Treasury Auth",
    roleRule: "ClaimsVault & Zero-PHI Calldata",
    badgeColor: "bg-[#047857]",
    accentText: "text-[#047857]",
  },
};

/**
 * Dual-surface Zero-PHI shell:
 * - Public pages (`/`, `/story`) use `<Navbar />` + 4-column enterprise footer.
 * - Dedicated views (`/patient`, `/hospital`, `/insurer`) render strictly that route's controls in an isolated
 *   sidebar, live smart-contract role detection, and a persistent top bar with Connect Wallet + 1 -> 2 -> 3 switcher.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/" || pathname === "/story";

  const roles = useWalletRoles();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const [zkeyStatus, setZkeyStatus] = useState<"checking" | "verified" | "mismatch">("checking");
  const [zkeySha, setZkeySha] = useState<string>("");
  const [vaultCount, setVaultCount] = useState<number>(0);
  const [mirror, setMirror] = useState<LocalChainMirror | null>(null);

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
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const syncCounts = async () => {
      if (active && !IS_CHAIN_DEPLOYED) {
        setMirror(loadLocalChainMirror());
      }
      const [localEntries, remoteMirror] = await Promise.all([
        listVaultEntries().catch(() => []),
        !IS_CHAIN_DEPLOYED ? fetchRelayState() : Promise.resolve(null),
      ]);
      if (!active) return;
      setVaultCount(localEntries.length);
      if (remoteMirror) {
        setMirror(remoteMirror);
      }
    };
    syncCounts();
    window.addEventListener("storage", syncCounts);
    const id = setInterval(syncCounts, 4500);
    return () => {
      active = false;
      window.removeEventListener("storage", syncCounts);
      clearInterval(id);
    };
  }, [pathname]);

  useEffect(() => {
    setNotifOpen(false);
  }, [pathname]);

  if (isPublicPage) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-[#E4E4E7] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#09090B] text-white font-mono-tabular font-bold text-xs">
                    Q
                  </div>
                  <span className="text-sm font-bold text-[#09090B]">Qlo Clearinghouse</span>
                </div>
                <p className="text-[#52525B] leading-relaxed">
                  Privacy-preserving medical claim adjudication and patient-controlled encrypted records. Clinical plaintext remains strictly client-side.
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[#09090B]">Protocol Workflow</div>
                <ul className="space-y-1.5 text-[#52525B]">
                  <li>
                    <Link href="/patient" className="hover:text-[#0F766E] transition-colors">
                      1. Patient Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/hospital" className="hover:text-[#0F766E] transition-colors">
                      2. Hospital Claims Portal
                    </Link>
                  </li>
                  <li>
                    <Link href="/insurer" className="hover:text-[#0F766E] transition-colors">
                      3. Insurer Audit View
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[#09090B]">Trust &amp; Protocol</div>
                <ul className="space-y-1.5 text-[#52525B]">
                  <li>
                    <Link href="/story" className="hover:text-[#0F766E] transition-colors">
                      Cryptographic Trust Center
                    </Link>
                  </li>
                  <li>
                    <Link href="/story" className="hover:text-[#0F766E] transition-colors">
                      8-Signal Groth16 Specification
                    </Link>
                  </li>
                  <li>
                    <Link href="/story" className="hover:text-[#0F766E] transition-colors">
                      Security Model &amp; Specifications
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[#09090B]">Verification</div>
                <div className="font-mono-tabular text-[#52525B] space-y-1">
                  <div>Chain: Ethereum Sepolia ({DEPLOYMENT.chainId})</div>
                  <div>zkey SHA-256: {DEPLOYMENT.zkeySha256.slice(0, 12)}...</div>
                  <div className="text-[#047857]">MIT Licensed · Open Specification</div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  const activeGrantsCount = mirror
    ? Object.values(mirror.grants).filter((g) => g.expiresAt > Math.floor(Date.now() / 1000)).length
    : 0;
  const settledCount = IS_CHAIN_DEPLOYED
    ? roles.totalClaimsSettled
    : mirror?.settledClaims.length ?? 0;
  const recentAudit = mirror?.auditLogs.slice(0, 5) ?? [];

  const profile = PORTAL_PROFILES[pathname] ?? {
    brand: "Qlo Platform",
    subBrand: "Workspace",
    roleTitle: "Wallet Auth",
    roleRule: "Ethereum Sepolia (11155111)",
    badgeColor: "bg-[#09090B]",
    accentText: "text-[#0F766E]",
  };

  let portalSections: PortalNavSection[] = [];
  if (pathname === "/patient") {
    portalSections = [
      { href: "/patient#patient-intake", label: "Intake & Local OCR", icon: FileText },
      { href: "/patient#patient-consent", label: "Encrypt, Anchor & Consent", icon: KeyRound },
      { href: "/patient#patient-vault", label: "Encrypted Vault", icon: FileLock2, pill: String(vaultCount) },
      { href: "/patient#patient-audit", label: "Access Audit Trail", icon: Activity },
      { href: "/patient#patient-benefits", label: "Covered Benefits", icon: ShieldCheck },
    ];
  } else if (pathname === "/hospital") {
    portalSections = [
      {
        href: "/hospital#hospital-queue",
        label: "Access & Record Queue",
        icon: FileLock2,
        pill: IS_CHAIN_DEPLOYED ? String(vaultCount) : String(activeGrantsCount),
      },
      { href: "/hospital#hospital-prover", label: "Groth16 Eligibility Prover", icon: Cpu },
      { href: "/hospital#hospital-standards", label: "X12 837P & FHIR R4", icon: FileCode2 },
      { href: "/hospital#hospital-guardrails", label: "Policy & Fraud Guardrails", icon: ShieldAlert },
    ];
  } else if (pathname === "/insurer") {
    const escrowDisplay = IS_CHAIN_DEPLOYED
      ? `${formatWeiToEth(roles.insurerEscrowWei, 2)} ETH`
      : `${formatWeiToEth(mirror?.insurerEscrowWei ?? "1000000000000000000", 2)} ETH`;
    portalSections = [
      {
        href: "/insurer#insurer-reserves",
        label: "Escrow Reserves",
        icon: Landmark,
        pill: escrowDisplay,
      },
      { href: "/insurer#insurer-analytics", label: "Liquidity & Cap Mix", icon: Activity },
      { href: "/insurer#insurer-ledger", label: "Settlement Ledger", icon: CheckCircle2, pill: String(settledCount) },
      { href: "/insurer#insurer-audit", label: "Zero-PHI Calldata Audit", icon: ShieldCheck },
    ];
  }

  const routeRoleUnlocked =
    pathname === "/patient"
      ? roles.isPatient
      : pathname === "/hospital"
      ? roles.isApprovedHospital
      : pathname === "/insurer"
      ? roles.isInsurer
      : roles.isConnected;

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-5">
        <Link href="/" className="flex items-center gap-2.5 px-2 pt-1">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl text-white font-mono-tabular font-bold text-sm",
              profile.badgeColor
            )}
          >
            Q
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-[#09090B]">{profile.brand}</div>
            <div className="text-[10px] font-medium text-[#71717A]">{profile.subBrand}</div>
          </div>
        </Link>

        {/* Live Contract Role Authorization Card */}
        <div className="rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className={cn("text-[11px] font-semibold", profile.accentText)}>
              {profile.roleTitle}
            </span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-mono-tabular font-semibold",
                routeRoleUnlocked
                  ? "bg-[#ECFDF5] text-[#047857]"
                  : IS_CHAIN_DEPLOYED
                  ? "bg-[#FEF2F2] text-[#B91C1C]"
                  : "bg-[#F0FDFA] text-[#0F766E]"
              )}
            >
              {routeRoleUnlocked
                ? "Verified"
                : IS_CHAIN_DEPLOYED
                ? roles.isConnected
                  ? "Not Registered"
                  : "Wallet Required"
                : "Sandbox Open"}
            </span>
          </div>
          <div className="text-[10px] font-mono-tabular text-[#71717A] truncate">
            {roles.isConnected && roles.address
              ? `${shortHex(roles.address, 6, 4)} · ${profile.roleRule}`
              : profile.roleRule}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#71717A] hover:border-[#D4D4D8] hover:text-[#09090B] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            Quick jump...
          </span>
          <kbd className="rounded border border-[#E4E4E7] bg-[#FAFAFA] px-1.5 py-0.5 font-mono-tabular text-[10px]">
            ⌘K
          </kbd>
        </button>

        {/* Route-Isolated Controls Navigation */}
        <div className="space-y-1">
          <div className="px-2 pb-1 text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.14em] text-[#71717A]">
            {profile.subBrand}
          </div>
          {portalSections.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-white border border-[#E4E4E7] text-[#09090B] shadow-2xs"
                    : "text-[#52525B] hover:bg-white/70 hover:text-[#09090B]"
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className={cn("h-4 w-4 shrink-0", active ? profile.accentText : "text-[#71717A]")} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.pill !== undefined ? (
                  <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 font-mono-tabular text-[10px] text-[#52525B] shrink-0">
                    {item.pill}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <div className="px-2 pb-1 text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.14em] text-[#71717A]">
            Protocol
          </div>
          <Link
            href="/story"
            onClick={() => setMobileNavOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#52525B] hover:bg-white/70 hover:text-[#09090B] transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-[#71717A]" />
            Trust Center
          </Link>
          <Link
            href="/"
            onClick={() => setMobileNavOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#52525B] hover:bg-white/70 hover:text-[#09090B] transition-colors"
          >
            <Activity className="h-4 w-4 text-[#71717A]" />
            Product Overview
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
                window.dispatchEvent(new Event("storage"));
              }
              setMobileNavOpen(false);
              setOnboardingOpen(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#52525B] hover:bg-white/70 hover:text-[#09090B] transition-colors cursor-pointer"
          >
            <Compass className="h-4 w-4 text-[#0F766E]" />
            Setup Guide
          </button>
        </div>
      </div>

      {/* Bottom Network & Low-Gas Faucet Guard */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white p-3 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-[#09090B]">
            <span
              className={`h-2 w-2 rounded-full ${
                IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#0F766E]"
              }`}
            />
            {IS_CHAIN_DEPLOYED ? "Ethereum Sepolia Live" : "Sandbox Mode"}
          </span>
          <span className="font-mono-tabular text-[10px] text-[#71717A]">
            Chain {DEPLOYMENT.chainId}
          </span>
        </div>

        {roles.lowGasBalance ? (
          <a
            href="https://www.alchemy.com/faucets/ethereum-sepolia"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-1 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1.5 text-[10px] font-medium text-[#B45309] hover:bg-[#FEF3C7] transition-colors"
          >
            <span>Low testnet ETH</span>
            <span className="inline-flex items-center gap-0.5 font-semibold">
              Faucet <ExternalLink className="h-2.5 w-2.5" />
            </span>
          </a>
        ) : (
          <div className="text-[10px] font-mono-tabular text-[#71717A]">
            {IS_CHAIN_DEPLOYED
              ? "Wallet auth reads live contracts"
              : "Full ZK + ECDH active without gas"}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      {/* Persistent Focused Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-[#E4E4E7] bg-[#F4F4F5]/75 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileNavOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex lg:hidden bg-[#09090B]/30 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={motionTransitions.springSnappy}
              onClick={(e) => e.stopPropagation()}
              className="w-68 bg-[#F4F4F5] border-r border-[#E4E4E7] h-full"
            >
              <div className="flex justify-end px-4 pt-3">
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#E4E4E7] cursor-pointer"
                >
                  <X className="h-4 w-4 text-[#09090B]" />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Right Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Persistent Top Navbar with 1->2->3 Switcher, Chain, Role Badges & Connect Wallet */}
        <header className="sticky top-0 z-30 border-b border-[#E4E4E7] bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 text-xs min-w-0">
              <button
                type="button"
                aria-label="Open workspace navigation"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden rounded-lg border border-[#E4E4E7] bg-white p-1.5 text-[#09090B] hover:bg-[#F4F4F5] cursor-pointer"
              >
                <Menu className="h-4 w-4" />
              </button>

              <WorkflowStepSwitcher pathname={pathname} layoutId="qlo-workspace-step-nav" />

              <span className="md:hidden font-semibold text-[#09090B] truncate">
                {profile.subBrand}
              </span>
            </div>

            <div className="relative flex items-center gap-1.5 shrink-0">
              <WalletAuthControls roles={roles} zkeyStatus={zkeyStatus} zkeySha={zkeySha} />

              {/* Interactive Activity Bell */}
              <button
                type="button"
                aria-label="Toggle workspace notifications"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {recentAudit.length > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#0F766E] ring-2 ring-white" />
                ) : null}
              </button>

              {notifOpen ? (
                <div className="absolute right-0 top-11 w-80 rounded-2xl border border-[#E4E4E7] bg-white p-3 shadow-[0_16px_44px_-12px_rgba(15,23,42,0.22)] z-50">
                  <div className="flex items-center justify-between border-b border-[#F4F4F5] pb-2 mb-2 text-xs font-semibold text-[#09090B]">
                    <span>Recent Protocol Activity</span>
                    <span className="font-mono-tabular text-[11px] text-[#71717A]">
                      {recentAudit.length} events
                    </span>
                  </div>
                  {recentAudit.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[#71717A]">
                      No events recorded in this session yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {recentAudit.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-lg border border-[#F4F4F5] bg-[#FAFAFA] p-2 text-[11px]"
                        >
                          <div className="font-semibold text-[#09090B]">{ev.title}</div>
                          <div className="text-[#52525B] truncate">{ev.detail}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 lg:px-8">
          {roles.wrongChain ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#92400E]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0" />
                <span>
                  Wallet connected on wrong network (Chain ID {roles.chainId}). Switch to Ethereum Sepolia (11155111) for on-chain actions.
                </span>
              </div>
              <TactileButton
                size="sm"
                variant="amber"
                onClick={() => roles.switchToSepolia()}
              >
                Switch to Ethereum Sepolia (11155111)
              </TactileButton>
            </div>
          ) : null}

          <OnboardingChecklistRail
            pathname={pathname}
            vaultCount={vaultCount}
            hasActiveGrant={activeGrantsCount > 0}
            settledCount={settledCount}
            zkeyVerified={zkeyStatus === "verified"}
            onOpenGuide={() => setOnboardingOpen(true)}
          />
          {children}
        </main>
      </div>

      <CommandMenu
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />
      <OnboardingModal
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        vaultCount={vaultCount}
        hasActiveGrant={activeGrantsCount > 0}
        settledCount={settledCount}
        zkeyVerified={zkeyStatus === "verified"}
      />
    </div>
  );
}
