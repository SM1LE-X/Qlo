"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Cpu,
  FileLock2,
  Landmark,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { loadLocalChainMirror } from "@/lib/localState";
import { motionTransitions } from "@/lib/motion-tokens";
import { fetchRelayState } from "@/lib/relayClient";
import { listVaultEntries } from "@/lib/storage";
import { cn, shortHex } from "@/lib/utils";
import { verifyZkeyIntegrity } from "@/lib/zkeyIntegrity";
import { Badge } from "./ui/card";
import { CommandMenu } from "./ui/command-menu";
import { OnboardingModal } from "./ui/onboarding-guide";
import { TactileButton } from "./ui/tactile-button";

const NAV_LINKS = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/patient", label: "Patient Portal", icon: FileLock2 },
  { href: "/hospital", label: "Hospital RCM", icon: Cpu },
  { href: "/insurer", label: "Insurer Treasury", icon: Landmark },
  { href: "/story", label: "Trust Center", icon: ShieldCheck },
];

/**
 * Clean light frosted product header for Qlo's public routes (/ and /story).
 */
export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

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

  const wrongChain = isConnected && chainId !== baseSepolia.id;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E4E4E7]/85 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3.5 shrink-0">
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

            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-0.5 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1"
            >
              {NAV_LINKS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      active ? "text-[#09090B]" : "text-[#52525B] hover:text-[#09090B]"
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="qlo-active-nav"
                        transition={motionTransitions.springMorph}
                        className="absolute inset-0 rounded-lg bg-white shadow-xs border border-[#E4E4E7]/80"
                      />
                    ) : null}
                    <Icon className={cn("relative z-10 h-3.5 w-3.5", active && "text-[#0F766E]")} />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
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

            {zkeyStatus === "verified" ? (
              <Badge variant="emerald" className="hidden sm:inline-flex whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3" />
                <span className="font-mono-tabular">zkey {shortHex(zkeySha, 6, 4)}</span>
              </Badge>
            ) : zkeyStatus === "checking" ? (
              <Badge variant="amber" className="hidden sm:inline-flex whitespace-nowrap">
                Verifying zkey...
              </Badge>
            ) : (
              <Badge variant="crimson" className="hidden sm:inline-flex whitespace-nowrap">
                zkey check failed
              </Badge>
            )}

            {IS_CHAIN_DEPLOYED ? (
              <Badge variant="teal" className="hidden sm:inline-flex whitespace-nowrap">
                Base Sepolia
              </Badge>
            ) : (
              <Badge variant="neutral" className="hidden sm:inline-flex whitespace-nowrap">
                Sandbox
              </Badge>
            )}

            {wrongChain ? (
              <TactileButton
                size="sm"
                variant="amber"
                onClick={() => switchChain({ chainId: baseSepolia.id })}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Switch Network
              </TactileButton>
            ) : isConnected && address ? (
              <TactileButton size="sm" variant="secondary" onClick={() => disconnect()}>
                <Wallet className="h-3.5 w-3.5 text-[#0F766E]" />
                <span className="font-mono-tabular">{shortHex(address, 6, 4)}</span>
              </TactileButton>
            ) : (
              <TactileButton
                size="sm"
                variant="primary"
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
        settledCount={onboardingStats.settledCount}
        zkeyVerified={zkeyStatus === "verified"}
      />
    </>
  );
}
