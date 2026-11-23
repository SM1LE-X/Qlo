# Qlo — Product & Engineering Specification

> **Mission:** Build **Qlo**—a live, judge-clickable, **$0-cost**, **100% MIT open-source** zero-knowledge health insurance claims and patient-sovereign encrypted medical records platform on **Ethereum Sepolia (`11155111`)** and **Vercel Hobby**—combining browser-local CMS-1500 & OCR intake with 8 on-chain-verified Groth16 policy-coverage predicates, private cumulative annual limits, and patient-controlled decryption/revocation.

---

## 1. Real-World Problem Statement

Modern healthcare claim adjudication runs through centralized Electronic Data Interchange (**EDI 837/835**) clearinghouses that concentrate unencrypted Protected Health Information (**PHI**) and create catastrophic single points of failure:

- **The Change Healthcare Breach (Feb 2024):** UnitedHealth Group's Change Healthcare clearinghouse—which processed roughly **50% of U.S. medical claims** (~15 billion transactions annually)—suffered a ransomware blackout that halted EDI 837/835 transmission nationwide.
- **Confirmed Human & Financial Fallout:** The U.S. HHS Office for Civil Rights (OCR) confirmed **192.7 million individuals** impacted (largest healthcare data breach in U.S. history); hospitals endured **2 to 6+ week cash-flow blackouts** with **60%** of surveyed providers needing 2 weeks to 3 months to recover normal operations; UnitedHealth disclosed **$2.45+ billion** in cumulative impact after a **$22 million** ransom payment.
- **Why Naive Blockchains Fail Healthcare:** Putting raw ICD-10 diagnoses, CPT procedures, or prescriptions on a public L2 violates patient privacy instantly. Putting trust in external AI nodes or AVS operators re-introduces intermediary risk.

**Qlo's Solution:** Replace clearinghouse intermediaries and unverified off-chain attestations with **client-side AES-256-GCM + ECDH cryptography**, **100% browser-local CMS-1500 intake & OCR**, **client-side Circom 2 Groth16 proofs (< 3 seconds)**, and **deterministic Ethereum Sepolia smart contract settlement**.

---

## 2. Prior Art & Competitive Matrix (Qlo vs. VeriSure, ETHDenver 2025)

| Capability                            | VeriSure (ETHDenver 2025)                      | Qlo Production-Hardened Scope                                                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CMS-1500 Claim Intake & OCR**       | Next.js upload + Gaia AI OCR extraction        | 100% client-side CMS-1500 form + synthetic presets + JSON/TXT upload + lazy in-browser **`tesseract.js`** WASM OCR (**0 bytes sent to any external AI/server**)                                     |
| **Form Completeness Validation**      | Core ETHDenver demo scope                      | Full client-side CMS-1500 Box `1a`, `21` (ICD-10), `24A` (DOS), `24D` (CPT), `24F` (Charge), `24J` (10-digit NPI) validation before proving                                                         |
| **Policy Coverage Enforcement**       | **Deferred as future work**                    | **Enforced in Groth16:** policy commitment preimage, `claimTimestamp < policyExpiry`, covered CPT Merkle proof, positive amount                                                                     |
| **Cumulative Annual Policy Limits**   | Absent                                         | **Enforced in Groth16 + Solidity:** `priorPolicySpent + claimAmount <= annualLimit` with `annualLimit` kept strictly private                                                                        |
| **Provider Accreditation**            | Off-chain / AVS operator assumptions           | Depth-6 Poseidon Merkle proof binding `hospitalAddress` (`msg.sender`) + `hospitalLicenseId` against `HospitalRegistry`                                                                             |
| **Patient Data Ownership & Consent**  | Absent (no encryption/revocation layer)        | Patient encrypts via **AES-256-GCM**, publishes **IPFS CIDv1** + 248-bit commitment, wraps DEK via **ECDH P-256** per grant, and enforces **time-bound grant/revoke** directly inside `ClaimsVault` |
| **Settlement Verification & Latency** | EigenLayer + Othentic AVS + RISC0 (~2 minutes) | Native **Ethereum Sepolia** Groth16 pairing verification + atomic ETH escrow payout (**< 3 seconds** local prove + instant L1 confirmation) |
| **Cost & Licensing**                  | Paid/complex infra, BUSL-1.1 performer         | **$0 total cash cost**, **100% MIT open-source**                                                                                                                                                    |

