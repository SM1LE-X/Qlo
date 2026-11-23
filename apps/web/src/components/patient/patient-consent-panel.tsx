"use client";

import { Download, KeyRound, Lock, ShieldOff } from "lucide-react";
import { CopyHash } from "@/components/ui/copy-hash";
import { DecryptedText } from "@/components/ui/decrypted-text";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TactileButton } from "@/components/ui/tactile-button";
import { WalletPassCard } from "@/components/ui/wallet-pass-card";
import { ACCREDITED_PROVIDERS } from "@/lib/clinicalCatalog";
import { type EncryptedRecordResult } from "@/lib/crypto";
import { type Cms1500Claim } from "@/lib/intake";
import { type StoredVaultEntry } from "@/lib/storage";

const INPUT_CLASS =
  "mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 font-mono-tabular text-xs text-[#09090B] placeholder-[#A1A1AA] focus:border-[#0F766E] focus:outline-none transition-colors";

interface PatientConsentPanelProps {
  claim: Cms1500Claim;
  encrypted: EncryptedRecordResult | null;
  cid: string;
  registeredRecordId: string;
  secondsRemaining: number;
  targetHospital: string;
  onChangeTargetHospital: (addr: string) => void;
  connectedAddress?: string;
  pubKeySource: string;
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
  pubKeySource,
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
  return (
    <div id="patient-consent" className="lg:col-span-5 space-y-5 scroll-mt-20">
      <WalletPassCard
        policyId={claim.insuredPolicyId || "2026001"}
        patientAlias={claim.patientAlias || "SYNTH-CASE"}
        icd10Code={claim.icd10Code}
        cptCode={claim.cptCode}
        claimAmountEth={claim.claimAmountEth || "0"}
        encrypted={Boolean(encrypted)}
        cid={cid}
        recordCommitmentHex={encrypted?.recordCommitmentHex}
        recordId={registeredRecordId}
        secondsRemaining={secondsRemaining}
        targetHospital={targetHospital}
      />

      <SpotlightCard accent="neutral" className="p-6 space-y-4">
        <div className="border-b border-[#F4F4F5] pb-3">
          <h2 className="text-sm font-semibold text-[#09090B]">
            2. AES-256-GCM Encrypt &amp; CIDv1
          </h2>
        </div>

        <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3 text-xs space-y-1">
          <div className="text-[#71717A] text-[10px] uppercase tracking-wider font-mono-tabular">
            Live Cryptographic View
          </div>
          <DecryptedText
            text={`ICD:${claim.icd10Code} | CPT:${claim.cptCode} | RX:${claim.prescription}`}
            encrypted={Boolean(encrypted)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <TactileButton
            variant="primary"
            onClick={onEncryptLocally}
            disabled={busy || !completenessValid}
          >
            <Lock className="h-4 w-4" />
            Encrypt Locally (AES-256-GCM)
          </TactileButton>
          {vaultEntry ? (
            <TactileButton
              variant="secondary"
              onClick={() => onDownloadBundle(vaultEntry, registeredRecordId)}
            >
              <Download className="h-4 w-4" />
              .qlo.json
            </TactileButton>
          ) : null}
        </div>

        {encrypted && cid ? (
          <div className="space-y-2 pt-1">
            <CopyHash label="IPFS CIDv1" value={cid} />
            <CopyHash label="248-bit Commit" value={encrypted.recordCommitmentHex} />
            <div className="text-[11px] font-mono-tabular text-[#047857]">
              Ciphertext persisted in IndexedDB (<code className="font-semibold">qlo-vault-v1</code>)
            </div>
          </div>
        ) : null}
      </SpotlightCard>

      <SpotlightCard accent="emerald" className="p-6 space-y-4 text-xs">
        <div className="border-b border-[#F4F4F5] pb-3">
          <h2 className="text-sm font-semibold text-[#09090B]">
            3. On-Chain Consent &amp; ECDH Key Wrap
          </h2>
        </div>

        <TactileButton
          variant="secondary"
          className="w-full"
          onClick={onRegisterOnChain}
          disabled={busy || !encrypted || !canSignChainTx}
        >
          Register Commitment &amp; CID On-Chain
          {registeredRecordId ? ` (Record #${registeredRecordId})` : ""}
        </TactileButton>

        <div className="space-y-2.5 border-t border-[#F4F4F5] pt-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#52525B]">Accredited Provider Directory</span>
              <span className="font-mono-tabular text-[#71717A]">
                {ACCREDITED_PROVIDERS.length} verified on-chain
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCREDITED_PROVIDERS.map((prov) => {
                const selected = prov.address.toLowerCase() === targetHospital.toLowerCase();
                return (
                  <button
                    key={prov.address}
                    type="button"
                    onClick={() => onChangeTargetHospital(prov.address)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                      selected
                        ? "border-[#0F766E] bg-[#F0FDFA]/80"
                        : "border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#D4D4D8] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-semibold text-[#09090B] text-[11px]">
                        {prov.name}
                      </span>
                      <span className="shrink-0 rounded bg-[#ECFDF5] px-1.5 py-0.5 font-mono-tabular text-[9px] font-semibold text-[#047857]">
                        NPI
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-[#52525B]">
                      {prov.specialty} · {prov.city}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label
            htmlFor="hosp-addr"
            className="text-[#52525B] font-medium flex items-center justify-between gap-2"
          >
            <span>Target Accredited Hospital</span>
            <span className="flex items-center gap-2">
              {connectedAddress &&
              connectedAddress.toLowerCase() !== targetHospital.toLowerCase() ? (
                <button
                  type="button"
                  onClick={() => onChangeTargetHospital(connectedAddress)}
                  className="text-[10px] font-mono-tabular text-[#0F766E] underline hover:text-[#09090B] cursor-pointer"
                >
                  Use my wallet
                </button>
              ) : null}
              {pubKeySource ? (
                <span className="text-[10px] font-mono-tabular text-[#047857]">
                  {pubKeySource}
                </span>
              ) : null}
            </span>
          </label>

          <input
            id="hosp-addr"
            value={targetHospital}
            onChange={(e) => onChangeTargetHospital(e.target.value)}
            className={INPUT_CLASS}
          />

          <div className="flex items-center gap-2 pt-1">
            {[10, 30].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => onChangeGrantMinutes(mins)}
                className={`rounded-lg border px-3 py-1.5 font-mono-tabular cursor-pointer transition-colors ${
                  grantMinutes === mins
                    ? "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E] font-semibold"
                    : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#D4D4D8]"
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#99F6E4] bg-[#F0FDFA]/60 p-3 space-y-1 text-[11px]">
            <div className="font-semibold text-[#0F766E]">
              Consent Scope Disclosure (SMART-on-FHIR Standard)
            </div>
            <p className="text-[#52525B] leading-relaxed">
              Authorizes{" "}
              <span className="font-semibold text-[#09090B]">
                {ACCREDITED_PROVIDERS.find(
                  (p) => p.address.toLowerCase() === targetHospital.toLowerCase()
                )?.name ?? targetHospital}
              </span>{" "}
              to unwrap record{" "}
              <span className="font-mono-tabular font-semibold text-[#09090B]">
                #{registeredRecordId || "—"}
              </span>{" "}
              for <span className="font-semibold text-[#09090B]">{grantMinutes} minutes</span> exclusively to compute a zero-knowledge eligibility proof. Insurer sees <span className="font-semibold text-[#047857]">0 clinical bytes</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <TactileButton
            variant="emerald"
            onClick={onGrantAccess}
            disabled={busy || !registeredRecordId || !canSignChainTx}
          >
            <KeyRound className="h-4 w-4" />
            Grant {grantMinutes}m Access (Wrap DEK)
          </TactileButton>
          <TactileButton
            variant="crimson"
            onClick={onRevokeAccess}
            disabled={busy || !registeredRecordId || !canSignChainTx}
          >
            <ShieldOff className="h-4 w-4" />
            Revoke Immediately
          </TactileButton>
        </div>
      </SpotlightCard>
    </div>
  );
}
