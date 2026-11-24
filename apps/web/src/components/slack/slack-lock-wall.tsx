"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, Wallet } from "lucide-react";
import { useConnect } from "wagmi";
import { useActiveRole } from "@/components/role-context";
import { ROLE_META, type AppRole } from "@/lib/roles";
import { connectInjectedWallet } from "@/lib/useWalletRoles";

interface SlackLockWallProps {
  channel: AppRole;
}

export function SlackLockWall({ channel }: SlackLockWallProps) {
  const { mode, walletRoles, setActiveRole, lockReason } = useActiveRole();
  const { connectors, connectAsync, isPending } = useConnect();
  const meta = ROLE_META[channel];
  const accent = meta.accentHex;

  const handleWalletConnect = () => {
    void connectInjectedWallet(connectors, connectAsync);
  };

  return (
    <div
      role="region"
      aria-label={`Restricted private channel ${meta.channelName}`}
      className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-10"
    >
      {/* Subtle radial hairline grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(24, 24, 27, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(24, 24, 27, 0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 68% 62% at 50% 45%, #000 10%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(ellipse 68% 62% at 50% 45%, #000 10%, transparent 82%)",
        }}
      />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA]/95 p-6 shadow-[0_8px_30px_rgba(9,9,11,0.08)] backdrop-blur-sm sm:p-7">
        {/* Top lock emblem + role gate */}
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border bg-[#FFFFFF]"
            style={{
              borderColor: `${accent}4D`,
              boxShadow: `0 0 0 1px ${accent}1F inset, 0 8px 24px ${accent}18`,
            }}
          >
            <Lock className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
          </div>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-0.5 font-mono-tabular text-[10.5px] font-medium uppercase tracking-wider text-[#DC2626]">
            403 · {meta.label} only
          </div>

          <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-[#09090B]">
            Restricted — {meta.channelName}
          </h2>

          <div className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#D4D4D8] bg-[#FFFFFF] px-3 py-1">
            <ShieldCheck
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: accent }}
              aria-hidden="true"
            />
            <span className="truncate font-mono-tabular text-[11px] text-[#27272A]">
              {meta.contractGate}
            </span>
          </div>

          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-[#52525B]">
            {lockReason(channel)}
          </p>
        </div>

        {/* 2-column compact RBAC boundary card */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E4E4E7] bg-[#FFFFFF] p-3.5">
            <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#18181B]">
              <Eye className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} aria-hidden="true" />
              <span>Permitted</span>
            </div>
            <ul className="space-y-2">
              {meta.canSee.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-snug text-[#27272A]"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-3.5">
            <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#52525B]">
              <EyeOff className="h-3.5 w-3.5 shrink-0 text-[#71717A]" aria-hidden="true" />
              <span>Restricted</span>
            </div>
            <ul className="space-y-2">
              {meta.hiddenFromRole.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-snug text-[#52525B]"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A1A1AA]"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action footer */}
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-[#E4E4E7] pt-5">
          {mode === "sandbox" ? (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveRole(channel)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  backgroundColor: accent,
                  borderColor: accent,
                }}
              >
                <span>Sign in as {meta.accountName}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4D4D8] bg-[#FFFFFF] px-3.5 py-2 text-[13px] font-medium text-[#27272A] transition hover:border-[#A1A1AA] hover:text-[#09090B]"
              >
                <span>Role Sign-In</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleWalletConnect}
                  disabled={isPending}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    backgroundColor: accent,
                    borderColor: accent,
                  }}
                >
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {walletRoles.isConnected ? `Switch to ${meta.label} Wallet` : `Connect ${meta.label} Wallet`}
                  </span>
                </button>

                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4D4D8] bg-[#FFFFFF] px-3.5 py-2 text-[13px] font-medium text-[#27272A] transition hover:border-[#A1A1AA] hover:text-[#09090B]"
                >
                  <span>Role Sign-In</span>
                </Link>
              </div>
              <p className="text-center font-mono-tabular text-[11px] text-[#71717A]">
                On-chain wallet roles enforce access on Sepolia (11155111). Connect an accredited{" "}
                {meta.label} wallet or sign in via the Role Login Gateway.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
