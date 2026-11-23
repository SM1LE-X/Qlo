# Frozen ZK Circuit & Protocol ABI Specification (`ClaimValidity.circom`)

> **Status:** FROZEN SPECIFICATION — Single source of truth across Circom (`circuits/`), `snarkjs` scripts, Solidity contracts (`contracts/src/`), and the Next.js browser prover (`apps/web/`). Any index, field-width, or hash-ordering mismatch is a hard bug.

---

## 1. Proof System & Curve Parameters

| Parameter | Value | Rationale |
|---|---|---|
| **Proof System** | Groth16 | Constant-size 256-byte proof, ~230k–260k gas on-chain verification, fast client proving |
| **Elliptic Curve** | BN254 (`alt_bn128`) | Native EVM precompiles (`ecAdd`, `ecMul`, `ecPairing` at `0x06`, `0x07`, `0x08`) on Base Sepolia |
| **SNARK Scalar Field Prime ($p$)** | `21888242871839275222246405745257275088548364400416034343698204186575808495617` | $\approx 2^{253.6}$; all signals & commitments MUST be strictly $< p$ |
| **Compiler** | Circom `2.1.6+` | `pragma circom 2.1.6;` |
| **Hash Function** | Poseidon (`circomlib/circuits/poseidon.circom`) | Exact round constants & MDS matching `circomlibjs` `buildPoseidon()` |
| **Merkle Tree Depth** | `DEPTH = 6` (64 leaves per tree) | Fits both Hospital Registry and Covered CPT Policy Trees |
| **R1CS Constraint Budget** | ~4,400 constraints (hard ceiling `< 8,192`) | Fits Ethereum Foundation PSE Perpetual Powers of Tau `ppot_0080_13.ptau` ($2^{13} = 8,192$) |
| **Browser Artifacts** | `ClaimValidity.wasm` (~1.5 MB), `ClaimValidity.zkey` (~2.2 MB) | Preloaded from `/public/zk/` (well below GitHub/Vercel limits; no Git LFS needed) |
| **Target Proving Latency** | `< 3.0 seconds` (hard gate `< 5.0s`) | Executed inside dedicated `prover.worker.ts` Web Worker |

---

## 2. Frozen Public Signals (`pubSignals[8]`)

Order is **strictly frozen** between `component main { public [...] }`, `snarkjs` `publicSignals` output, `Groth16Verifier.verifyProof`, `ClaimsVault.submitClaim`, and `apps/web`:

| Index | Signal Name | Domain / Type | Circuit Constraint | On-Chain Enforcement (`ClaimsVault.sol`) |
|---|---|---|---|---|
| `0` | `hospitalRoot` | BN254 Field Element | Computed root of `hospitalAddress` + `hospitalLicenseId` Merkle path | `pubSignals[0] == hospitalRegistry.hospitalRoot()` (else `InvalidHospitalRoot()`) |
| `1` | `policyCommitment` | BN254 Field Element | `Poseidon(6)(policyId, patientCommit, policyExpiry, annualLimit, coveredCptRoot, policySalt)` | `(address insurer, bool active) = policyRegistry.getPolicy(pubSignals[1]);` requires `active` (else `PolicyNotActive()`) |
| `2` | `nullifier` | BN254 Field Element | `Poseidon(3)(policySalt, policyId, recordCommitment)` | Requires `!nullifierUsed[pubSignals[2]]`; marks `true` before ETH transfer (else `NullifierAlreadyUsed()`) |
| `3` | `claimAmount` | `uint96` (wei) | `Num2Bits(96)`, `IsZero == 0`, `priorPolicySpent + claimAmount <= annualLimit` | Requires `claimAmount > 0` and `insurerEscrow[insurer] >= claimAmount`; exact ETH transferred to `msg.sender` |
| `4` | `claimTimestamp` | `uint64` (unix sec) | `Num2Bits(64)`, `LessThan(64)(claimTimestamp, policyExpiry) == 1` | Requires `claimTimestamp <= block.timestamp + 60` and `block.timestamp <= claimTimestamp + 900` (15-min freshness window; else `ClaimTimestampOutOfWindow()`) |
| `5` | `recordCommitment` | `uint248` (`sha256 >> 8`) | Bound inside `nullifier` preimage | Requires `healthRecords.hasActiveAccessByCommitment(bytes32(pubSignals[5]), msg.sender)` (else `PatientAccessNotActive()`) |
| `6` | `hospitalAddress` | `uint160` | Bound inside `hospitalLeaf = Poseidon(2)(hospitalAddress, hospitalLicenseId)` | Requires `address(uint160(pubSignals[6])) == msg.sender` (blocks mempool front-running; else `HospitalSenderMismatch()`) |
| `7` | `priorPolicySpent` | `uint96` (wei) | `Num2Bits(96)`, added to `claimAmount` in `LessEqThan(97)` against `annualLimit` | Requires `pubSignals[7] == policySpent[pubSignals[1]]`; adds `claimAmount` on settlement (else `PriorSpentMismatch()`) |

