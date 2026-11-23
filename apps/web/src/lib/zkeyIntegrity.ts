"use client";

export interface ZkManifest {
  circuitName: string;
  depth: number;
  publicSignalsCount: number;
  nConstraints: number;
  nWires: number;
  ptauFile: string;
  ptauCapacity: number;
  zkeySha256: string;
  wasmSha256: string;
  vkeySha256: string;
  zkeyBytes: number;
  wasmBytes: number;
  builtAt: string;
}

export interface ZkeyIntegrityResult {
  verified: boolean;
  expectedSha256: string;
  actualSha256: string;
  manifest: ZkManifest;
  checkedAtMs: number;
}

export async function verifyZkeyIntegrity(): Promise<ZkeyIntegrityResult> {
  const t0 = performance.now();
  const [manifestRes, zkeyRes] = await Promise.all([
    fetch("/zk/manifest.json", { cache: "no-store" }),
    fetch("/zk/ClaimValidity.zkey"),
  ]);

  if (!manifestRes.ok || !zkeyRes.ok) {
    throw new Error("Unable to fetch /zk/manifest.json or /zk/ClaimValidity.zkey");
  }

  const manifest = (await manifestRes.json()) as ZkManifest;
  const zkeyBuf = await zkeyRes.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", zkeyBuf);
  const actualSha256 = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    verified: actualSha256.toLowerCase() === manifest.zkeySha256.toLowerCase(),
    expectedSha256: manifest.zkeySha256,
    actualSha256,
    manifest,
    checkedAtMs: Math.round(performance.now() - t0),
  };
}
