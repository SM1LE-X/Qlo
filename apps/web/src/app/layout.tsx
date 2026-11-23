import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Qlo — Zero-Knowledge Health Claims & Patient-Sovereign Records",
  description:
    "Commercial zero-knowledge health insurance clearinghouse proving 8 claim coverage predicates in Groth16 with AES-256-GCM patient-owned records on Ethereum Sepolia.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Qlo — Zero-Knowledge Health Claims & Patient-Sovereign Records",
    description:
      "Browser-local CMS-1500 OCR + AES-256-GCM encryption + 8-predicate Groth16 claim settlement on Ethereum Sepolia with 0 bytes of PHI on-chain.",
    siteName: "Qlo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qlo — Zero-Knowledge Health Claims",
    description:
      "Prove coverage, hospital accreditation, and cumulative annual limits in < 3s Groth16 with 0 PHI on-chain.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-screen bg-[#F7F8F7] text-[#09090B] font-sans antialiased selection:bg-[#0F766E]/15 selection:text-[#042F2E]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