---

## 3. Red-Team Audit Log ("Assume I'm Wrong")

Every assumption from the initial draft was stress-tested against adversarial exploits and Windows/browser constraints before writing code. All **8 critical flaws** below are permanently resolved in our frozen specs:

1. **Exploit — Arbitrary-Nonce Nullifier Vault Drain:**
   - _Trap:_ `nullifier === Poseidon(secret, policyId, nonce)` with a free private `nonce` lets a malicious hospital mint unlimited distinct nullifiers from a single valid medical record and drain `ClaimsVault`.
   - _Fix:_ Deterministic nullifier `Poseidon(policySalt, policyId, recordCommitment)`. One encrypted record settles **at most once** per policy.
2. **Exploit — Unbound Payout Front-Running:**
   - _Trap:_ Paying `msg.sender` without committing `msg.sender` inside the ZK circuit allows mempool bots to copy `(proof, pubSignals)` and steal the ETH payout.
   - _Fix:_ Public signal `[6] hospitalAddress` is hashed into the hospital Merkle leaf AND enforced on-chain (`address(uint160(pubSignals[6])) == msg.sender`).
3. **Exploit — Underconstrained `LessThan(n)` & Backdated `claimDate`:**
   - _Trap:_ `circomlib`'s `LessThan(n)` breaks under BN254 field wrap-around unless inputs are explicitly bit-checked; unrestricted caller timestamps let expired policies submit old dates.
   - _Fix:_ Explicit `Num2Bits(64)` / `Num2Bits(96)` checks before every comparator, PLUS on-chain `ClaimsVault` 15-minute freshness window (`[block.timestamp - 900, block.timestamp + 60]`).
4. **Architecture Gap — Disconnected `HealthRecords` Revocation:**
   - _Trap:_ `ClaimsVault` didn't check `HealthRecords` consent, allowing revoked hospitals to still collect ETH payouts.
   - _Fix:_ `ClaimsVault` calls `healthRecords.hasActiveAccessByCommitment(bytes32(pubSignals[5]), msg.sender)` before verifying Groth16—enforcing revocation on-chain without leaking `patientAddress` in `ClaimsVault` logs.
5. **Cryptographic Bug — BN254 Scalar Field Overflow on 256-Bit Hashes:**
   - _Trap:_ Standard 256-bit SHA-256 / Keccak digests exceed the BN254 field prime $p \approx 2^{253.6}$ ~50% of the time.
   - _Fix:_ Canonical **248-bit** field-safe commitment: `recordCommitment = uint256(sha256(ciphertext)) >> 8`.
6. **Storage & Key-Handoff Gap — Missing DEK Transfer + Browser Helia Trap:**
   - _Trap:_ AES-GCM ciphertext without a key-exchange protocol leaves the hospital unable to decrypt; full `helia` + `libp2p` in Next.js triggers Webpack polyfill crashes, StrictMode IndexedDB locks, and fails cross-browser discovery without paid pinning.
   - _Fix:_ Hospitals register an **ECDH P-256** public key in `HospitalRegistry`; `HealthRecords.grantAccess` stores the opaque ephemeral-ECDH wrapped DEK on-chain (deleted on revoke). Storage computes deterministic **IPFS CIDv1** (`multiformats`) backed by **IndexedDB** + 1-click **`.qlo.json` encrypted bundle** portability + isolated non-blocking optional **Helia** worker.
