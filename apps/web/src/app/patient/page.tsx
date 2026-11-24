"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { DropIntake, formatClinicalSummary, getFacilityName, mergeOcrClaim, sanitizeLabel, type DropBillOptions } from "@/components/patient/drop-intake";
import { PatientOverviewHeader } from "@/components/patient/patient-overview-header";
import { useAmbientStatus } from "@/components/ui/ambient-pill";
import { AuditTimeline, type AuditEventItem } from "@/components/ui/audit-timeline";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { fetchPatientAuditEvents } from "@/lib/chainEvents";
import { CONTRACTS, IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import { encryptClinicalPayload, getOrCreateHospitalKeypair, wrapDekForHospital, type EncryptedRecordResult } from "@/lib/crypto";
import { runLocalOcrOnBill, validateCms1500Completeness, type Cms1500Claim } from "@/lib/intake";
import { loadLocalChainMirror, saveLocalChainMirror } from "@/lib/localState";
import { fetchRelayState, postRelayAction, pushCiphertextToRelay } from "@/lib/relayClient";
import { computeDeterministicCidV1, listVaultEntries, saveEncryptedRecordToVault, serializeQloBundle, type StoredVaultEntry } from "@/lib/storage";
import { decodeContractError, ensureSepoliaChain, preflightSimulateAndWrite } from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatCountdown, shortHex } from "@/lib/utils";

const SUMMARY_STORAGE_KEY = "qlo-clinical-summaries-v1";
const loadSavedSummaries = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(SUMMARY_STORAGE_KEY) || "{}") as Record<string, string>; } catch { return {}; }
};
const persistSummary = (commitmentHex: string, summary: string): void => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify({ ...loadSavedSummaries(), [commitmentHex.toLowerCase()]: summary })); } catch { /* quota */ }
};

