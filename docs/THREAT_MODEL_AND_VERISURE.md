# Threat Model, Cryptographic Honesty & Comparison vs. VeriSure (ETHDenver 2025)

---

## 1. Trust Boundaries & Data Classification

| Boundary | Data Inside Boundary | Cryptographic / Access Enforcement |
|---|---|---|
| **Zone 1: Patient Browser** | Plaintext CMS-1500 bill, ICD-10 diagnosis, CPT code, Rx, clinical note, raw AES-256-GCM DEK | Never leaves browser unencrypted. Encrypted with random 256-bit DEK + 96-bit IV; DEK wrapped per-hospital using ephemeral ECDH P-256 + HKDF-SHA256. |
| **Zone 2: Hospital Browser** | Unwrapped DEK (only while `grantAccess` is active), decrypted CMS-1500 bill, private Circom witness (`cptCode`, `annualLimit`, `policyExpiry`, `policySalt`) | Witness never leaves Web Worker memory. Proof outputs only the 8 public field signals and `(pA, pB, pC)`. |
| **Zone 3: Off-Chain Ciphertext Storage (IndexedDB / CIDv1 / `.qlo.json`)** | Opaque AES-256-GCM ciphertext envelope (`ivBase64`, `ciphertextBase64`) | Content-addressed by `CIDv1` and committed via 248-bit `sha256(envelope) >> 8`. Useless without a currently active wrapped DEK. |
| **Zone 4: Ethereum Sepolia Public Ledger** | `hospitalRoot`, `policyCommitment`, `nullifier`, `claimAmount`, `claimTimestamp`, `recordCommitment`, `hospitalAddress`, `priorPolicySpent`, `encryptedDek`, `cid` | **Zero PHI.** Every state transition verified by Groth16 pairing + Solidity invariants (`ClaimsVault`, `HealthRecords`, `PolicyRegistry`, `HospitalRegistry`). |

---

## 2. STRIDE Threat Matrix

| Threat Category | Attack Scenario | Mitigation in Qlo | Where Enforced |
|---|---|---|---|
| **S — Spoofing** | Rogue wallet impersonates a licensed hospital to claim ETH | Hospital leaf binds `Poseidon(hospitalAddress, hospitalLicenseId)` AND `ClaimsVault` asserts `address(uint160(pubSignals[6])) == msg.sender`. | `ClaimValidity.circom` + `ClaimsVault.sol` |
| **T — Tampering** | Malicious prover submits altered proof, forged ciphertext, or non-binary Merkle path | Groth16 verifier validates pairing over BN254; `MerkleProof` enforces `idx * (idx - 1) === 0`; `recordCommitment` is checked on-chain against `HealthRecords` & bound into `nullifier`. | `ClaimValidity.circom` + `Groth16Verifier.sol` |
| **T — Tampering (Replay / Double-Spend)** | Hospital replays a valid proof or invents arbitrary nonces to drain `ClaimsVault` | `nullifier = Poseidon(policySalt, policyId, recordCommitment)` is fully deterministic—no free nonce! `ClaimsVault` tracks `nullifierUsed[nullifier]` before ETH transfer. | `ClaimValidity.circom` + `ClaimsVault.sol` |
| **T — Tampering (Backdated Clock / Cap Bypass)** | Hospital submits an expired policy with a stale timestamp, or splits claims to exceed annual limit | Circuit range-checks `Num2Bits(64)` + `claimTimestamp < policyExpiry` and `priorPolicySpent + claimAmount <= annualLimit`; `ClaimsVault` enforces `[now - 900s, now + 60s]` and exact `policySpent`. | `ClaimValidity.circom` + `ClaimsVault.sol` |
| **R — Repudiation** | Dispute over whether or when a hospital accessed a patient record or settled a claim | Immutable on-chain events: `RecordRegistered`, `AccessGranted`, `AccessRevoked`, `RecordAccessed`, and `ClaimSettled`. | `HealthRecords.sol` + `ClaimsVault.sol` |
| **I — Information Disclosure** | Observer scrapes Ethereum Sepolia calldata/events to infer patient diagnosis, CPT code, or annual policy cap | 0 PHI in calldata or events; `ClaimsVault` never emits `patientAddress`; `annualLimit` and `cptCode` are private Circom signals; `HealthRecords.getGrant()` redacts expired DEKs. | `ClaimValidity.circom` + `HealthRecords.sol` + `ClaimsVault.sol` |
| **D — Denial of Service** | Reentrancy drains escrow, or an admin key compromise halts/drains protocol | `ReentrancyGuard` + checks-effects-interactions on ETH `.call`; `Pausable` emergency brake; `Ownable2Step` prevents accidental ownership loss. | `ClaimsVault.sol` + `HospitalRegistry.sol` |
| **E — Elevation of Privilege** | Hospital continues settling claims after patient revokes consent, or insurer overwrites another's policy | `ClaimsVault` enforces `healthRecords.hasActiveAccessByCommitment` on every settlement; `PolicyRegistry` forbids overwriting existing commitments. | `ClaimsVault.sol` + `PolicyRegistry.sol` |

