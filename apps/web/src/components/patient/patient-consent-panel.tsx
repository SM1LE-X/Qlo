"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, KeyRound, Lock, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { TactileButton } from "@/components/ui/tactile-button";
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
    <div id="patient-consent" className="lg:col-span-5 space-y-5">
      {/* Card 1: Local AES-256-GCM Encryption & Commitment */}
      <section className="rounded-xl border border-[#1E242D] bg-[#111419] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#1E242D] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              Local AES-256-GCM Encryption &amp; Commitment
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Encrypt bill locally and anchor its 248-bit hash on-chain.
            </p>
          </div>
          {registeredRecordId ? (
            <Badge variant="emerald">Saved (#{registeredRecordId})</Badge>
          ) : encrypted ? (
            <Badge variant="teal">AES-256 Locked</Badge>
          ) : (
            <Badge variant="neutral">Unsealed</Badge>
          )}
        </div>

        {/* Cryptographic Hash & CID Readout */}
        <div className="rounded-lg border border-[#1E242D] bg-[#0D1014] p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#64748B]">Policy / Procedure</span>
            <span className="font-mono-tabular text-[#F3F4F6]">
              {claim.insuredPolicyId} · CPT {claim.cptCode} · {claim.claimAmountEth} ETH
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#1E242D] pt-2">
            <span className="text-[#64748B]">248-bit Commit</span>
            <span className="font-mono-tabular text-[#10B981]">
              {encrypted ? shortHex(encrypted.recordCommitmentHex, 12, 8) : "Pending encryption"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#64748B]">CIDv1 Digest</span>
            <span className="font-mono-tabular text-[#94A3B8]">
              {cid ? shortHex(cid, 14, 8) : "—"}
            </span>
          </div>

          {encrypted && cid && vaultEntry ? (
            <div className="flex items-center justify-between gap-2 border-t border-[#1E242D] pt-2">
              <span className="font-mono-tabular text-[11px] text-[#64748B]">
                Portable ciphertext bundle (.qlo.json)
              </span>
              <button
                type="button"
                onClick={() => onDownloadBundle(vaultEntry, registeredRecordId)}
                className="inline-flex items-center gap-1 rounded-md border border-[#1E242D] bg-[#161B22] px-2 py-1 text-[11px] font-medium text-[#10B981] hover:border-[#2B3340] cursor-pointer transition-colors"
              >
                <Download className="h-3 w-3" />
                Backup
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <TactileButton
            variant={encrypted ? "secondary" : "primary"}
            className="w-full"
            onClick={onEncryptLocally}
            disabled={busy || !completenessValid}
          >
            {encrypted ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
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
              ? `Saved (#${registeredRecordId})`
              : "Save Fingerprint On-Chain"}
          </TactileButton>

          {IS_CHAIN_DEPLOYED && !canSignChainTx ? (
            <p className="text-[11px] text-[#F59E0B]">
              Connect MetaMask on Ethereum Sepolia to anchor on-chain.
            </p>
          ) : null}
        </div>
      </section>

      {/* Card 2: Access Control */}
      <section className="rounded-xl border border-[#1E242D] bg-[#111419] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#1E242D] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#F3F4F6]">Access Control</h2>
            <p className="text-xs text-[#94A3B8]">
              Wrap DEK via ECDH P-256 with time-bound expiry and instant revoke.
            </p>
          </div>
          <Badge variant={grantActive ? "emerald" : "neutral"}>
            {grantActive ? "Access Granted" : "Not Shared"}
          </Badge>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="hosp-addr" className="font-medium text-[#94A3B8]">
              Hospital Wallet
            </label>
            {connectedAddress && !isOwnWalletTarget ? (
              <button
                type="button"
                onClick={() => onChangeTargetHospital(connectedAddress)}
                className="text-[11px] font-medium text-[#38BDF8] hover:underline cursor-pointer"
              >
                Use my connected wallet
              </button>
            ) : isOwnWalletTarget ? (
              <span className="text-[11px] font-medium text-[#10B981]">Using your wallet</span>
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
            className="w-full rounded-lg border border-[#1E242D] bg-[#0D1014] px-3 py-2 text-xs font-medium text-[#F3F4F6] focus:border-[#10B981] focus:outline-none"
          >
            {ACCREDITED_PROVIDERS.map((prov) => (
              <option
                key={prov.address}
                value={prov.address}
                className="bg-[#111419] text-[#F3F4F6]"
              >
                {connectedAddress &&
                prov.address.toLowerCase() === connectedAddress.toLowerCase()
                  ? `Your Wallet — ${prov.name} (${shortHex(prov.address, 6, 4)})`
                  : `${prov.name} (${shortHex(prov.address, 6, 4)})`}
              </option>
            ))}
            {!ACCREDITED_PROVIDERS.some(
              (p) => p.address.toLowerCase() === targetHospital.toLowerCase()
            ) ? (
              <option value="__custom" className="bg-[#111419] text-[#F3F4F6]">
                Custom ({shortHex(targetHospital, 6, 4)})
              </option>
            ) : null}
          </select>

          <input
            id="hosp-addr"
            value={targetHospital}
            onChange={(e) => onChangeTargetHospital(e.target.value)}
            className="w-full rounded-lg border border-[#1E242D] bg-[#0D1014] px-3 py-2 font-mono-tabular text-[11px] text-[#F3F4F6] placeholder-[#64748B] focus:border-[#10B981] focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[#94A3B8]">Grant TTL</span>
            <div className="inline-flex items-center gap-1 rounded-lg border border-[#1E242D] bg-[#0D1014] p-0.5">
              {[10, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => onChangeGrantMinutes(mins)}
                  className={`rounded-md px-3 py-1 font-mono-tabular text-xs font-medium cursor-pointer transition-colors ${
                    grantMinutes === mins
                      ? "bg-[#161B22] text-[#10B981] border border-[#10B981]/30"
                      : "text-[#94A3B8] hover:text-[#F3F4F6] border border-transparent"
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
          <p className="text-[11px] text-[#64748B]">
            Encrypt and save the record fingerprint on-chain first to enable consent grants.
          </p>
        ) : null}

        {grantActive ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#10B981]/25 bg-[#10B981]/10 px-3.5 py-2.5">
            <span className="text-xs font-medium text-[#10B981]">
              Hospital authorized to unwrap &amp; prove claim
            </span>
            <Link
              href="/hospital"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#F3F4F6] hover:text-[#10B981] shrink-0"
            >
              Claims Prover
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
