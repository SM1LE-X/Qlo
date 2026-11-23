"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, KeyRound, Lock, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { WalletPassCard } from "@/components/ui/wallet-pass-card";
import { ACCREDITED_PROVIDERS } from "@/lib/clinicalCatalog";
import { IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { type EncryptedRecordResult } from "@/lib/crypto";
import { type Cms1500Claim } from "@/lib/intake";
import { type StoredVaultEntry } from "@/lib/storage";
import { shortHex } from "@/lib/utils";

interface PatientConsentPanelProps {
  claim: Cms1500Claim;
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
  claim,
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
    <div id="patient-consent" className="lg:col-span-5 space-y-6">
      {/* Step 2: Interactive 3D Policy Pass + Encrypt & Anchor */}
      <SpotlightCard accent="emerald" className="p-6 sm:p-7 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#0F766E]">
              02 · Client Encryption &amp; Policy Pass
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[#09090B]">
              2. Encrypt &amp; Save Record
            </h2>
          </div>
          {registeredRecordId ? (
            <Badge variant="emerald">Saved (#{registeredRecordId})</Badge>
          ) : encrypted ? (
            <Badge variant="teal">AES-256 Locked</Badge>
          ) : null}
        </div>

        {/* Flippable 3D Encrypted Health Policy Pass */}
        <WalletPassCard
          policyId={claim.insuredPolicyId}
          patientAlias={claim.patientAlias}
          cptCode={claim.cptCode}
          icd10Code={claim.icd10Code}
          claimAmountEth={claim.claimAmountEth}
          encrypted={Boolean(encrypted)}
          cid={cid}
          recordCommitmentHex={encrypted?.recordCommitmentHex}
          recordId={registeredRecordId}
          secondsRemaining={secondsRemaining}
          targetHospital={targetHospital}
        />

        <div className="space-y-2.5 pt-1">
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
            variant={encrypted && !registeredRecordId ? "emerald" : "secondary"}
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
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] px-3.5 py-2.5 text-[11px]">
            <span className="font-mono-tabular text-[#52525B] truncate">
              Hash: {shortHex(encrypted.recordCommitmentHex, 10, 6)}
            </span>
            <button
              type="button"
              onClick={() => onDownloadBundle(vaultEntry, registeredRecordId)}
              className="inline-flex items-center gap-1 font-semibold text-[#0F766E] hover:underline shrink-0 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              Backup
            </button>
          </div>
        ) : null}
      </SpotlightCard>

      {/* Step 3: Grant / Revoke Hospital Access */}
      <SpotlightCard accent={grantActive ? "emerald" : "neutral"} className="p-6 sm:p-7 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#0F766E]">
              03 · Consent Control
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[#09090B]">
              3. Share with Hospital
            </h2>
          </div>
          <Badge variant={grantActive ? "emerald" : "neutral"}>
            {grantActive ? "Access Granted" : "Not Shared"}
          </Badge>
        </div>

        <p className="text-xs text-[#52525B] leading-relaxed">
          Wrap the encryption key for one hospital wallet with a strict timer. Revoking deletes
          the key on-chain immediately.
        </p>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="hosp-addr" className="font-semibold text-[#3F3F46]">
              Hospital Wallet
            </label>
            {connectedAddress && !isOwnWalletTarget ? (
              <button
                type="button"
                onClick={() => onChangeTargetHospital(connectedAddress)}
                className="text-[11px] font-semibold text-[#0F766E] hover:underline cursor-pointer"
              >
                Use my connected wallet
              </button>
            ) : isOwnWalletTarget ? (
              <span className="text-[11px] font-semibold text-[#047857]">
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
            className="w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2 text-xs font-medium text-[#09090B] focus:border-[#0F766E] focus:outline-none"
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
            className="w-full rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] px-3.5 py-2 font-mono-tabular text-[11px] text-[#52525B] focus:border-[#0F766E] focus:bg-white focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[#71717A] font-medium">Access window:</span>
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#E4E4E7] bg-[#F7F8F7] p-1">
              {[10, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => onChangeGrantMinutes(mins)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer transition-all ${
                    grantMinutes === mins
                      ? "bg-white text-[#0F766E] shadow-2xs border border-[#99F6E4]"
                      : "text-[#52525B] hover:text-[#09090B]"
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
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
          <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-4 space-y-3">
            <div className="text-xs font-semibold text-[#047857]">
              ✓ Access granted! Your hospital can now prove and settle this claim.
            </div>
            <Link href="/hospital" className="block">
              <TactileButton variant="primary" size="sm" className="w-full">
                Continue to Step 2: Hospital Portal
                <ArrowRight className="h-3.5 w-3.5" />
              </TactileButton>
            </Link>
          </div>
        ) : null}
      </SpotlightCard>
    </div>
  );
}
