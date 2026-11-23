"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  KeyRound,
  Lock,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { AnimatedFileUpload } from "@/components/ui/animated-file-upload";
import { AuditTimeline, type AuditEventItem } from "@/components/ui/audit-timeline";
import { Badge } from "@/components/ui/card";
import { CopyHash } from "@/components/ui/copy-hash";
import { DecryptedText } from "@/components/ui/decrypted-text";
import { NumberTicker, SlidingCountdown } from "@/components/ui/number-ticker";
import { SmoothAccordion } from "@/components/ui/smooth-accordion";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { StatCard } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import { TactileButton } from "@/components/ui/tactile-button";
import { WalletPassCard } from "@/components/ui/wallet-pass-card";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { ACCREDITED_PROVIDERS, COVERED_CLINICAL_SCHEDULE } from "@/lib/clinicalCatalog";
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
  computeDeterministicCidV1,
  listVaultEntries,
  saveEncryptedRecordToVault,
  serializeQloBundle,
  type StoredVaultEntry,
} from "@/lib/storage";
import { shortHex } from "@/lib/utils";

const INPUT_CLASS =
  "mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 font-mono-tabular text-xs text-[#09090B] placeholder-[#A1A1AA] focus:border-[#0F766E] focus:outline-none transition-colors";

