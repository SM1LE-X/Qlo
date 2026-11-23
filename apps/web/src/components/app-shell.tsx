"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileLock2,
  Landmark,
  Menu,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { DEPLOYMENT, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { loadLocalChainMirror, type LocalChainMirror } from "@/lib/localState";
import { motionTransitions } from "@/lib/motion-tokens";
import { listVaultEntries } from "@/lib/storage";
import { cn, formatWeiToEth, shortHex } from "@/lib/utils";
import { verifyZkeyIntegrity } from "@/lib/zkeyIntegrity";
import { Navbar } from "./navbar";
import { Badge } from "./ui/card";
import { CommandMenu } from "./ui/command-menu";
import { TactileButton } from "./ui/tactile-button";

const WORKSPACE_META: Record<string, { title: string; section: string }> = {
  "/patient": { title: "Patient Vault", section: "Records & Consent" },
  "/hospital": { title: "Provider Clearinghouse", section: "Proving & Settlement" },
  "/insurer": { title: "Payer Treasury & Ledger", section: "Escrow & Privacy Audit" },
  "/story": { title: "Security Trust Center", section: "Cryptography & Compliance" },
};

/**
 * Dual-surface SaaS Chrome:
 * - `/` renders the public landing navbar + 4-column enterprise footer.
 * - Workspace routes render a persistent SaaS sidebar + breadcrumb bar + Notification Bell + wallet dock.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

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
    const syncCounts = () => {
      setMirror(loadLocalChainMirror());
      listVaultEntries()
        .then((items) => setVaultCount(items.length))
        .catch(() => undefined);
    };
    syncCounts();
    window.addEventListener("storage", syncCounts);
    const id = setInterval(syncCounts, 2500);
    return () => {
      window.removeEventListener("storage", syncCounts);
      clearInterval(id);
    };
  }, [pathname]);

  if (isHome) {
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
                  <span className="text-sm font-bold text-[#09090B]">Qlo Health Network</span>
                </div>
                <p className="text-[#52525B] leading-relaxed">
                  Zero-knowledge medical claim adjudication and patient-owned encrypted records on Base Sepolia. Zero plaintext PHI leaves client devices.
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[#09090B]">Workspaces</div>
                <ul className="space-y-1.5 text-[#52525B]">
                  <li>
                    <Link href="/patient" className="hover:text-[#0F766E] transition-colors">
                      Patient Record Vault
                    </Link>
                  </li>
                  <li>
                    <Link href="/hospital" className="hover:text-[#0F766E] transition-colors">
                      Provider Clearinghouse Prover
                    </Link>
                  </li>
                  <li>
                    <Link href="/insurer" className="hover:text-[#0F766E] transition-colors">
                      Payer Treasury &amp; Ledger
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
                      STRIDE &amp; Prior Art Analysis
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[#09090B]">Verification</div>
                <div className="font-mono-tabular text-[#52525B] space-y-1">
                  <div>Chain: Base Sepolia ({DEPLOYMENT.chainId})</div>
                  <div>zkey SHA-256: {DEPLOYMENT.zkeySha256.slice(0, 12)}...</div>
                  <div className="text-[#047857]">MIT Open Source · $0 Stack</div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  const wrongChain = isConnected && chainId !== baseSepolia.id;
  const activeGrantsCount = mirror
    ? Object.values(mirror.grants).filter((g) => g.expiresAt > Math.floor(Date.now() / 1000)).length
    : 0;
  const settledCount = mirror?.settledClaims.length ?? 0;
  const recentAudit = mirror?.auditLogs.slice(0, 5) ?? [];
  const meta = WORKSPACE_META[pathname] ?? { title: "Workspace", section: "Qlo Platform" };

  const workspaceLinks = [
    { href: "/patient", label: "Patient Vault", icon: FileLock2, pill: String(vaultCount) },
    { href: "/hospital", label: "Provider Clearinghouse", icon: Cpu, pill: String(activeGrantsCount) },
    {
      href: "/insurer",
      label: "Payer Treasury",
      icon: Landmark,
      pill: settledCount > 0 ? `${settledCount} settled` : formatWeiToEth(mirror?.insurerEscrowWei ?? "1000000000000000000", 2) + " ETH",
    },
  ];

  const protocolLinks = [
    { href: "/story", label: "Trust Center", icon: ShieldCheck },
    { href: "/", label: "Product Overview", icon: Activity },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        <Link href="/" className="flex items-center gap-2.5 px-2 pt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#09090B] text-white font-mono-tabular font-bold text-sm">
            Q
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-[#09090B]">Qlo Health</div>
            <div className="text-[10px] font-medium text-[#71717A]">Claims Platform</div>
          </div>
        </Link>

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

        <div className="space-y-1">
          <div className="px-2 pb-1 text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.14em] text-[#71717A]">
            Workspaces
          </div>
          {workspaceLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "relative flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  active ? "text-[#09090B]" : "text-[#52525B] hover:bg-white/70 hover:text-[#09090B]"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="sidebar-active"
                    transition={motionTransitions.springMorph}
                    className="absolute inset-0 rounded-xl bg-white border border-[#E4E4E7] shadow-2xs"
                  />
                ) : null}
                <span className="relative z-10 flex items-center gap-2.5">
                  <Icon className={cn("h-4 w-4", active ? "text-[#0F766E]" : "text-[#71717A]")} />
                  {item.label}
                </span>
                <span className="relative z-10 rounded-full bg-[#F4F4F5] px-2 py-0.5 font-mono-tabular text-[10px] text-[#52525B]">
                  {item.pill}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <div className="px-2 pb-1 text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.14em] text-[#71717A]">
            Verification
          </div>
          {protocolLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  active ? "text-[#09090B] bg-white border border-[#E4E4E7] shadow-2xs" : "text-[#52525B] hover:bg-white/70 hover:text-[#09090B]"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-[#0F766E]" : "text-[#71717A]")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Wallet & Network Status Card */}
      <div className="rounded-xl border border-[#E4E4E7] bg-white p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-[#09090B]">
            <span
              className={`h-2 w-2 rounded-full ${
                IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#0F766E]"
              }`}
            />
            {IS_CHAIN_DEPLOYED ? "Base Sepolia Live" : "Local ZK Sandbox"}
          </span>
          <span className="font-mono-tabular text-[10px] text-[#71717A]">84532</span>
        </div>

        {wrongChain ? (
          <TactileButton
            size="sm"
            variant="amber"
            className="w-full"
            onClick={() => switchChain({ chainId: baseSepolia.id })}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Switch Base Sepolia
          </TactileButton>
        ) : isConnected && address ? (
          <TactileButton
            size="sm"
            variant="secondary"
            className="w-full justify-between"
            onClick={() => disconnect()}
          >
            <span className="flex items-center gap-1.5 font-mono-tabular">
              <Wallet className="h-3.5 w-3.5 text-[#0F766E]" />
              {shortHex(address, 6, 4)}
            </span>
            <span className="text-[10px] text-[#71717A]">Disconnect</span>
          </TactileButton>
        ) : (
          <TactileButton
            size="sm"
            variant="primary"
            className="w-full"
            onClick={() => {
              const injectedConn = connectors[0];
              if (injectedConn) connect({ connector: injectedConn });
            }}
          >
            <Wallet className="h-3.5 w-3.5" />
            Connect Wallet
          </TactileButton>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      {/* Persistent Desktop Left Sidebar */}
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
        <header className="sticky top-0 z-30 border-b border-[#E4E4E7] bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 text-xs">
              <button
                type="button"
                aria-label="Open workspace navigation"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden rounded-lg border border-[#E4E4E7] bg-white p-1.5 text-[#09090B] hover:bg-[#F4F4F5] cursor-pointer"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Link href="/" className="text-[#71717A] hover:text-[#09090B] transition-colors">
                Qlo
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-[#A1A1AA]" />
              <span className="font-semibold text-[#09090B]">{meta.title}</span>
              <span className="hidden sm:inline text-[#71717A]">· {meta.section}</span>
            </div>

            <div className="relative flex items-center gap-2">
              {zkeyStatus === "verified" ? (
                <Badge variant="emerald" className="hidden sm:inline-flex">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="font-mono-tabular">zkey {shortHex(zkeySha, 6, 4)}</span>
                </Badge>
              ) : null}

              {/* Interactive Notification Bell */}
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
          {children}
        </main>
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
