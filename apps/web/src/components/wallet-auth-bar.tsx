"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
import { motionTransitions } from "@/lib/motion-tokens";
import { connectInjectedWallet, type WalletRolesState } from "@/lib/useWalletRoles";
import { cn, shortHex } from "@/lib/utils";
import { TactileButton } from "./ui/tactile-button";

export const WORKFLOW_STEPS = [
  { href: "/patient", label: "1. Patient", icon: FileLock2, color: "text-[#0F766E]" },
  { href: "/hospital", label: "2. Hospital", icon: Cpu, color: "text-[#0F4C81]" },
  { href: "/insurer", label: "3. Insurer", icon: Landmark, color: "text-[#047857]" },
] as const;

export function WorkflowStepSwitcher({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="3-step claim workflow"
      className="flex items-center gap-0.5 rounded-full border border-[#E4E4E7] bg-[#F4F5F4] p-1"
    >
      {WORKFLOW_STEPS.map((item, idx) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <div key={item.href} className="flex items-center">
            <Link
              href={item.href}
              className={cn(
                "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                active ? "text-[#09090B]" : "text-[#52525B] hover:text-[#09090B]"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="active-workflow-pill"
                  transition={motionTransitions.springMorph}
                  className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(9,12,14,0.09)] border border-[#E4E4E7]/80"
                />
              ) : null}
              <Icon className={cn("relative z-10 h-3.5 w-3.5", active && item.color)} />
              <span className="relative z-10">{item.label}</span>
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
    <div className={cn("hidden xl:flex items-center gap-1.5", className)}>
      {roles.isPatient ? (
        <span className="inline-flex items-center rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[10px] font-semibold text-[#0F766E] whitespace-nowrap">
          Patient
        </span>
      ) : null}
      {roles.isApprovedHospital ? (
        <span className="inline-flex items-center rounded-full border border-[#BAE6FD] bg-[#F0F9FF] px-2.5 py-0.5 text-[10px] font-semibold text-[#0F4C81] whitespace-nowrap">
          Approved Hospital
        </span>
      ) : null}
      {roles.isInsurer ? (
        <span className="inline-flex items-center rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-semibold text-[#047857] whitespace-nowrap">
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

      <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-white px-3 py-1 text-[11px] font-medium text-[#52525B] whitespace-nowrap shadow-2xs">
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#F59E0B]"
            )}
            style={{ animation: "pulse-ring 2.2s cubic-bezier(0,0,0.2,1) infinite" }}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              IS_CHAIN_DEPLOYED ? "bg-[#10B981]" : "bg-[#F59E0B]"
            )}
          />
        </span>
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