export default function PatientPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const roles = useWalletRoles();
  const { showStatus } = useAmbientStatus();

  const [encrypted, setEncrypted] = useState<EncryptedRecordResult | null>(null);
  const [vaultItems, setVaultItems] = useState<StoredVaultEntry[]>([]);
  const [registeredRecordId, setRegisteredRecordId] = useState("");
  const [targetHospital, setTargetHospital] = useState<string>(canonicalFixtures.accounts.hospital1);
  const [grantMinutes, setGrantMinutes] = useState(10);
  const [grantExpiresAt, setGrantExpiresAt] = useState(0);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [auditItems, setAuditItems] = useState<AuditEventItem[]>([]);
  const [activeGrantsMap, setActiveGrantsMap] = useState<Record<string, { expiresAt: number }>>({});
  const [settledClaimsCount, setSettledClaimsCount] = useState(0);
  const [summaries, setSummaries] = useState<Record<string, string>>(() => loadSavedSummaries());
  const [busy, setBusy] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [pipelineDetail, setPipelineDetail] = useState("");
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [sectionTab, setSectionTab] = useState<"records" | "activity">("records");

  const readRecordId = useCallback(async (commitmentHex: `0x${string}`) => {
    if (!publicClient) return 0n;
    return (await publicClient.readContract({ address: CONTRACTS.HealthRecords.address, abi: CONTRACTS.HealthRecords.abi, functionName: "commitmentToRecordId", args: [commitmentHex] })) as bigint;
  }, [publicClient]);

  const syncOverviewState = useCallback(async () => {
    const items = await listVaultEntries().catch(() => [] as StoredVaultEntry[]);
    const now = Math.floor(Date.now() / 1000);
    const maxActiveExpiry = (map: Record<string, { expiresAt: number }>) => Math.max(0, ...Object.values(map).map((g) => (g.expiresAt > now ? g.expiresAt : 0)));

    if (IS_CHAIN_DEPLOYED && publicClient) {
      let onChainSettled = roles.totalClaimsSettled;
      try {
        onChainSettled = Number((await publicClient.readContract({ address: CONTRACTS.ClaimsVault.address, abi: CONTRACTS.ClaimsVault.abi, functionName: "totalClaimsSettled" })) as bigint);
      } catch { /* fallback to cached role count */ }

      const grantsMap: Record<string, { expiresAt: number }> = {};
      const hydratedItems: StoredVaultEntry[] = [];
      for (const item of items) {
        let recIdStr = item.recordId || "";
        try {
          const recId = await readRecordId(item.recordCommitmentHex);
          if (recId > 0n) {
            recIdStr = recId.toString();
            const hospTarget = item.hospitalAddress || targetHospital;
            const [exp] = (await publicClient.readContract({ address: CONTRACTS.HealthRecords.address, abi: CONTRACTS.HealthRecords.abi, functionName: "getGrant", args: [recId, hospTarget as `0x${string}`] })) as [bigint, `0x${string}`];
            if (exp > 0n) grantsMap[`${recIdStr}:${hospTarget.toLowerCase()}`] = { expiresAt: Number(exp) };
          }
        } catch { /* non-fatal on RPC jitter */ }
        const updated = recIdStr && recIdStr !== item.recordId ? { ...item, recordId: recIdStr } : item;
        if (updated !== item) await saveEncryptedRecordToVault(updated).catch(() => undefined);
        hydratedItems.push(updated);
      }

      const remoteRelay = await fetchRelayState();
      const mergedGrants: Record<string, { expiresAt: number }> = { ...(remoteRelay?.grants ?? {}), ...grantsMap };
      setVaultItems(hydratedItems);
      setActiveGrantsMap(mergedGrants);
      setSettledClaimsCount(onChainSettled + (remoteRelay?.settledClaims?.length ?? 0));
      setGrantExpiresAt(maxActiveExpiry(mergedGrants));
      return { mirror: remoteRelay, items: hydratedItems };
    }

    const mirror = (await fetchRelayState()) ?? loadLocalChainMirror();
    setActiveGrantsMap(mirror.grants);
    setSettledClaimsCount(mirror.settledClaims.length);
    setVaultItems(items);
    setGrantExpiresAt(maxActiveExpiry(mirror.grants));
    return { mirror, items };
  }, [publicClient, readRecordId, roles.totalClaimsSettled, targetHospital]);

  useEffect(() => {
    void syncOverviewState().then(({ mirror, items }) => {
      if (IS_CHAIN_DEPLOYED && publicClient) fetchPatientAuditEvents(publicClient).then(setAuditItems).catch(() => undefined);
      else if (mirror) setAuditItems(mirror.auditLogs);
      const latest = items.find((i) => i.recordId) ?? items[0];
      if (!latest) return;
      setRegisteredRecordId(latest.recordId ?? "");
      const dekKey = `qlo-dek-${latest.recordCommitmentHex.toLowerCase()}`;
      const dekJson = localStorage.getItem(dekKey) ?? sessionStorage.getItem(dekKey);
      if (dekJson) setEncrypted({ envelope: latest.envelope, envelopeBytes: new TextEncoder().encode(JSON.stringify(latest.envelope)), dekRawBytes: new Uint8Array(JSON.parse(dekJson) as number[]), recordCommitment: BigInt(latest.recordCommitmentHex), recordCommitmentHex: latest.recordCommitmentHex });
    });
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [publicClient, syncOverviewState]);

  useEffect(() => {
    if (!IS_CHAIN_DEPLOYED || !address || grantExpiresAt > 0) return;
    if (canonicalFixtures.hospitals.some((h) => h.address.toLowerCase() === address.toLowerCase())) setTargetHospital(address);
  }, [address, grantExpiresAt]);

  const secondsRemaining = Math.max(0, grantExpiresAt - nowSec);
  const activeCount = useMemo(() => Object.values(activeGrantsMap).filter((g) => g.expiresAt > nowSec).length, [activeGrantsMap, nowSec]);

  const downloadBundleEntry = (entry: StoredVaultEntry) => {
    const url = URL.createObjectURL(new Blob([serializeQloBundle(entry)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `qlo-record-${entry.recordCommitmentHex.slice(2, 10)}.qlo.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDropBill = async (claimInput: Cms1500Claim, options: DropBillOptions) => {
    setBusy(true);
    setPipelineDetail("");
    const useOnChain = Boolean(IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain);

    try {
      let finalClaim = claimInput;
      if (options.runOcr && (options.fileBlob || options.pngUrl)) {
        setPipelineStage("Reading bill…");
        showStatus("Reading bill…", "working");
        let blob = options.fileBlob;
        if (!blob && options.pngUrl) {
          const res = await fetch(options.pngUrl);
          if (!res.ok) throw new Error("Unable to load bill image.");
          blob = await res.blob();
        }
        if (blob) {
          const { parsed } = await runLocalOcrOnBill(blob, (_s, pct) => setPipelineDetail(`${pct}%`));
          finalClaim = mergeOcrClaim(claimInput, parsed, options.fromRecentVisit, options.displayTitle);
        }
      }

      const completeness = validateCms1500Completeness(finalClaim);
      if (!completeness.valid) {
        const failed = completeness.checks.find((c) => !c.passed);
        throw new Error(failed ? `Missing ${failed.label} (${failed.detail}).` : "Incomplete medical bill fields.");
      }

      setPipelineStage("Encrypting locally…");
      setPipelineDetail("");
      showStatus("Encrypting locally…", "working");

      const enc = await encryptClinicalPayload(finalClaim);
      const computedCid = await computeDeterministicCidV1(enc.envelopeBytes);
      const summary = formatClinicalSummary(finalClaim, options.displayTitle);
      const cleanTitle = sanitizeLabel(options.displayTitle || finalClaim.caseLabel);

      let entry: StoredVaultEntry = { cid: computedCid, recordCommitmentHex: enc.recordCommitmentHex, envelope: enc.envelope, createdAt: new Date().toISOString(), patientAddress: address || canonicalFixtures.accounts.patient, hospitalAddress: targetHospital, summaryHint: `${cleanTitle} (${finalClaim.claimAmountEth} ETH)` };
      await saveEncryptedRecordToVault(entry);
      persistSummary(enc.recordCommitmentHex, summary);
      setSummaries((prev) => ({ ...prev, [enc.recordCommitmentHex.toLowerCase()]: summary }));

      const dekKey = `qlo-dek-${enc.recordCommitmentHex.toLowerCase()}`;
      const dekSerialized = JSON.stringify(Array.from(enc.dekRawBytes));
      sessionStorage.setItem(dekKey, dekSerialized);
      localStorage.setItem(dekKey, dekSerialized);
      setEncrypted(enc);

      setPipelineStage("Anchoring fingerprint…");
      showStatus("Anchoring fingerprint…", "working");

      let recId = "";
      if (useOnChain && publicClient && address) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        const existingRecId = await readRecordId(enc.recordCommitmentHex);
        if (existingRecId > 0n) {
          recId = existingRecId.toString();
        } else {
          const { hash } = await preflightSimulateAndWrite({ publicClient, account: address, address: CONTRACTS.HealthRecords.address, abi: CONTRACTS.HealthRecords.abi as Abi, functionName: "registerRecord", args: [enc.recordCommitmentHex, computedCid], writeContractAsync });
          recId = (await readRecordId(enc.recordCommitmentHex)).toString();
          setAuditItems((prev) => [{ id: `reg-${Date.now()}`, kind: "registered", title: `Record #${recId} Anchored`, detail: `CID ${shortHex(computedCid, 10, 6)}`, timestamp: new Date().toLocaleTimeString(), txHash: hash, explorerUrl: explorerTxUrl(hash) }, ...prev]);
        }
      } else {
        const updatedMirror = await postRelayAction({ action: "registerRecord", recordCommitmentHex: enc.recordCommitmentHex, cid: computedCid, patient: address || canonicalFixtures.accounts.patient });
        const mirror = updatedMirror ?? loadLocalChainMirror();
        const existing = mirror.records.find((r) => r.recordCommitmentHex.toLowerCase() === enc.recordCommitmentHex.toLowerCase());
        recId = existing ? existing.recordId : String(mirror.nextRecordId);
        if (!updatedMirror) {
          if (!existing) {
            mirror.nextRecordId += 1;
            mirror.records.push({ recordId: recId, patient: address || canonicalFixtures.accounts.patient, recordCommitmentHex: enc.recordCommitmentHex, cid: computedCid, createdAt: Math.floor(Date.now() / 1000) });
          }
          mirror.auditLogs = [{ id: `reg-${Date.now()}`, kind: "registered", title: `Record #${recId} Anchored`, detail: `CID ${shortHex(computedCid, 10, 6)}`, timestamp: new Date().toLocaleTimeString() }, ...mirror.auditLogs];
          saveLocalChainMirror(mirror);
        }
        setAuditItems(mirror.auditLogs);
      }

      entry = { ...entry, recordId: recId, hospitalAddress: targetHospital };
      setRegisteredRecordId(recId);
      await saveEncryptedRecordToVault(entry);
      await pushCiphertextToRelay(entry);

      setPipelineStage("Authorizing provider…");
      showStatus("Authorizing provider…", "working");

      let hospitalPubHex = "";
      if (IS_CHAIN_DEPLOYED && publicClient) {
        const onChainPub = (await publicClient.readContract({ address: CONTRACTS.HospitalRegistry.address, abi: CONTRACTS.HospitalRegistry.abi, functionName: "hospitalEncryptionPubKey", args: [targetHospital as `0x${string}`] })) as `0x${string}`;
        if (onChainPub && onChainPub.length >= 132) hospitalPubHex = onChainPub;
      }
      if (!hospitalPubHex) {
        const remoteKey = (await fetchRelayState())?.hospitalPubKeys?.[targetHospital.toLowerCase()];
        if (remoteKey && remoteKey.length >= 132) hospitalPubHex = remoteKey;
      }
      if (!hospitalPubHex) hospitalPubHex = (await getOrCreateHospitalKeypair(targetHospital)).publicKeyHex;

      const encryptedDekHex = await wrapDekForHospital(enc.dekRawBytes, hospitalPubHex);
      const expiresAt = Math.floor(Date.now() / 1000) + grantMinutes * 60;
      const facilityName = getFacilityName(targetHospital);
      const grantPayload = { action: "grant", recordId: recId, hospitalAddress: targetHospital, expiresAt, grantMinutes, encryptedDekHex, recordCommitmentHex: enc.recordCommitmentHex, hospitalPubKeyHex: hospitalPubHex };

      if (useOnChain && publicClient && address) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        const { hash } = await preflightSimulateAndWrite({ publicClient, account: address, address: CONTRACTS.HealthRecords.address, abi: CONTRACTS.HealthRecords.abi as Abi, functionName: "grantAccess", args: [BigInt(recId), targetHospital as `0x${string}`, BigInt(grantMinutes * 60), encryptedDekHex], writeContractAsync });
        await postRelayAction(grantPayload);
        setGrantExpiresAt(expiresAt);
        setAuditItems((prev) => [{ id: `grant-${Date.now()}`, kind: "granted", title: `Shared with ${facilityName} (${grantMinutes}m)`, detail: `Record #${recId}`, timestamp: new Date().toLocaleTimeString(), txHash: hash, explorerUrl: explorerTxUrl(hash) }, ...prev]);
        await Promise.all([syncOverviewState(), roles.refetch()]);
      } else {
        const updatedMirror = await postRelayAction(grantPayload);
        const mirror = updatedMirror ?? loadLocalChainMirror();
        if (!updatedMirror) {
          mirror.hospitalPubKeys[targetHospital.toLowerCase()] = hospitalPubHex;
          mirror.grants[`${recId}:${targetHospital.toLowerCase()}`] = { expiresAt, encryptedDekHex };
          mirror.auditLogs = [{ id: `grant-${Date.now()}`, kind: "granted", title: `Shared with ${facilityName} (${grantMinutes}m)`, detail: `Record #${recId}`, timestamp: new Date().toLocaleTimeString() }, ...mirror.auditLogs];
          saveLocalChainMirror(mirror);
        }
        window.dispatchEvent(new Event("storage"));
        setGrantExpiresAt(expiresAt);
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
      }
      showStatus(`Shared with ${facilityName} (${grantMinutes}m)`, "done");
    } catch (err) {
      const msg = decodeContractError(err);
      showStatus(msg, "error");
      toast.error(msg);
    } finally {
      setBusy(false);
      setPipelineStage(null);
      setPipelineDetail("");
    }
  };

  const handleRevoke = async (entry: StoredVaultEntry) => {
    if (!entry.recordId) return;
    const hospAddr = entry.hospitalAddress || targetHospital;
    const facilityName = getFacilityName(hospAddr);
    setRevokingKey(entry.recordCommitmentHex);
    showStatus("Revoking access…", "working");

    try {
      const useOnChain = Boolean(IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain);
      if (useOnChain && publicClient && address) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        const { hash } = await preflightSimulateAndWrite({ publicClient, account: address, address: CONTRACTS.HealthRecords.address, abi: CONTRACTS.HealthRecords.abi as Abi, functionName: "revokeAccess", args: [BigInt(entry.recordId), hospAddr as `0x${string}`], writeContractAsync });
        await postRelayAction({ action: "revoke", recordId: entry.recordId, hospitalAddress: hospAddr });
        setAuditItems((prev) => [{ id: `rev-${Date.now()}`, kind: "revoked", title: `Revoked ${facilityName} — Record #${entry.recordId}`, detail: "Access cleared", timestamp: new Date().toLocaleTimeString(), txHash: hash, explorerUrl: explorerTxUrl(hash) }, ...prev]);
        await Promise.all([syncOverviewState(), roles.refetch()]);
      } else {
        const updatedMirror = await postRelayAction({ action: "revoke", recordId: entry.recordId, hospitalAddress: hospAddr });
        const mirror = updatedMirror ?? loadLocalChainMirror();
        if (!updatedMirror) {
          delete mirror.grants[`${entry.recordId}:${hospAddr.toLowerCase()}`];
          mirror.auditLogs = [{ id: `rev-${Date.now()}`, kind: "revoked", title: `Revoked ${facilityName} — Record #${entry.recordId}`, detail: "Access cleared", timestamp: new Date().toLocaleTimeString() }, ...mirror.auditLogs];
          saveLocalChainMirror(mirror);
        }
        window.dispatchEvent(new Event("storage"));
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
      }
      showStatus(`Revoked ${facilityName}`, "done");
    } catch (err) {
      const msg = decodeContractError(err);
      showStatus(msg, "error");
      toast.error(msg);
    } finally {
      setRevokingKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PatientOverviewHeader isPatientRole={roles.isPatient} isChainDeployed={IS_CHAIN_DEPLOYED} secondsRemaining={secondsRemaining} hasEncrypted={Boolean(encrypted)} hasRegistered={Boolean(registeredRecordId)} />
      <DropIntake targetHospital={targetHospital} onChangeTargetHospital={setTargetHospital} grantMinutes={grantMinutes} onChangeGrantMinutes={setGrantMinutes} busy={busy} stage={pipelineStage} stageDetail={pipelineDetail} onDropBill={handleDropBill} />

      <section className="overflow-hidden rounded-2xl border border-[#E4E4E7] bg-[#FFFFFF]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 py-3.5">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSectionTab("records")} className={`text-sm font-semibold transition-colors cursor-pointer ${sectionTab === "records" ? "text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"}`}>
              Shared Records<span className="ml-1.5 font-mono-tabular text-xs font-normal text-[#71717A]">{vaultItems.length}</span>
            </button>
            <button type="button" onClick={() => setSectionTab("activity")} className={`text-xs font-medium transition-colors cursor-pointer ${sectionTab === "activity" ? "text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"}`}>
              Activity{auditItems.length > 0 ? <span className="ml-1 font-mono-tabular text-[#71717A]">({auditItems.length})</span> : null}
            </button>
          </div>
          <div className="flex items-center gap-2 font-mono-tabular text-xs text-[#71717A]">
            <span>{activeCount} active</span><span>·</span><span>{settledClaimsCount} settled</span>
          </div>
        </div>

        {sectionTab === "records" ? (
          vaultItems.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-[#71717A]">No shared records yet. Drop a bill above to encrypt and share.</div>
          ) : (
            <ul className="divide-y divide-[#E4E4E7]">
              {vaultItems.map((item) => {
                const hospAddr = item.hospitalAddress || targetHospital;
                const facility = getFacilityName(hospAddr);
                const grant = item.recordId ? activeGrantsMap[`${item.recordId}:${hospAddr.toLowerCase()}`] : undefined;
                const remaining = grant ? Math.max(0, grant.expiresAt - nowSec) : 0;
                const isActive = remaining > 0;
                const { mins, secs } = formatCountdown(remaining);
                const expanded = Boolean(expandedKeys[item.recordCommitmentHex]);
                const isRevoking = revokingKey === item.recordCommitmentHex;
                const summary = summaries[item.recordCommitmentHex.toLowerCase()] || sanitizeLabel(item.summaryHint);

                return (
                  <li key={item.recordCommitmentHex} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[#09090B]">{facility}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono-tabular text-[11px] font-medium ${isActive ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#F4F4F5] text-[#71717A]"}`}>
                            {isActive ? `Active · ${mins}:${String(secs).padStart(2, "0")}` : "Not Shared"}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[#52525B]">{sanitizeLabel(item.summaryHint)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && item.recordId ? (
                          <button type="button" disabled={isRevoking || busy} onClick={() => void handleRevoke(item)} className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#DC2626] transition-colors hover:border-[#DC2626]/40 hover:bg-[#FEF2F2] disabled:opacity-50 cursor-pointer">
                            <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />{isRevoking ? "Revoking…" : "Revoke"}
                          </button>
                        ) : null}
                        <button type="button" aria-expanded={expanded} onClick={() => setExpandedKeys((prev) => ({ ...prev, [item.recordCommitmentHex]: !prev[item.recordCommitmentHex] }))} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#52525B] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B] cursor-pointer">
                          <span>Details</span>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 text-xs">
                        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div><dt className="text-[11px] text-[#71717A]">Commitment (248-bit)</dt><dd title={item.recordCommitmentHex} className="mt-0.5 font-mono-tabular text-[#09090B]">{shortHex(item.recordCommitmentHex, 10, 8)}</dd></div>
                          <div><dt className="text-[11px] text-[#71717A]">CIDv1</dt><dd title={item.cid} className="mt-0.5 font-mono-tabular text-[#09090B]">{shortHex(item.cid, 12, 8)}</dd></div>
                          <div className="sm:col-span-2"><dt className="text-[11px] text-[#71717A]">Clinical summary</dt><dd className="mt-0.5 text-[#27272A]">{summary}</dd></div>
                        </dl>
                        <div className="mt-3 flex items-center justify-end border-t border-[#E4E4E7] pt-2.5">
                          <button type="button" onClick={() => downloadBundleEntry(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5] cursor-pointer">
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />Backup
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <div className="p-5"><AuditTimeline items={auditItems} /></div>
        )}
      </section>
    </div>
  );
}
