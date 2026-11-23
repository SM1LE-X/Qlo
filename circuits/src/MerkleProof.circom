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