---

## 3. Private Witness Inputs (Never Leave Hospital Browser)

| Signal Name | Dimensions / Type | Description |
|---|---|---|
| `hospitalLicenseId` | Field (integer encoding of NPI / license) | Accredited hospital license identifier bound to `hospitalAddress` |
| `hospitalPathElements` | `Field[6]` | Sibling hashes from leaf to root in Hospital Merkle tree |
| `hospitalPathIndices` | `bit[6]` (`0` or `1`) | Path direction bits (`0` = current node is left child, `1` = right child) |
| `policyId` | Field | Unique private policy identifier |
| `patientCommit` | Field | Private Poseidon commitment binding subscriber/patient identity |
| `policyExpiry` | `uint64` (unix sec) | Policy expiration timestamp (`claimTimestamp < policyExpiry`) |
| `annualLimit` | `uint96` (wei) | Private cumulative policy coverage cap (`priorPolicySpent + claimAmount <= annualLimit`) |
| `coveredCptRoot` | Field | Depth-6 Poseidon Merkle root of covered 5-digit CPT procedure codes for this policy |
| `policySalt` | Field (248-bit random secret) | Random insurer-provisioned blinding factor (also anchors deterministic nullifier!) |
| `cptCode` | Field (integer CPT code, e.g., `99285`) | Private medical procedure code from CMS-1500 Box 24D |
| `cptPathElements` | `Field[6]` | Sibling hashes from CPT leaf to `coveredCptRoot` |
| `cptPathIndices` | `bit[6]` (`0` or `1`) | Path direction bits (`0` = left, `1` = right) |

> **Zero-PHI Guarantee:** Diagnosis codes (ICD-10-CM Box 21), prescription details (Rx), clinical encounter notes, patient name, plaintext AES-GCM payloads, `cptCode`, `annualLimit`, and `policyExpiry` are **never** placed in `pubSignals` or on-chain calldata.

---

## 4. Hash, Commitment & Merkle Tree Conventions

### 4.1 Canonical Poseidon Formulas

1. **Hospital Accreditation Leaf:**
   $$\text{hospitalLeaf} = \text{Poseidon}_2(\text{uint160}(\text{hospitalAddress}),\ \text{hospitalLicenseId})$$
   - `hospitalAddress` is passed as `BigInt(address.toLowerCase())` (`uint160`, strictly $< 2^{160} < p$).
   - `hospitalLicenseId` is passed as `BigInt(npiOrLicenseNumeric)`.
   - Unused tree leaves (up to index $63$) MUST be padded with `0n`.

2. **Policy Commitment:**
   $$\text{policyCommitment} = \text{Poseidon}_6(\text{policyId},\ \text{patientCommit},\ \text{policyExpiry},\ \text{annualLimit},\ \text{coveredCptRoot},\ \text{policySalt})$$

3. **Covered CPT Leaf:**
   - Leaf value is the numeric CPT integer (e.g., `99285n`) or `0n` for unused padding slots.
   - Standard canonical covered set for seeded demo policy (`DEPTH = 6`, padded with `0n` to 64 leaves):
     `99285` (ER high severity), `99214` (Outpatient follow-up), `27750` (Tibial fracture care), `93000` (ECG 12-lead), `71046` (Chest X-ray), `80053` (Comprehensive metabolic panel), `36415` (Venipuncture), `99284` (ER moderate severity).
   - Uncovered test code (Attack Lab): `15777` (Cosmetic/elective implant — absent from `coveredCptRoot`).