7. **Operational Reality — Windows Toolchain, Ceremony & Free Contract Verification:**
   - _Trap:_ `circomkit` has Windows path bugs; `foundryup` requires Git Bash (not PowerShell or blocked WSL); `powersOfTau28_hez_final.ptau` is 288 GB; Etherscan API keys aren't always pre-provisioned.
   - _Fix:_ Install Foundry via Git Bash, fetch prebuilt `circom-windows-amd64.exe`, run direct `circom.exe + snarkjs + vitest`, download Ethereum Foundation PSE `ppot_0080_13.ptau` (~9.5 MB, $2^{13} = 8,192$ constraints), verify contracts via **Sourcify** (0 API keys) + optional Etherscan V2, and compile Next.js explicitly with `--webpack` + browser polyfills.
8. **Protocol Gap — Missing Cumulative Annual Cap Enforcement:**
   - _Trap:_ Per-claim limits alone allow splitting a $50k claim into 50 consecutive $1k records to bypass policy limits.
   - _Fix:_ Public signal `[7] priorPolicySpent` is bound to `ClaimsVault.policySpent[policyCommitment]` and checked against private `annualLimit` via `LessEqThan(97)(priorPolicySpent + claimAmount, annualLimit)`.

---

## 4. Target Production & Governance Boundaries

- **Chain:** **Ethereum Sepolia** (Chain ID `11155111`, public RPCs `https://ethereum-sepolia-rpc.publicnode.com`, `https://1rpc.io/sepolia`, `https://sepolia.gateway.tenderly.co`). Native **ETH** escrow & settlement only.
- **Strict Production Governance (Zero Demo Backdoors):** `HospitalRegistry` is strictly `Ownable2Step` (no public self-registration backdoor). Demo hospitals, active/expired policy commitments, and initial insurer escrow are deterministically provisioned at deploy time via `DeploySepolia.s.sol`.
- **Host:** **Vercel Hobby** (`apps/web`, free GitHub-linked deployment).
- **Zero-Cost Guarantee (Explicitly Excluded):** Pinata, Alchemy paid tiers, Infura, WalletConnect Cloud, Circle USDC, Chainlink oracles, EigenLayer/Othentic, Gaia external AI nodes, RISC0/Bonsai, real patient HIPAA PHI, break-glass backdoors, and Mainnet real funds.

---

## 5. Monorepo Layout

```text
Qlo/
├── .github/workflows/ci.yml           # Free GH Actions: forge test, circuit vitest, web typecheck & build
├── interfaces/
│   └── claim-zk.md                    # Frozen 8-signal ZK ABI & Poseidon specs
├── circuits/
│   ├── src/
│   │   ├── MerkleProof.circom         # Depth-6 boolean-checked Poseidon Merkle verifier
│   │   └── ClaimValidity.circom       # Production Groth16 claim validity circuit (~4,400 R1CS)
│   ├── scripts/
│   │   ├── download-ptau.mjs          # Polygon Hermez powersOfTau28_hez_final_13.ptau fetcher
│   │   ├── build.mjs                  # Compiles circuit, Phase 2 ceremony, exports verifier + manifest SHA-256
│   │   └── generate-fixtures.mjs      # Generates 2 sequential real Groth16 proofs for Foundry + UI
│   └── test/claimValidity.test.ts     # 11-case Vitest soundness & negative test suite
├── contracts/
│   ├── foundry.toml                   # Solc 0.8.28, OZ v5, Ethereum Sepolia + Sourcify/Etherscan config
│   ├── src/
│   │   ├── HospitalRegistry.sol
│   │   ├── PolicyRegistry.sol
│   │   ├── HealthRecords.sol
│   │   ├── ClaimsVault.sol
│   │   └── Groth16Verifier.sol
│   ├── script/
│   │   ├── DeploySepolia.s.sol
│   │   └── export-abis.mjs
│   └── test/
│       ├── QloProtocol.t.sol          # Real Circom Groth16 proofs verified on-chain
│       └── QloSecurity.t.sol          # 13 security/invariant tests + zero-PHI log audit
├── deployments/
│   └── sepolia.json                   # Canonical deployed contract addresses, deployBlock, zkey SHA-256
├── apps/web/
│   ├── next.config.mjs                # Webpack polyfills, WASM/zkey cache headers
│   ├── public/zk/                     # Preloaded ClaimValidity.wasm, .zkey, verification_key.json, manifest.json
│   └── src/
│       ├── app/                       # /, /patient, /hospital, /insurer, /story
│       ├── components/ui/             # shadcn + Origin UI + EasyUI + Magic UI + React Bits + Motion Primitives
│       └── lib/                       # wagmi, crypto, storage, intake/OCR, merkle, prover.worker, zkeyIntegrity
└── docs/
    ├── CONTRACTS_SPEC.md
    ├── CRYPTO_STORAGE_OCR_SPEC.md
    ├── UI_UX_DESIGN_SPEC.md
    ├── THREAT_MODEL_AND_VERISURE.md
    └── JUDGING_SCRIPT.md
```

