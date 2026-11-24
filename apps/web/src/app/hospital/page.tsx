"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Abi, PublicClient } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { ClaimsQueue, type ClaimRowState } from "@/components/hospital/claims-queue";
import { HospitalOverviewHeader } from "@/components/hospital/hospital-overview-header";
import { useAmbientStatus } from "@/components/ui/ambient-pill";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { registryFromMirror } from "@/lib/demoRegistry";
import { CONTRACTS, IS_CHAIN_DEPLOYED } from "@/lib/contracts";
import { decryptClinicalPayload, getOrCreateHospitalKeypair, unwrapDekForHospital } from "@/lib/crypto";
import { type Cms1500Claim } from "@/lib/intake";
import { loadLocalChainMirror, saveLocalChainMirror, type LocalChainMirror } from "@/lib/localState";
import { buildCircuitInputFromClaim, generateClaimProof } from "@/lib/prover";
import { fetchHospitalRelayVault, fetchRelayState, postRelayAction } from "@/lib/relayClient";
import { importAndVerifyQloBundle, listVaultEntries, saveEncryptedRecordToVault, type StoredVaultEntry } from "@/lib/storage";
import { decodeContractError, ensureSepoliaChain, preflightSimulateAndWrite } from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth, parseEthToWei } from "@/lib/utils";

const POLICY_COMMIT = canonicalFixtures.activePolicy.commitment;
const REVOKED_PATCH: Partial<ClaimRowState> = { status: "revoked", decryptedClaim: null, proverOutput: null, proofMs: null };

function readContractSafe<T>(pc: PublicClient, contract: keyof typeof CONTRACTS, functionName: string, args?: readonly unknown[]): Promise<T> {
  return pc.readContract({ address: CONTRACTS[contract].address, abi: CONTRACTS[contract].abi, functionName, ...(args ? { args } : {}) } as Parameters<PublicClient["readContract"]>[0]) as Promise<T>;
}

function classifyExclusion(claim: Cms1500Claim, priorSpentWei: bigint): string {
  if (!canonicalFixtures.coveredCpts.includes(Number(claim.cptCode.trim()))) return "Excluded CPT";
  if (claim.useExpiredPolicy) return "Expired policy";
  try {
    const amt = parseEthToWei(claim.claimAmountEth || "0");
    if (amt <= 0n) return "Invalid amount";
    if (priorSpentWei + amt > BigInt(canonicalFixtures.activePolicy.annualLimitWei)) return "Exceeds annual cap";
  } catch {
    return "Invalid amount";
  }
  return "Policy excluded";
}

function buildInitialRows(entries: StoredVaultEntry[], prevRows: ClaimRowState[], mirror: LocalChainMirror, forceReprove: boolean): ClaimRowState[] {
  const prevMap = new Map(prevRows.map((r) => [r.entry.recordCommitmentHex.toLowerCase(), r]));
  return entries.map((entry) => {
    const key = entry.recordCommitmentHex.toLowerCase();
    const prev = prevMap.get(key);
    const settled = mirror.settledClaims.find((c) => c.recordCommitmentHex.toLowerCase() === key);
    if (settled) {
      return { entry, recordId: entry.recordId || prev?.recordId || "", status: "settled", decryptedClaim: prev?.decryptedClaim ?? null, proverOutput: prev?.proverOutput ?? null, amountEth: formatWeiToEth(settled.amountWei, 4), proofMs: prev?.proofMs ?? null, settledTxHash: settled.txHash, isOnChainTx: Boolean(prev?.isOnChainTx) };
    }
    if (prev?.status === "settled") return { ...prev, entry };
    return { entry, recordId: entry.recordId || prev?.recordId || "", status: prev?.status === "ready" && !forceReprove ? "ready" : "checking", decryptedClaim: prev?.decryptedClaim ?? null, proverOutput: !forceReprove ? prev?.proverOutput ?? null : null, amountEth: prev?.amountEth ?? null, proofMs: !forceReprove ? prev?.proofMs ?? null : null, settledTxHash: null, isOnChainTx: false };
  });
}

