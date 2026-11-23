import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Qlo Protocol — Zero-Knowledge Health Claims & Records",
  description:
    "Zero-knowledge health insurance settlement protocol on Ethereum Sepolia. AES-256-GCM patient records, ECDH consent grants, and 8-predicate Groth16 BN254 claim verification with 0 bytes of PHI on-chain.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Qlo Protocol — Zero-Knowledge Health Claims & Records",
    description:
      "Client-side AES-256-GCM record encryption and 8-predicate Groth16 BN254 claim settlement on Ethereum Sepolia with 0 bytes of PHI on-chain.",
    siteName: "Qlo Protocol",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qlo Protocol — Zero-Knowledge Health Claims",
    description:
      "8-predicate Groth16 BN254 claim settlement and patient-sovereign encrypted records on Ethereum Sepolia.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
    >
      <body className="min-h-screen bg-[#090B0E] text-[#F3F4F6] font-sans antialiased selection:bg-[#10B981]/20 selection:text-[#F3F4F6]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
