"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Lock,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/card";
import { DecryptedText } from "@/components/ui/decrypted-text";
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
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <section
      id="hospital-queue"
      className="lg:col-span-5 rounded-xl border border-[#1E242D] bg-[#111419] p-5 sm:p-6 space-y-4"
    >
      <div className="border-b border-[#1E242D] pb-3.5 space-y-0.5">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">Shared Patient Records</h2>
        <p className="text-xs text-[#94A3B8]">
          Verify active on-chain consent and unwrap AES-256-GCM medical records locally.
        </p>
      </div>

      {/* Live Grant Status */}
      {selectedEntry ? (
        <div
          className={`rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs ${
            accessStatus === "granted"
              ? "border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]"
              : accessStatus === "missing"
              ? "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]"
              : "border-[#1E242D] bg-[#0D1014] text-[#94A3B8]"
          }`}
        >
          <span className="font-medium">
            {accessStatus === "granted"
              ? "Patient Consent Active"
              : accessStatus === "missing"
              ? "Access Not Granted / Revoked"
              : "Checking on-chain consent..."}
          </span>
          {accessStatus === "granted" && accessExpiresAt > 0 ? (
            <span className="font-mono-tabular text-[11px]">
              Exp {new Date(accessExpiresAt * 1000).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Record Selector */}
      <div>
        <label htmlFor="vault-select" className="text-xs font-medium text-[#94A3B8]">
          Authorized Record Queue
        </label>
        <select
          id="vault-select"
          value={selectedEntry?.recordCommitmentHex ?? ""}
          onChange={(e) => {
            const found = entries.find((x) => x.recordCommitmentHex === e.target.value);
            onSelectEntry(found ?? null);
          }}
          className="mt-1.5 w-full rounded-lg border border-[#1E242D] bg-[#0D1014] px-3 py-2 text-xs font-medium text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
        >
          {entries.length === 0 ? (
            <option value="" className="bg-[#111419] text-[#94A3B8]">
              No shared records found yet
            </option>
          ) : (
            entries.map((item) => (
              <option
                key={item.recordCommitmentHex}
                value={item.recordCommitmentHex}
                className="bg-[#111419] text-[#F3F4F6]"
              >
                {item.summaryHint || shortHex(item.cid, 12, 6)}
              </option>
            ))
          )}
        </select>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#1E242D] bg-[#0D1014] p-4 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 font-medium text-[#F3F4F6]">
            <Lock className="h-3.5 w-3.5 text-[#38BDF8]" />
            No shared patient record yet
          </div>
          <p className="text-[#94A3B8] leading-relaxed">
            Encrypt a CMS-1500 bill in Records Vault, anchor its 248-bit hash on Sepolia, and grant temporary access to your hospital wallet.
          </p>
          <Link
            href="/patient"
            className="inline-flex items-center gap-1.5 font-medium text-[#10B981] hover:underline"
          >
            Open Records Vault
            <ArrowRight className="h-3.5 w-3.5" />
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
        <div className="rounded-lg border border-[#EF4444]/25 bg-[#EF4444]/10 p-3 text-xs text-[#EF4444] flex items-start gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{accessError}</span>
        </div>
      ) : null}

      {matchedProvider &&
      decryptedClaim &&
      decryptedClaim.renderingNpi.trim() !== matchedProvider.licenseId ? (
        <div className="rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/10 p-3 flex items-center justify-between gap-2 text-xs text-[#F59E0B]">
          <span>
            Bill NPI ({decryptedClaim.renderingNpi}) differs from facility ({matchedProvider.licenseId}).
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

      {/* Decrypted Clinical Encounter Key-Value Table */}
      {decryptedClaim ? (
        <div className="rounded-lg border border-[#10B981]/25 bg-[#0D1014] overflow-hidden text-xs">
          <div className="flex items-center justify-between border-b border-[#1E242D] bg-[#10B981]/10 px-3.5 py-2.5">
            <span className="font-semibold text-[#10B981] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Decrypted Clinical Encounter
            </span>
            {completenessValid ? <Badge variant="emerald">CMS-1500 Valid</Badge> : null}
          </div>

          <div className="divide-y divide-[#1E242D] px-3.5">
            <div className="flex items-center justify-between py-2">
              <span className="text-[#64748B]">Diagnosis (ICD-10)</span>
              <DecryptedText
                text={decryptedClaim.icd10Code}
                encrypted={false}
                className="font-mono-tabular font-semibold text-[#F3F4F6]"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[#64748B]">Procedure (CPT)</span>
              <DecryptedText
                text={decryptedClaim.cptCode}
                encrypted={false}
                className="font-mono-tabular font-semibold text-[#F3F4F6]"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[#64748B]">Claim Payout</span>
              <span className="font-mono-tabular font-semibold text-[#10B981]">
                {decryptedClaim.claimAmountEth} ETH
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[#64748B]">Policy ID</span>
              <span className="font-mono-tabular text-[#94A3B8]">
                {decryptedClaim.insuredPolicyId}
              </span>
            </div>
            <div className="py-2 space-y-0.5">
              <div className="text-[#64748B]">Prescription</div>
              <div className="text-[#F3F4F6]">{decryptedClaim.prescription}</div>
            </div>
          </div>

          <div className="border-t border-[#1E242D] bg-[#111419] px-3.5 py-2.5">
            <button
              type="button"
              onClick={onLogAccessAudit}
              className="text-[11px] font-medium text-[#38BDF8] hover:underline cursor-pointer"
            >
              Log read-access audit on-chain →
            </button>
          </div>
        </div>
      ) : null}

      {/* Collapsible Hospital Wallet & Backup Import */}
      <div className="rounded-lg border border-[#1E242D] bg-[#0D1014] overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setConfigOpen((prev) => !prev)}
          aria-expanded={configOpen}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left font-medium text-[#94A3B8] hover:text-[#F3F4F6] hover:bg-[#161B22] cursor-pointer transition-colors"
        >
          <span className="font-mono-tabular">
            Hospital Wallet &amp; Backup Import ({shortHex(hospitalAddr, 6, 4)})
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${configOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div className={configOpen ? "space-y-3 border-t border-[#1E242D] p-3.5" : "hidden"}>
          <div className="grid grid-cols-1 gap-1.5">
            {ACCREDITED_PROVIDERS.map((prov) => {
              const active = prov.address.toLowerCase() === hospitalAddr.toLowerCase();
              return (
                <button
                  key={prov.address}
                  type="button"
                  onClick={() => onChangeHospitalAddr(prov.address)}
                  className={`rounded-lg border px-3 py-2 text-left text-[11px] font-mono-tabular cursor-pointer transition-colors ${
                    active
                      ? "border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#F3F4F6]"
                      : "border-[#1E242D] bg-[#111419] text-[#94A3B8] hover:border-[#2B3340]"
                  }`}
                >
                  {prov.name} · {shortHex(prov.address, 6, 4)}
                </button>
              );
            })}
          </div>
          <div>
            <label htmlFor="hosp-wallet" className="sr-only">
              Proving hospital address
            </label>
            <input
              id="hosp-wallet"
              aria-label="Proving hospital address"
              value={hospitalAddr}
              onChange={(e) => onChangeHospitalAddr(e.target.value)}
              className="w-full rounded-lg border border-[#1E242D] bg-[#161B22] px-3 py-2 font-mono-tabular text-[11px] text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
            />
          </div>
          <label
            htmlFor="qlo-bundle-upload"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#1E242D] bg-[#161B22] px-3 py-2 text-[11px] font-medium text-[#F3F4F6] hover:border-[#2B3340] transition-colors"
          >
            <Upload className="h-3.5 w-3.5 text-[#10B981]" />
            Import .qlo.json backup
            <input
              id="qlo-bundle-upload"
              aria-label="Import encrypted .qlo.json bundle"
              type="file"
              accept=".json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportBundle(file);
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