---

## 6. 12-Hour Execution Roadmap & Hard Fallback Gates

| Window          | Milestone                                                                                                                                                                  | Hard Verification Gate / Fallback                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **H0 – H1**     | Foundry install (Git Bash), `circom.exe` download, `git init`, workspace & CI setup                                                                                        | `forge --version`, `circom --version`, `pnpm` all green                                                                                          |
| **H1 – H3**     | `MerkleProof.circom` + `ClaimValidity.circom`, Hermez `ptau_13`, `.zkey` Phase 2, SHA-256 manifest, 11 Vitest soundness tests + 2 real fixtures                            | `< 6,000` R1CS constraints, `< 3s` browser prove, 11/11 tests green                                                                              |
| **H3 – H5.5**   | All 4 core Solidity contracts + OZ v5 + real-proof `QloProtocol.t.sol` + 13-test `QloSecurity.t.sol`                                                                       | `forge test --root contracts -vvv` 100% green                                                                                                    |
| **H5.5 – H6.5** | Ethereum Sepolia deploy (`11155111`), Sourcify verification (0 keys, 5/5 `exact_match`), seed escrow & policies, write `deployments/sepolia.json` | All 5 contracts verified & clickable on Sourcify & Etherscan |
| **H6.5 – H9.5** | Next.js Clinical-Ops app (`--webpack`), WebCrypto ECDH+AES-GCM, CIDv1/IndexedDB/`.qlo.json`, CMS-1500/Tesseract OCR, `prover.worker.ts`, MIT animation stack, all 5 routes | **H9 Cutoff:** If optional Helia causes any Webpack friction, drop runtime Helia cleanly and keep `multiformats` CIDv1 + IndexedDB + `.qlo.json` |
| **H9.5 – H11**  | GitHub CI green, Vercel Hobby production deploy, live Ethereum Sepolia E2E settlement & OWASP 2025/CSP perimeter audit | Zero console/SSR/CSP errors; live Etherscan payout tx + zero-PHI scan verified |
| **H11 – H12**   | Final polish, update `README.md` with live explorer links, dry-run 3-minute judging script                                                                                 | Shipped & demo-ready                                                                                                                             |

---

## 7. Installed Skills & MCP Execution Integration

1. **Vercel Plugin (`antigravity-plugins-partners/plugin/vercel-plugin`):**
   - `react-best-practices`: Direct Lucide icon imports (no barrel bloat), `next/dynamic` (`ssr: false`) for OCR/crypto/prover components, `Promise.all` + `viem` multicall across contracts, non-blocking Web Worker proving, background preload of `.wasm`/`.zkey`.
   - `deployments-cicd`, `vercel-cli`, `env-vars`, `verification`: Clean `NEXT_PUBLIC_*` public config discipline (zero private keys), Vercel MCP / CLI production deploy, full-story browser $\to$ RPC $\to$ chain state verification.
2. **Chrome DevTools Plugin (`antigravity-plugins-official/plugin/chrome-devtools-plugin`):**
   - `chrome-devtools`: Live DOM/console/network inspection, Web Worker `.wasm`/`.zkey` fetch caching & proving time verification across all 5 routes.
   - `a11y-debugging`: Automated accessibility snapshot, heading hierarchy, keyboard focus, tap targets, and contrast verification across dark clinical surfaces.
