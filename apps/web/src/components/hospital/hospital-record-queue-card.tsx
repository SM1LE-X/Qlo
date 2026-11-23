"use client";

import Link from "next/link";
import { AlertOctagon, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { DecryptedText } from "@/components/ui/decrypted-text";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { ACCREDITED_PROVIDERS } from "@/lib/clinicalCatalog";
import { type Cms1500Claim } from "@/lib/intake";
import { type StoredVaultEntry } from "@/lib/storage";

interface MatchedHospitalInfo {
  address: string;
  licenseId: string;
  name: string;
}

interface HospitalRecordQueueCardProps {
  hospitalAddr: string;
  onChangeHospitalAddr: (addr: string) => void;
  entries: StoredVaultEntry[];
  selectedEntry: StoredVaultEntry | null;
  onSelectEntry: (entry: StoredVaultEntry | null) => void;
  onUnwrapAndDecrypt: () => void;
  txBusy: boolean;
  accessStatus: "unknown" | "checking" | "granted" | "missing";
  accessExpiresAt: number;
  matchedProvider: MatchedHospitalInfo | null;
  isChainDeployed: boolean;
  isApprovedHospitalRole: boolean;
  onChainKeyRegistered: boolean;
  decryptedClaim: Cms1500Claim | null;
  onMatchFacilityNpi: (npi: string) => void;
  completenessValid: boolean;
  accessError: string;
  onLogAccessAudit: () => void;
}

export function HospitalRecordQueueCard({
  hospitalAddr,
  onChangeHospitalAddr,
  entries,
  selectedEntry,
  onSelectEntry,
  onUnwrapAndDecrypt,
  txBusy,
  accessStatus,
  accessExpiresAt,
  matchedProvider,
  isChainDeployed,
  isApprovedHospitalRole,
  onChainKeyRegistered,
  decryptedClaim,
  onMatchFacilityNpi,
  completenessValid,
  accessError,
  onLogAccessAudit,
}: HospitalRecordQueueCardProps) {
  return (
    <SpotlightCard
      id="hospital-queue"
      accent="neutral"
      className="lg:col-span-5 p-6 space-y-4 text-xs scroll-mt-20"
    >
      <div className="border-b border-[#F4F4F5] pb-3">
        <h2 className="text-sm font-semibold text-[#09090B]">
          1. Fetch &amp; Unwrap Patient Record
        </h2>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-[#52525B]">Facility Identity</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ACCREDITED_PROVIDERS.map((prov) => {
            const selected = prov.address.toLowerCase() === hospitalAddr.toLowerCase();
            return (
              <button
                key={prov.address}
                type="button"
                onClick={() => onChangeHospitalAddr(prov.address)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                  selected
                    ? "border-[#0F4C81] bg-[#F0F9FF]/70"
                    : "border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#D4D4D8] hover:bg-white"
                }`}
              >
                <div className="truncate text-[11px] font-semibold text-[#09090B]">
                  {prov.name}
                </div>
                <div className="font-mono-tabular text-[10px] text-[#52525B]">
                  NPI {prov.licenseId}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="hosp-wallet" className="text-[#52525B] font-medium">
          Proving Hospital Address
        </label>
        <input
          id="hosp-wallet"
          value={hospitalAddr}
          onChange={(e) => onChangeHospitalAddr(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="vault-select" className="text-[#52525B] font-medium">
          Authorized Patient Records
        </label>
        <select
          id="vault-select"
          value={selectedEntry?.recordCommitmentHex ?? ""}
          onChange={(e) => {
            const found = entries.find((x) => x.recordCommitmentHex === e.target.value);
            onSelectEntry(found ?? null);
          }}
          className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-[#09090B] focus:border-[#0F766E] focus:outline-none"
        >
          {entries.length === 0 ? (
            <option value="">No authorized records available in this session</option>
          ) : (
            entries.map((item) => (
              <option key={item.recordCommitmentHex} value={item.recordCommitmentHex}>
                {item.summaryHint || item.cid.slice(0, 24)} ({item.cid.slice(0, 12)}...)
              </option>
            ))
          )}
        </select>
      </div>

      <TactileButton
        variant="emerald"
        className="w-full"
        onClick={onUnwrapAndDecrypt}
        disabled={!selectedEntry || txBusy}
      >
        <KeyRound className="h-4 w-4" />
        Unwrap ECDH DEK &amp; Decrypt Locally
      </TactileButton>

      {selectedEntry ? (
        <div
          className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 ${
            accessStatus === "granted"
              ? "border-[#A7F3D0] bg-[#ECFDF5]/70 text-[#047857]"
              : accessStatus === "missing"
              ? "border-[#FECACA] bg-[#FEF2F2]/80 text-[#B91C1C]"
              : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
          }`}
        >
          <span className="font-semibold">
            {accessStatus === "granted"
              ? "Patient Access: Granted (Active)"
              : accessStatus === "missing"
              ? "Patient Access: Not Granted / Revoked"
              : "Checking patient access permission..."}
          </span>
          {accessStatus === "granted" && accessExpiresAt > 0 ? (
            <span className="font-mono-tabular text-[10px]">
              Until {new Date(accessExpiresAt * 1000).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      ) : null}

      {!matchedProvider ? (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[#92400E] space-y-1">
          <div className="font-semibold">Hospital Accreditation Notice</div>
          <p className="text-[11px] leading-relaxed">
            Address {hospitalAddr.slice(0, 10)}... is not present in the Poseidon hospital Merkle root. Select an accredited facility above or deploy with EXTRA_HOSPITAL_ADDRESS set to your MetaMask address.
          </p>
        </div>
      ) : null}

      {isChainDeployed && isApprovedHospitalRole && !onChainKeyRegistered ? (
        <div className="rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] px-3 py-2 text-[#0F4C81] text-[11px]">
          Tip: Click <span className="font-semibold">Sync Hospital ECDH Key</span> above to anchor this facility&apos;s P-256 public key on-chain in <code className="font-mono-tabular">HospitalRegistry</code>.
        </div>
      ) : null}

      {matchedProvider &&
      decryptedClaim &&
      decryptedClaim.renderingNpi.trim() !== matchedProvider.licenseId ? (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 flex items-center justify-between gap-2 text-[#92400E]">
          <div className="text-[11px]">
            Claim NPI ({decryptedClaim.renderingNpi}) differs from selected facility NPI ({matchedProvider.licenseId}).
          </div>
          <TactileButton
            size="sm"
            variant="amber"
            onClick={() => onMatchFacilityNpi(matchedProvider.licenseId)}
          >
            Match Facility NPI
          </TactileButton>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-[#09090B]">Start in Patient Vault</div>
          <p className="text-[#52525B]">
            Encrypt a sample CMS-1500 claim and issue a provider grant first to populate this verification queue, or import a portable{" "}
            <code className="font-mono-tabular text-[#09090B]">.qlo.json</code> bundle above.
          </p>
          <Link
            href="/patient"
            className="inline-flex items-center font-medium text-[#0F766E] hover:underline"
          >
            Create &amp; Authorize Sample Record in Patient Vault →
          </Link>
        </div>
      ) : null}

      {accessError ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[#B91C1C] flex items-start gap-2">
          <AlertOctagon className="h-4 w-4 text-[#DC2626] shrink-0 mt-0.5" />
          <span>{accessError}</span>
        </div>
      ) : null}

      {decryptedClaim ? (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#047857]">Decrypted CMS-1500 Claim</span>
            {completenessValid ? <Badge variant="emerald">Form Complete</Badge> : null}
          </div>
          <DecryptedText
            text={`ICD ${decryptedClaim.icd10Code} | CPT ${decryptedClaim.cptCode} | ${decryptedClaim.claimAmountEth} ETH`}
            encrypted={false}
          />
          <div className="text-[#52525B]">Rx: {decryptedClaim.prescription}</div>
          <TactileButton size="sm" variant="secondary" onClick={onLogAccessAudit}>
            Log Access Audit On-Chain
          </TactileButton>
        </div>
      ) : null}
    </SpotlightCard>
  );
}
