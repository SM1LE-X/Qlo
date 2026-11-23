"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
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
import { Badge } from "./ui/card";
import { TactileButton } from "./ui/tactile-button";

export const WORKFLOW_STEPS = [
  { href: "/patient", step: "1. Patient", label: "1. Patient", icon: FileLock2 },
  { href: "/hospital", step: "2. Hospital", label: "2. Hospital", icon: Cpu },
  { href: "/insurer", step: "3. Insurer", label: "3. Insurer", icon: Landmark },
] as const;

export function WorkflowStepSwitcher({
  pathname,
  layoutId = "qlo-step-nav",
}: {
  pathname: string;
  layoutId?: string;
}) {
  return (
    <nav
      aria-label="3-step claim workflow"
      className="hidden md:flex items-center gap-0.5 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1"
    >
      {WORKFLOW_STEPS.map((item, idx) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <div key={item.href} className="flex items-center">
            <Link
              href={item.href}
              className={cn(
                "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                active ? "text-[#09090B]" : "text-[#52525B] hover:text-[#09090B]"
              )}
            >
              {active ? (
                <motion.span
                  layoutId={layoutId}
                  transition={motionTransitions.springMorph}
                  className="absolute inset-0 rounded-lg bg-white shadow-xs border border-[#E4E4E7]/80"
                />
              ) : null}
              <Icon
                className={cn(
                  "relative z-10 h-3.5 w-3.5",
                  active && "text-[#0F766E]"
                )}
              />
              <span className="relative z-10">{item.label}</span>
            </Link>
            {idx < WORKFLOW_STEPS.length - 1 ? (
              <ChevronRight
                aria-hidden="true"
                className="mx-0.5 h-3 w-3 text-[#A1A1AA] shrink-0"
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
  if (!roles.isConnected) return null;

  if (roles.loadingRoles) {
    return (
      <span
        className={cn(
          "hidden xl:inline-flex items-center rounded-full border border-[#E4E4E7] bg-[#FAFAFA] px-2 py-0.5 text-[10px] font-mono-tabular text-[#71717A]",
          className
        )}
      >
        Syncing roles...
      </span>
    );
  }

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

export function WalletAuthControls({
  roles,
  zkeyStatus,
  zkeySha,
}: {
  roles: WalletRolesState;
  zkeyStatus: "checking" | "verified" | "mismatch";
  zkeySha: string;
}) {
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <DetectedRoleBadges roles={roles} />

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
          Ethereum Sepolia
        </Badge>
      ) : (
        <Badge variant="neutral" className="hidden sm:inline-flex whitespace-nowrap">
          Ethereum Sepolia · Sandbox
        </Badge>
      )}

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
