"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { EnterpriseVerificationDock } from "@/components/hospital/enterprise-verification-dock";
import { HospitalOverviewHeader } from "@/components/hospital/hospital-overview-header";
import { HospitalProverCard } from "@/components/hospital/hospital-prover-card";
import { HospitalRecordQueueCard } from "@/components/hospital/hospital-record-queue-card";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { CONTRACTS, IS_CHAIN_DEPLOYED, explorerTxUrl } from "@/lib/contracts";
import {
  decryptClinicalPayload,
  getOrCreateHospitalKeypair,
  unwrapDekForHospital,
} from "@/lib/crypto";
import {
  executeHospitalGuardrailCheck,
  type AttackId,
} from "@/lib/hospitalGuardrails";
import { validateCms1500Completeness, type Cms1500Claim } from "@/lib/intake";
import { loadLocalChainMirror, saveLocalChainMirror } from "@/lib/localState";
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
  ensureSepoliaChain,
  preflightSimulateAndWrite,
} from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";
import { formatWeiToEth, parseEthToWei } from "@/lib/utils";

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

      if (forceSyncKey || remoteMirror?.hospitalPubKeys?.[targetAddr.toLowerCase()] !== kp.publicKeyHex) {
        await postRelayAction({
          action: "publishPubKey",
          hospitalAddress: targetAddr,
          publicKeyHex: kp.publicKeyHex,
          force: true,
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
        if (prev && mergedList[0] && mergedList[0].createdAt > prev.createdAt) {
          return mergedList[0];
        }
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
          if (recId > 0n) {
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
          }
        } catch {
          // Fall through to relay check when record is off-chain
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
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
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
        appendLog(`Registered ECDH pubkey on Ethereum Sepolia: ${hash}`, "ok");
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
        try {
          const recId = (await publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "commitmentToRecordId",
            args: [selectedEntry.recordCommitmentHex],
          })) as bigint;
          if (recId > 0n) {
            recIdStr = recId.toString();
            const [expiresAt, dekBytes] = (await publicClient.readContract({
              address: CONTRACTS.HealthRecords.address,
              abi: CONTRACTS.HealthRecords.abi,
              functionName: "getGrant",
              args: [recId, hospitalAddr as `0x${string}`],
            })) as [bigint, `0x${string}`];
            if (expiresAt === 0n || !dekBytes || dekBytes === "0x") {
              throw new Error(
                "ACCESS DENIED: Patient grant missing, expired, or revoked on-chain."
              );
            }
            encryptedDekHex = dekBytes;
          }
        } catch (chainErr) {
          if (chainErr instanceof Error && chainErr.message.startsWith("ACCESS DENIED")) {
            throw chainErr;
          }
        }
      }
      if (!encryptedDekHex) {
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
      if (IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
        const recId = (await publicClient.readContract({
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi,
          functionName: "commitmentToRecordId",
          args: [selectedEntry.recordCommitmentHex],
        })) as bigint;
        if (recId === 0n) throw new Error("Record not registered on Ethereum Sepolia");
        const { hash } = await preflightSimulateAndWrite({
          publicClient,
          account: address,
          address: CONTRACTS.HealthRecords.address,
          abi: CONTRACTS.HealthRecords.abi as Abi,
          functionName: "logAccess",
          args: [recId],
          writeContractAsync,
        });
        appendLog(`Logged RecordAccessed(${recId.toString()}) on Ethereum Sepolia: ${hash}`, "ok");
        toast.success("Logged immutable RecordAccessed audit event on Ethereum Sepolia");
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
      if (IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain) {
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
            `Synced live Ethereum Sepolia block clock (${latestBlock.timestamp.toString()}) & root`,
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
      if (IS_CHAIN_DEPLOYED && address && publicClient && !roles.wrongChain) {
        await ensureSepoliaChain(roles.chainId, switchChainAsync);
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
        appendLog(`Ethereum Sepolia Tx Settled: ${hash}`, "ok");
        toast.success("Claim settled on Ethereum Sepolia — ETH transferred to Hospital!");
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
    try {
      await executeHospitalGuardrailCheck({
        kind,
        hospitalAddr,
        selectedEntry,
        decryptedClaim,
        proverOutput,
        publicClient,
      });
    } catch (err) {
      const msg = decodeContractError(err);
      setAttackResult({ status: "blocked", detail: msg });
      appendLog(`ATTACK BLOCKED [${kind.toUpperCase()}]: ${msg}`, "err");
    }
  };

  const completeness = decryptedClaim ? validateCms1500Completeness(decryptedClaim) : null;

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
        hasDecrypted={Boolean(decryptedClaim)}
        hasProved={Boolean(proverOutput)}
        hasSettled={Boolean(settledTx)}
        onRefreshInbox={() => refreshHospitalInbox(hospitalAddr, false)}
        onRegisterHospitalPubKey={handleRegisterHospitalPubKey}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <HospitalRecordQueueCard
          hospitalAddr={hospitalAddr}
          onChangeHospitalAddr={setHospitalAddr}
          entries={entries}
          selectedEntry={selectedEntry}
          onSelectEntry={(found) => {
            setSelectedEntry(found);
            setDecryptedClaim(null);
            setAccessError("");
          }}
          onUnwrapAndDecrypt={handleUnwrapAndDecrypt}
          txBusy={txBusy}
          accessStatus={accessStatus}
          accessExpiresAt={accessExpiresAt}
          matchedProvider={matchedProvider}
          decryptedClaim={decryptedClaim}
          onMatchFacilityNpi={(npi) =>
            setDecryptedClaim((prev) => (prev ? { ...prev, renderingNpi: npi } : prev))
          }
          completenessValid={Boolean(completeness?.valid)}
          accessError={accessError}
          onLogAccessAudit={handleLogAccessAudit}
          onImportBundle={handleImportBundle}
        />

        <HospitalProverCard
          proveStage={proveStage}
          proverOutput={proverOutput}
          decryptedClaim={decryptedClaim}
          hospitalAddr={hospitalAddr}
          txBusy={txBusy}
          chainSettleBlocked={roles.wrongChain}
          onProve={handleProve}
          onSettle={handleSettle}
          settledTx={settledTx}
          settledAmountEth={settledAmountEth}
          terminalLines={terminalLines}
        />
      </div>

      <EnterpriseVerificationDock
        activeAttack={activeAttack}
        attackResult={attackResult}
        onRunScenario={runAttackScenario}
        standardsTab={standardsTab}
        onChangeStandardsTab={setStandardsTab}
        decryptedClaim={decryptedClaim}
        hospitalAddr={hospitalAddr}
      />
    </div>
  );
}
