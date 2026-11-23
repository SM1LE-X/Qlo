"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, KeyRound, Lock, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
import { ACCREDITED_PROVIDERS } from "@/lib/clinicalCatalog";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { type EncryptedRecordResult } from "@/lib/crypto";
import { type StoredVaultEntry } from "@/lib/storage";
import { shortHex } from "@/lib/utils";

interface PatientConsentPanelProps {
  encrypted: EncryptedRecordResult | null;
  cid: string;
  registeredRecordId: string;
  secondsRemaining: number;
  targetHospital: string;
  onChangeTargetHospital: (addr: string) => void;
  connectedAddress?: string;
  grantMinutes: number;
  onChangeGrantMinutes: (mins: number) => void;
  busy: boolean;
  completenessValid: boolean;
  vaultEntry: StoredVaultEntry | null;
  canSignChainTx: boolean;
  onEncryptLocally: () => void;
  onDownloadBundle: (entry: StoredVaultEntry, overrideId?: string) => void;
  onRegisterOnChain: () => void;
  onGrantAccess: () => void;
  onRevokeAccess: () => void;
}

export function PatientConsentPanel({
  encrypted,
  cid,
  registeredRecordId,
  secondsRemaining,
  targetHospital,
  onChangeTargetHospital,
  connectedAddress,
  grantMinutes,
  onChangeGrantMinutes,
  busy,
  completenessValid,
  vaultEntry,
  canSignChainTx,
  onEncryptLocally,
  onDownloadBundle,
  onRegisterOnChain,
  onGrantAccess,
  onRevokeAccess,
}: PatientConsentPanelProps) {
  const grantActive = secondsRemaining > 0;
  const isOwnWalletTarget = Boolean(
    connectedAddress && connectedAddress.toLowerCase() === targetHospital.toLowerCase()
  );

  return (
    <div id="patient-consent" className="lg:col-span-5 space-y-5">
      {/* Step 2: Encrypt & Anchor */}
      <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#09090B]">
            2. Encrypt &amp; Save Record
          </h2>
          {registeredRecordId ? (
            <Badge variant="emerald">Saved (#{registeredRecordId})</Badge>
          ) : encrypted ? (
            <Badge variant="teal">Encrypted</Badge>
          ) : null}
        </div>

        <p className="text-xs text-[#52525B] leading-relaxed">
          Your browser encrypts this medical record locally with AES-256 and writes only an anonymous hash to Ethereum Sepolia.
        </p>

        <div className="space-y-2.5">
          <TactileButton
            variant={encrypted ? "secondary" : "primary"}
            className="w-full"
            onClick={onEncryptLocally}
            disabled={busy || !completenessValid}
          >
            {encrypted ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[#047857]" />
                Encrypted Locally (Re-Encrypt)
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Encrypt Record on Device
              </>
            )}
          </TactileButton>

          <TactileButton
            variant={encrypted && !registeredRecordId ? "primary" : "secondary"}
            className="w-full"
            onClick={onRegisterOnChain}
            disabled={busy || !encrypted || !canSignChainTx}
          >
            {registeredRecordId
              ? `Saved On-Chain (Record #${registeredRecordId})`
              : "Save Fingerprint On-Chain"}
          </TactileButton>

          {IS_CHAIN_DEPLOYED && !canSignChainTx ? (
            <p className="text-[11px] text-[#B45309]">
              Connect MetaMask on Ethereum Sepolia (top right) to save on-chain.
            </p>
          ) : null}
        </div>

        {encrypted && cid && vaultEntry ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[11px]">
            <span className="font-mono-tabular text-[#52525B] truncate">
              Hash: {shortHex(encrypted.recordCommitmentHex, 10, 6)}
            </span>
            <button
              type="button"
              onClick={() => onDownloadBundle(vaultEntry, registeredRecordId)}
              className="inline-flex items-center gap-1 font-medium text-[#0F766E] hover:underline shrink-0 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              Backup
            </button>
          </div>
        ) : null}
      </div>

      {/* Step 3: Grant / Revoke Hospital Access */}
      <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#09090B]">
            3. Share with Hospital
          </h2>
          <Badge variant={grantActive ? "emerald" : "neutral"}>
            {grantActive ? "Access Granted" : "Not Shared"}
          </Badge>
        </div>

        <p className="text-xs text-[#52525B] leading-relaxed">
          Choose which hospital wallet can temporarily decrypt this record to file your claim.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="hosp-addr" className="font-medium text-[#52525B]">
              Hospital Wallet
            </label>
            {connectedAddress && !isOwnWalletTarget ? (
              <button
                type="button"
                onClick={() => onChangeTargetHospital(connectedAddress)}
                className="text-[11px] font-medium text-[#0F766E] hover:underline cursor-pointer"
              >
                Use my connected wallet
              </button>
            ) : isOwnWalletTarget ? (
              <span className="text-[11px] font-medium text-[#047857]">
                Using your wallet ✓
              </span>
            ) : null}
          </div>

          <select
            aria-label="Choose accredited hospital"
            value={
              ACCREDITED_PROVIDERS.some(
                (p) => p.address.toLowerCase() === targetHospital.toLowerCase()
              )
                ? ACCREDITED_PROVIDERS.find(
                    (p) => p.address.toLowerCase() === targetHospital.toLowerCase()
                  )?.address
                : "__custom"
            }
            onChange={(e) => {
              if (e.target.value !== "__custom") {
                onChangeTargetHospital(e.target.value);
              }
            }}
            className="w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#09090B] focus:border-[#0F766E] focus:outline-none"
          >
            {ACCREDITED_PROVIDERS.map((prov) => (
              <option key={prov.address} value={prov.address}>
                {connectedAddress &&
                prov.address.toLowerCase() === connectedAddress.toLowerCase()
                  ? `Your Wallet — ${prov.name} (${shortHex(prov.address, 6, 4)})`
                  : `${prov.name} (${shortHex(prov.address, 6, 4)})`}
              </option>
            ))}
            {!ACCREDITED_PROVIDERS.some(
              (p) => p.address.toLowerCase() === targetHospital.toLowerCase()
            ) ? (
              <option value="__custom">Custom ({shortHex(targetHospital, 6, 4)})</option>
            ) : null}
          </select>

          <input
            id="hosp-addr"
            value={targetHospital}
            onChange={(e) => onChangeTargetHospital(e.target.value)}
            className="w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-1.5 font-mono-tabular text-[11px] text-[#52525B] focus:border-[#0F766E] focus:bg-white focus:outline-none"
          />

          <div className="flex items-center gap-2 pt-1 text-xs">
            <span className="text-[#71717A]">Access lasts:</span>
            {[10, 30].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => onChangeGrantMinutes(mins)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                  grantMinutes === mins
                    ? "border-[#0F766E] bg-[#F0FDFA] text-[#0F766E]"
                    : "border-[#E4E4E7] bg-white text-[#52525B]"
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <TactileButton
            variant="emerald"
            onClick={onGrantAccess}
            disabled={busy || !registeredRecordId || !canSignChainTx}
          >
            <KeyRound className="h-4 w-4" />
            Grant Access
          </TactileButton>
          <TactileButton
            variant="crimson"
            onClick={onRevokeAccess}
            disabled={busy || !registeredRecordId || !canSignChainTx}
          >
            <ShieldOff className="h-4 w-4" />
            Revoke
          </TactileButton>
        </div>

        {!registeredRecordId ? (
          <p className="text-[11px] text-[#71717A]">
            Finish Step 2 above first to unlock sharing controls.
          </p>
        ) : null}

        {grantActive ? (
          <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-[#047857]">
              ✓ Access granted! Your hospital can now prove and submit this claim.
            </div>
            <Link href="/hospital" className="block">
              <TactileButton variant="primary" size="sm" className="w-full">
                Continue to Step 2: Hospital Portal
                <ArrowRight className="h-3.5 w-3.5" />
              </TactileButton>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
