import { buildPoseidon } from "circomlibjs";

export const TREE_DEPTH = 6;
export const TREE_SIZE = 1 << TREE_DEPTH; // 64
export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

let poseidonInstance = null;

export async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

export async function poseidonHash(inputs) {
  const poseidon = await getPoseidon();
  const res = poseidon(inputs.map((x) => BigInt(x)));
  return BigInt(poseidon.F.toObject(res));
}

/**
 * Builds a fixed depth-6 Poseidon Merkle tree matching MerkleProof.circom bit-for-bit:
 * - Unused leaves padded to 64 with 0n
 * - pathIndices[i] == 0 => current is left child: Poseidon(current, sibling)
 * - pathIndices[i] == 1 => current is right child: Poseidon(sibling, current)
 */
export async function buildPoseidonMerkleTree(leaves, depth = TREE_DEPTH) {
  const size = 1 << depth;
  if (leaves.length > size) {
    throw new Error(`Too many leaves (${leaves.length} > ${size})`);
  }

  const padded = new Array(size).fill(0n);
  for (let i = 0; i < leaves.length; i++) {
    padded[i] = BigInt(leaves[i]);
  }

  const layers = [padded];
  let current = padded;
  for (let level = 0; level < depth; level++) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const parent = await poseidonHash([current[i], current[i + 1]]);
      next.push(parent);
    }
    layers.push(next);
    current = next;
  }

  const root = layers[depth][0];

  function getProof(index) {
    if (index < 0 || index >= size) {
      throw new Error(`Leaf index out of range: ${index}`);
    }
    const pathElements = [];
    const pathIndices = [];
    let idx = index;
    for (let level = 0; level < depth; level++) {
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

export function addressToField(address) {
  return BigInt(address.toLowerCase());
}

export async function computeHospitalLeaf(hospitalAddress, hospitalLicenseId) {
  return poseidonHash([addressToField(hospitalAddress), BigInt(hospitalLicenseId)]);
}

export async function computePolicyCommitment({
  policyId,
  patientCommit,
  policyExpiry,
  annualLimit,
  coveredCptRoot,
  policySalt,
}) {
  return poseidonHash([
    BigInt(policyId),
    BigInt(patientCommit),
    BigInt(policyExpiry),
    BigInt(annualLimit),
    BigInt(coveredCptRoot),
    BigInt(policySalt),
  ]);
}

export async function computeNullifier({ policySalt, policyId, recordCommitment }) {
  return poseidonHash([BigInt(policySalt), BigInt(policyId), BigInt(recordCommitment)]);
}