4. **Deterministic Non-Replayable Nullifier:**
   $$\text{nullifier} = \text{Poseidon}_3(\text{policySalt},\ \text{policyId},\ \text{recordCommitment})$$
   - Why this defeats replay & arbitrary-nonce vault drain: `policySalt` and `policyId` are committed inside `policyCommitment`, and `recordCommitment` is committed on-chain inside `HealthRecords`. Therefore, settling one encrypted record against one policy yields exactly **one deterministic nullifier**.

5. **Field-Safe 248-Bit Encrypted Record Commitment:**
   $$\text{recordCommitment} = \lfloor \text{SHA256}(\text{ciphertextBytes}) / 2^8 \rfloor = \text{uint256}(\text{sha256}(\text{ciphertextBytes})) \gg 8$$
   - Stripping the lowest 8 bits guarantees `0 <= recordCommitment < 2^248 < p` (BN254 scalar field prime), eliminating the ~50% field-overflow failure mode of raw 256-bit SHA-256 / Keccak digests.
   - Represented on-chain as `bytes32(uint256(recordCommitment))` (top byte is always `0x00`), passed as decimal string to `snarkjs`, and converted via `uint256(bytes32)` in Solidity.

### 4.2 Merkle Ordering Convention (`DEPTH = 6`)

At tree level `i` (`0` = leaf layer, `5` = top pair before root):
- `pathIndices[i]` MUST satisfy `pathIndices[i] * (pathIndices[i] - 1) === 0`.
- `pathIndices[i] == 0` $\implies \text{parent} = \text{Poseidon}_2(\text{current},\ \text{sibling})$ (current node is left child).
- `pathIndices[i] == 1` $\implies \text{parent} = \text{Poseidon}_2(\text{sibling},\ \text{current})$ (current node is right child).

TypeScript (`circuits/scripts/` and `apps/web/src/lib/merkle.ts`) MUST implement this identical left/right child order using `circomlibjs` `poseidon([left, right])` with `poseidon.F.toObject(...)`.

---

## 5. Reference Circom 2 Circuit Specification

### 5.1 `circuits/src/MerkleProof.circom`

```circom
pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

template MerkleProof(DEPTH) {
    signal input leaf;
    signal input pathElements[DEPTH];
    signal input pathIndices[DEPTH];
    signal output root;

    signal hashes[DEPTH + 1];
    signal diff[DEPTH];
    signal left[DEPTH];
    signal right[DEPTH];

    component hashers[DEPTH];
    hashes[0] <== leaf;

    for (var i = 0; i < DEPTH; i++) {
        // Strict boolean constraint prevents non-binary selector soundness attacks
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // Quadratic-safe dual mux:
        // index == 0 => left = hashes[i], right = pathElements[i]
        // index == 1 => left = pathElements[i], right = hashes[i]
        diff[i] <== pathElements[i] - hashes[i];
        left[i] <== hashes[i] + pathIndices[i] * diff[i];
        right[i] <== pathElements[i] - pathIndices[i] * diff[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[DEPTH];
}
```

### 5.2 `circuits/src/ClaimValidity.circom`

