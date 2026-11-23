"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import canonicalFixtures from "./canonicalFixtures.json";
import { fetchOnChainVaultSnapshot } from "./chainEvents";
import { CONTRACTS, DEPLOYMENT, IS_CHAIN_DEPLOYED } from "./contracts";
import { decodeContractError } from "./txHelpers";
import { formatWeiToEth } from "./utils";

export interface MatchedHospitalInfo {
  address: string;
  licenseId: string;
  name: string;
}

export interface WalletRolesState {
  mounted: boolean;
  address: `0x${string}` | undefined;
  isConnected: boolean;
  chainId: number;
  wrongChain: boolean;
  loadingRoles: boolean;
  isPatient: boolean;
  isApprovedHospital: boolean;
  isInsurer: boolean;
  matchedHospital: MatchedHospitalInfo | null;
  hospitalPubKeyOnChain: string;
  patientRecordCount: number;
  insurerEscrowWei: bigint;
  ownInsurerEscrowWei: bigint;
  totalClaimsSettled: number;
  totalPayoutWei: bigint;
  policySpentWei: bigint;
  vaultPaused: boolean;
  onChainHospitalRoot: bigint | null;
  rootMatchesFixtures: boolean;
  balanceWei: bigint | null;
  balanceEth: string | null;
  lowGasBalance: boolean;
  switchToBaseSepolia: () => Promise<void>;
  refetch: () => Promise<void>;
}

export async function connectInjectedWallet<TConnector>(
  connectors: readonly TConnector[],
  connectFn: (vars: { connector: TConnector }) => Promise<unknown> | void
): Promise<void> {
  const win =
    typeof window !== "undefined" ? (window as { ethereum?: unknown }) : undefined;
  if (!win?.ethereum) {
    toast.error("No browser wallet detected. Install MetaMask or continue in Sandbox mode.");
    return;
  }
  const connector = connectors[0];
  if (!connector) {
    toast.error("Wallet connector unavailable. Refresh after unlocking MetaMask.");
    return;
  }
  try {
    await Promise.resolve(connectFn({ connector }));
  } catch (err) {
    toast.error(decodeContractError(err));
  }
}

