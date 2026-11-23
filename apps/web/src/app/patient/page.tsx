"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { Cms1500IntakeCard } from "@/components/patient/cms1500-intake-card";
import { CoveredBenefitsSection } from "@/components/patient/covered-benefits-section";
import { PatientConsentPanel } from "@/components/patient/patient-consent-panel";
import { PatientOverviewHeader } from "@/components/patient/patient-overview-header";
import { PatientVaultTable } from "@/components/patient/patient-vault-table";
import { AuditTimeline, type AuditEventItem } from "@/components/ui/audit-timeline";
import { Badge } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { fetchPatientAuditEvents } from "@/lib/chainEvents";
import { CONTRACTS, IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import {
  encryptClinicalPayload,
  getOrCreateHospitalKeypair,
  wrapDekForHospital,
  type EncryptedRecordResult,
} from "@/lib/crypto";
import {
  SYNTHETIC_CMS1500_PRESETS,
  generateSampleCms1500BillPng,
  parseClaimFromTextOrJson,
  runLocalOcrOnBill,
  validateCms1500Completeness,
  type Cms1500Claim,
} from "@/lib/intake";
import { loadLocalChainMirror, saveLocalChainMirror } from "@/lib/localState";
import {
  fetchRelayState,
  postRelayAction,
  pushCiphertextToRelay,
} from "@/lib/relayClient";
import {
  computeDeterministicCidV1,
  listVaultEntries,
  saveEncryptedRecordToVault,
  serializeQloBundle,
  type StoredVaultEntry,
} from "@/lib/storage";
import {
  decodeContractError,
  ensureSepoliaChain,
  preflightSimulateAndWrite,
} from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";

export default function PatientPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const roles = useWalletRoles();

  const [claim, setClaim] = useState<Cms1500Claim>(SYNTHETIC_CMS1500_PRESETS[0]);
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [ocrRunning, setOcrRunning] = useState(false);

  const [encrypted, setEncrypted] = useState<EncryptedRecordResult | null>(null);
  const [cid, setCid] = useState<string>("");
  const [vaultEntry, setVaultEntry] = useState<StoredVaultEntry | null>(null);
  const [vaultItems, setVaultItems] = useState<StoredVaultEntry[]>([]);
  const [registeredRecordId, setRegisteredRecordId] = useState<string>("");

  const [targetHospital, setTargetHospital] = useState<string>(canonicalFixtures.accounts.hospital1);
  const [grantMinutes, setGrantMinutes] = useState<number>(10);
  const [grantExpiresAt, setGrantExpiresAt] = useState<number>(0);
  const [pubKeySource, setPubKeySource] = useState<string>("");
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  const [auditItems, setAuditItems] = useState<AuditEventItem[]>([]);
  const [activeGrantsCount, setActiveGrantsCount] = useState<number>(0);
  const [settledClaimsCount, setSettledClaimsCount] = useState<number>(0);
  const [activeGrantsMap, setActiveGrantsMap] = useState<Record<string, { expiresAt: number }>>({});
  const [busy, setBusy] = useState(false);

  const completeness = validateCms1500Completeness(claim);

  const syncOverviewState = async () => {
    const items = await listVaultEntries().catch(() => [] as StoredVaultEntry[]);
    const now = Math.floor(Date.now() / 1000);

    if (IS_CHAIN_DEPLOYED && publicClient) {
      let onChainSettled = 0;
      try {
        const settled = (await publicClient.readContract({
          address: CONTRACTS.ClaimsVault.address,
          abi: CONTRACTS.ClaimsVault.abi,
          functionName: "totalClaimsSettled",
        })) as bigint;
        onChainSettled = Number(settled);
      } catch {
        onChainSettled = roles.totalClaimsSettled;
      }

      const grantsMap: Record<string, { expiresAt: number }> = {};
      const hydratedItems: StoredVaultEntry[] = [];

      for (const item of items) {
        let recIdStr = item.recordId || "";
        try {
          const recId = (await publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "commitmentToRecordId",
            args: [item.recordCommitmentHex],
          })) as bigint;
          if (recId > 0n) {
            recIdStr = recId.toString();
            const hospTarget = item.hospitalAddress || targetHospital;
            const [exp] = (await publicClient.readContract({
              address: CONTRACTS.HealthRecords.address,
              abi: CONTRACTS.HealthRecords.abi,
              functionName: "getGrant",
              args: [recId, hospTarget as `0x${string}`],
            })) as [bigint, `0x${string}`];
            if (exp > 0n) {
              grantsMap[`${recIdStr}:${hospTarget.toLowerCase()}`] = {
                expiresAt: Number(exp),
              };
            }
          }
        } catch {
          // Non-fatal on RPC jitter
        }

        const updatedItem = recIdStr && recIdStr !== item.recordId
          ? { ...item, recordId: recIdStr }
          : item;
        if (updatedItem !== item) {
          await saveEncryptedRecordToVault(updatedItem).catch(() => undefined);
        }
        hydratedItems.push(updatedItem);
      }

      setVaultItems(hydratedItems);
      setActiveGrantsMap(grantsMap);
      setActiveGrantsCount(
        Object.values(grantsMap).filter((g) => g.expiresAt > now).length
      );
      setSettledClaimsCount(onChainSettled);

      return { mirror: null, items: hydratedItems, grantsMap };
    }

    const remote = await fetchRelayState();
    const mirror = remote ?? loadLocalChainMirror();
    setActiveGrantsMap(mirror.grants);
    setActiveGrantsCount(Object.values(mirror.grants).filter((g) => g.expiresAt > now).length);
    setSettledClaimsCount(mirror.settledClaims.length);
    setVaultItems(items);
    return { mirror, items, grantsMap: mirror.grants };
  };

  useEffect(() => {
    syncOverviewState().then(({ mirror, items, grantsMap }) => {
      if (IS_CHAIN_DEPLOYED && publicClient) {
        fetchPatientAuditEvents(publicClient)
          .then(setAuditItems)
          .catch(() => undefined);
        const latestRegistered = items.find((i) => i.recordId);
        if (latestRegistered) {
          setVaultEntry(latestRegistered);
          setCid(latestRegistered.cid);
          setRegisteredRecordId(latestRegistered.recordId ?? "");
          const hospTarget = (latestRegistered.hospitalAddress || targetHospital).toLowerCase();
          const g = grantsMap[`${latestRegistered.recordId}:${hospTarget}`];
          if (g && g.expiresAt > Math.floor(Date.now() / 1000)) {
            setGrantExpiresAt(g.expiresAt);
          }
          const dekJson = sessionStorage.getItem(
            `qlo-dek-${latestRegistered.recordCommitmentHex.toLowerCase()}`
          );
          if (dekJson) {
            const dekBytes = new Uint8Array(JSON.parse(dekJson) as number[]);
            setEncrypted({
              envelope: latestRegistered.envelope,
              envelopeBytes: new TextEncoder().encode(JSON.stringify(latestRegistered.envelope)),
              dekRawBytes: dekBytes,
              recordCommitment: BigInt(latestRegistered.recordCommitmentHex),
              recordCommitmentHex: latestRegistered.recordCommitmentHex,
            });
          }
        }
        return;
      }

      if (!mirror) return;
      setAuditItems(mirror.auditLogs);

      if (mirror.records.length > 0) {
        const latestRec = mirror.records[mirror.records.length - 1];
        setRegisteredRecordId(latestRec.recordId);
        setCid(latestRec.cid);

        const grantKey = Object.keys(mirror.grants).find((k) =>
          k.startsWith(`${latestRec.recordId}:`)
        );
        if (grantKey) {
          const g = mirror.grants[grantKey];
          if (g.expiresAt > Math.floor(Date.now() / 1000)) {
            setGrantExpiresAt(g.expiresAt);
            const hosp = grantKey.split(":")[1];
            if (hosp) setTargetHospital(hosp);
          }
        }

        const match = items.find(
          (x) => x.recordCommitmentHex.toLowerCase() === latestRec.recordCommitmentHex.toLowerCase()
        );
        if (match) {
          setVaultEntry(match);
          const dekJson = sessionStorage.getItem(
            `qlo-dek-${match.recordCommitmentHex.toLowerCase()}`
          );
          if (dekJson) {
            const dekBytes = new Uint8Array(JSON.parse(dekJson) as number[]);
            setEncrypted({
              envelope: match.envelope,
              envelopeBytes: new TextEncoder().encode(JSON.stringify(match.envelope)),
              dekRawBytes: dekBytes,
              recordCommitment: BigInt(match.recordCommitmentHex),
              recordCommitmentHex: match.recordCommitmentHex,
            });
          }
        }
      }
    });

    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient]);

  useEffect(() => {
    if (!IS_CHAIN_DEPLOYED || !address || grantExpiresAt > 0) return;
    const isAccredited = canonicalFixtures.hospitals.some(
      (h) => h.address.toLowerCase() === address.toLowerCase()
    );
    if (isAccredited) {
      setTargetHospital(address);
    }
  }, [address, grantExpiresAt]);

  const secondsRemaining = Math.max(0, grantExpiresAt - nowSec);

  const handleOcrFile = async (file: Blob, label: string) => {
    setOcrRunning(true);
    setOcrStatus(`Running local Tesseract WASM OCR on ${label}...`);
    try {
      const { parsed } = await runLocalOcrOnBill(file, (status, pct) => {
        setOcrStatus(`${status} (${pct}%)`);
      });
      setClaim((prev) => ({ ...prev, ...parsed }));
      toast.success("Client-side OCR extracted CMS-1500 fields (0 bytes left your device)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrRunning(false);
      setOcrStatus("");
    }
  };

  const handleTestSampleBillOcr = async () => {
    const blob = await generateSampleCms1500BillPng();
    await handleOcrFile(blob, "sample-cms1500.png");
  };

  const handleTextFileUpload = async (file: File) => {
    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB client intake cap
    const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".txt", ".json", ".edi"];
    const ALLOWED_MIMES = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "application/json",
      "application/edi-x12",
      "",
    ]);

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File exceeds 5 MB maximum upload limit.");
      return;
    }
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error("Unsupported file extension. Upload PNG, JPG, WEBP, TXT, JSON, or EDI.");
      return;
    }
    if (!ALLOWED_MIMES.has(file.type.toLowerCase())) {
      toast.error(`Unsupported file MIME type: ${file.type}`);
      return;
    }

    if (file.type.startsWith("image/")) {
      await handleOcrFile(file, file.name);
      return;
    }
    const text = await file.text();
    const parsed = parseClaimFromTextOrJson(text);
    setClaim((prev) => ({ ...prev, ...parsed }));
    toast.success(`Parsed ${file.name} locally in browser`);
  };

  const handleEncryptLocally = async () => {
    if (!completeness.valid) {
      toast.error("Fix failing CMS-1500 completeness checks before encrypting.");
      return;
    }
    setBusy(true);
    try {
      const enc = await encryptClinicalPayload(claim);
      const computedCid = await computeDeterministicCidV1(enc.envelopeBytes);

      const entry: StoredVaultEntry = {
        cid: computedCid,
        recordCommitmentHex: enc.recordCommitmentHex,
        envelope: enc.envelope,
        createdAt: new Date().toISOString(),
        patientAddress: address || canonicalFixtures.accounts.patient,
        hospitalAddress: targetHospital,
        summaryHint: `${claim.caseLabel} (${claim.claimAmountEth} ETH)`,
      };
      await saveEncryptedRecordToVault(entry);

      sessionStorage.setItem(
        `qlo-dek-${enc.recordCommitmentHex.toLowerCase()}`,
        JSON.stringify(Array.from(enc.dekRawBytes))
      );

      setEncrypted(enc);
      setCid(computedCid);
      setVaultEntry(entry);
      setRegisteredRecordId("");
      setGrantExpiresAt(0);
      await syncOverviewState();
      toast.success("Encrypted locally with AES-256-GCM & saved to IndexedDB CID store");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Encryption failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadBundleEntry = (entry: StoredVaultEntry, overrideId?: string) => {
    const json = serializeQloBundle({
      ...entry,
      recordId: overrideId || entry.recordId,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qlo-record-${entry.recordCommitmentHex.slice(2, 10)}.qlo.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegisterOnChain = async () => {
    if (!encrypted || !cid) return;
    setBusy(true);
    try {
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) throw new Error("Connect MetaMask on Ethereum Sepolia first");
        await ensureSepoliaChain(roles.chainId, switchChainAsync);

        const existingRecId = (await publicClient.readContract({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "commitmentToRecordId",
          args: [encrypted.recordCommitmentHex],
        })) as bigint;

        let idStr = "";
        let txHash: `0x${string}` | undefined;

        if (existingRecId > 0n) {
          idStr = existingRecId.toString();
          toast.success(`Record #${idStr} is already anchored on Ethereum Sepolia`);
        } else {
          const { hash } = await preflightSimulateAndWrite({
            publicClient,
            account: address,
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi as Abi,
            functionName: "registerRecord",
            args: [encrypted.recordCommitmentHex, cid],
            writeContractAsync,
          });
          txHash = hash;
          const recId = (await publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "commitmentToRecordId",
            args: [encrypted.recordCommitmentHex],
          })) as bigint;
          idStr = recId.toString();
          toast.success(`Registered record #${idStr} on Ethereum Sepolia`);
        }

        setRegisteredRecordId(idStr);
        if (vaultEntry) {
          const updated = { ...vaultEntry, recordId: idStr };
          setVaultEntry(updated);
          await saveEncryptedRecordToVault(updated);
          await pushCiphertextToRelay(updated);
        }
        if (txHash) {
          setAuditItems((prev) => [
            {
              id: `reg-${Date.now()}`,
              kind: "registered",
              title: `Record #${idStr} Registered On-Chain`,
              detail: `CIDv1 ${cid} | Commitment ${encrypted.recordCommitmentHex}`,
              timestamp: new Date().toLocaleTimeString(),
              txHash,
              explorerUrl: explorerTxUrl(txHash),
            },
            ...prev,
          ]);
        }
        await Promise.all([syncOverviewState(), roles.refetch()]);
      } else {
        const updatedMirror = await postRelayAction({
          action: "registerRecord",
          recordCommitmentHex: encrypted.recordCommitmentHex,
          cid,
          patient: address || canonicalFixtures.accounts.patient,
        });
        const mirror = updatedMirror ?? loadLocalChainMirror();
        const existing = mirror.records.find(
          (r) => r.recordCommitmentHex.toLowerCase() === encrypted.recordCommitmentHex.toLowerCase()
        );
        const recId = existing ? existing.recordId : String(mirror.nextRecordId);
        if (!updatedMirror) {
          if (!existing) {
            mirror.nextRecordId += 1;
            mirror.records.push({
              recordId: recId,
              patient: address || canonicalFixtures.accounts.patient,
              recordCommitmentHex: encrypted.recordCommitmentHex,
              cid,
              createdAt: Math.floor(Date.now() / 1000),
            });
          }
          const entry: AuditEventItem = {
            id: `reg-${Date.now()}`,
            kind: "registered",
            title: `Record #${recId} Registered (Local Sandbox)`,
            detail: `CIDv1 ${cid} | 248-bit Commit ${encrypted.recordCommitmentHex}`,
            timestamp: new Date().toLocaleTimeString(),
          };
          mirror.auditLogs = [entry, ...mirror.auditLogs];
          saveLocalChainMirror(mirror);
        }
        setRegisteredRecordId(recId);
        if (vaultEntry) {
          const updated = { ...vaultEntry, recordId: recId };
          setVaultEntry(updated);
          await saveEncryptedRecordToVault(updated);
          await pushCiphertextToRelay(updated);
        }
        window.dispatchEvent(new Event("storage"));
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
        toast.success(`Registered encrypted record #${recId} & published Zero-PHI ciphertext bundle`);
      }
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!encrypted || !registeredRecordId) {
      toast.error("Encrypt and register the record first.");
      return;
    }
    setBusy(true);
    try {
      let hospitalPubHex = "";
      if (IS_CHAIN_DEPLOYED && publicClient) {
        const onChainPub = (await publicClient.readContract({
          address: CONTRACTS.HospitalRegistry.address,
          abi: CONTRACTS.HospitalRegistry.abi,
          functionName: "hospitalEncryptionPubKey",
          args: [targetHospital as `0x${string}`],
        })) as `0x${string}`;
        if (onChainPub && onChainPub.length >= 132) {
          hospitalPubHex = onChainPub;
          setPubKeySource("On-Chain HospitalRegistry");
        }
      }
      if (!hospitalPubHex) {
        const relayState = await fetchRelayState();
        const remoteKey = relayState?.hospitalPubKeys?.[targetHospital.toLowerCase()];
        if (remoteKey && remoteKey.length >= 132) {
          hospitalPubHex = remoteKey;
          setPubKeySource("Clearinghouse Directory ECDH");
        }
      }
      if (!hospitalPubHex) {
        const kp = await getOrCreateHospitalKeypair(targetHospital);
        hospitalPubHex = kp.publicKeyHex;
        setPubKeySource("Local ECDH Keypair");
      }

      const encryptedDekHex = await wrapDekForHospital(encrypted.dekRawBytes, hospitalPubHex);
      const durationSeconds = BigInt(grantMinutes * 60);
      const expiresAt = Math.floor(Date.now() / 1000) + grantMinutes * 60;

      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) throw new Error("Connect MetaMask on Ethereum Sepolia");
        await ensureSepoliaChain(roles.chainId, switchChainAsync);

        if (vaultEntry) {
          const entryWithTarget: StoredVaultEntry = {
            ...vaultEntry,
            recordId: registeredRecordId,
            hospitalAddress: targetHospital,
          };
          setVaultEntry(entryWithTarget);
          await saveEncryptedRecordToVault(entryWithTarget);
          await pushCiphertextToRelay(entryWithTarget);
        }

        const { hash } = await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi as Abi,
          functionName: "grantAccess",
          args: [
            BigInt(registeredRecordId),
            targetHospital as `0x${string}`,
            durationSeconds,
            encryptedDekHex,
          ],
          writeContractAsync,
        });
        setGrantExpiresAt(expiresAt);
        toast.success(`Granted ${grantMinutes}-minute ECDH-wrapped DEK access on Ethereum Sepolia`);
        setAuditItems((prev) => [
          {
            id: `grant-${Date.now()}`,
            kind: "granted",
            title: `Access Granted (${grantMinutes}m) — Record #${registeredRecordId}`,
            detail: `Hospital ${targetHospital} | Wrapped DEK (${(encryptedDekHex.length - 2) / 2} bytes)`,
            timestamp: new Date().toLocaleTimeString(),
            txHash: hash,
            explorerUrl: explorerTxUrl(hash),
          },
          ...prev,
        ]);
        await Promise.all([syncOverviewState(), roles.refetch()]);
      } else {
        if (vaultEntry) {
          const entryWithTarget: StoredVaultEntry = {
            ...vaultEntry,
            recordId: registeredRecordId,
            hospitalAddress: targetHospital,
          };
          setVaultEntry(entryWithTarget);
          await saveEncryptedRecordToVault(entryWithTarget);
          await pushCiphertextToRelay(entryWithTarget);
        }

        const updatedMirror = await postRelayAction({
          action: "grant",
          recordId: registeredRecordId,
          hospitalAddress: targetHospital,
          expiresAt,
          grantMinutes,
          encryptedDekHex,
          recordCommitmentHex: encrypted.recordCommitmentHex,
          hospitalPubKeyHex: hospitalPubHex,
        });

        const mirror = updatedMirror ?? loadLocalChainMirror();
        if (!updatedMirror) {
          mirror.hospitalPubKeys[targetHospital.toLowerCase()] = hospitalPubHex;
          mirror.grants[`${registeredRecordId}:${targetHospital.toLowerCase()}`] = {
            expiresAt,
            encryptedDekHex,
          };
          const logEntry: AuditEventItem = {
            id: `grant-${Date.now()}`,
            kind: "granted",
            title: `Access Granted (${grantMinutes}m) — Record #${registeredRecordId}`,
            detail: `Hospital ${targetHospital} | ECDH P-256 Wrapped DEK (${(encryptedDekHex.length - 2) / 2} bytes)`,
            timestamp: new Date().toLocaleTimeString(),
          };
          mirror.auditLogs = [logEntry, ...mirror.auditLogs];
          saveLocalChainMirror(mirror);
        }

        window.dispatchEvent(new Event("storage"));
        setGrantExpiresAt(expiresAt);
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
        toast.success(`Granted ${grantMinutes}-minute ECDH-wrapped access to Hospital`);
      }
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!registeredRecordId) return;
    setBusy(true);
    try {
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) throw new Error("Connect MetaMask on Ethereum Sepolia");
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        const { hash } = await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi as Abi,
          functionName: "revokeAccess",
          args: [BigInt(registeredRecordId), targetHospital as `0x${string}`],
          writeContractAsync,
        });
        setGrantExpiresAt(0);
        toast.success("Access revoked on Ethereum Sepolia — Hospital settlement now blocked!");
        setAuditItems((prev) => [
          {
            id: `rev-${Date.now()}`,
            kind: "revoked",
            title: `Access Revoked — Record #${registeredRecordId}`,
            detail: `Hospital ${targetHospital} cleared & DEK deleted on-chain`,
            timestamp: new Date().toLocaleTimeString(),
            txHash: hash,
            explorerUrl: explorerTxUrl(hash),
          },
          ...prev,
        ]);
        await Promise.all([syncOverviewState(), roles.refetch()]);
      } else {
        const updatedMirror = await postRelayAction({
          action: "revoke",
          recordId: registeredRecordId,
          hospitalAddress: targetHospital,
        });
        const mirror = updatedMirror ?? loadLocalChainMirror();
        if (!updatedMirror) {
          delete mirror.grants[`${registeredRecordId}:${targetHospital.toLowerCase()}`];
          const logEntry: AuditEventItem = {
            id: `rev-${Date.now()}`,
            kind: "revoked",
            title: `Access Revoked — Record #${registeredRecordId}`,
            detail: `Hospital ${targetHospital} blocked; wrapped DEK deleted`,
            timestamp: new Date().toLocaleTimeString(),
          };
          mirror.auditLogs = [logEntry, ...mirror.auditLogs];
          saveLocalChainMirror(mirror);
        }
        window.dispatchEvent(new Event("storage"));
        setGrantExpiresAt(0);
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
        toast.success("Access revoked! Hospital decryption & settlement are now blocked.");
      }
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PatientOverviewHeader
        isPatientRole={roles.isPatient}
        isChainDeployed={IS_CHAIN_DEPLOYED}
        secondsRemaining={secondsRemaining}
        grantExpiresAt={grantExpiresAt}
        nowSec={nowSec}
        registeredRecordId={registeredRecordId}
        hasEncrypted={Boolean(encrypted)}
        vaultCount={vaultItems.length}
        activeGrantsCount={activeGrantsCount}
        settledClaimsCount={settledClaimsCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Cms1500IntakeCard
          claim={claim}
          onChangeClaim={setClaim}
          completeness={completeness}
          ocrRunning={ocrRunning}
          ocrStatus={ocrStatus}
          onRunSampleOcr={handleTestSampleBillOcr}
          onFileSelected={handleTextFileUpload}
        />

        <PatientConsentPanel
          claim={claim}
          encrypted={encrypted}
          cid={cid}
          registeredRecordId={registeredRecordId}
          secondsRemaining={secondsRemaining}
          targetHospital={targetHospital}
          onChangeTargetHospital={setTargetHospital}
          connectedAddress={address}
          pubKeySource={pubKeySource}
          grantMinutes={grantMinutes}
          onChangeGrantMinutes={setGrantMinutes}
          busy={busy}
          completenessValid={completeness.valid}
          vaultEntry={vaultEntry}
          canSignChainTx={!IS_CHAIN_DEPLOYED || (roles.isConnected && !roles.wrongChain)}
          onEncryptLocally={handleEncryptLocally}
          onDownloadBundle={downloadBundleEntry}
          onRegisterOnChain={handleRegisterOnChain}
          onGrantAccess={handleGrantAccess}
          onRevokeAccess={handleRevokeAccess}
        />
      </div>

      <PatientVaultTable
        vaultItems={vaultItems}
        targetHospital={targetHospital}
        activeGrantsMap={activeGrantsMap}
        nowSec={nowSec}
        onDownloadBundle={(item) => downloadBundleEntry(item)}
      />

      <SpotlightCard id="patient-audit" accent="neutral" className="p-6 space-y-4 scroll-mt-20">
        <div className="flex items-center justify-between border-b border-[#F4F4F5] pb-3">
          <h2 className="text-sm font-semibold text-[#09090B]">
            Immutable Access &amp; Consent Audit Log
          </h2>
          <Badge variant="neutral">Event Trail</Badge>
        </div>
        <AuditTimeline items={auditItems} />
      </SpotlightCard>

      <CoveredBenefitsSection />
    </div>
  );
}