```circom
pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "./MerkleProof.circom";

template ClaimValidity(DEPTH) {
    // --- Public Inputs (8) ---
    signal input hospitalRoot;
    signal input policyCommitment;
    signal input nullifier;
    signal input claimAmount;       // wei, uint96 (> 0)
    signal input claimTimestamp;    // unix seconds, uint64
    signal input recordCommitment;  // 248-bit truncated SHA-256 of ciphertext
    signal input hospitalAddress;   // uint160(msg.sender), anti-front-run binding
    signal input priorPolicySpent;  // wei, uint96, bound on-chain to policySpent[policyCommitment]

    // --- Private Inputs (12 logical inputs) ---
    signal input hospitalLicenseId;
    signal input hospitalPathElements[DEPTH];
    signal input hospitalPathIndices[DEPTH];

    signal input policyId;
    signal input patientCommit;
    signal input policyExpiry;
    signal input annualLimit;
    signal input coveredCptRoot;
    signal input policySalt;

    signal input cptCode;
    signal input cptPathElements[DEPTH];
    signal input cptPathIndices[DEPTH];

    // 1. Hospital Accreditation Merkle Proof (binds sender address + license ID)
    component hospLeaf = Poseidon(2);
    hospLeaf.inputs[0] <== hospitalAddress;
    hospLeaf.inputs[1] <== hospitalLicenseId;

    component hospMerkle = MerkleProof(DEPTH);
    hospMerkle.leaf <== hospLeaf.out;
    for (var i = 0; i < DEPTH; i++) {
        hospMerkle.pathElements[i] <== hospitalPathElements[i];
        hospMerkle.pathIndices[i] <== hospitalPathIndices[i];
    }
    hospMerkle.root === hospitalRoot;

    // 2. Policy Commitment Preimage Check
    component polHash = Poseidon(6);
    polHash.inputs[0] <== policyId;
    polHash.inputs[1] <== patientCommit;
    polHash.inputs[2] <== policyExpiry;
    polHash.inputs[3] <== annualLimit;
    polHash.inputs[4] <== coveredCptRoot;
    polHash.inputs[5] <== policySalt;
    polHash.out === policyCommitment;

    // 3. Explicit 64-Bit Range Check + Expiry Predicate (claimTimestamp < policyExpiry)
    component tsBits = Num2Bits(64);
    tsBits.in <== claimTimestamp;
    component expBits = Num2Bits(64);
    expBits.in <== policyExpiry;

    component notExpired = LessThan(64);
    notExpired.in[0] <== claimTimestamp;
    notExpired.in[1] <== policyExpiry;
    notExpired.out === 1;

    // 4. Covered CPT Procedure Merkle Proof
    component cptMerkle = MerkleProof(DEPTH);
    cptMerkle.leaf <== cptCode;
    for (var i = 0; i < DEPTH; i++) {
        cptMerkle.pathElements[i] <== cptPathElements[i];
        cptMerkle.pathIndices[i] <== cptPathIndices[i];
    }
    cptMerkle.root === coveredCptRoot;

    // 5. Explicit 96-Bit Range Checks + Positive Amount + Cumulative Annual Cap
    component amtBits = Num2Bits(96);
    amtBits.in <== claimAmount;
    component spentBits = Num2Bits(96);
    spentBits.in <== priorPolicySpent;
    component limBits = Num2Bits(96);
    limBits.in <== annualLimit;

    component amtIsZero = IsZero();
    amtIsZero.in <== claimAmount;
    amtIsZero.out === 0;

    // Because both priorPolicySpent and claimAmount are 96-bit, their sum fits in 97 bits (<= 2^97 - 2 < p)
    component withinCap = LessEqThan(97);
    withinCap.in[0] <== priorPolicySpent + claimAmount;
    withinCap.in[1] <== annualLimit;
    withinCap.out === 1;

    // 6. Deterministic Non-Replayable Nullifier bound to policySalt + policyId + recordCommitment
    component nullHash = Poseidon(3);
    nullHash.inputs[0] <== policySalt;
    nullHash.inputs[1] <== policyId;
    nullHash.inputs[2] <== recordCommitment;
    nullHash.out === nullifier;
}

component main { public [
    hospitalRoot,
    policyCommitment,
    nullifier,
    claimAmount,
    claimTimestamp,
    recordCommitment,
    hospitalAddress,
    priorPolicySpent
] } = ClaimValidity(6);
```

---

## 6. Solidity Calldata Marshalling (`snarkjs` $\to$ `Groth16Verifier.sol`)

`snarkjs.groth16.fullProve` outputs `proof.pi_b` in JSON order, whereas EVM `bn128Pairing` precompile expects G2 coordinates transposed (`[x1, x0]`, `[y1, y0]`). Always marshal using `snarkjs.groth16.exportSolidityCallData(proof, publicSignals)` or explicit transposition:

