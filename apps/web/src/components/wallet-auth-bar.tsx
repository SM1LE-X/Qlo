"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Lock, ShieldCheck, Wallet } from "lucide-react";
import { useConnect, useDisconnect } from "wagmi";
import { useActiveRole } from "@/components/role-context";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { ROLE_META, ROLE_ORDER, type AppRole } from "@/lib/roles";
import { connectInjectedWallet, type WalletRolesState } from "@/lib/useWalletRoles";
import { cn, shortHex } from "@/lib/utils";
import { TactileButton } from "./ui/tactile-button";

export const WORKFLOW_STEPS = [
  { href: "/onboarding", label: "Sign In" },
  { href: "/patient", label: "Patient" },
  { href: "/hospital", label: "Hospital" },
  { href: "/insurer", label: "Insurer" },
] as const;

export function WorkflowStepSwitcher({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary navigation" className="flex items-center gap-1">
      {WORKFLOW_STEPS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors",
              active
                ? "bg-[#F4F4F5] text-[#09090B] border border-[#D4D4D8]"
                : "border border-transparent text-[#52525B] hover:text-[#09090B] hover:bg-[#FFFFFF]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function RoleIdentityPill() {
  const { activeRole, activeMeta, mode, canAccess, setActiveRole } = useActiveRole();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (mode === "wallet") return null;

  const handleSelect = (role: AppRole) => {
    setActiveRole(role);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Signed in as ${activeMeta.accountName} (${activeMeta.label})`}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#09090B] hover:border-[#D4D4D8] transition-colors cursor-pointer"
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: activeMeta.accentHex }}
        />
        <span className="hidden sm:inline max-w-[132px] truncate">{activeMeta.accountName}</span>
        <span className="hidden lg:inline font-mono-tabular text-[10px] uppercase tracking-wider text-[#71717A]">
          {activeMeta.shortLabel}
        </span>
        <ChevronDown className="h-3 w-3 text-[#71717A]" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-[#D4D4D8] bg-[#FAFAFA] p-1.5 shadow-2xl shadow-zinc-900/10 z-50"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-mono-tabular uppercase tracking-wider text-[#71717A]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-[#059669]" /> Role Account
            </span>
            <span>Switch Login</span>
          </div>
          <div className="my-1 border-t border-[#E4E4E7]" />
          {ROLE_ORDER.map((id) => {
            const meta = ROLE_META[id];
            const unlocked = canAccess(id);
            const isCurrent = activeRole === id;
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer",
                  isCurrent
                    ? "bg-[#F4F4F5] text-[#09090B]"
                    : "text-[#52525B] hover:bg-[#FFFFFF] hover:text-[#09090B]"
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono-tabular text-[11px] font-bold text-white"
                    style={{ backgroundColor: meta.accentHex }}
                  >
                    {meta.accountName.charAt(0)}
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="block truncate font-medium text-[#09090B]">{meta.accountName}</span>
                    <span className="block truncate font-mono-tabular text-[10px] text-[#71717A]">
                      {meta.label} · {shortHex(meta.accountAddress, 6, 4)}
                    </span>
                  </span>
                </span>
                {isCurrent ? (
                  <Check className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                ) : !unlocked ? (
                  <Lock className="h-3 w-3 text-[#71717A] shrink-0" />
                ) : null}
              </button>
            );
          })}
          <div className="my-1 border-t border-[#E4E4E7]" />
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] text-[#52525B] hover:bg-[#FFFFFF] hover:text-[#09090B]"
          >
            <span>Role Sign-In &amp; Account Setup</span>
            <span className="font-mono-tabular text-[#71717A]">→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function DetectedRoleBadges({
  roles,
  className,
}: {
  roles: WalletRolesState;
  className?: string;
}) {
  if (!roles.isConnected || roles.loadingRoles) return null;

  return (
    <div className={cn("hidden xl:flex items-center gap-1.5", className)}>
      {roles.isPatient ? (
        <span className="inline-flex items-center rounded-md border border-[#059669]/30 bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#059669] whitespace-nowrap">
          Patient
        </span>
      ) : null}
      {roles.isApprovedHospital ? (
        <span className="inline-flex items-center rounded-md border border-[#0284C7]/30 bg-[#F0F9FF] px-2 py-0.5 text-[11px] font-medium text-[#0284C7] whitespace-nowrap">
          Approved Hospital
        </span>
      ) : null}
      {roles.isInsurer ? (
        <span className="inline-flex items-center rounded-md border border-[#F59E0B]/30 bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-medium text-[#B45309] whitespace-nowrap">
          Insurer
        </span>
      ) : null}
    </div>
  );
}

export function WalletAuthControls({ roles }: { roles: WalletRolesState }) {
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <DetectedRoleBadges roles={roles} />

      <span className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#52525B] whitespace-nowrap">
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              IS_CHAIN_DEPLOYED ? "bg-[#059669]" : "bg-[#F59E0B]"
            )}
            style={{ animation: "pulse-ring 2.4s cubic-bezier(0,0,0.2,1) infinite" }}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              IS_CHAIN_DEPLOYED ? "bg-[#059669]" : "bg-[#F59E0B]"
            )}
          />
        </span>
        <span className="font-mono-tabular text-[11px] text-[#09090B]">
          {IS_CHAIN_DEPLOYED ? "Sepolia" : "Local"}
        </span>
      </span>

      {roles.wrongChain ? (
        <TactileButton
          size="sm"
          variant="amber"
          onClick={() => roles.switchToSepolia()}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Switch Network
        </TactileButton>
      ) : roles.isConnected && roles.address ? (
        <TactileButton
          size="sm"
          variant="secondary"
          onClick={() => disconnect()}
          title={`Connected: ${roles.address} — click to disconnect`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
          <span className="font-mono-tabular text-[#09090B]">
            {shortHex(roles.address, 6, 4)}
          </span>
          {roles.balanceEth !== null ? (
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#52525B] border-l border-[#D4D4D8] pl-2">
              {roles.balanceEth} ETH
            </span>
          ) : null}
        </TactileButton>
      ) : (
        <TactileButton
          size="sm"
          variant="primary"
          onClick={() => connectInjectedWallet(connectors, connectAsync)}
        >
          <Wallet className="h-3.5 w-3.5" />
          Connect Wallet
        </TactileButton>
      )}
    </div>
  );
}
