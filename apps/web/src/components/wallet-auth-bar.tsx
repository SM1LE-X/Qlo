"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Cpu,
  FileLock2,
  Landmark,
  Wallet,
} from "lucide-react";
import { useConnect, useDisconnect } from "wagmi";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { connectInjectedWallet, type WalletRolesState } from "@/lib/useWalletRoles";
import { cn, shortHex } from "@/lib/utils";
import { TactileButton } from "./ui/tactile-button";

export const WORKFLOW_STEPS = [
  { href: "/patient", label: "1. Patient", icon: FileLock2 },
  { href: "/hospital", label: "2. Hospital", icon: Cpu },
  { href: "/insurer", label: "3. Insurer", icon: Landmark },
] as const;

export function WorkflowStepSwitcher({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="3-step claim workflow"
      className="flex items-center gap-1 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1"
    >
      {WORKFLOW_STEPS.map((item, idx) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <div key={item.href} className="flex items-center">
            <Link
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "bg-white text-[#09090B] shadow-xs border border-[#E4E4E7]/80"
                  : "text-[#52525B] hover:text-[#09090B]"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active && "text-[#0F766E]")} />
              <span>{item.label}</span>
            </Link>
            {idx < WORKFLOW_STEPS.length - 1 ? (
              <ChevronRight
                aria-hidden="true"
                className="mx-0.5 h-3 w-3 text-[#A1A1AA] shrink-0 hidden sm:block"
              />
            ) : null}
          </div>
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
    <div className={cn("hidden xl:flex items-center gap-1", className)}>
      {roles.isPatient ? (
        <span className="inline-flex items-center rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2 py-0.5 text-[10px] font-semibold text-[#0F766E] whitespace-nowrap">
          Patient
        </span>
      ) : null}
      {roles.isApprovedHospital ? (
        <span className="inline-flex items-center rounded-full border border-[#BAE6FD] bg-[#F0F9FF] px-2 py-0.5 text-[10px] font-semibold text-[#0F4C81] whitespace-nowrap">
          Approved Hospital
        </span>
      ) : null}
      {roles.isInsurer ? (
        <span className="inline-flex items-center rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#047857] whitespace-nowrap">
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

      <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-[11px] font-medium text-[#52525B] whitespace-nowrap">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#F59E0B]"
          )}
        />
        {IS_CHAIN_DEPLOYED ? "Sepolia" : "Sandbox"}
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
          <Wallet className="h-3.5 w-3.5 text-[#0F766E]" />
          <span className="font-mono-tabular">{shortHex(roles.address, 6, 4)}</span>
          {roles.balanceEth !== null ? (
            <span className="hidden sm:inline font-mono-tabular text-[10px] text-[#71717A] border-l border-[#E4E4E7] pl-1.5">
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
