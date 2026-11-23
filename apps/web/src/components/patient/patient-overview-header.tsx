"use client";

import { Badge } from "@/components/ui/card";
import { NumberTicker, SlidingCountdown } from "@/components/ui/number-ticker";
import { StatCard } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";

interface PatientOverviewHeaderProps {
  isPatientRole: boolean;
  isChainDeployed: boolean;
  secondsRemaining: number;
  grantExpiresAt: number;
  nowSec: number;
  registeredRecordId: string;
  hasEncrypted: boolean;
  vaultCount: number;
  activeGrantsCount: number;
  settledClaimsCount: number;
}

export function PatientOverviewHeader({
  isPatientRole,
  isChainDeployed,
  secondsRemaining,
  grantExpiresAt,
  nowSec,
  registeredRecordId,
  hasEncrypted,
  vaultCount,
  activeGrantsCount,
  settledClaimsCount,
}: PatientOverviewHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">Patient Dashboard</Badge>
            <Badge variant={isPatientRole ? "emerald" : isChainDeployed ? "amber" : "neutral"}>
              {isPatientRole
                ? "Patient Wallet Connected"
                : isChainDeployed
                ? "Connect Wallet to Anchor"
                : "Sandbox Mode Open"}
            </Badge>
            <span className="text-xs font-mono-tabular text-[#71717A]">
              IndexedDB · CIDv1 · ECDH P-256
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
            Patient Record Vault
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B]">
            Extract CMS-1500 fields locally via WASM OCR, seal clinical payloads with AES-256-GCM, and issue revocable provider grants.
          </p>
        </div>

        {secondsRemaining > 0 ? (
          <div className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-1.5">
            <span className="text-xs font-semibold text-[#047857]">Active Grant</span>
            <SlidingCountdown secondsLeft={secondsRemaining} />
          </div>
        ) : null}
      </div>

      <Stepper
        current={grantExpiresAt > nowSec ? 3 : registeredRecordId ? 2 : hasEncrypted ? 1 : 0}
        steps={[
          { title: "Intake & Local OCR", description: "CMS-1500 parsed in browser" },
          { title: "AES-256-GCM Encrypt", description: "IndexedDB + IPFS CIDv1" },
          { title: "Register & Wrap DEK", description: "Commit on HealthRecords.sol" },
          { title: "Active Hospital Grant", description: "Time-bounded consent key" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Encrypted Vault Records"
          valueText={<NumberTicker value={vaultCount} />}
          sublabel="IndexedDB qlo-vault-v1"
          deltaText="Local Only"
          deltaTone="emerald"
          trend={[1, 1, 2, 2, 3, Math.max(1, vaultCount)]}
          accentColor="#047857"
        />
        <StatCard
          label="Active Provider Grants"
          valueText={<NumberTicker value={activeGrantsCount} />}
          sublabel={secondsRemaining > 0 ? "ECDH wrapped key live" : "Ready to delegate"}
          deltaText={secondsRemaining > 0 ? "Active" : "Standby"}
          deltaTone={secondsRemaining > 0 ? "teal" : "neutral"}
          trend={[0, 1, 0, 1, activeGrantsCount, activeGrantsCount]}
          accentColor="#0F766E"
        />
        <StatCard
          label="Settled Claims"
          valueText={<NumberTicker value={settledClaimsCount} />}
          sublabel="Zero-PHI disbursements"
          deltaText="Sepolia"
          deltaTone="neutral"
          trend={[0, 1, 1, 2, 2, Math.max(0, settledClaimsCount)]}
          accentColor="#0F4C81"
        />
        <StatCard
          label="Envelope Cipher"
          valueText="AES-256-GCM"
          sublabel="ECDH P-256 ephemeral wrap"
          deltaText="0 Bytes Sent"
          deltaTone="emerald"
          trend={[256, 256, 256, 256, 256, 256]}
          accentColor="#047857"
        />
      </div>
    </>
  );
}
