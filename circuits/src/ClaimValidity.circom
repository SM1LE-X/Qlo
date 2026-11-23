pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "./MerkleProof.circom";

template ClaimValidity(DEPTH) {
    // --- Public Inputs (8 exact frozen indices) ---
    signal input hospitalRoot;
    signal input policyCommitment;
    signal input nullifier;
    signal input claimAmount;       // wei, uint96 (> 0)
    signal input claimTimestamp;    // unix seconds, uint64
    signal input recordCommitment;  // 248-bit SHA-256 truncation of encrypted envelope
    signal input hospitalAddress;   // uint160(msg.sender), anti-front-run binding
    signal input priorPolicySpent;  // wei, uint96, bound on-chain to policySpent[policyCommitment]

    // --- Private Witness Inputs ---
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

    // Prior + claim fit strictly within 97 bits (<= 2^97 - 2 << p)
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
