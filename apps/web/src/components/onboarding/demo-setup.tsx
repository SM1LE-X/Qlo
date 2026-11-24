"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { parseEther, type Abi } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import canonicalFixtures from "@/lib/canonicalFixtures.json";
import { CONTRACTS, explorerTxUrl } from "@/lib/contracts";
import { mergedHospitals, type HospitalEntry } from "@/lib/demoRegistry";
import { buildPoseidonMerkleTree, computeHospitalLeaf, computePolicyCommitment } from "@/lib/merkle";
import { postRelayAction } from "@/lib/relayClient";
import { decodeContractError, ensureSepoliaChain, preflightSimulateAndWrite } from "@/lib/txHelpers";
import { useWalletRoles } from "@/lib/useWalletRoles";

const BTN =
  "inline-flex items-center justify-center rounded-lg bg-[#09090B] px-3.5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer";
const INPUT =
  "w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 font-mono text-xs text-[#09090B] outline-none focus:border-[#09090B]";

function randomDigits(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return (Array.from(bytes, (b) => String(b % 10)).join("").replace(/^0+/, "") || "1").slice(0, n);
}

/**
 * Demo onboarding for 3 independent wallets:
 *  - Owner wallet accredits ANY hospital wallet (updates on-chain Poseidon hospitalRoot).
 *  - ANY wallet becomes an insurer (registers its own policy + funds escrow).
 * Patients need no setup.
 */