---

## 3. Cryptographic Honesty & Known Limitations

Security judges actively penalize demos that claim impossible guarantees. Qlo explicitly documents its true cryptographic boundaries both here and live on `/story`:

1. **Post-Decryption Off-Chain Retention (The Analog Hole):**
   - Once a patient grants access and a hospital unwraps the DEK and decrypts the plaintext inside its browser, **no cryptographic primitive on Earth can delete plaintext that an intentionally malicious hospital copied to local disk** prior to revocation.
   - *What Qlo's revocation DOES strictly enforce:* It deletes the on-chain wrapped DEK (`HealthRecords.revokeAccess`), prevents decrypting any future record updates or new claims, blocks view-call retrieval of expired DEKs, and **immediately halts on-chain `ClaimsVault` financial settlement** via `hasActiveAccessByCommitment`.
   - *v2 Mitigation Roadmap:* Hardware TEEs (e.g., AWS Nitro / Intel TDX) with ephemeral enclave-bound attestation keys that never expose raw plaintext to host memory.
2. **Groth16 Trusted Setup:**
   - Groth16 requires a circuit-specific trusted setup (Phase 2) atop a universal powers-of-tau (Phase 1). If the Phase 2 toxic waste were retained by a single untrusted actor, fake proofs could be forged.
   - *Mitigation in Qlo:* Phase 1 uses the Ethereum Foundation PSE **Perpetual Powers of Tau** (`ppot_0080_13.ptau`, 80+ community contributors), Phase 2 entropy contribution is scripted and verifiable, and `/story` runs an in-browser SHA-256 check on the active `.zkey` artifact matching `deployments/sepolia.json`.
   - *v2 Mitigation Roadmap:* Transparent setups (Halo2 / UltraHonk) or multi-party Phase 2 ceremonies.
3. **On-Chain Timing & Payout Amount Leakage:**
   - Although `cptCode`, `icd10Code`, `patientAddress` (in `ClaimsVault`), and `annualLimit` are hidden, `claimAmount` (exact wei transferred) and `hospitalAddress` (`msg.sender`) are visible on Ethereum Sepolia. Correlating rare payout amounts with hospital identity could leak side-channel hints.
   - *v2 Mitigation Roadmap:* Payout amount bucketing or shielded privacy pools (e.g., Railgun / Privacy Pools integration).
4. **Synthetic Data Only (Not Certified HIPAA Infrastructure):**
   - Qlo is an **Ethereum Sepolia** hackathon/research protocol using strictly synthetic medical claims. Production healthcare deployment requires HIPAA BAA hosting, formal circuit verification (Circomspect / Picus), and an independent smart contract audit.

---

## 4. Deep Comparison vs. VeriSure (ETHDenver 2025)

**Reference:** [VeriSure](https://github.com/micahborg/verisure) won 1st Place in Gaia's AVS + ZK Challenge and 1st Place in Boundless zkVM Bounty at ETHDenver 2025 by tackling the 2-week medical clearinghouse bottleneck with Next.js, OCR, Gaia AI, Othentic AVS, and RISC0.

| Dimension | VeriSure (ETHDenver 2025) | Qlo (This Build) |
|---|---|---|
| **Core Bottleneck Addressed** | 14-day centralized clearinghouse claim validation | Same clearinghouse & breach crisis (Change Healthcare: 192.7M affected, $2.45B impact) + patient data custody |
| **Document Intake & OCR** | Off-chain Gaia AI nodes (PHI leaves client) | 100% browser-local CMS-1500 intake + `tesseract.js` WASM OCR (**0 bytes PHI sent to external servers**) |
| **What ZK Actually Proves** | Form parsing & completeness; **full policy coverage rules deferred as future work** | **8 real predicates proven in Groth16:** accredited hospital, policy commitment, expiry vs. live clock, covered CPT Merkle tree, positive amount, **private cumulative annual limit**, deterministic nullifier, anti-front-run sender |
| **Trust & Consensus Model** | EigenLayer + Othentic AVS operator quorum + RISC0 zkVM | **Trustless L1 verification:** Groth16 BN254 pairing directly on Ethereum Sepolia (`ClaimsVault.sol`) |
| **Patient Consent & Storage** | No patient encryption, key wrapping, or revocation | **AES-256-GCM + ECDH P-256 wrapped DEKs**, deterministic **IPFS CIDv1** + IndexedDB + `.qlo.json`, time-bound grant & instant on-chain revoke enforced inside `ClaimsVault` |
| **Proving Speed & Infra Cost** | ~2 minutes; AVS/zkVM infra; BUSL-1.1 performer | **< 3 seconds** in browser Web Worker; **$0 cash cost**; **100% MIT open-source** |
| **Fail-Closed Verification UX** | Happy-path AVS demonstration | Interactive **Attack Lab** + **Live On-Chain Zero-PHI Calldata Scanner** + **Live `.zkey` SHA-256 Verifier** |
