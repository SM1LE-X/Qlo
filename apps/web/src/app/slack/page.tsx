"use client";

import { SlackWorkspace } from "@/components/slack/slack-workspace";

export default function SlackChannelsPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-6 text-[#09090B] sm:px-6">
      <header className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="font-mono-tabular text-[11px] font-medium tracking-[0.14em] text-[#059669]">
            PRIVATE CHANNELS
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#09090B]">
            Channels
          </h1>
        </div>
        <p className="font-mono-tabular text-[11.5px] text-[#71717A]">
          Sepolia 11155111 · HMAC-SHA256 webhooks
        </p>
      </header>
      <SlackWorkspace />
    </main>
  );
}
