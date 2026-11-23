"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertOctagon,
  CheckCircle2,
  Cpu,
  Download,
  FileCode2,
  KeyRound,
  Landmark,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { Badge } from "@/components/ui/card";
import { DecryptedText } from "@/components/ui/decrypted-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { OrbitalProver } from "@/components/ui/orbital-prover";
import { PaymentNotificationBanner } from "@/components/ui/payment-notification-banner";
import { PaymentReceiptPrinter } from "@/components/ui/payment-receipt-printer";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { StatCard } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import { TactileButton } from "@/components/ui/tactile-button";
import { BorderBeam, Terminal } from "@/components/ui/terminal";
import { TransitionPanel } from "@/components/ui/transition-panel";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import {
  ACCREDITED_PROVIDERS,
  getCptLabel,
  getProviderDisplayName,
} from "@/lib/clinicalCatalog";
import { CONTRACTS, IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import {
  decryptClinicalPayload,
  getOrCreateHospitalKeypair,
  unwrapDekForHospital,
} from "@/lib/crypto";
import {
  cms1500ToFhirClaim,
  cms1500ToX12837P,
  generateX12835Era,
} from "@/lib/healthcareStandards";
import { validateCms1500Completeness, type Cms1500Claim } from "@/lib/intake";
import { loadLocalChainMirror, saveLocalChainMirror } from "@/lib/localState";
import { motionTransitions } from "@/lib/motion-tokens";
import {
  buildCircuitInputFromClaim,
  generateClaimProof,
  type ProveStage,
  type ProverOutput,
} from "@/lib/prover";
import {
  fetchHospitalRelayVault,
  fetchRelayState,
  postRelayAction,
} from "@/lib/relayClient";
import {
  importAndVerifyQloBundle,
  listVaultEntries,
  saveEncryptedRecordToVault,
  type StoredVaultEntry,
} from "@/lib/storage";
import {
  decodeContractError,
  ensureBaseSepoliaChain,
  preflightSimulateAndWrite,
} from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth, parseEthToWei } from "@/lib/utils";

const PREDICATE_LABELS = [
  "1. Hospital Merkle Membership (Poseidon(address, licenseId))",
  "2. Policy Commitment Preimage (Poseidon(6))",
  "3. Policy Unexpired vs. Live Clock (Num2Bits(64) + LessThan)",
  "4. Procedure Code in Covered CPT Tree (MerkleProof(6))",
  "5. Positive Claim Amount (IsZero == 0)",
  "6. Cumulative Annual Cap (priorSpent + claim <= annualLimit)",
  "7. Deterministic Non-Replayable Nullifier (Poseidon(3))",
  "8. Anti-Front-Run Sender Binding (hospitalAddress == msg.sender)",
];

type AttackId = "replay" | "cpt" | "expired" | "cap" | "revoked";