export default function PatientPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

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
    const mirror = loadLocalChainMirror();
    const now = Math.floor(Date.now() / 1000);
    setActiveGrantsMap(mirror.grants);
    setActiveGrantsCount(Object.values(mirror.grants).filter((g) => g.expiresAt > now).length);
    setSettledClaimsCount(mirror.settledClaims.length);
    const items = await listVaultEntries().catch(() => [] as StoredVaultEntry[]);
    setVaultItems(items);
    return { mirror, items };
  };

  useEffect(() => {
    syncOverviewState().then(({ mirror, items }) => {
      if (IS_CHAIN_DEPLOYED && publicClient) {
        fetchPatientAuditEvents(publicClient)
          .then(setAuditItems)
          .catch(() => undefined);
      } else {
        setAuditItems(
          mirror.auditLogs.map((a) => ({
            ...a,
            explorerUrl: a.txHash && IS_CHAIN_DEPLOYED ? explorerTxUrl(a.txHash) : undefined,
          }))
        );
      }

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
        if (!address || !publicClient) throw new Error("Connect MetaMask on Base Sepolia first");
        const hash = await writeContractAsync({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "registerRecord",
          args: [encrypted.recordCommitmentHex, cid],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        const recId = (await publicClient.readContract({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "commitmentToRecordId",
          args: [encrypted.recordCommitmentHex],
        })) as bigint;
        const idStr = recId.toString();
        setRegisteredRecordId(idStr);
        if (vaultEntry) {
          const updated = { ...vaultEntry, recordId: idStr };
          setVaultEntry(updated);
          await saveEncryptedRecordToVault(updated);
        }
        toast.success(`Registered record #${idStr} on Base Sepolia`);
        setAuditItems((prev) => [
          {
            id: `reg-${Date.now()}`,
            kind: "registered",
            title: `Record #${idStr} Registered On-Chain`,
            detail: `CIDv1 ${cid} | Commitment ${encrypted.recordCommitmentHex}`,
            timestamp: new Date().toLocaleTimeString(),
            txHash: hash,
            explorerUrl: explorerTxUrl(hash),
          },
          ...prev,
        ]);
      } else {
        const mirror = loadLocalChainMirror();
        const existing = mirror.records.find(
          (r) => r.recordCommitmentHex.toLowerCase() === encrypted.recordCommitmentHex.toLowerCase()
        );
        const recId = existing ? existing.recordId : String(mirror.nextRecordId);
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
        setRegisteredRecordId(recId);
        if (vaultEntry) {
          const updated = { ...vaultEntry, recordId: recId };
          setVaultEntry(updated);
          await saveEncryptedRecordToVault(updated);
        }
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
        toast.success(`Registered encrypted record #${recId} in local consent mirror`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
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
        const kp = await getOrCreateHospitalKeypair(targetHospital);
        hospitalPubHex = kp.publicKeyHex;
        setPubKeySource("Local ECDH Keypair");
      }

      const encryptedDekHex = await wrapDekForHospital(encrypted.dekRawBytes, hospitalPubHex);
      const durationSeconds = BigInt(grantMinutes * 60);
      const expiresAt = Math.floor(Date.now() / 1000) + grantMinutes * 60;

      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) throw new Error("Connect MetaMask on Base Sepolia");
        const hash = await writeContractAsync({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "grantAccess",
          args: [
            BigInt(registeredRecordId),
            targetHospital as `0x${string}`,
            durationSeconds,
            encryptedDekHex,
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setGrantExpiresAt(expiresAt);
        toast.success(`Granted ${grantMinutes}-minute ECDH-wrapped DEK access on Base Sepolia`);
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
      } else {
        const mirror = loadLocalChainMirror();
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
        setGrantExpiresAt(expiresAt);
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
        toast.success(`Granted ${grantMinutes}-minute ECDH-wrapped access to Hospital`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!registeredRecordId) return;
    setBusy(true);
    try {
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) throw new Error("Connect MetaMask on Base Sepolia");
        const hash = await writeContractAsync({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "revokeAccess",
          args: [BigInt(registeredRecordId), targetHospital as `0x${string}`],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setGrantExpiresAt(0);
        toast.success("Access revoked on Base Sepolia — Hospital settlement now blocked!");
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
      } else {
        const mirror = loadLocalChainMirror();
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
        setGrantExpiresAt(0);
        setAuditItems(mirror.auditLogs);
        await syncOverviewState();
        toast.success("Access revoked! Hospital decryption & settlement are now blocked.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="teal">Patient Sovereignty Portal</Badge>
            <span className="text-xs font-mono-tabular text-[#71717A]">
              IndexedDB · CIDv1 · ECDH P-256
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
            Patient Encrypted Record Vault
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B]">
            Parse medical claims locally with Tesseract WASM OCR, seal clinical payloads via AES-256-GCM, and issue time-bounded provider grants.
          </p>
        </div>

        {secondsRemaining > 0 ? (
          <div className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-1.5">
            <span className="text-xs font-semibold text-[#047857]">Active Grant</span>
            <SlidingCountdown secondsLeft={secondsRemaining} />
          </div>
        ) : null}
      </div>

      {/* Patient Workflow Stepper */}
      <Stepper
        current={grantExpiresAt > nowSec ? 3 : registeredRecordId ? 2 : encrypted ? 1 : 0}
        steps={[
          { title: "Intake & Local OCR", description: "CMS-1500 parsed in browser" },
          { title: "AES-256-GCM Encrypt", description: "IndexedDB + IPFS CIDv1" },
          { title: "Register & Wrap DEK", description: "Commit on HealthRecords.sol" },
          { title: "Active Hospital Grant", description: "Time-bounded consent key" },
        ]}
      />

      {/* Patient Overview KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Encrypted Vault Records"
          valueText={<NumberTicker value={vaultItems.length} />}
          sublabel="IndexedDB qlo-vault-v1"
          deltaText="Local Only"
          deltaTone="emerald"
          trend={[1, 1, 2, 2, 3, Math.max(1, vaultItems.length)]}
          accentColor="#047857"
        />
        <StatCard
          label="Active Provider Grants"
          valueText={<NumberTicker value={activeGrantsCount} />}
          sublabel={secondsRemaining > 0 ? "ECDH wrapped key live" : "Ready to delegate"}
          deltaText={secondsRemaining > 0 ? "Active" : "Standby"}
          deltaTone={secondsRemaining > 0 ? "teal" : "neutral"}
          trend={[0, 1, 0, 1, activeGrantsCount, activeGrantsCount]}
          accentColor="#0F766E"
        />
        <StatCard
          label="Settled Claims"
          valueText={<NumberTicker value={settledClaimsCount} />}
          sublabel="Zero-PHI disbursements"
          deltaText="Base Sepolia"
          deltaTone="neutral"
          trend={[0, 1, 1, 2, 2, Math.max(0, settledClaimsCount)]}
          accentColor="#0F4C81"
        />
        <StatCard
          label="Envelope Cipher"
          valueText="AES-256-GCM"
          sublabel="ECDH P-256 ephemeral wrap"
          deltaText="0 Bytes Sent"
          deltaTone="emerald"
          trend={[256, 256, 256, 256, 256, 256]}
          accentColor="#047857"
        />
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SpotlightCard accent="emerald" className="lg:col-span-7 p-6 space-y-5">
          <div className="border-b border-[#F4F4F5] pb-4">
            <h2 className="text-sm font-semibold text-[#09090B]">
              1. CMS-1500 Claim Intake &amp; Local OCR
            </h2>
            <p className="text-xs text-[#52525B]">
              All diagnosis, CPT, and prescription fields remain strictly private on your device.
            </p>
          </div>

          <AnimatedFileUpload
            ocrRunning={ocrRunning}
            ocrStatus={ocrStatus}
            onRunSampleOcr={handleTestSampleBillOcr}
            onFileSelected={handleTextFileUpload}
          />

          <div className="space-y-1">
            <label htmlFor="preset-select" className="text-xs font-medium text-[#52525B]">
              Clinical Claim Templates
            </label>
            <select
              id="preset-select"
              value={claim.caseLabel}
              onChange={(e) => {
                const found = SYNTHETIC_CMS1500_PRESETS.find((p) => p.caseLabel === e.target.value);
                if (found) setClaim(found);
              }}
              className={INPUT_CLASS}
            >
              {SYNTHETIC_CMS1500_PRESETS.map((p) => (
                <option key={p.caseLabel} value={p.caseLabel}>
                  {p.caseLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="box1a" className="text-[#52525B] font-medium">
                Box 1a — Policy ID (Private)
              </label>
              <input
                id="box1a"
                value={claim.insuredPolicyId}
                onChange={(e) => setClaim({ ...claim, insuredPolicyId: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="box2" className="text-[#52525B] font-medium">
                Box 2 — Patient Alias (Private)
              </label>
              <input
                id="box2"
                value={claim.patientAlias}
                onChange={(e) => setClaim({ ...claim, patientAlias: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="box21" className="text-[#52525B] font-medium">
                Box 21 — ICD-10-CM (Private)
              </label>
              <input
                id="box21"
                value={claim.icd10Code}
                onChange={(e) => setClaim({ ...claim, icd10Code: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="box24d" className="text-[#52525B] font-medium">
                Box 24D — CPT Code (Private)
              </label>
              <input
                id="box24d"
                value={claim.cptCode}
                onChange={(e) => setClaim({ ...claim, cptCode: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="box24f" className="text-[#52525B] font-medium">
                Box 24F — Charge ETH (Public Signal)
              </label>
              <input
                id="box24f"
                value={claim.claimAmountEth}
                onChange={(e) => setClaim({ ...claim, claimAmountEth: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="box24j" className="text-[#52525B] font-medium">
                Box 24J — Rendering NPI (Private)
              </label>
              <input
                id="box24j"
                value={claim.renderingNpi}
                onChange={(e) => setClaim({ ...claim, renderingNpi: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs">
            <div>
              <label htmlFor="rx" className="text-[#52525B] font-medium">
                Prescription / Rx (Private)
              </label>
              <input
                id="rx"
                value={claim.prescription}
                onChange={(e) => setClaim({ ...claim, prescription: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#09090B] focus:border-[#0F766E] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="notes" className="text-[#52525B] font-medium">
                Clinical Summary (Private)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={claim.clinicalNotes}
                onChange={(e) => setClaim({ ...claim, clinicalNotes: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#09090B] focus:border-[#0F766E] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#09090B] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#0F766E]" />
                CMS-1500 Completeness Validator
              </span>
              <Badge variant={completeness.valid ? "emerald" : "crimson"}>
                {completeness.score}/{completeness.total} Checks Valid
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {completeness.checks.map((c) => (
                <div
                  key={c.field}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] flex items-center gap-1.5 ${
                    c.passed
                      ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                      : "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                  }`}
                >
                  {c.passed ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">
                    {c.box}: {c.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SpotlightCard>

        {/* Right: Wallet Pass + Encryption + Consent Control */}
        <div className="lg:col-span-5 space-y-5">
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
                onClick={handleEncryptLocally}
                disabled={busy || !completeness.valid}
              >
                <Lock className="h-4 w-4" />
                Encrypt Locally (AES-256-GCM)
              </TactileButton>
              {vaultEntry ? (
                <TactileButton
                  variant="secondary"
                  onClick={() => downloadBundleEntry(vaultEntry, registeredRecordId)}
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
                  Ciphertext persisted in IndexedDB (`qlo-vault-v1`)
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
              onClick={handleRegisterOnChain}
              disabled={busy || !encrypted}
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
                    const selected =
                      prov.address.toLowerCase() === targetHospital.toLowerCase();
                    return (
                      <button
                        key={prov.address}
                        type="button"
                        onClick={() => setTargetHospital(prov.address)}
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
                  {address && address.toLowerCase() !== targetHospital.toLowerCase() ? (
                    <button
                      type="button"
                      onClick={() => setTargetHospital(address)}
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
                onChange={(e) => setTargetHospital(e.target.value)}
                className={INPUT_CLASS}
              />

              <div className="flex items-center gap-2 pt-1">
                {[10, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setGrantMinutes(mins)}
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
            </div>

            <div className="flex flex-wrap gap-2">
              <TactileButton
                variant="emerald"
                onClick={handleGrantAccess}
                disabled={busy || !registeredRecordId}
              >
                <KeyRound className="h-4 w-4" />
                Grant {grantMinutes}m Access (Wrap DEK)
              </TactileButton>
              <TactileButton
                variant="crimson"
                onClick={handleRevokeAccess}
                disabled={busy || !registeredRecordId}
              >
                <ShieldOff className="h-4 w-4" />
                Revoke Immediately
              </TactileButton>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* Real Encrypted Records Vault Table */}
      <SpotlightCard accent="neutral" className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">My Encrypted Records Vault</h2>
            <p className="text-xs text-[#52525B]">
              Local IndexedDB (`qlo-vault-v1`) ciphertext bundles and portable `.qlo.json` exports.
            </p>
          </div>
          <Badge variant="neutral">{vaultItems.length} records stored</Badge>
        </div>

        {vaultItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-[#FAFAFA] py-6 text-center text-xs text-[#71717A]">
            No encrypted clinical records yet. Encrypt a claim above to populate your vault.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E4E7] text-[#71717A]">
                  <th className="py-2.5 pr-4 font-medium">Record</th>
                  <th className="py-2.5 pr-4 font-medium">Summary</th>
                  <th className="py-2.5 pr-4 font-medium">CIDv1</th>
                  <th className="py-2.5 pr-4 font-medium">Consent Status</th>
                  <th className="py-2.5 text-right font-medium">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F5]">
                {vaultItems.map((item) => {
                  const hospTarget = (item.hospitalAddress || targetHospital).toLowerCase();
                  const recGrant = item.recordId
                    ? activeGrantsMap[`${item.recordId}:${hospTarget}`]
                    : undefined;
                  const isActive = Boolean(recGrant && recGrant.expiresAt > nowSec);
                  return (
                    <tr key={item.recordCommitmentHex} className="hover:bg-[#FAFAFA]">
                      <td className="py-2.5 pr-4 font-mono-tabular font-semibold text-[#09090B]">
                        {item.recordId ? `#${item.recordId}` : "Local"}
                      </td>
                      <td className="py-2.5 pr-4 text-[#09090B]">{item.summaryHint || "Encrypted Bill"}</td>
                      <td className="py-2.5 pr-4 font-mono-tabular text-[#52525B]">
                        {shortHex(item.cid, 12, 8)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={isActive ? "emerald" : "neutral"}>
                          {isActive ? "Grant Active" : item.recordId ? "Revoked / Idle" : "Unregistered"}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <TactileButton
                          size="sm"
                          variant="secondary"
                          onClick={() => downloadBundleEntry(item)}
                        >
                          <Download className="h-3 w-3" />
                          Bundle
                        </TactileButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SpotlightCard>

      {/* Immutable Event Audit Log */}
      <SpotlightCard accent="neutral" className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#F4F4F5] pb-3">
          <h2 className="text-sm font-semibold text-[#09090B]">
            Immutable Access &amp; Consent Audit Log
          </h2>
          <Badge variant="neutral">Event Trail</Badge>
        </div>
        <AuditTimeline items={auditItems} />
      </SpotlightCard>

      {/* Plain-English Covered Benefits Schedule */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#09090B]">
              Covered Clinical Benefits Schedule
            </h2>
            <p className="text-xs text-[#52525B]">
              Every procedure below is pre-committed in the Poseidon Depth-6 benefit Merkle tree and settles automatically without exposing diagnoses.
            </p>
          </div>
          <Badge variant="emerald">{COVERED_CLINICAL_SCHEDULE.length} Approved CPT Codes</Badge>
        </div>

        <SmoothAccordion
          defaultOpen={["cat-Emergency"]}
          items={[
            {
              id: "cat-Emergency",
              title: "Emergency & Acute Cardiac Care",
              subtitle: "Priority high-severity & urgent ED stabilization",
              badge: "CPT 99285 · 99284",
              content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {COVERED_CLINICAL_SCHEDULE.filter((c) => c.category === "Emergency").map((item) => (
                    <div
                      key={item.code}
                      className="rounded-xl border border-[#E4E4E7] bg-white p-3.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#09090B]">{item.title}</span>
                        <span className="font-mono-tabular text-[11px] font-semibold text-[#0F766E]">
                          CPT {item.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#52525B]">{item.summary}</p>
                      <div className="text-[10px] font-mono-tabular text-[#047857]">
                        {item.copayTier} · {item.typicalTurnaround}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              id: "cat-Specialty",
              title: "Outpatient Consultations, Cardiology & Orthopedic Care",
              subtitle: "Follow-up specialist clinics, 12-lead ECG, and closed fracture reduction",
              badge: "CPT 99214 · 93000 · 27750",
              content: (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {COVERED_CLINICAL_SCHEDULE.filter((c) =>
                    ["Outpatient", "Cardiology", "Orthopedic"].includes(c.category)
                  ).map((item) => (
                    <div
                      key={item.code}
                      className="rounded-xl border border-[#E4E4E7] bg-white p-3.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#09090B]">{item.title}</span>
                        <span className="font-mono-tabular text-[11px] font-semibold text-[#0F766E]">
                          CPT {item.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#52525B]">{item.summary}</p>
                      <div className="text-[10px] font-mono-tabular text-[#047857]">
                        {item.copayTier} · {item.typicalTurnaround}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              id: "cat-Diagnostics",
              title: "Diagnostic Radiology & Clinical Pathology Panels",
              subtitle: "Chest imaging, metabolic chemistry panels, and specimen draws",
              badge: "CPT 71046 · 80053 · 36415",
              content: (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {COVERED_CLINICAL_SCHEDULE.filter((c) =>
                    ["Radiology", "Pathology"].includes(c.category)
                  ).map((item) => (
                    <div
                      key={item.code}
                      className="rounded-xl border border-[#E4E4E7] bg-white p-3.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#09090B]">{item.title}</span>
                        <span className="font-mono-tabular text-[11px] font-semibold text-[#0F766E]">
                          CPT {item.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#52525B]">{item.summary}</p>
                      <div className="text-[10px] font-mono-tabular text-[#047857]">
                        {item.copayTier} · {item.typicalTurnaround}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
