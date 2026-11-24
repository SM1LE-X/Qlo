import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, FileLock2, ShieldCheck } from "lucide-react";
import { DEPLOYMENT, explorerAddressUrl } from "@/lib/contracts";

const ROLES = [
  {
    icon: FileLock2,
    title: "Patients",
    desc: "Upload bills and records, encrypted on your device. Share with a hospital and revoke anytime.",
  },
  {
    icon: Building2,
    title: "Hospitals",
    desc: "Open records patients share with you and submit claims without exposing diagnoses.",
  },
  {
    icon: ShieldCheck,
    title: "Insurers",
    desc: "Verify every claim cryptographically and pay instantly from escrow. No medical data seen.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#09090B]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11.5" cy="11.5" r="6.5" stroke="#FFFFFF" strokeWidth="2.2" />
              <path d="M16.2 16.2L20.5 20.5" stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="11.5" cy="11.5" r="2.2" fill="#34D399" />
            </svg>
          </div>
          <span className="text-[16px] font-semibold tracking-tight">Qlo</span>
        </div>
        <Link
          href="/onboarding"
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16 pt-12 sm:pt-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-white px-3 py-1 text-xs text-[#52525B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" aria-hidden="true" />
            Live on Ethereum Sepolia
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Health insurance claims,
            <br />
            without exposing health data.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#52525B]">
            Patients own their records. Hospitals get paid in minutes. Insurers verify every claim
            with zero-knowledge proofs — and never see a diagnosis.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#09090B] px-5 text-sm font-medium text-white transition-colors hover:bg-[#27272A]"
            >
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={explorerAddressUrl(DEPLOYMENT.contracts.ClaimsVault)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#09090B] transition-colors hover:border-[#A1A1AA]"
            >
              View contract
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {ROLES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-[#E4E4E7] bg-white p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F4F5]">
                <Icon className="h-4 w-4 text-[#09090B]" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-sm font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#52525B]">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-[#E4E4E7] pt-6 text-xs text-[#71717A]">
          <span>0 bytes of medical data on-chain</span>
          <span>Encrypted on device · AES-256</span>
          <span>Patient-controlled access</span>
          <span>Every action signed by your wallet</span>
        </div>
      </main>
    </div>
  );
}