async function resolveActiveGrant(entry: StoredVaultEntry, targetAddr: string, mirror: LocalChainMirror, pc?: PublicClient) {
  const key = entry.recordCommitmentHex.toLowerCase();
  let recordId = entry.recordId || "";
  if (IS_CHAIN_DEPLOYED && pc) {
    try {
      const recId = await readContractSafe<bigint>(pc, "HealthRecords", "commitmentToRecordId", [entry.recordCommitmentHex]);
      if (recId > 0n) {
        recordId = recId.toString();
        const [expiresAt, dek] = await readContractSafe<[bigint, `0x${string}`]>(pc, "HealthRecords", "getGrant", [recId, targetAddr as `0x${string}`]);
        const active = expiresAt > BigInt(Math.floor(Date.now() / 1000)) && Boolean(dek && dek !== "0x");
        return { grantActive: active, encryptedDekHex: active ? dek : "", recordId };
      }
    } catch {
      // Fall through to relay mirror when record is off-chain
    }
  }
  const rec = mirror.records.find((r) => r.recordCommitmentHex.toLowerCase() === key);
  if (!rec) return { grantActive: false, encryptedDekHex: "", recordId };
  const grant = mirror.grants[`${rec.recordId}:${targetAddr.toLowerCase()}`];
  const active = Boolean(grant && grant.expiresAt > Math.floor(Date.now() / 1000) && grant.encryptedDekHex);
  return { grantActive: active, encryptedDekHex: active && grant ? grant.encryptedDekHex : "", recordId: rec.recordId };
}