```ts
export function formatSolidityProof(proof: SnarkjsProof, publicSignals: string[]) {
  return {
    pA: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as const,
    pB: [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ] as const,
    pC: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as const,
    pubSignals: publicSignals.map((s) => BigInt(s)) as [
      bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint
    ],
  };
}
```

And the generated `contracts/src/Groth16Verifier.sol` MUST expose:

```solidity
interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[8] calldata _pubSignals
    ) external view returns (bool);
}
```

---

## 7. Trusted Setup, Phase 2 Contribution & Artifact Pinning

1. **Phase 1 (Universal Perpetual Powers of Tau):**
   - Source: Ethereum Foundation PSE Perpetual Powers of Tau ceremony `ppot_0080_13.ptau` (80+ public participants)
   - Download URL: `https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_13.ptau`
   - Constraint capacity: $2^{13} = 8,192$ constraints (~9.5 MB download).
2. **Phase 2 (Circuit-Specific Ceremony):**
   - `snarkjs.zKey.newZKey(r1csPath, ptauPath, zkey0Path)`
   - `snarkjs.zKey.contribute(zkey0Path, finalZkeyPath, "Qlo Phase 2 Ceremony", randomBytes(32).toString("hex"))`
   - Export `verification_key.json` and `contracts/src/Groth16Verifier.sol` (normalize pragma to `pragma solidity ^0.8.28;`).
3. **Integrity Pinning (`circuits/build/manifest.json` & `apps/web/public/zk/manifest.json`):**
   - Record `circuitName`, `constraintCount`, `zkeySha256`, `wasmSha256`, `vkeySha256`, `ptauFile`, and `builtAt`.
   - `/story` page and UI footer compute `crypto.subtle.digest("SHA-256", zkeyArrayBuffer)` live in the browser and verify parity against the pinned manifest hash.

---

## 8. Mandatory Circuit Soundness & Negative Test Matrix (11 Cases)

Implemented in `circuits/test/claimValidity.test.ts` via `vitest`:

| # | Test Case | Expected Result | Predicate Verified |
|---|---|---|---|
| 1 | Valid Claim #1 (`priorPolicySpent = 0`, `claimAmount = 0.01 ETH`) + real Groth16 prove & verify | **PASS** (`< 5s`) | All 8 public signals + Groth16 verify |
| 2 | Valid Cumulative Claim #2 (`priorPolicySpent = 0.01 ETH`, `claimAmount = 0.015 ETH`, `annualLimit = 0.03 ETH`) | **PASS** | Cumulative cap math (`0.025 <= 0.03`) |
| 3 | Unregistered Hospital (`hospitalLicenseId` / wrong Merkle proof) | **FAIL (Witness Error)** | Hospital Merkle membership |
| 4 | Front-Run Attack (valid hospital path, substituted `hospitalAddress` attacker) | **FAIL (Witness Error)** | Leaf binding `Poseidon(hospitalAddress, licenseId)` |
| 5 | Tampered Policy Commitment (`policyCommitment + 1`) | **FAIL (Witness Error)** | `Poseidon(6)` preimage constraint |
| 6 | Expired Policy (`claimTimestamp >= policyExpiry`) | **FAIL (Witness Error)** | `Num2Bits(64)` + `LessThan(64)` |
| 7 | Uncovered CPT Procedure (`cptCode = 15777`) | **FAIL (Witness Error)** | `coveredCptRoot` Merkle membership |
| 8 | Over Annual Cumulative Cap (`priorPolicySpent + claimAmount > annualLimit`) | **FAIL (Witness Error)** | `Num2Bits(96)` + `LessEqThan(97)` |
| 9 | Zero Claim Amount (`claimAmount = 0`) | **FAIL (Witness Error)** | `IsZero(claimAmount) == 0` |
| 10 | Tampered Nullifier (`nullifier + 1`) | **FAIL (Witness Error)** | `Poseidon(3)` deterministic nullifier |
| 11 | Tampered Record Commitment (`recordCommitment + 1`) | **FAIL (Witness Error)** | Nullifier $\leftrightarrow$ encrypted record binding |