export function useWalletRoles(): WalletRolesState {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = walletChainId ?? configChainId;
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveConnected = Boolean(mounted && isConnected && address);
  const wrongChain = effectiveConnected && chainId !== baseSepolia.id;

  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address,
    chainId: baseSepolia.id,
    query: {
      enabled: effectiveConnected,
    },
  });

  const [loadingRoles, setLoadingRoles] = useState(false);
  const [hospitalPubKeyOnChain, setHospitalPubKeyOnChain] = useState("");
  const [patientRecordCount, setPatientRecordCount] = useState(0);
  const [insurerEscrowWei, setInsurerEscrowWei] = useState(0n);
  const [ownInsurerEscrowWei, setOwnInsurerEscrowWei] = useState(0n);
  const [totalClaimsSettled, setTotalClaimsSettled] = useState(0);
  const [totalPayoutWei, setTotalPayoutWei] = useState(0n);
  const [policySpentWei, setPolicySpentWei] = useState(0n);
  const [vaultPaused, setVaultPaused] = useState(false);
  const [onChainHospitalRoot, setOnChainHospitalRoot] = useState<bigint | null>(null);
  const [isOwnerOrSeededInsurer, setIsOwnerOrSeededInsurer] = useState(false);
  const [insurerPolicyCount, setInsurerPolicyCount] = useState(0);

  const matchedHospital: MatchedHospitalInfo | null = address
    ? canonicalFixtures.hospitals.find(
        (h) => h.address.toLowerCase() === address.toLowerCase()
      ) ?? null
    : null;

  const refetch = useCallback(async () => {
    if (!IS_CHAIN_DEPLOYED || !publicClient) {
      setHospitalPubKeyOnChain("");
      setPatientRecordCount(0);
      setOwnInsurerEscrowWei(0n);
      setIsOwnerOrSeededInsurer(false);
      setInsurerPolicyCount(0);
      setOnChainHospitalRoot(null);
      return;
    }

    setLoadingRoles(true);
    try {
      const zeroAddr = "0x0000000000000000000000000000000000000000";
      const seeded =
        (DEPLOYMENT as { seededInsurer?: string }).seededInsurer &&
        (DEPLOYMENT as { seededInsurer?: string }).seededInsurer !== zeroAddr
          ? ((DEPLOYMENT as { seededInsurer?: string }).seededInsurer as `0x${string}`)
          : (canonicalFixtures.accounts.insurer as `0x${string}`);
      const targetInsurer = (address || seeded) as `0x${string}`;

      const snapPromise = fetchOnChainVaultSnapshot(publicClient, targetInsurer);

      if (!address) {
        const snap = await snapPromise;
        setInsurerEscrowWei(snap.insurerEscrowWei ?? 0n);
        setTotalClaimsSettled(snap.totalClaimsSettled ?? 0);
        setTotalPayoutWei(snap.totalPayoutWei ?? 0n);
        setPolicySpentWei(snap.policySpentWei ?? 0n);
        setVaultPaused(Boolean(snap.paused));
        setOnChainHospitalRoot(snap.hospitalRoot);
        setHospitalPubKeyOnChain("");
        setPatientRecordCount(0);
        setOwnInsurerEscrowWei(0n);
        setIsOwnerOrSeededInsurer(false);
        setInsurerPolicyCount(0);
        return;
      }

      const [snap, pubKeyRes, patRecIdsRes, ownerRes, polIdsRes] =
        await Promise.allSettled([
          snapPromise,
          publicClient.readContract({
            address: CONTRACTS.HospitalRegistry.address,
            abi: CONTRACTS.HospitalRegistry.abi,
            functionName: "hospitalEncryptionPubKey",
            args: [address],
          }),
          publicClient.readContract({
            address: CONTRACTS.HealthRecords.address,
            abi: CONTRACTS.HealthRecords.abi,
            functionName: "getRecordIdsByPatient",
            args: [address],
          }),
          publicClient.readContract({
            address: CONTRACTS.ClaimsVault.address,
            abi: CONTRACTS.ClaimsVault.abi,
            functionName: "owner",
          }),
          publicClient.readContract({
            address: CONTRACTS.PolicyRegistry.address,
            abi: CONTRACTS.PolicyRegistry.abi,
            functionName: "getPoliciesByInsurer",
            args: [address],
          }),
        ]);

      if (snap.status === "fulfilled") {
        const s = snap.value;
        setInsurerEscrowWei(s.insurerEscrowWei ?? 0n);
        setOwnInsurerEscrowWei(s.insurerEscrowWei ?? 0n);
        setTotalClaimsSettled(s.totalClaimsSettled ?? 0);
        setTotalPayoutWei(s.totalPayoutWei ?? 0n);
        setPolicySpentWei(s.policySpentWei ?? 0n);
        setVaultPaused(Boolean(s.paused));
        setOnChainHospitalRoot(s.hospitalRoot);
      }

      if (pubKeyRes.status === "fulfilled") {
        const hex = String(pubKeyRes.value ?? "");
        setHospitalPubKeyOnChain(hex.length >= 132 ? hex : "");
      } else {
        setHospitalPubKeyOnChain("");
      }

      if (patRecIdsRes.status === "fulfilled" && Array.isArray(patRecIdsRes.value)) {
        setPatientRecordCount(patRecIdsRes.value.length);
      } else {
        setPatientRecordCount(0);
      }

      const ownerAddr =
        ownerRes.status === "fulfilled" ? String(ownerRes.value).toLowerCase() : "";
      const seededLower = seeded.toLowerCase();
      setIsOwnerOrSeededInsurer(
        address.toLowerCase() === ownerAddr || address.toLowerCase() === seededLower
      );

      if (polIdsRes.status === "fulfilled" && Array.isArray(polIdsRes.value)) {
        setInsurerPolicyCount(polIdsRes.value.length);
      } else {
        setInsurerPolicyCount(0);
      }
    } finally {
      setLoadingRoles(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (!mounted) return;
    refetch().catch(() => undefined);
    refetchBalance().catch(() => undefined);
  }, [mounted, refetch, refetchBalance]);

  const rootMatchesFixtures = !IS_CHAIN_DEPLOYED
    ? true
    : onChainHospitalRoot !== null &&
      onChainHospitalRoot === BigInt(canonicalFixtures.hospitalRoot);

  const isPatient = effectiveConnected;
  const isApprovedHospital = Boolean(
    effectiveConnected && matchedHospital && rootMatchesFixtures
  );
  const isInsurer = Boolean(
    effectiveConnected &&
      (IS_CHAIN_DEPLOYED
        ? isOwnerOrSeededInsurer || ownInsurerEscrowWei > 0n || insurerPolicyCount > 0
        : address!.toLowerCase() === canonicalFixtures.accounts.insurer.toLowerCase() ||
          address!.toLowerCase() === canonicalFixtures.accounts.deployer.toLowerCase())
  );

  const balanceWei = effectiveConnected && balanceData ? balanceData.value : null;
  const balanceEth = balanceWei !== null ? formatWeiToEth(balanceWei, 4) : null;
  const lowGasBalance = Boolean(
    IS_CHAIN_DEPLOYED &&
      effectiveConnected &&
      !wrongChain &&
      balanceWei !== null &&
      balanceWei < 2_000_000_000_000_000n
  );

  const switchToBaseSepolia = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: baseSepolia.id });
      await Promise.all([refetch(), refetchBalance()]);
      toast.success("Switched wallet network to Base Sepolia (84532)");
    } catch (err) {
      toast.error(decodeContractError(err));
    }
  }, [switchChainAsync, refetch, refetchBalance]);

  return {
    mounted,
    address,
    isConnected: effectiveConnected,
    chainId,
    wrongChain,
    loadingRoles,
    isPatient,
    isApprovedHospital,
    isInsurer,
    matchedHospital,
    hospitalPubKeyOnChain,
    patientRecordCount,
    insurerEscrowWei,
    ownInsurerEscrowWei,
    totalClaimsSettled,
    totalPayoutWei,
    policySpentWei,
    vaultPaused,
    onChainHospitalRoot,
    rootMatchesFixtures,
    balanceWei,
    balanceEth,
    lowGasBalance,
    switchToBaseSepolia,
    refetch,
  };
}