function settleInLocalMirror(row: ClaimRowState, hospitalAddr: string, txHash: string) {
  const { pubSignals, rawCalldataHex } = row.proverOutput!.solidity;
  const [policyStr, nullifierStr, amount] = [pubSignals[1].toString(), pubSignals[2].toString(), pubSignals[3]];
  const mirror = loadLocalChainMirror();
  const key = row.entry.recordCommitmentHex.toLowerCase();
  const recId = mirror.records.find((r) => r.recordCommitmentHex.toLowerCase() === key)?.recordId;
  const grant = recId ? mirror.grants[`${recId}:${hospitalAddr.toLowerCase()}`] : null;
  if (!grant || grant.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error("ClaimsVault.PatientAccessNotActive()");
  if (mirror.nullifierUsed[nullifierStr]) throw new Error("ClaimsVault.NullifierAlreadyUsed()");
  if (BigInt(mirror.insurerEscrowWei) < amount) throw new Error("ClaimsVault.InsufficientEscrow()");
  saveLocalChainMirror({
    ...mirror,
    nullifierUsed: { ...mirror.nullifierUsed, [nullifierStr]: true },
    policySpentWei: { ...mirror.policySpentWei, [policyStr]: (BigInt(mirror.policySpentWei[policyStr] ?? "0") + amount).toString() },
    insurerEscrowWei: (BigInt(mirror.insurerEscrowWei) - amount).toString(),
    settledClaims: [{ txHash, nullifier: nullifierStr, policyCommitment: policyStr, recordCommitmentHex: row.entry.recordCommitmentHex, hospital: hospitalAddr, amountWei: amount.toString(), settledAt: Math.floor(Date.now() / 1000), rawCalldataHex, pubSignals: row.proverOutput!.publicSignals }, ...mirror.settledClaims],
  });
}

export default function HospitalPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const roles = useWalletRoles();
  const { showStatus } = useAmbientStatus();

  const [hospitalAddr, setHospitalAddr] = useState<string>(canonicalFixtures.accounts.hospital1);
  const [hospitalPubKeyHex, setHospitalPubKeyHex] = useState<string>("");
  const [rows, setRows] = useState<ClaimRowState[]>([]);
  const [providerRevenueEth, setProviderRevenueEth] = useState<number>(0);
  const [settledClaimsCount, setSettledClaimsCount] = useState<number>(0);
  const [refreshingInbox, setRefreshingInbox] = useState(false);
  const [txBusy, setTxBusy] = useState(false);
  const [onChainKeyRegistered, setOnChainKeyRegistered] = useState(false);

  const rowsRef = useRef<ClaimRowState[]>([]);
  rowsRef.current = rows;
  const runIdRef = useRef(0);
  const [registry, setRegistry] = useState(() => registryFromMirror(null));
  const matchedProvider = registry.hospitals.find((h) => h.address.toLowerCase() === hospitalAddr.toLowerCase()) ?? null;

  const patchRow = useCallback((commitmentHex: string, patch: Partial<ClaimRowState>) => {
    const target = commitmentHex.toLowerCase();
    setRows((prev) => prev.map((row) => (row.entry.recordCommitmentHex.toLowerCase() === target ? { ...row, ...patch } : row)));
  }, []);

  const syncMetrics = useCallback(async (customMirror?: LocalChainMirror | null) => {
    if (IS_CHAIN_DEPLOYED && publicClient) {
      try {
        const [payoutWei, count] = await Promise.all([
          readContractSafe<bigint>(publicClient, "ClaimsVault", "totalPayoutWei"),
          readContractSafe<bigint>(publicClient, "ClaimsVault", "totalClaimsSettled"),
        ]);
        setProviderRevenueEth(Number(formatWeiToEth(payoutWei, 4)));
        setSettledClaimsCount(Number(count));
        return;
      } catch {
        // Fall back to mirror
      }
    }
    const mirror = customMirror ?? loadLocalChainMirror();
    const totalWei = mirror.settledClaims.reduce((acc, c) => acc + BigInt(c.amountWei), 0n);
    setProviderRevenueEth(Number(formatWeiToEth(totalWei, 4)));
    setSettledClaimsCount(mirror.settledClaims.length);
  }, [publicClient]);

  const runAutonomousPipeline = useCallback(async (entries: StoredVaultEntry[], targetAddr: string, mirror: LocalChainMirror, forceReprove = false) => {
    const currentRun = ++runIdRef.current;
    const isStale = () => runIdRef.current !== currentRun;
    const kp = await getOrCreateHospitalKeypair(targetAddr);
    if (isStale()) return;

    const initialRows = buildInitialRows(entries, rowsRef.current, mirror, forceReprove);
    setRows(initialRows);
    const reg = registryFromMirror(mirror as unknown as Parameters<typeof registryFromMirror>[0]);
    setRegistry(reg);
    const policyCommit = reg.policy.commitment;
    const providerForTarget = reg.hospitals.find((h) => h.address.toLowerCase() === targetAddr.toLowerCase()) ?? null;

    for (const item of initialRows) {
      if (isStale()) continue;
      const key = item.entry.recordCommitmentHex.toLowerCase();
      const { grantActive, encryptedDekHex, recordId } = await resolveActiveGrant(item.entry, targetAddr, mirror, publicClient);
      if (isStale()) return;

      if (!grantActive || !encryptedDekHex) {
        patchRow(key, { ...REVOKED_PATCH, recordId: recordId || item.recordId });
        continue;
      }
      if (item.status === "settled") continue;
      if (item.status === "ready" && item.proverOutput && item.decryptedClaim && !forceReprove) {
        if (recordId && recordId !== item.recordId) patchRow(key, { recordId });
        continue;
      }

      const label = recordId ? `Record #${recordId}` : "Record";
      patchRow(key, { recordId: recordId || item.recordId, status: "unwrapping" });
      showStatus(`Unwrapping ${label}…`, "working");

      let plain: Cms1500Claim;
      try {
        const rawDek = await unwrapDekForHospital(encryptedDekHex, kp.privateJwk);
        plain = await decryptClinicalPayload<Cms1500Claim>(item.entry.envelope, rawDek);
      } catch {
        if (!isStale()) patchRow(key, { ...REVOKED_PATCH, recordId: recordId || item.recordId });
        continue;
      }
      if (isStale()) return;

      const claim: Cms1500Claim = providerForTarget && plain.renderingNpi.trim() !== providerForTarget.licenseId ? { ...plain, renderingNpi: providerForTarget.licenseId } : plain;
      let priorSpentWei = BigInt(mirror.policySpentWei[policyCommit] ?? "0");
      let claimTimestampOverride: bigint | undefined;
      if (IS_CHAIN_DEPLOYED && publicClient) {
        try {
          const [spent, block] = await Promise.all([
            readContractSafe<bigint>(publicClient, "ClaimsVault", "policySpent", [BigInt(policyCommit)]),
            publicClient.getBlock({ blockTag: "latest" }),
          ]);
          priorSpentWei = spent;
          claimTimestampOverride = block.timestamp;
        } catch {
          // Keep mirror fallback
        }
      }
      if (isStale()) return;

      const input = await buildCircuitInputFromClaim({ claim, recordCommitment: BigInt(item.entry.recordCommitmentHex), hospitalAddress: targetAddr, priorPolicySpentWei: priorSpentWei, claimTimestampOverride, hospitals: reg.hospitals, policyOverride: reg.policy });
      if (isStale()) return;

      let used = Boolean(mirror.nullifierUsed[input.nullifier]);
      if (!used && IS_CHAIN_DEPLOYED && publicClient) {
        used = await readContractSafe<boolean>(publicClient, "ClaimsVault", "nullifierUsed", [BigInt(input.nullifier)]).catch(() => false);
      }
      if (isStale()) return;

      const amtFmt = Number(claim.claimAmountEth || 0).toFixed(4);
      if (used) {
        patchRow(key, { recordId: recordId || item.recordId, status: "settled", decryptedClaim: claim, amountEth: amtFmt });
        continue;
      }

      patchRow(key, { recordId: recordId || item.recordId, status: "proving", decryptedClaim: claim, amountEth: amtFmt });
      showStatus(`Proving ${label}…`, "working");

      try {
        const out = await generateClaimProof(input);
        if (isStale()) return;
        patchRow(key, { recordId: recordId || item.recordId, status: "ready", decryptedClaim: claim, proverOutput: out, amountEth: formatWeiToEth(out.solidity.pubSignals[3], 4), proofMs: out.elapsedMs, reason: undefined });
        showStatus(`Proof ready (${out.elapsedMs}ms)`, "done", label);
      } catch {
        if (isStale()) return;
        const reason = classifyExclusion(claim, priorSpentWei);
        patchRow(key, { recordId: recordId || item.recordId, status: "excluded", decryptedClaim: claim, proverOutput: null, proofMs: null, reason });
        showStatus(`Excluded · ${label}`, "error", reason);
      }
    }
  }, [patchRow, publicClient, showStatus]);

  const refreshHospitalInbox = useCallback(async (targetAddr = hospitalAddr, forceReprove = false) => {
    setRefreshingInbox(true);
    try {
      const kp = await getOrCreateHospitalKeypair(targetAddr);
      setHospitalPubKeyHex(kp.publicKeyHex);
      const [localItems, relayedItems, remoteMirror] = await Promise.all([
        listVaultEntries().catch(() => [] as StoredVaultEntry[]),
        fetchHospitalRelayVault(targetAddr),
        fetchRelayState(),
      ]);
      if (remoteMirror?.hospitalPubKeys?.[targetAddr.toLowerCase()] !== kp.publicKeyHex) {
        await postRelayAction({ action: "publishPubKey", hospitalAddress: targetAddr, publicKeyHex: kp.publicKeyHex, force: true });
      }
      const merged = new Map<string, StoredVaultEntry>();
      for (const item of localItems) merged.set(item.recordCommitmentHex.toLowerCase(), item);
      for (const rel of relayedItems) {
        const key = rel.recordCommitmentHex.toLowerCase();
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, rel);
          await saveEncryptedRecordToVault(rel).catch(() => undefined);
        } else if (!existing.recordId && rel.recordId) {
          merged.set(key, { ...existing, recordId: rel.recordId });
        }
      }
      const sorted = Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (IS_CHAIN_DEPLOYED && publicClient) {
        const pub = await readContractSafe<`0x${string}`>(publicClient, "HospitalRegistry", "hospitalEncryptionPubKey", [targetAddr as `0x${string}`]).catch(() => "0x" as `0x${string}`);
        // Must match THIS browser's key, otherwise shared records cannot be unlocked here.
        setOnChainKeyRegistered(Boolean(pub && pub.length >= 132 && pub.toLowerCase() === kp.publicKeyHex.toLowerCase()));
      } else {
        setOnChainKeyRegistered(false);
      }
      const mirror = remoteMirror ?? loadLocalChainMirror();
      await syncMetrics(IS_CHAIN_DEPLOYED ? null : mirror);
      await runAutonomousPipeline(sorted, targetAddr, mirror, forceReprove);
    } finally {
      setRefreshingInbox(false);
    }
  }, [hospitalAddr, publicClient, runAutonomousPipeline, syncMetrics]);

  useEffect(() => { refreshHospitalInbox(hospitalAddr, false).catch(() => undefined); }, [hospitalAddr, refreshHospitalInbox]);
  useEffect(() => { if (address) setHospitalAddr(address); }, [address]);

  // Near-real-time inbox: cheap poll + tab focus. Only re-runs the (expensive) proof
  // pipeline when a NEW record appears, so in-flight proofs are never cancelled.
  useEffect(() => {
    let checking = false;
    let tick = 0;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const [local, relayed] = await Promise.all([
          listVaultEntries().catch(() => [] as StoredVaultEntry[]),
          fetchHospitalRelayVault(hospitalAddr).catch(() => [] as StoredVaultEntry[]),
        ]);
        const known = new Set(rowsRef.current.map((r) => r.entry.recordCommitmentHex.toLowerCase()));
        const hasNew = [...local, ...relayed].some((e) => !known.has(e.recordCommitmentHex.toLowerCase()));
        // Grant tx may still be mining when the record first appears: recheck "not shared" rows every ~12s.
        const recheckPending = ++tick % 3 === 0 && rowsRef.current.some((r) => r.status === "revoked");
        if (hasNew || recheckPending) await refreshHospitalInbox(hospitalAddr, false);
      } finally {
        checking = false;
      }
    };
    const id = window.setInterval(() => void check(), 4000);
    const onWake = () => void check();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [hospitalAddr, refreshHospitalInbox]);

  const handleRegisterHospitalPubKey = async () => {
    if (!hospitalPubKeyHex || txBusy) return;
    setTxBusy(true);
    try {
      await postRelayAction({ action: "publishPubKey", hospitalAddress: hospitalAddr, publicKeyHex: hospitalPubKeyHex, force: true });
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) throw new Error("Connect Hospital wallet first");
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        await preflightSimulateAndWrite({ publicClient, account: address, address: CONTRACTS.HospitalRegistry.address, abi: CONTRACTS.HospitalRegistry.abi as Abi, functionName: "registerEncryptionPubKey", args: [hospitalPubKeyHex as `0x${string}`], writeContractAsync });
        setOnChainKeyRegistered(true);
        showStatus("Encryption key registered", "done", "Sepolia");
        await roles.refetch();
      } else {
        const m = loadLocalChainMirror();
        saveLocalChainMirror({ ...m, hospitalPubKeys: { ...m.hospitalPubKeys, [hospitalAddr.toLowerCase()]: hospitalPubKeyHex } });
        showStatus("Encryption key synced", "done");
      }
    } catch (err) {
      const msg = decodeContractError(err);
      showStatus("Key registration failed", "error", msg);
      toast.error(msg);
    } finally {
      setTxBusy(false);
    }
  };

  const handleImportBundle = async (file: File) => {
    if (file.size > 512 * 1024 || !file.name.toLowerCase().endsWith(".json")) {
      toast.error("Select a valid .qlo.json bundle under 512 KB.");
      return;
    }
    try {
      await importAndVerifyQloBundle(await file.text());
      showStatus("Bundle verified", "done");
      await refreshHospitalInbox(hospitalAddr, false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bundle verification failed");
    }
  };

  const handleLogAccessAudit = async (row: ClaimRowState) => {
    if (txBusy) return;
    setTxBusy(true);
    try {
      if (IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        const recId = await readContractSafe<bigint>(publicClient, "HealthRecords", "commitmentToRecordId", [row.entry.recordCommitmentHex]);
        if (recId === 0n) throw new Error("Record not registered on Sepolia");
        await preflightSimulateAndWrite({ publicClient, account: address, address: CONTRACTS.HealthRecords.address, abi: CONTRACTS.HealthRecords.abi as Abi, functionName: "logAccess", args: [recId], writeContractAsync });
        showStatus("Access audit logged", "done", `Record #${recId.toString()}`);
      } else {
        const recId = row.recordId || "?";
        await postRelayAction({ action: "logAccess", recordId: recId, hospitalAddress: hospitalAddr });
        window.dispatchEvent(new Event("storage"));
        showStatus("Access audit logged", "done", `Record #${recId}`);
      }
    } catch (err) {
      const msg = decodeContractError(err);
      showStatus("Audit log failed", "error", msg);
      toast.error(msg);
    } finally {
      setTxBusy(false);
    }
  };

  const handleSettle = async (row: ClaimRowState) => {
    if (!row.proverOutput || txBusy) return;
    const key = row.entry.recordCommitmentHex.toLowerCase();
    const { pA, pB, pC, pubSignals, rawCalldataHex } = row.proverOutput.solidity;
    const amountFmt = formatWeiToEth(pubSignals[3], 4);
    setTxBusy(true);
    patchRow(key, { status: "settling" });
    showStatus(`Settling +${amountFmt} ETH…`, "working", `Record #${row.recordId}`);

    try {
      if (IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        const { hash } = await preflightSimulateAndWrite({ publicClient, account: address, address: CONTRACTS.ClaimsVault.address, abi: CONTRACTS.ClaimsVault.abi as Abi, functionName: "submitClaim", args: [pA, pB, pC, pubSignals], writeContractAsync });
        patchRow(key, { status: "settled", amountEth: amountFmt, settledTxHash: hash, isOnChainTx: true });
        showStatus(`Settled +${amountFmt} ETH`, "done", `Record #${row.recordId}`);
        await Promise.all([syncMetrics(), roles.refetch()]);
      } else {
        const pseudoHash = ("0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
        const relayed = await postRelayAction({ action: "settle", recordCommitmentHex: row.entry.recordCommitmentHex, hospitalAddress: hospitalAddr, policyCommitment: pubSignals[1].toString(), nullifier: pubSignals[2].toString(), amountWei: pubSignals[3].toString(), rawCalldataHex, pubSignals: row.proverOutput.publicSignals, txHash: pseudoHash });
        if (!relayed) settleInLocalMirror(row, hospitalAddr, pseudoHash);
        window.dispatchEvent(new Event("storage"));
        patchRow(key, { status: "settled", amountEth: amountFmt, settledTxHash: pseudoHash, isOnChainTx: false });
        showStatus(`Settled +${amountFmt} ETH`, "done", `Record #${row.recordId}`);
        await syncMetrics(relayed);
      }
      if (rowsRef.current.some((r) => r.entry.recordCommitmentHex.toLowerCase() !== key && r.status === "ready")) {
        const mirror = (await fetchRelayState()) ?? loadLocalChainMirror();
        runAutonomousPipeline(rowsRef.current.map((r) => r.entry), hospitalAddr, mirror, true).catch(() => undefined);
      }
    } catch (err) {
      const msg = decodeContractError(err);
      patchRow(key, msg.includes("PatientAccessNotActive") ? REVOKED_PATCH : msg.includes("NullifierAlreadyUsed") ? { status: "settled" } : { status: "ready" });
      showStatus("Settlement reverted", "error", msg);
      toast.error(msg);
    } finally {
      setTxBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <HospitalOverviewHeader
        isChainDeployed={IS_CHAIN_DEPLOYED}
        isApprovedHospital={roles.isApprovedHospital}
        matchedProviderPresent={Boolean(matchedProvider)}
        isConnected={roles.isConnected}
        wrongChain={roles.wrongChain}
        onChainKeyRegistered={onChainKeyRegistered}
        refreshingInbox={refreshingInbox}
        txBusy={txBusy}
        onRefreshInbox={() => refreshHospitalInbox(hospitalAddr, false)}
        onRegisterHospitalPubKey={handleRegisterHospitalPubKey}
      />
      <ClaimsQueue
        rows={rows}
        hospitalAddr={hospitalAddr}
        walletConnected={Boolean(address)}
        onChangeHospitalAddr={setHospitalAddr}
        refreshing={refreshingInbox}
        txBusy={txBusy}
        chainSettleBlocked={roles.wrongChain}
        settledClaimsCount={settledClaimsCount}
        providerRevenueEth={providerRevenueEth}
        onRefresh={() => refreshHospitalInbox(hospitalAddr, false)}
        onSettle={handleSettle}
        onImportBundle={handleImportBundle}
        onLogAccessAudit={handleLogAccessAudit}
      />
    </div>
  );
}