export function DemoSetup() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const roles = useWalletRoles();
  const [hospAddr, setHospAddr] = useState("");
  const [hospName, setHospName] = useState("City General Hospital");
  const [escrowEth, setEscrowEth] = useState("0.03");
  const [busy, setBusy] = useState<string | null>(null);

  const [owner, setOwner] = useState<string>("");
  useEffect(() => {
    if (!publicClient) return;
    publicClient
      .readContract({ address: CONTRACTS.HospitalRegistry.address, abi: CONTRACTS.HospitalRegistry.abi as Abi, functionName: "owner" })
      .then((o) => setOwner(String(o)))
      .catch(() => undefined);
  }, [publicClient]);
  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());

  const run = async (label: string, fn: () => Promise<void>) => {
    if (!address || !publicClient) return toast.error("Connect a wallet first.");
    setBusy(label);
    try {
      await ensureSepoliaChain(roles.chainId, switchChainAsync);
      await fn();
    } catch (err) {
      toast.error(decodeContractError(err));
    } finally {
      setBusy(null);
    }
  };

  const accreditHospital = () =>
    run("accredit", async () => {
      const target = hospAddr.trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(target)) throw new Error("Paste a valid hospital wallet address.");
      const res = await fetch("/api/relay/state", { cache: "no-store" });
      const st = res.ok ? ((await res.json()) as { demoHospitals?: HospitalEntry[] }) : {};
      const licenseId = `15${randomDigits(8)}`;
      const list = mergedHospitals([...(st.demoHospitals ?? []), { address: target.toLowerCase(), licenseId, name: hospName }]);
      if (list.length > 64) throw new Error("Hospital registry is full (64).");
      const existing = mergedHospitals(st.demoHospitals).find((h) => h.address.toLowerCase() === target.toLowerCase());
      if (existing) throw new Error(`${existing.name} is already accredited.`);
      const tree = await buildPoseidonMerkleTree(await Promise.all(list.map((h) => computeHospitalLeaf(h.address, h.licenseId))));
      const { hash } = await preflightSimulateAndWrite({
        publicClient: publicClient!,
        account: address!,
        address: CONTRACTS.HospitalRegistry.address,
        abi: CONTRACTS.HospitalRegistry.abi as Abi,
        functionName: "updateHospitalRoot",
        args: [tree.root],
        writeContractAsync,
      });
      // Only publish after the root is mined, so the shared list always matches the chain.
      await postRelayAction({ action: "accreditHospital", address: target, licenseId, name: hospName });
      toast.success(`${hospName} accredited on-chain.`, {
        action: { label: "View tx", onClick: () => window.open(explorerTxUrl(hash), "_blank") },
      });
      setHospAddr("");
    });

  const becomeInsurer = () =>
    run("insurer", async () => {
      const base = canonicalFixtures.activePolicy;
      const cptTree = await buildPoseidonMerkleTree(canonicalFixtures.coveredCpts);
      const policy = {
        insurer: address!,
        policyId: base.policyId,
        patientCommit: base.patientCommit,
        policyExpiry: base.policyExpiry,
        annualLimitWei: base.annualLimitWei,
        policySalt: randomDigits(28),
      };
      const commitment = await computePolicyCommitment({
        policyId: policy.policyId,
        patientCommit: policy.patientCommit,
        policyExpiry: policy.policyExpiry,
        annualLimit: policy.annualLimitWei,
        coveredCptRoot: cptTree.root,
        policySalt: policy.policySalt,
      });
      toast.message("Step 1 of 2 — create your policy");
      await preflightSimulateAndWrite({
        publicClient: publicClient!,
        account: address!,
        address: CONTRACTS.PolicyRegistry.address,
        abi: CONTRACTS.PolicyRegistry.abi as Abi,
        functionName: "registerPolicy",
        args: [commitment],
        writeContractAsync,
      });
      await postRelayAction({ action: "setDemoPolicy", policy: { ...policy, commitment: commitment.toString() } });
      toast.message("Step 2 of 2 — fund claim escrow");
      const { hash } = await preflightSimulateAndWrite({
        publicClient: publicClient!,
        account: address!,
        address: CONTRACTS.ClaimsVault.address,
        abi: CONTRACTS.ClaimsVault.abi as Abi,
        functionName: "depositEscrow",
        value: parseEther(escrowEth || "0.03"),
        writeContractAsync,
      });
      toast.success("You're the active insurer. New claims pay from your escrow.", {
        action: { label: "View tx", onClick: () => window.open(explorerTxUrl(hash), "_blank") },
      });
    });

  return (
    <details className="group mt-4 rounded-2xl border border-[#E4E4E7] bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[#09090B]">
        Organization setup
        <span className="text-xs font-normal text-[#71717A] group-open:hidden">For admins · approve hospitals, onboard insurers</span>
      </summary>
      <div className="mt-4 space-y-3">

      <div className="rounded-xl border border-[#E4E4E7] p-3.5">
        <div className="text-xs font-semibold text-[#09090B]">Hospital — approve a wallet</div>
        <p className="mt-0.5 text-[11px] text-[#71717A]">
          Signed by the registry owner {isOwner ? "(that's you ✓)" : `(${owner ? owner.slice(0, 6) + "…" + owner.slice(-4) : "loading…"})`}. Then
          switch to the hospital wallet and tap “Enable this device”.
        </p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className={INPUT} placeholder="Hospital wallet 0x…" value={hospAddr} onChange={(e) => setHospAddr(e.target.value)} />
          <input className={INPUT} placeholder="Hospital name" value={hospName} onChange={(e) => setHospName(e.target.value)} />
        </div>
        <button className={`${BTN} mt-2.5`} disabled={!isOwner || busy !== null} onClick={accreditHospital}>
          {busy === "accredit" ? "Approving…" : isOwner ? "Approve hospital" : "Switch to owner wallet to approve"}
        </button>
      </div>

      <div className="rounded-xl border border-[#E4E4E7] p-3.5">
        <div className="text-xs font-semibold text-[#09090B]">Insurer — become the payer</div>
        <p className="mt-0.5 text-[11px] text-[#71717A]">
          From the insurer wallet: creates your policy and funds escrow (2 signatures).
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <input className={`${INPUT} max-w-[110px]`} value={escrowEth} onChange={(e) => setEscrowEth(e.target.value)} aria-label="Escrow ETH" />
          <span className="text-xs text-[#71717A]">ETH escrow</span>
          <button className={BTN} disabled={!address || busy !== null} onClick={becomeInsurer}>
            {busy === "insurer" ? "Setting up…" : "Create policy & fund"}
          </button>
        </div>
      </div>
      </div>
    </details>
  );
}
