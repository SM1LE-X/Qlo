"use client";

import Link from "next/link";
import { AlertOctagon, CheckCircle2, KeyRound, Upload } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import { ACCREDITED_PROVIDERS } from "@/lib/clinicalCatalog";
import { type Cms1500Claim } from "@/lib/intake";
import { type StoredVaultEntry } from "@/lib/storage";
import { shortHex } from "@/lib/utils";

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
  decryptedClaim: Cms1500Claim | null;
  onMatchFacilityNpi: (npi: string) => void;
  completenessValid: boolean;
  accessError: string;
  onLogAccessAudit: () => void;
  onImportBundle: (file: File) => void;
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
  decryptedClaim,
  onMatchFacilityNpi,
  completenessValid,
  accessError,
  onLogAccessAudit,
  onImportBundle,
}: HospitalRecordQueueCardProps) {
  return (
    <div
      id="hospital-queue"
      className="lg:col-span-5 rounded-2xl border border-[#E4E4E7] bg-white p-6 space-y-4 shadow-2xs"
    >
      <div className="border-b border-[#F4F4F5] pb-3">
        <h2 className="text-base font-semibold text-[#09090B]">
          1. Open Shared Patient Record
        </h2>
        <p className="text-xs text-[#52525B]">
          Verify patient permission and decrypt the medical bill locally.
        </p>
      </div>

      {/* Live Access Status */}
      {selectedEntry ? (
        <div
          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs ${
            accessStatus === "granted"
              ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
              : accessStatus === "missing"
              ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
              : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
          }`}
        >
          <span className="font-semibold">
            {accessStatus === "granted"
              ? "✓ Patient Granted Access"
              : accessStatus === "missing"
              ? "✕ Access Not Granted / Revoked"
              : "Checking patient permission..."}
          </span>
          {accessStatus === "granted" && accessExpiresAt > 0 ? (
            <span className="font-mono-tabular text-[11px]">
              Until {new Date(accessExpiresAt * 1000).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Record Selector */}
      <div>
        <label htmlFor="vault-select" className="text-xs font-medium text-[#52525B]">
          Patient Records Shared With You
        </label>
        <select
          id="vault-select"
          value={selectedEntry?.recordCommitmentHex ?? ""}
          onChange={(e) => {
            const found = entries.find((x) => x.recordCommitmentHex === e.target.value);
            onSelectEntry(found ?? null);
          }}
          className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#09090B] focus:border-[#0F766E] focus:outline-none"
        >
          {entries.length === 0 ? (
            <option value="">No shared records found yet</option>
          ) : (
            entries.map((item) => (
              <option key={item.recordCommitmentHex} value={item.recordCommitmentHex}>
                {item.summaryHint || shortHex(item.cid, 12, 6)}
              </option>
            ))
          )}
        </select>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-[#FAFAFA] p-4 space-y-2 text-xs">
          <div className="font-semibold text-[#09090B]">No shared patient record yet</div>
          <p className="text-[#52525B] leading-relaxed">
            Go to Step 1 (Patient Dashboard), encrypt a sample medical bill, save it on-chain, and grant access to your wallet first.
          </p>
          <Link
            href="/patient"
            className="inline-flex items-center font-semibold text-[#0F766E] hover:underline"
          >
            Go to 1. Patient Dashboard →
          </Link>
        </div>
      ) : (
        <TactileButton
          variant={decryptedClaim ? "secondary" : "primary"}
          className="w-full"
          onClick={onUnwrapAndDecrypt}
          disabled={!selectedEntry || txBusy}
        >
          <KeyRound className="h-4 w-4" />
          {decryptedClaim ? "Record Unlocked (Re-Decrypt)" : "Unlock & View Patient Record"}
        </TactileButton>
      )}

      {accessError ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C] flex items-start gap-2">
          <AlertOctagon className="h-4 w-4 text-[#DC2626] shrink-0 mt-0.5" />
          <span>{accessError}</span>
        </div>
      ) : null}

      {matchedProvider &&
      decryptedClaim &&
      decryptedClaim.renderingNpi.trim() !== matchedProvider.licenseId ? (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 flex items-center justify-between gap-2 text-xs text-[#92400E]">
          <span>
            Bill NPI ({decryptedClaim.renderingNpi}) doesn&apos;t match your hospital ({matchedProvider.licenseId}).
          </span>
          <TactileButton
            size="sm"
            variant="amber"
            onClick={() => onMatchFacilityNpi(matchedProvider.licenseId)}
          >
            Match NPI
          </TactileButton>
        </div>
      ) : null}

      {/* Decrypted Medical Summary */}
      {decryptedClaim ? (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/70 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#047857] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Decrypted Medical Record
            </span>
            {completenessValid ? <Badge variant="emerald">Valid</Badge> : null}
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-white/80 p-2.5 font-mono-tabular text-[11px]">
            <div>
              <div className="text-[10px] text-[#71717A] font-sans">Diagnosis</div>
              <div className="font-semibold text-[#09090B]">{decryptedClaim.icd10Code}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#71717A] font-sans">Procedure</div>
              <div className="font-semibold text-[#09090B]">{decryptedClaim.cptCode}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#71717A] font-sans">Amount</div>
              <div className="font-semibold text-[#047857]">{decryptedClaim.claimAmountEth} ETH</div>
            </div>
          </div>
          <div className="text-[#52525B]">
            <span className="font-medium text-[#09090B]">Rx:</span> {decryptedClaim.prescription}
          </div>
          <button
            type="button"
            onClick={onLogAccessAudit}
            className="text-[11px] font-medium text-[#0F766E] hover:underline cursor-pointer"
          >
            Optional: Log read-access audit on-chain →
          </button>
        </div>
      ) : null}

      {/* Collapsible Facility & Backup Options */}
      <details className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 text-xs">
        <summary className="cursor-pointer font-medium text-[#52525B] select-none">
          Hospital Wallet &amp; Backup Import ({shortHex(hospitalAddr, 6, 4)})
        </summary>
        <div className="mt-3 space-y-3 pt-2 border-t border-[#E4E4E7]">
          <div className="grid grid-cols-1 gap-1.5">
            {ACCREDITED_PROVIDERS.map((prov) => (
              <button
                key={prov.address}
                type="button"
                onClick={() => onChangeHospitalAddr(prov.address)}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] cursor-pointer ${
                  prov.address.toLowerCase() === hospitalAddr.toLowerCase()
                    ? "border-[#0F4C81] bg-[#F0F9FF] font-semibold text-[#09090B]"
                    : "border-[#E4E4E7] bg-white text-[#52525B]"
                }`}
              >
                {prov.name} · {shortHex(prov.address, 6, 4)}
              </button>
            ))}
          </div>
          <input
            id="hosp-wallet"
            aria-label="Proving hospital address"
            value={hospitalAddr}
            onChange={(e) => onChangeHospitalAddr(e.target.value)}
            className="w-full rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 font-mono-tabular text-[11px] text-[#09090B]"
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#09090B] hover:bg-[#F4F4F5]">
            <Upload className="h-3.5 w-3.5" />
            Import .qlo.json backup
            <input
              id="qlo-bundle-upload"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportBundle(file);
              }}
            />
          </label>
        </div>
      </details>
    </div>
  );
}
