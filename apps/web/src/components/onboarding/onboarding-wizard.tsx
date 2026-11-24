"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowRight, ChevronDown, Wallet } from "lucide-react";
import { useConnect, useDisconnect } from "wagmi";
import { OnboardingChecks } from "@/components/onboarding/checks";
import { useActiveRole } from "@/components/role-context";
import { ROLE_META, ROLE_ORDER, type AppRole } from "@/lib/roles";
import { connectInjectedWallet } from "@/lib/useWalletRoles";
import { shortHex } from "@/lib/utils";

const ACCOUNT_SUBTITLES: Record<AppRole, string> = {
  patient: "Member · Policy #2026001",
  hospital: "Provider · NPI 1234567890",
  insurer: "Payer · Escrow Admin",
};

export function OnboardingWizard() {
  const router = useRouter();
  const { activeRole, walletRoles, setActiveRole } = useActiveRole();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const [statusOpen, setStatusOpen] = useState(false);

  const handleConnect = useCallback(() => {
    void connectInjectedWallet(connectors, connectAsync);
  }, [connectors, connectAsync]);

  const handleSelectAccount = useCallback(
    (roleId: AppRole) => {
      setActiveRole(roleId);
      router.push(ROLE_META[roleId].portalHref);
    },
    [router, setActiveRole]
  );

  const roleBadges = [
    { label: "Member", active: walletRoles.isPatient, accent: "#059669" },
    { label: "Provider", active: walletRoles.isApprovedHospital, accent: "#0284C7" },
    { label: "Payer", active: walletRoles.isInsurer, accent: "#D97706" },
  ];

  return (
    <div className="mx-auto my-8 w-full max-w-lg px-4 sm:px-0">
      <section className="rounded-2xl border border-[#E4E4E7] bg-[#FFFFFF] p-6 shadow-[0_1px_3px_rgba(9,9,11,0.04),0_8px_24px_rgba(9,9,11,0.03)] sm:p-8">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-[#09090B]">
            Sign in
          </h1>
          <p className="text-sm text-[#52525B]">
            Connect a Sepolia wallet or select an organization account.
          </p>
        </header>

        <div className="mt-6">
          {walletRoles.isConnected && walletRoles.address ? (
            <div className="space-y-3 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-[#059669]"
                  />
                  <span className="font-mono-tabular text-xs font-semibold text-[#09090B]">
                    {shortHex(walletRoles.address, 6, 4)}
                  </span>
                </div>
                <span className="font-mono-tabular text-xs text-[#52525B]">
                  {walletRoles.balanceEth ?? "0.0000"} ETH
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {roleBadges.map((badge) => (
                  <span
                    key={badge.label}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      badge.active
                        ? "border-[#E4E4E7] bg-[#FFFFFF] text-[#09090B]"
                        : "border-transparent bg-transparent text-[#71717A]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: badge.active ? badge.accent : "#D4D4D8",
                      }}
                    />
                    {badge.label}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[#E4E4E7] pt-3">
                {walletRoles.wrongChain ? (
                  <button
                    type="button"
                    onClick={() => void walletRoles.switchToSepolia()}
                    className="rounded-lg border border-[#D97706]/30 bg-[#FFFBEB] px-3 py-1 text-xs font-medium text-[#D97706] transition-colors hover:bg-[#FEF3C7] cursor-pointer"
                  >
                    Switch to Sepolia
                  </button>
                ) : (
                  <span className="text-xs text-[#059669]">Sepolia verified</span>
                )}
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="text-xs font-medium text-[#52525B] transition-colors hover:text-[#09090B] cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#09090B] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {isConnecting ? "Connecting wallet…" : "Continue with Ethereum Wallet"}
            </button>
          )}
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#E4E4E7]" aria-hidden="true" />
          <span className="text-xs text-[#71717A]">or organization account</span>
          <span className="h-px flex-1 bg-[#E4E4E7]" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          {ROLE_ORDER.map((roleId) => {
            const meta = ROLE_META[roleId];
            const isActive = activeRole === roleId;
            return (
              <div
                key={roleId}
                className={`group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                  isActive
                    ? "border-[#D4D4D8] bg-[#FAFAFA]"
                    : "border-[#E4E4E7] bg-[#FFFFFF] hover:border-[#D4D4D8] hover:bg-[#FAFAFA]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectAccount(roleId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.accentHex }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[#09090B]">
                      {meta.accountName}
                    </div>
                    <div className="truncate text-xs text-[#52525B]">
                      {ACCOUNT_SUBTITLES[roleId]}
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/slack?channel=${roleId}`}
                    onClick={() => setActiveRole(roleId)}
                    className="rounded-md px-2 py-1 font-mono-tabular text-[11px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
                  >
                    {meta.channelName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleSelectAccount(roleId)}
                    aria-label={`Open ${meta.accountName}`}
                    className="rounded-md p-1 text-[#71717A] transition-colors group-hover:text-[#09090B] cursor-pointer"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-4">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setStatusOpen((prev) => !prev)}
            aria-expanded={statusOpen}
            aria-controls="system-status-panel"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-[#71717A] transition-colors hover:text-[#09090B] cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[#059669]"
            />
            <span>System status</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${
                statusOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {statusOpen ? (
          <div id="system-status-panel" className="mt-3">
            <OnboardingChecks />
          </div>
        ) : null}
      </div>
    </div>
  );
}
