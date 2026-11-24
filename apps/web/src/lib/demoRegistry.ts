import canonicalFixtures from "@/lib/canonicalFixtures.json";
import type { DemoHospital, DemoPolicy, RelayChainMirror } from "@/lib/relayStore";

export type HospitalEntry = { address: string; licenseId: string; name: string };
export type PolicyEntry = {
  policyId: string;
  patientCommit: string;
  policyExpiry: string;
  annualLimitWei: string;
  policySalt: string;
  commitment: string;
  insurer?: string;
};

/** Canonical accredited hospitals followed by demo-accredited ones. ORDER MATTERS: it defines the Merkle root. */
export function mergedHospitals(extra?: DemoHospital[] | null): HospitalEntry[] {
  const base: HospitalEntry[] = canonicalFixtures.hospitals.map((h) => ({ ...h }));
  const seen = new Set(base.map((h) => h.address.toLowerCase()));
  for (const h of extra ?? []) {
    if (seen.has(h.address.toLowerCase())) continue;
    seen.add(h.address.toLowerCase());
    base.push({ address: h.address, licenseId: h.licenseId, name: h.name });
  }
  return base;
}

export function activePolicy(demo?: DemoPolicy | null): PolicyEntry {
  return demo ?? (canonicalFixtures.activePolicy as unknown as PolicyEntry);
}

export function registryFromMirror(m: RelayChainMirror | null | undefined) {
  return { hospitals: mergedHospitals(m?.demoHospitals), policy: activePolicy(m?.demoPolicy) };
}

/** Local Hardhat test accounts can't be connected on Sepolia — never offer them as share targets. */
const TEST_ACCOUNTS = new Set(Object.values(canonicalFixtures.accounts).map((a) => a.toLowerCase()));

export function connectableHospitals(list: HospitalEntry[]): HospitalEntry[] {
  const real = list.filter((h) => !TEST_ACCOUNTS.has(h.address.toLowerCase()));
  return real.length ? real : list;
}
