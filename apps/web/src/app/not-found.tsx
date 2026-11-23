import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { TactileButton } from "@/components/ui/tactile-button";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl py-16 px-4">
      <div className="rounded-2xl border border-[#E4E4E7] bg-white p-8 shadow-xs space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-3 py-1 text-[11px] font-medium text-[#0F766E]">
          <ShieldCheck className="h-3.5 w-3.5" />
          404 · Route Not Found
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#09090B]">
            Qlo Portal Route Unavailable
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B]">
            Select one of the three stakeholder workspaces or return to the public Trust Center.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-1">
          <Link href="/">
            <TactileButton size="sm" variant="primary">
              Overview
              <ArrowRight className="h-3.5 w-3.5" />
            </TactileButton>
          </Link>
          <Link href="/patient">
            <TactileButton size="sm" variant="secondary">
              Patient Portal
            </TactileButton>
          </Link>
          <Link href="/hospital">
            <TactileButton size="sm" variant="secondary">
              Hospital RCM
            </TactileButton>
          </Link>
          <Link href="/insurer">
            <TactileButton size="sm" variant="secondary">
              Insurer Treasury
            </TactileButton>
          </Link>
          <Link href="/story">
            <TactileButton size="sm" variant="secondary">
              Trust Center
            </TactileButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