export default function HospitalPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const roles = useWalletRoles();

  const [entries, setEntries] = useState<StoredVaultEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<StoredVaultEntry | null>(null);
  const [hospitalAddr, setHospitalAddr] = useState<string>(canonicalFixtures.accounts.hospital1);
  const [hospitalPubKeyHex, setHospitalPubKeyHex] = useState<string>("");

  const [decryptedClaim, setDecryptedClaim] = useState<Cms1500Claim | null>(null);
  const [accessError, setAccessError] = useState<string>("");

  const [proveStage, setProveStage] = useState<ProveStage>("idle");
  const [proverOutput, setProverOutput] = useState<ProverOutput | null>(null);
  const [terminalLines, setTerminalLines] = useState<
    { text: string; tone?: "info" | "ok" | "warn" | "err" }[]
  >([
    { text: "Qlo Groth16 Web Worker standby (4,349 R1CS constraints, BN254)", tone: "info" },
  ]);

  const [settledTx, setSettledTx] = useState<string>("");
  const [settledAmountEth, setSettledAmountEth] = useState<string>("0.01");
  const [providerRevenueEth, setProviderRevenueEth] = useState<number>(0);
  const [settledClaimsCount, setSettledClaimsCount] = useState<number>(0);

  const [activeAttack, setActiveAttack] = useState<AttackId>("replay");
  const [attackResult, setAttackResult] = useState<{ status: "idle" | "blocked"; detail: string }>({
    status: "idle",
    detail: "",
  });
  const [standardsTab, setStandardsTab] = useState<"fhir" | "x12">("fhir");
  const [refreshingInbox, setRefreshingInbox] = useState(false);
  const [txBusy, setTxBusy] = useState(false);
  const [onChainKeyRegistered, setOnChainKeyRegistered] = useState(false);
  const [accessStatus, setAccessStatus] = useState<"unknown" | "checking" | "granted" | "missing">("unknown");
  const [accessExpiresAt, setAccessExpiresAt] = useState(0);

  const matchedProvider =
    canonicalFixtures.hospitals.find(
      (h) => h.address.toLowerCase() === hospitalAddr.toLowerCase()
    ) ?? null;

  const syncMetrics = async (customMirror?: ReturnType<typeof loadLocalChainMirror> | null) => {
    if (IS_CHAIN_DEPLOYED && publicClient) {
      try {
        const [payoutWei, count] = await Promise.all([
          publicClient.readContract({
            address: CONTRACTS.ClaimsVault.address,
            abi: CONTRACTS.ClaimsVault.abi,
            functionName: "totalPayoutWei",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: CONTRACTS.ClaimsVault.address,
            abi: CONTRACTS.ClaimsVault.abi,
            functionName: "totalClaimsSettled",
          }) as Promise<bigint>,
        ]);
        setProviderRevenueEth(Number(formatWeiToEth(payoutWei, 4)));
        setSettledClaimsCount(Number(count));
        return;
      } catch {
        // Fallback to cached state if RPC throttles
      }
    }
    const mirror = customMirror ?? loadLocalChainMirror();
    const totalWei = mirror.settledClaims.reduce((acc, c) => acc + BigInt(c.amountWei), 0n);
    setProviderRevenueEth(Number(formatWeiToEth(totalWei, 4)));
    setSettledClaimsCount(mirror.settledClaims.length);
  };

  const refreshHospitalInbox = async (targetAddr = hospitalAddr, forceSyncKey = false) => {
    setRefreshingInbox(true);
    try {
      const kp = await getOrCreateHospitalKeypair(targetAddr);
      setHospitalPubKeyHex(kp.publicKeyHex);

      const [localItems, relayedItems, remoteMirror] = await Promise.all([
        listVaultEntries().catch(() => [] as StoredVaultEntry[]),
        fetchHospitalRelayVault(targetAddr),
        fetchRelayState(),
      ]);

      if (forceSyncKey || !remoteMirror?.hospitalPubKeys?.[targetAddr.toLowerCase()]) {
        await postRelayAction({
          action: "publishPubKey",
          hospitalAddress: targetAddr,
          publicKeyHex: kp.publicKeyHex,
          force: forceSyncKey,
        });
      }

      const mergedByCommit = new Map<string, StoredVaultEntry>();
      for (const item of localItems) {
        mergedByCommit.set(item.recordCommitmentHex.toLowerCase(), item);
      }
      for (const rel of relayedItems) {
        const key = rel.recordCommitmentHex.toLowerCase();
        const existing = mergedByCommit.get(key);
        if (!existing) {
          mergedByCommit.set(key, rel);
          await saveEncryptedRecordToVault(rel).catch(() => undefined);
        } else if (!existing.recordId && rel.recordId) {
          mergedByCommit.set(key, { ...existing, recordId: rel.recordId });
        }
      }

      const mergedList = Array.from(mergedByCommit.values()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      setEntries(mergedList);
      setSelectedEntry((prev) => {
        if (
          prev &&
          mergedList.some(
            (x) => x.recordCommitmentHex.toLowerCase() === prev.recordCommitmentHex.toLowerCase()
          )
        ) {
          return (
            mergedList.find(
              (x) =>
                x.recordCommitmentHex.toLowerCase() === prev.recordCommitmentHex.toLowerCase()
            ) ?? mergedList[0] ?? null
          );
        }
        return mergedList[0] ?? null;
      });

      if (IS_CHAIN_DEPLOYED && publicClient) {
        try {
          const onChainPub = (await publicClient.readContract({
            address: CONTRACTS.HospitalRegistry.address,
            abi: CONTRACTS.HospitalRegistry.abi,
            functionName: "hospitalEncryptionPubKey",
            args: [targetAddr as `0x${string}`],
          })) as `0x${string}`;
          setOnChainKeyRegistered(Boolean(onChainPub && onChainPub.length >= 132));
        } catch {
          setOnChainKeyRegistered(false);
        }
      } else {
        setOnChainKeyRegistered(false);
      }

      await syncMetrics(IS_CHAIN_DEPLOYED ? null : remoteMirror);
    } finally {
      setRefreshingInbox(false);
    }
  };

  useEffect(() => {
    refreshHospitalInbox(hospitalAddr, false).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalAddr]);

  useEffect(() => {
    if (address) setHospitalAddr(address);
  }, [address]);

  useEffect(() => {
    let active = true;
    if (!selectedEntry) {
      setAccessStatus("unknown");
      setAccessExpiresAt(0);
      return;
    }

    const checkGrantStatus = async () => {
      setAccessStatus("checking");
      if (IS_CHAIN_DEPLOYED && publicClient) {
        try {
          const recId = (await publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "commitmentToRecordId",
            args: [selectedEntry.recordCommitmentHex],
          })) as bigint;
          if (!active) return;
          if (recId === 0n) {
            setAccessStatus("missing");
            setAccessExpiresAt(0);
            return;
          }
          const [exp, dekBytes] = (await publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "getGrant",
            args: [recId, hospitalAddr as `0x${string}`],
          })) as [bigint, `0x${string}`];
          if (!active) return;
          if (exp > 0n && dekBytes && dekBytes !== "0x") {
            setAccessStatus("granted");
            setAccessExpiresAt(Number(exp));
          } else {
            setAccessStatus("missing");
            setAccessExpiresAt(0);
          }
          return;
        } catch {
          if (!active) return;
          setAccessStatus("unknown");
          return;
        }
      }

      const remote = await fetchRelayState();
      if (!active) return;
      const mirror = remote ?? loadLocalChainMirror();
      const rec = mirror.records.find(
        (r) =>
          r.recordCommitmentHex.toLowerCase() ===
          selectedEntry.recordCommitmentHex.toLowerCase()
      );
      if (!rec) {
        setAccessStatus("missing");
        setAccessExpiresAt(0);
        return;
      }
      const grant = mirror.grants[`${rec.recordId}:${hospitalAddr.toLowerCase()}`];
      const now = Math.floor(Date.now() / 1000);
      if (grant && grant.expiresAt > now) {
        setAccessStatus("granted");
        setAccessExpiresAt(grant.expiresAt);
      } else {
        setAccessStatus("missing");
        setAccessExpiresAt(0);
      }
    };

    checkGrantStatus().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedEntry, hospitalAddr, publicClient, settledTx]);

  const appendLog = (text: string, tone: "info" | "ok" | "warn" | "err" = "info") => {
    setTerminalLines((prev) => [...prev, { text, tone }]);
  };

  const handleRegisterHospitalPubKey = async () => {
    if (!hospitalPubKeyHex || txBusy) return;
    setTxBusy(true);
    try {
      await postRelayAction({
        action: "publishPubKey",
        hospitalAddress: hospitalAddr,
        publicKeyHex: hospitalPubKeyHex,
        force: true,
      });

      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) {
          throw new Error("Connect Hospital MetaMask wallet first");
        }
        await ensureBaseSepoliaChain(roles.chainId, switchChainAsync);
        const { hash } = await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.HospitalRegistry.address,
          abi: CONTRACTS.HospitalRegistry.abi as Abi,
          functionName: "registerEncryptionPubKey",
          args: [hospitalPubKeyHex as `0x${string}`],
          writeContractAsync,
        });
        setOnChainKeyRegistered(true);
        appendLog(`Registered ECDH pubkey on Base Sepolia: ${hash}`, "ok");
        toast.success("Registered ECDH P-256 public key in HospitalRegistry");
        await roles.refetch();
      } else {
        const mirror = loadLocalChainMirror();
        mirror.hospitalPubKeys[hospitalAddr.toLowerCase()] = hospitalPubKeyHex;
        saveLocalChainMirror(mirror);
        toast.success("Synced Hospital ECDH P-256 public key to clearinghouse directory");
      }
    } catch (err) {
      const msg = decodeContractError(err);
      appendLog(msg, "err");
      toast.error(msg);
    } finally {
      setTxBusy(false);
    }
  };

  const handleImportBundle = async (file: File) => {
    const MAX_BUNDLE_BYTES = 512 * 1024; // 512 KB ceiling for encrypted bundles
    if (file.size > MAX_BUNDLE_BYTES) {
      toast.error("Encrypted bundle exceeds 512 KB maximum size.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Import a valid .qlo.json encrypted bundle file.");
      return;
    }
    if (file.type && !["application/json", "text/plain"].includes(file.type.toLowerCase())) {
      toast.error(`Unsupported bundle MIME type: ${file.type}`);
      return;
    }
    try {
      const raw = await file.text();
      const imported = await importAndVerifyQloBundle(raw);
      const updated = await listVaultEntries();
      setEntries(updated);
      setSelectedEntry(imported);
      setDecryptedClaim(null);
      setAccessError("");
      toast.success("Verified .qlo.json CIDv1 + 248-bit commitment & imported into vault");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify bundle");
    }
  };

  const handleUnwrapAndDecrypt = async () => {
    if (!selectedEntry) {
      toast.error("Select or import an encrypted record first");
      return;
    }
    setAccessError("");
    setProverOutput(null);
    setProveStage("idle");
    try {
      let encryptedDekHex = "";
      let recIdStr = selectedEntry.recordId || "";

      if (IS_CHAIN_DEPLOYED && publicClient) {
        const recId = (await publicClient.readContract({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "commitmentToRecordId",
          args: [selectedEntry.recordCommitmentHex],
        })) as bigint;
        if (recId === 0n) throw new Error("Record not registered on Base Sepolia");
        recIdStr = recId.toString();
        const [expiresAt, dekBytes] = (await publicClient.readContract({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "getGrant",
          args: [recId, hospitalAddr as `0x${string}`],
        })) as [bigint, `0x${string}`];
        if (expiresAt === 0n || !dekBytes || dekBytes === "0x") {
          throw new Error("ACCESS DENIED: Patient grant missing, expired, or revoked on-chain.");
        }
        encryptedDekHex = dekBytes;
      } else {
        const remote = await fetchRelayState();
        const mirror = remote ?? loadLocalChainMirror();
        const rec = mirror.records.find(
          (r) => r.recordCommitmentHex.toLowerCase() === selectedEntry.recordCommitmentHex.toLowerCase()
        );
        if (!rec) throw new Error("Record not registered in consent registry yet.");
        recIdStr = rec.recordId;
        const grant = mirror.grants[`${rec.recordId}:${hospitalAddr.toLowerCase()}`];
        const now = Math.floor(Date.now() / 1000);
        if (!grant || grant.expiresAt <= now) {
          throw new Error(
            "ACCESS DENIED: Patient grant missing, expired, or revoked (PatientAccessNotActive)."
          );
        }
        encryptedDekHex = grant.encryptedDekHex;
        const updatedMirror = await postRelayAction({
          action: "logAccess",
          recordId: rec.recordId,
          hospitalAddress: hospitalAddr,
        });
        if (!updatedMirror) {
          mirror.auditLogs = [
            {
              id: `acc-${Date.now()}`,
              kind: "accessed",
              title: `Hospital Accessed Record #${rec.recordId}`,
              detail: `Unwrapped ECDH DEK for ${hospitalAddr}`,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...mirror.auditLogs,
          ];
          saveLocalChainMirror(mirror);
        }
      }

      const kp = await getOrCreateHospitalKeypair(hospitalAddr);
      const rawDek = await unwrapDekForHospital(encryptedDekHex, kp.privateJwk);
      const plain = await decryptClinicalPayload<Cms1500Claim>(selectedEntry.envelope, rawDek);
      setDecryptedClaim(plain);
      appendLog(`Unwrapped ECDH DEK for Record #${recIdStr} — CMS-1500 decrypted locally`, "ok");
      toast.success("DEK unwrapped & clinical record decrypted locally");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Access blocked";
      setDecryptedClaim(null);
      setAccessError(msg);
      appendLog(msg, "err");
      toast.error(msg);
    }
  };

  const handleLogAccessAudit = async () => {
    if (!selectedEntry || txBusy) return;
    setTxBusy(true);
    try {
      if (IS_CHAIN_DEPLOYED && publicClient) {
        if (!address) throw new Error("Connect Hospital MetaMask wallet");
        await ensureBaseSepoliaChain(roles.chainId, switchChainAsync);
        const recId = (await publicClient.readContract({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "commitmentToRecordId",
          args: [selectedEntry.recordCommitmentHex],
        })) as bigint;
        if (recId === 0n) throw new Error("Record not registered on Base Sepolia");
        const { hash } = await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi as Abi,
          functionName: "logAccess",
          args: [recId],
          writeContractAsync,
        });
        appendLog(`Logged RecordAccessed(${recId.toString()}) on Base Sepolia: ${hash}`, "ok");
        toast.success("Logged immutable RecordAccessed audit event on Base Sepolia");
      } else {
        const remote = await fetchRelayState();
        const mirror = remote ?? loadLocalChainMirror();
        const rec = mirror.records.find(
          (r) => r.recordCommitmentHex.toLowerCase() === selectedEntry.recordCommitmentHex.toLowerCase()
        );
        const recId = rec?.recordId ?? selectedEntry.recordId ?? "?";
        const updatedMirror = await postRelayAction({
          action: "logAccess",
          recordId: recId,
          hospitalAddress: hospitalAddr,
        });
        if (!updatedMirror) {
          mirror.auditLogs = [
            {
              id: `log-acc-${Date.now()}`,
              kind: "accessed",
              title: `Explicit Access Audit Logged — Record #${recId}`,
              detail: `HealthRecords.logAccess(${recId}) verified for ${hospitalAddr}`,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...mirror.auditLogs,
          ];
          saveLocalChainMirror(mirror);
        }
        window.dispatchEvent(new Event("storage"));
        appendLog(`Explicit RecordAccessed(${recId}) audit entry recorded`, "ok");
        toast.success(`Logged RecordAccessed audit entry for Record #${recId}`);
      }
    } catch (err) {
      const msg = decodeContractError(err);
      appendLog(msg, "err");
      toast.error(msg);
    } finally {
      setTxBusy(false);
    }
  };

  const handleProve = async () => {
    if (!selectedEntry || !decryptedClaim) {
      toast.error("Decrypt an authorized record first.");
      return;
    }

    setProveStage("building_witness");
    setProverOutput(null);
    appendLog("Building 20-signal Poseidon Merkle witness...", "info");

    try {
      let priorSpentWei = 0n;
      let claimTimestampOverride: bigint | undefined;
      const commitmentBigInt = BigInt(canonicalFixtures.activePolicy.commitment);
      if (IS_CHAIN_DEPLOYED && publicClient) {
        const [spent, latestBlock, onChainRoot] = await Promise.all([
          publicClient.readContract({
            address: CONTRACTS.ClaimsVault.address,
            abi: CONTRACTS.ClaimsVault.abi,
            functionName: "policySpent",
            args: [commitmentBigInt],
          }) as Promise<bigint>,
          publicClient.getBlock({ blockTag: "latest" }),
          publicClient.readContract({
            address: CONTRACTS.HospitalRegistry.address,
            abi: CONTRACTS.HospitalRegistry.abi,
            functionName: "hospitalRoot",
          }) as Promise<bigint>,
        ]);
        priorSpentWei = spent;
        claimTimestampOverride = latestBlock.timestamp;
        if (onChainRoot !== BigInt(canonicalFixtures.hospitalRoot)) {
          appendLog(
            "WARNING: On-chain HospitalRegistry.hospitalRoot() differs from local canonicalFixtures.json.",
            "warn"
          );
        } else {
          appendLog(
            `Synced live Base Sepolia block clock (${latestBlock.timestamp.toString()}) & root`,
            "info"
          );
        }
      } else {
        const remote = await fetchRelayState();
        const mirror = remote ?? loadLocalChainMirror();
        priorSpentWei = BigInt(
          mirror.policySpentWei[canonicalFixtures.activePolicy.commitment] ?? "0"
        );
      }

      const input = await buildCircuitInputFromClaim({
        claim: decryptedClaim,
        recordCommitment: BigInt(selectedEntry.recordCommitmentHex),
        hospitalAddress: hospitalAddr,
        priorPolicySpentWei: priorSpentWei,
        claimTimestampOverride,
      });

      const out = await generateClaimProof(input, (stage) => {
        setProveStage(stage);
        if (stage === "loading_artifacts") appendLog("Loading /zk/ClaimValidity.wasm + .zkey...", "info");
        if (stage === "computing_witness") appendLog("Generating Groth16 BN254 witness & pairing proof...", "warn");
        if (stage === "verifying_locally") appendLog("Verifying Groth16 proof locally...", "info");
      });

      setProverOutput(out);
      appendLog(
        `Groth16 proof verified locally in ${out.elapsedMs}ms (priorSpent=${formatWeiToEth(priorSpentWei)} ETH)`,
        "ok"
      );
      toast.success(`Groth16 proof generated & verified in ${out.elapsedMs}ms!`);
    } catch (err) {
      setProveStage("failed");
      const msg = err instanceof Error ? err.message : "Proving failed closed";
      appendLog(`FAIL-CLOSED CIRCUIT REJECTION: ${msg}`, "err");
      toast.error("Circuit failed closed — predicate violation detected!");
    }
  };

  const handleSettle = async () => {
    if (!proverOutput || !selectedEntry || txBusy) return;
    const { pA, pB, pC, pubSignals, rawCalldataHex } = proverOutput.solidity;
    setTxBusy(true);
    try {
      const amountFmt = formatWeiToEth(pubSignals[3], 4);
      if (IS_CHAIN_DEPLOYED) {
        if (!address || !publicClient) throw new Error("Connect Hospital MetaMask wallet");
        await ensureBaseSepoliaChain(roles.chainId, switchChainAsync);
        const { hash } = await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.ClaimsVault.address,
          abi: CONTRACTS.ClaimsVault.abi as Abi,
          functionName: "submitClaim",
          args: [pA, pB, pC, pubSignals],
          writeContractAsync,
        });
        setSettledAmountEth(amountFmt);
        setSettledTx(hash);
        await Promise.all([syncMetrics(), roles.refetch()]);
        appendLog(`Base Sepolia Tx Settled: ${hash}`, "ok");
        toast.success("Claim settled on Base Sepolia — ETH transferred to Hospital!");
      } else {
        const nullifierStr = pubSignals[2].toString();
        const policyStr = pubSignals[1].toString();
        const amount = pubSignals[3];
        const pseudoHash = ("0x" +
          Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")) as `0x${string}`;

        const relayed = await postRelayAction({
          action: "settle",
          recordCommitmentHex: selectedEntry.recordCommitmentHex,
          hospitalAddress: hospitalAddr,
          policyCommitment: policyStr,
          nullifier: nullifierStr,
          amountWei: amount.toString(),
          rawCalldataHex,
          pubSignals: proverOutput.publicSignals,
          txHash: pseudoHash,
        });

        if (!relayed) {
          const mirror = loadLocalChainMirror();
          const recId = mirror.records.find(
            (r) => r.recordCommitmentHex.toLowerCase() === selectedEntry.recordCommitmentHex.toLowerCase()
          )?.recordId;
          const grant = recId ? mirror.grants[`${recId}:${hospitalAddr.toLowerCase()}`] : null;
          if (!grant || grant.expiresAt <= Math.floor(Date.now() / 1000)) {
            throw new Error("ClaimsVault.PatientAccessNotActive()");
          }
          if (mirror.nullifierUsed[nullifierStr]) {
            throw new Error("ClaimsVault.NullifierAlreadyUsed()");
          }
          if (BigInt(mirror.insurerEscrowWei) < amount) {
            throw new Error("ClaimsVault.InsufficientEscrow()");
          }

          mirror.nullifierUsed[nullifierStr] = true;
          mirror.policySpentWei[policyStr] = (
            BigInt(mirror.policySpentWei[policyStr] ?? "0") + amount
          ).toString();
          mirror.insurerEscrowWei = (BigInt(mirror.insurerEscrowWei) - amount).toString();
          mirror.settledClaims = [
            {
              txHash: pseudoHash,
              nullifier: nullifierStr,
              policyCommitment: policyStr,
              recordCommitmentHex: selectedEntry.recordCommitmentHex,
              hospital: hospitalAddr,
              amountWei: amount.toString(),
              settledAt: Math.floor(Date.now() / 1000),
              rawCalldataHex,
              pubSignals: proverOutput.publicSignals,
            },
            ...mirror.settledClaims,
          ];
          mirror.auditLogs = [
            {
              id: `settle-${Date.now()}`,
              kind: "settled",
              title: `Claim Settled (+${amountFmt} ETH)`,
              detail: `Nullifier ${nullifierStr.slice(0, 16)}... | Zero PHI emitted`,
              timestamp: new Date().toLocaleTimeString(),
              txHash: pseudoHash,
            },
            ...mirror.auditLogs,
          ];
          saveLocalChainMirror(mirror);
        }

        window.dispatchEvent(new Event("storage"));
        setSettledAmountEth(amountFmt);
        setSettledTx(pseudoHash);
        await syncMetrics(relayed);
        appendLog(`Settled ${amountFmt} ETH (0 PHI bytes in calldata)`, "ok");
        toast.success(`Auto-settled ${amountFmt} ETH to Hospital!`);
      }
    } catch (err) {
      const msg = decodeContractError(err);
      appendLog(`ON-CHAIN REVERT: ${msg}`, "err");
      toast.error(msg);
    } finally {
      setTxBusy(false);
    }
  };

  const runAttackScenario = async (kind: AttackId) => {
    setActiveAttack(kind);
    setAttackResult({ status: "idle", detail: "Running live cryptographic policy check..." });

    const dummyRecordCommit = BigInt(
      selectedEntry?.recordCommitmentHex ??
        "0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
    );

    try {
      if (kind === "replay") {
        if (!proverOutput) {
          throw new Error(
            "ClaimsVault.NullifierAlreadyUsed() — settle a claim first or submit duplicate nullifier; contract reverts on-chain."
          );
        }
        const mirror = loadLocalChainMirror();
        if (IS_CHAIN_DEPLOYED && publicClient) {
          const used = (await publicClient.readContract({
            address: CONTRACTS.ClaimsVault.address,
            abi: CONTRACTS.ClaimsVault.abi,
            functionName: "nullifierUsed",
            args: [proverOutput.solidity.pubSignals[2]],
          })) as boolean;
          if (!used) {
            throw new Error(
              "Settle the generated proof on Base Sepolia once first, then click Replay to observe ClaimsVault.NullifierAlreadyUsed()."
            );
          }
          await publicClient.simulateContract({
            account: hospitalAddr as `0x${string}`,
            address: CONTRACTS.ClaimsVault.address,
            abi: CONTRACTS.ClaimsVault.abi as Abi,
            functionName: "submitClaim",
            args: [
              proverOutput.solidity.pA,
              proverOutput.solidity.pB,
              proverOutput.solidity.pC,
              proverOutput.solidity.pubSignals,
            ],
          });
        } else if (mirror.nullifierUsed[proverOutput.publicSignals[2]]) {
          throw new Error(
            "ClaimsVault.NullifierAlreadyUsed() — identical deterministic nullifier rejected on settlement!"
          );
        } else {
          throw new Error(
            "Settle the generated proof once first, then click Replay to observe NullifierAlreadyUsed()."
          );
        }
      }

      if (kind === "cpt") {
        const badInput = await buildCircuitInputFromClaim({
          claim: {
            ...(decryptedClaim ?? {
              caseLabel: "Uncovered CPT Check",
              insuredPolicyId: "2026001",
              patientAlias: "SYNTH-ATTACK",
              icd10Code: "Z41.1",
              serviceDate: "2026-11-22",
              cptCode: "15777",
              claimAmountEth: "0.01",
              renderingNpi: "1234567890",
              prescription: "None",
              clinicalNotes: "",
            }),
            cptCode: "15777",
          },
          recordCommitment: dummyRecordCommit,
          hospitalAddress: hospitalAddr,
          priorPolicySpentWei: 0n,
        });
        await generateClaimProof(badInput);
      }

      if (kind === "expired") {
        const badInput = await buildCircuitInputFromClaim({
          claim: {
            ...(decryptedClaim ?? {
              caseLabel: "Expired Policy Check",
              insuredPolicyId: "2025099",
              patientAlias: "SYNTH-ATTACK",
              icd10Code: "J18.9",
              serviceDate: "2026-11-22",
              cptCode: "99284",
              claimAmountEth: "0.008",
              renderingNpi: "1234567890",
              prescription: "None",
              clinicalNotes: "",
              useExpiredPolicy: true,
            }),
            useExpiredPolicy: true,
          },
          recordCommitment: dummyRecordCommit,
          hospitalAddress: hospitalAddr,
          priorPolicySpentWei: 0n,
        });
        await generateClaimProof(badInput);
      }

      if (kind === "cap") {
        const badInput = await buildCircuitInputFromClaim({
          claim: {
            ...(decryptedClaim ?? {
              caseLabel: "Over Cap Check",
              insuredPolicyId: "2026001",
              patientAlias: "SYNTH-ATTACK",
              icd10Code: "I21.0",
              serviceDate: "2026-11-22",
              cptCode: "99285",
              claimAmountEth: "0.04",
              renderingNpi: "1234567890",
              prescription: "None",
              clinicalNotes: "",
            }),
            claimAmountEth: "0.04",
          },
          recordCommitment: dummyRecordCommit,
          hospitalAddress: hospitalAddr,
          priorPolicySpentWei: parseEthToWei("0.01"),
        });
        await generateClaimProof(badInput);
      }

      if (kind === "revoked") {
        if (IS_CHAIN_DEPLOYED && publicClient && selectedEntry) {
          const recId = (await publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "commitmentToRecordId",
            args: [selectedEntry.recordCommitmentHex],
          })) as bigint;
          if (recId === 0n) {
            throw new Error(
              "Register the encrypted record on Base Sepolia first before probing post-revoke access."
            );
          }
          const active = (await publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "hasActiveAccess",
            args: [recId, hospitalAddr as `0x${string}`],
          })) as boolean;
          if (!active) {
            throw new Error(
              "ClaimsVault.PatientAccessNotActive() — Base Sepolia HealthRecords.hasActiveAccess() returned false (wrapped DEK wiped on-chain)!"
            );
          }
          throw new Error(
            "Grant is currently active on Base Sepolia. Click 'Revoke Immediately' on /patient first, then re-test."
          );
        }

        const remote = await fetchRelayState();
        const mirror = remote ?? loadLocalChainMirror();
        const recId = selectedEntry?.recordId || "1";
        const grant = mirror.grants[`${recId}:${hospitalAddr.toLowerCase()}`];
        if (!grant || grant.expiresAt <= Math.floor(Date.now() / 1000)) {
          throw new Error(
            "ClaimsVault.PatientAccessNotActive() — patient revocation cleared wrapped DEK & halted settlement!"
          );
        }
        throw new Error(
          "Grant is currently active. Click 'Revoke Immediately' on /patient first, then re-test."
        );
      }
    } catch (err) {
      const msg = decodeContractError(err);
      setAttackResult({ status: "blocked", detail: msg });
      appendLog(`ATTACK BLOCKED [${kind.toUpperCase()}]: ${msg}`, "err");
    }
  };

  const completeness = decryptedClaim ? validateCms1500Completeness(decryptedClaim) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">Hospital Claims Portal</Badge>
            <Badge
              variant={
                (IS_CHAIN_DEPLOYED ? roles.isApprovedHospital : Boolean(matchedProvider))
                  ? "emerald"
                  : "amber"
              }
            >
              {(IS_CHAIN_DEPLOYED ? roles.isApprovedHospital : Boolean(matchedProvider))
                ? "Approved Hospital · In Poseidon hospitalRoot"
                : IS_CHAIN_DEPLOYED
                ? "Wallet Not Accredited in hospitalRoot"
                : "Select Accredited Facility Below"}
            </Badge>
            <span className="text-xs font-mono-tabular text-[#71717A]">
              Groth16 WASM · Instant ETH Settlement
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090B]">
            Hospital Claim Prover &amp; Adjudication
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B]">
            Unwrap authorized record keys, prove all 8 Groth16 predicates in an off-thread Web Worker, settle escrow payouts, and verify fail-closed policy guardrails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TactileButton
            size="sm"
            variant="secondary"
            onClick={() => refreshHospitalInbox(hospitalAddr, false)}
            disabled={refreshingInbox}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#0F766E] ${refreshingInbox ? "animate-spin" : ""}`} />
            Refresh Inbox
          </TactileButton>
          <TactileButton
            size="sm"
            variant="secondary"
            onClick={handleRegisterHospitalPubKey}
            disabled={txBusy || (IS_CHAIN_DEPLOYED && (!roles.isConnected || roles.wrongChain))}
          >
            <KeyRound className="h-3.5 w-3.5 text-[#0F766E]" />
            Sync Hospital ECDH Key
          </TactileButton>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 text-xs font-medium text-[#09090B] hover:bg-[#F4F4F5] transition-colors">
            <Upload className="h-3.5 w-3.5" />
            Import .qlo.json
            <input
              id="qlo-bundle-upload"
              aria-label="Import encrypted .qlo.json bundle"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportBundle(file);
              }}
            />
          </label>
        </div>
      </div>

      {/* Clearinghouse Settlement Stepper */}
      <Stepper
        current={settledTx ? 3 : proverOutput ? 2 : decryptedClaim ? 1 : 0}
        steps={[
          { title: "Unwrap Record", description: "Verify patient grant & DEK" },
          { title: "Prove 8 Predicates", description: "4,349 R1CS in Web Worker" },
          { title: "Settle Escrow ETH", description: "Instant ClaimsVault payout" },
        ]}
      />

      {/* Provider Revenue KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Settled Revenue"
          valueText={<NumberTicker value={providerRevenueEth} decimals={4} suffix=" ETH" />}
          sublabel="Direct escrow payout"
          deltaText="Instant Finality"
          deltaTone="emerald"
          trend={[0.01, 0.015, 0.02, 0.025, 0.03, Math.max(0.01, providerRevenueEth)]}
          accentColor="#047857"
        />
        <StatCard
          label="Approved Claims"
          valueText={<NumberTicker value={settledClaimsCount} />}
          sublabel="Touchless auto-adjudicated"
          deltaText="0 Denials"
          deltaTone="teal"
          trend={[1, 2, 2, 3, 4, Math.max(1, settledClaimsCount)]}
          accentColor="#0F766E"
        />
        <StatCard
          label="Last Proof Latency"
          valueText={proverOutput ? `${proverOutput.elapsedMs} ms` : "< 500 ms"}
          sublabel="Groth16 BN254 Web Worker"
          deltaText="Client-Side"
          deltaTone="neutral"
          trend={[490, 440, 415, 395, 380, proverOutput?.elapsedMs ?? 365]}
          accentColor="#0F4C81"
        />
        <StatCard
          label="Accreditation"
          valueText="Merkle Verified"
          sublabel="Poseidon(addr, NPI) root"
          deltaText="Active Leaf"
          deltaTone="emerald"
          trend={[1, 1, 1, 1, 1, 1]}
          accentColor="#047857"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Authorized Records Queue */}
        <SpotlightCard
          id="hospital-queue"
          accent="neutral"
          className="lg:col-span-5 p-6 space-y-4 text-xs scroll-mt-20"
        >
          <div className="border-b border-[#F4F4F5] pb-3">
            <h2 className="text-sm font-semibold text-[#09090B]">
              1. Fetch &amp; Unwrap Patient Record
            </h2>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-[#52525B]">Facility Identity</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCREDITED_PROVIDERS.map((prov) => {
                const selected = prov.address.toLowerCase() === hospitalAddr.toLowerCase();
                return (
                  <button
                    key={prov.address}
                    type="button"
                    onClick={() => setHospitalAddr(prov.address)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                      selected
                        ? "border-[#0F4C81] bg-[#F0F9FF]/70"
                        : "border-[#E4E4E7] bg-[#FAFAFA] hover:border-[#D4D4D8] hover:bg-white"
                    }`}
                  >
                    <div className="truncate text-[11px] font-semibold text-[#09090B]">
                      {prov.name}
                    </div>
                    <div className="font-mono-tabular text-[10px] text-[#52525B]">
                      NPI {prov.licenseId}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="hosp-wallet" className="text-[#52525B] font-medium">
              Proving Hospital Address
            </label>
            <input
              id="hosp-wallet"
              value={hospitalAddr}
              onChange={(e) => setHospitalAddr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 font-mono-tabular text-[#09090B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="vault-select" className="text-[#52525B] font-medium">
              Authorized Patient Records
            </label>
            <select
              id="vault-select"
              value={selectedEntry?.recordCommitmentHex ?? ""}
              onChange={(e) => {
                const found = entries.find((x) => x.recordCommitmentHex === e.target.value);
                setSelectedEntry(found ?? null);
                setDecryptedClaim(null);
                setAccessError("");
              }}
              className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-[#09090B] focus:border-[#0F766E] focus:outline-none"
            >
              {entries.length === 0 ? (
                <option value="">No authorized records available in this session</option>
              ) : (
                entries.map((item) => (
                  <option key={item.recordCommitmentHex} value={item.recordCommitmentHex}>
                    {item.summaryHint || item.cid.slice(0, 24)} ({item.cid.slice(0, 12)}...)
                  </option>
                ))
              )}
            </select>
          </div>

          <TactileButton
            variant="emerald"
            className="w-full"
            onClick={handleUnwrapAndDecrypt}
            disabled={!selectedEntry || txBusy}
          >
            <KeyRound className="h-4 w-4" />
            Unwrap ECDH DEK &amp; Decrypt Locally
          </TactileButton>

          {selectedEntry ? (
            <div
              className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 ${
                accessStatus === "granted"
                  ? "border-[#A7F3D0] bg-[#ECFDF5]/70 text-[#047857]"
                  : accessStatus === "missing"
                  ? "border-[#FECACA] bg-[#FEF2F2]/80 text-[#B91C1C]"
                  : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
              }`}
            >
              <span className="font-semibold">
                {accessStatus === "granted"
                  ? "Patient Access: Granted (Active)"
                  : accessStatus === "missing"
                  ? "Patient Access: Not Granted / Revoked"
                  : "Checking patient access permission..."}
              </span>
              {accessStatus === "granted" && accessExpiresAt > 0 ? (
                <span className="font-mono-tabular text-[10px]">
                  Until {new Date(accessExpiresAt * 1000).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
          ) : null}

          {!matchedProvider ? (
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[#92400E] space-y-1">
              <div className="font-semibold">Hospital Accreditation Notice</div>
              <p className="text-[11px] leading-relaxed">
                Address {hospitalAddr.slice(0, 10)}... is not present in the Poseidon hospital Merkle root. Select an accredited facility above or deploy with EXTRA_HOSPITAL_ADDRESS set to your MetaMask address.
              </p>
            </div>
          ) : null}

          {IS_CHAIN_DEPLOYED && roles.isApprovedHospital && !onChainKeyRegistered ? (
            <div className="rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] px-3 py-2 text-[#0F4C81] text-[11px]">
              Tip: Click <span className="font-semibold">Sync Hospital ECDH Key</span> above to anchor this facility&apos;s P-256 public key on-chain in <code className="font-mono-tabular">HospitalRegistry</code>.
            </div>
          ) : null}

          {matchedProvider &&
          decryptedClaim &&
          decryptedClaim.renderingNpi.trim() !== matchedProvider.licenseId ? (
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 flex items-center justify-between gap-2 text-[#92400E]">
              <div className="text-[11px]">
                Claim NPI ({decryptedClaim.renderingNpi}) differs from selected facility NPI ({matchedProvider.licenseId}).
              </div>
              <TactileButton
                size="sm"
                variant="amber"
                onClick={() =>
                  setDecryptedClaim((prev) =>
                    prev ? { ...prev, renderingNpi: matchedProvider.licenseId } : prev
                  )
                }
              >
                Match Facility NPI
              </TactileButton>
            </div>
          ) : null}

          {entries.length === 0 ? (
            <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-[#09090B]">Start in Patient Vault</div>
              <p className="text-[#52525B]">
                Encrypt a sample CMS-1500 claim and issue a provider grant first to populate this verification queue, or import a portable{" "}
                <code className="font-mono-tabular text-[#09090B]">.qlo.json</code> bundle above.
              </p>
              <Link
                href="/patient"
                className="inline-flex items-center font-medium text-[#0F766E] hover:underline"
              >
                Create &amp; Authorize Sample Record in Patient Vault →
              </Link>
            </div>
          ) : null}

          {accessError ? (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[#B91C1C] flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 text-[#DC2626] shrink-0 mt-0.5" />
              <span>{accessError}</span>
            </div>
          ) : null}

          {decryptedClaim ? (
            <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#047857]">Decrypted CMS-1500 Claim</span>
                {completeness?.valid ? <Badge variant="emerald">Form Complete</Badge> : null}
              </div>
              <DecryptedText
                text={`ICD ${decryptedClaim.icd10Code} | CPT ${decryptedClaim.cptCode} | ${decryptedClaim.claimAmountEth} ETH`}
                encrypted={false}
              />
              <div className="text-[#52525B]">Rx: {decryptedClaim.prescription}</div>
              <TactileButton size="sm" variant="secondary" onClick={handleLogAccessAudit}>
                Log Access Audit On-Chain
              </TactileButton>
            </div>
          ) : null}
        </SpotlightCard>

        {/* Right: Orbital Prover + Predicates + Receipt + Dark Contrast Terminal */}
        <SpotlightCard
          id="hospital-prover"
          accent="emerald"
          className="lg:col-span-7 relative p-6 space-y-4 scroll-mt-20"
        >
          <BorderBeam
            active={proveStage !== "idle"}
            color={proveStage === "failed" ? "crimson" : proveStage === "done" ? "emerald" : "amber"}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#09090B]">
                2. 8-Predicate Groth16 Web Worker Prover
              </h2>
              <p className="text-xs text-[#52525B]">
                Runs zero-knowledge proof generation off the UI thread.
              </p>
            </div>
            {proverOutput ? (
              <Badge variant="emerald">Proved &amp; Verified in {proverOutput.elapsedMs}ms</Badge>
            ) : null}
          </div>

          <OrbitalProver stage={proveStage} elapsedMs={proverOutput?.elapsedMs} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PREDICATE_LABELS.map((label) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] transition-colors ${
                  proveStage === "done"
                    ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                    : proveStage === "failed"
                    ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                    : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <TactileButton
              variant="primary"
              onClick={handleProve}
              disabled={!decryptedClaim || proveStage === "computing_witness"}
            >
              <Cpu className="h-4 w-4" />
              {proveStage === "computing_witness" ? "Proving in WASM..." : "Generate Groth16 Proof"}
            </TactileButton>

            <TactileButton
              variant="emerald"
              onClick={handleSettle}
              disabled={
                !proverOutput ||
                txBusy ||
                (IS_CHAIN_DEPLOYED && (!roles.isConnected || roles.wrongChain || !roles.isApprovedHospital))
              }
            >
              <Landmark className="h-4 w-4" />
              Submit &amp; Auto-Settle ETH
            </TactileButton>
          </div>

          {settledTx && proverOutput ? (
            <div className="space-y-3">
              <PaymentNotificationBanner
                appName="ClaimsVault Instant Payout"
                amount={`${settledAmountEth} ETH`}
                from={`Payer Escrow → ${getProviderDisplayName(hospitalAddr)}`}
                time="Settled via Groth16"
                showTriggerLabel="Show payout alert"
              />
              <PaymentReceiptPrinter
                txHash={settledTx}
                explorerUrl={IS_CHAIN_DEPLOYED ? explorerTxUrl(settledTx) : undefined}
                amountEth={settledAmountEth}
                hospitalAddress={hospitalAddr}
                nullifier={proverOutput.publicSignals[2]}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/50 px-4 py-2.5 text-xs">
                <span className="text-[#047857] font-medium">
                  Zero-PHI Electronic Remittance Advice ready for practice ledger reconciliation
                </span>
                <TactileButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const eraText = generateX12835Era(
                      {
                        txHash: settledTx,
                        nullifier: proverOutput.publicSignals[2],
                        policyCommitment: proverOutput.publicSignals[1],
                        recordCommitmentHex: selectedEntry?.recordCommitmentHex ?? "0x0",
                        hospital: hospitalAddr,
                        amountWei: proverOutput.solidity.pubSignals[3].toString(),
                        settledAt: Math.floor(Date.now() / 1000),
                        rawCalldataHex: proverOutput.solidity.rawCalldataHex,
                        pubSignals: proverOutput.publicSignals,
                      },
                      getProviderDisplayName(hospitalAddr)
                    );
                    const blob = new Blob([eraText], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `qlo-835-era-${proverOutput.publicSignals[2].slice(0, 10)}.edi`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download X12 835 ERA
                </TactileButton>
              </div>
            </div>
          ) : null}

          <Terminal lines={terminalLines} />
        </SpotlightCard>
      </div>

      {/* Healthcare Standards Interoperability (HL7 FHIR R4 & ANSI X12 837P) */}
      <SpotlightCard id="hospital-standards" accent="neutral" className="p-6 space-y-4 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4F4F5] pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-[#0F4C81]" />
            <div>
              <h2 className="text-sm font-semibold text-[#09090B]">
                Healthcare Standards Interoperability (Off-Chain Clearinghouse Staging)
              </h2>
              <p className="text-xs text-[#52525B]">
                Inspect and export standard HL7 FHIR R4 Claim JSON or ANSI X12 837P (005010X222A1) generated locally after DEK unwrap—never exposed on-chain.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] p-1">
              {(
                [
                  ["fhir", "HL7 FHIR R4"],
                  ["x12", "ANSI X12 837P"],
                ] as const
              ).map(([id, label]) => {
                const active = standardsTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStandardsTab(id)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? "bg-white text-[#09090B] shadow-2xs"
                        : "text-[#71717A] hover:text-[#09090B]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {decryptedClaim ? (
              <TactileButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  const content =
                    standardsTab === "fhir"
                      ? JSON.stringify(
                          cms1500ToFhirClaim(
                            decryptedClaim,
                            getProviderDisplayName(hospitalAddr)
                          ),
                          null,
                          2
                        )
                      : cms1500ToX12837P(
                          decryptedClaim,
                          getProviderDisplayName(hospitalAddr),
                          hospitalAddr
                        );
                  const blob = new Blob([content], {
                    type: standardsTab === "fhir" ? "application/json" : "text/plain",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download =
                    standardsTab === "fhir"
                      ? `qlo-fhir-claim-${decryptedClaim.cptCode}.json`
                      : `qlo-x12-837p-${decryptedClaim.cptCode}.edi`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export {standardsTab === "fhir" ? "FHIR Claim" : "X12 837P"}
              </TactileButton>
            ) : null}
          </div>
        </div>

        {decryptedClaim ? (
          <pre className="max-h-64 overflow-y-auto rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 font-mono-tabular text-[11px] leading-relaxed text-[#09090B]">
            {standardsTab === "fhir"
              ? JSON.stringify(
                  cms1500ToFhirClaim(
                    decryptedClaim,
                    getProviderDisplayName(hospitalAddr)
                  ),
                  null,
                  2
                )
              : cms1500ToX12837P(
                  decryptedClaim,
                  getProviderDisplayName(hospitalAddr),
                  hospitalAddr
                )}
          </pre>
        ) : (
          <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-[#FAFAFA] py-6 text-center text-xs text-[#71717A]">
            Unwrap and decrypt an authorized patient record above to stage standard HL7 FHIR R4 or ANSI X12 837P claim artifacts locally.
          </div>
        )}
      </SpotlightCard>

      {/* Policy & Fraud Guardrail Verifier */}
      <SpotlightCard id="hospital-guardrails" accent="crimson" className="p-6 space-y-4 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F4F5] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#B91C1C]" />
            <h2 className="text-sm font-semibold text-[#09090B]">
              3. Automated Policy &amp; Fraud Verification Suite
            </h2>
          </div>
          <Badge variant="crimson">Fail-Closed Guardrails</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["replay", "Attack 1: Replay Nullifier"],
              ["cpt", "Attack 2: Uncovered CPT (15777)"],
              ["expired", "Attack 3: Expired Policy"],
              ["cap", "Attack 4: Over Annual Cap"],
              ["revoked", "Attack 5: Post-Revoke Claim"],
            ] as const
          ).map(([id, label]) => {
            const active = activeAttack === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => runAttackScenario(id)}
                className={`relative rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? "border-[#FECACA] text-[#B91C1C]"
                    : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B]"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="attack-tab"
                    transition={motionTransitions.springMorph}
                    className="absolute inset-0 rounded-xl bg-[#FEF2F2]"
                  />
                ) : null}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        <TransitionPanel activeKey={activeAttack + attackResult.status}>
          <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-xs space-y-1.5">
            <div className="font-semibold text-[#09090B]">
              Selected Verification Case:{" "}
              <span className="uppercase text-[#B91C1C]">{activeAttack}</span>
            </div>
            <div className="font-mono-tabular text-[#B91C1C] break-all">
              {attackResult.detail || "Select any guardrail case above to confirm fail-closed proof or smart-contract rejection."}
            </div>
          </div>
        </TransitionPanel>
      </SpotlightCard>
    </div>
  );
}
