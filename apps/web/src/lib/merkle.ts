"use client";

export const TREE_DEPTH = 6;
export const TREE_SIZE = 1 << TREE_DEPTH;

type PoseidonFn = ((inputs: bigint[]) => unknown) & {
  F: { toObject: (el: unknown) => bigint };
};

let poseidonPromise: Promise<PoseidonFn> | null = null;

async function getPoseidon(): Promise<PoseidonFn> {
  if (!poseidonPromise) {
    poseidonPromise = (async () => {
      const mod = (await import("circomlibjs")) as { buildPoseidon: () => Promise<PoseidonFn> };
      return mod.buildPoseidon();
    })();
  }
  return poseidonPromise;
}

export async function poseidonHash(inputs: (bigint | string | number)[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const out = poseidon(inputs.map((x) => BigInt(x)));
  return BigInt(poseidon.F.toObject(out));
}

export async function buildPoseidonMerkleTree(leaves: (bigint | string | number)[]) {
  const padded = new Array<bigint>(TREE_SIZE).fill(0n);
  for (let i = 0; i < Math.min(leaves.length, TREE_SIZE); i++) {
    padded[i] = BigInt(leaves[i]);
  }

  const layers: bigint[][] = [padded];
  let current = padded;
  for (let level = 0; level < TREE_DEPTH; level++) {
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(await poseidonHash([current[i], current[i + 1]]));
    }
    layers.push(next);
    current = next;
  }

  const root = layers[TREE_DEPTH][0];

  function getProof(index: number) {
    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    let idx = index;
    for (let level = 0; level < TREE_DEPTH; level++) {
      const isRight = idx & 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      pathElements.push(layers[level][siblingIdx].toString());
      pathIndices.push(isRight);
      idx = idx >> 1;
    }
    return { pathElements, pathIndices, root: root.toString() };
  }

  return { root, layers, getProof };
}

export async function computeHospitalLeaf(address: string, licenseId: string | bigint) {
  return poseidonHash([BigInt(address.toLowerCase()), BigInt(licenseId)]);
}

export async function computePolicyCommitment(params: {
  policyId: string | bigint;
  patientCommit: string | bigint;
  policyExpiry: string | bigint;
  annualLimit: string | bigint;
  coveredCptRoot: string | bigint;
  policySalt: string | bigint;
}) {
  return poseidonHash([
    params.policyId,
    params.patientCommit,
    params.policyExpiry,
    params.annualLimit,
    params.coveredCptRoot,
    params.policySalt,
  ]);
}

export async function computeNullifier(params: {
  policySalt: string | bigint;
  policyId: string | bigint;
  recordCommitment: string | bigint;
}) {
  return poseidonHash([params.policySalt, params.policyId, params.recordCommitment]);
}
