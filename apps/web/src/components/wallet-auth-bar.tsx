"use client";

import Link from "next/link";
import { AlertTriangle, Wallet } from "lucide-react";
import { useConnect, useDisconnect } from "wagmi";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { connectInjectedWallet, type WalletRolesState } from "@/lib/useWalletRoles";
import { cn, shortHex } from "@/lib/utils";
import { TactileButton } from "./ui/tactile-button";

export const WORKFLOW_STEPS = [
  { href: "/", label: "Overview" },
  { href: "/patient", label: "Vault" },
  { href: "/hospital", label: "Claims" },
  { href: "/insurer", label: "Treasury" },
  { href: "/story", label: "Protocol" },
] as const;

export function WorkflowStepSwitcher({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary navigation" className="flex items-center gap-1">
      {WORKFLOW_STEPS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors",
              active
                ? "bg-[#161B22] text-[#F3F4F6] border border-[#2B3340]"
                : "border border-transparent text-[#94A3B8] hover:text-[#F3F4F6] hover:bg-[#111419]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
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
        <span className="inline-flex items-center rounded-md border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 text-[11px] font-medium text-[#10B981] whitespace-nowrap">
          Patient
        </span>
      ) : null}
      {roles.isApprovedHospital ? (
        <span className="inline-flex items-center rounded-md border border-[#38BDF8]/30 bg-[#38BDF8]/10 px-2 py-0.5 text-[11px] font-medium text-[#38BDF8] whitespace-nowrap">
          Approved Hospital
        </span>
      ) : null}
      {roles.isInsurer ? (
        <span className="inline-flex items-center rounded-md border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2 py-0.5 text-[11px] font-medium text-[#F59E0B] whitespace-nowrap">
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

      <span className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1E242D] bg-[#111419] px-2.5 text-xs font-medium text-[#94A3B8] whitespace-nowrap">
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#F59E0B]"
            )}
            style={{ animation: "pulse-ring 2.4s cubic-bezier(0,0,0.2,1) infinite" }}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#F59E0B]"
            )}
          />
        </span>
        <span className="font-mono-tabular text-[11px] text-[#F3F4F6]">
          {IS_CHAIN_DEPLOYED ? "Sepolia" : "Sandbox"}
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
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
          <span className="font-mono-tabular text-[#F3F4F6]">
            {shortHex(roles.address, 6, 4)}
          </span>
          {roles.balanceEth !== null ? (
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#94A3B8] border-l border-[#2B3340] pl-2">
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
