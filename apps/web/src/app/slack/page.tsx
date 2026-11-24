"use client";

import { SlackWorkspace } from "@/components/slack/slack-workspace";

export default function SlackChannelsPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-6 text-[#F3F4F6] sm:px-6">
      <header className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="font-mono-tabular text-[11px] font-medium tracking-[0.14em] text-[#10B981]">
            ZERO-PHI CHATOPS · ROLE-RESTRICTED PRIVATE CHANNELS
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#F3F4F6]">
            Clearinghouse Slack Channels
          </h1>
        </div>
        <p className="font-mono-tabular text-[11.5px] text-[#64748B]">
          Ethereum Sepolia (11155111) · Signed HMAC-SHA256 webhook bridge
        </p>
      </header>
      <SlackWorkspace />
    </main>
  );
}
