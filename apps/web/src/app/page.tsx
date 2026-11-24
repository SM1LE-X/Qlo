import { ArrowUpRight } from "lucide-react";
import { DEPLOYMENT, explorerAddressUrl } from "@/lib/contracts";

const SLACK_OPEN_URL =
  process.env.NEXT_PUBLIC_SLACK_OPEN_URL?.trim() || "https://slack.com/app_redirect";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 py-16 text-[#09090B]">
      <main className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-[#E4E4E7] bg-[#FFFFFF] p-8 shadow-[0_1px_2px_rgba(9,9,11,0.04)]">
          {/* Minimal Brand Mark */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#09090B]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11.5" cy="11.5" r="6.5" stroke="#FFFFFF" strokeWidth="2.2" />
                <path
                  d="M16.2 16.2L20.5 20.5"
                  stroke="#34D399"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="11.5" cy="11.5" r="2.2" fill="#34D399" />
              </svg>
            </div>
            <span className="text-[16px] font-semibold tracking-tight text-[#09090B]">Qlo</span>
          </div>

          <h1 className="mt-7 text-[22px] font-semibold leading-snug tracking-tight text-[#09090B]">
            Private health claims,
            <br />
            settled in Slack.
          </h1>

          <p className="mt-2.5 text-sm leading-relaxed text-[#52525B]">
            Submit bills, verify eligibility, and disburse payouts directly inside your workspace
            with zero medical data exposed.
          </p>

          <div className="mt-7 space-y-2.5">
            <a
              href={SLACK_OPEN_URL}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#09090B] px-4 text-sm font-medium text-[#FFFFFF] transition-colors hover:bg-[#27272A]"
            >
              Open in Slack
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>

            <div className="rounded-xl bg-[#F4F4F5] px-3.5 py-2.5 text-center font-mono-tabular text-xs text-[#52525B]">
              Run <span className="font-semibold text-[#09090B]">/qlo start</span> in Slack to begin
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-[#E4E4E7] pt-4 text-[11px] text-[#71717A]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" aria-hidden="true" />
              Sepolia live · 0 PHI
            </span>
            <a
              href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#52525B] transition-colors hover:text-[#09090B]"
            >
              Contract
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
