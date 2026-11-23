# Qlo Protocol — End-to-End Walkthrough & Verification Guide

> **For the 90-Second Hackathon Pitch, Prior-Art Comparison (`VeriSure`), and Judge Q&A Cheat Sheet, see [`docs/HACKATHON_PITCH_AND_DEMO.md`](./docs/HACKATHON_PITCH_AND_DEMO.md).**

---

## 1. Live Ethereum Sepolia Deployment (`Chain ID 11155111`, Block `12194573`)

All 5 Solidity `0.8.28` smart contracts are deployed and **5/5 `exact_match` verified on Sourcify**:

| Contract | Sepolia Address | Purpose |
| :--- | :--- | :--- |
| **`Groth16Verifier`** | `0x587FB82b3429d9Be80e23791809A92DAD352D019` | Pairing check over BN254 (`4,349` R1CS constraints, `8` public signals) |
| **`HospitalRegistry`** | `0xCf150397a7416D54c3828ffaC1B808a5C51B563D` | Stores accredited hospital Poseidon depth-6 Merkle root (`0x07fd69...98daa`) |
| **`PolicyRegistry`** | `0xc37c6A5e705B9aa9eB2680aBb2A72Ebf9080ebCF` | Anchors insurer-signed Poseidon(6) policy commitments |
| **`HealthRecords`** | `0x547273d15522AA461af233e5b4d7abb70D0bD8ce` | Stores 248-bit record commitments, CIDv1 pointers & ECDH-wrapped DEK grants |
| **`ClaimsVault`** | `0xB170D66d32C26168A56516d0aDb464B7762cC559` | Escrows native ETH, checks 8 ZK public signals, tracks cumulative policy spend & settles payouts |

### Verified Live Sepolia Transactions
- **Record #1 Registration (`HealthRecords.registerRecord`):** `0x742035b943904c6bdcde1a6ceeba505efa75b2fccaba2d549860ae5fb350494e`
- **10-Minute ECDH P-256 Wrapped DEK Grant (`HealthRecords.grantAccess`):** `0x155888e6d36bb9849b1f9e066d20e4a10902ed618858d1de666dd12ba0c93cb1`
- **Groth16 Claim Settlement (`ClaimsVault.submitClaim`, `0.005 ETH`, `0` PHI bytes):** `0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0`
- **Escrow Treasury Top-Up (`ClaimsVault.depositEscrow`):** `0x2c0fd149ea3059a677a704bea0dbbb711b02caa9055a94c73962a313a1fd0e8d`

---

## 2. Included Sample Medical Bills (`apps/web/public/samples/`)

You can test the full workflow using any of the **5 included CMS-1500 sample medical bills** either by clicking **OCR Scan** / **Load** directly inside `/patient`, or by downloading the `.png` / `.json` files and uploading them:

1. **`bill-cardiac-er-99285.png` / `.json`** — Metro Cardiac Center · STEMI Emergency (`ICD-10: I21.0`, `CPT: 99285`, `0.01 ETH`) → **Valid Claim #1**
2. **`bill-cardiology-followup-99214.png` / `.json`** — Metro Cardiac Center · Post-MI Follow-Up (`ICD-10: I25.10`, `CPT: 99214`, `0.015 ETH`) → **Valid Cumulative Claim #2 (`0.01 + 0.015 = 0.025 <= 0.03 ETH` cap)**
3. **`bill-ecg-diagnostic-93000.png` / `.json`** — Metro Cardiac Center · 12-Lead ECG (`ICD-10: R07.9`, `CPT: 93000`, `0.004 ETH`) → **Valid Diagnostic Claim**
4. **`bill-chest-xray-71046.png` / `.json`** — Bay General Surgical · Chest X-Ray 2 Views (`ICD-10: J18.9`, `CPT: 71046`, `0.005 ETH`) → **Valid Radiology Claim**
5. **`bill-cosmetic-excluded-15777.png` / `.json`** — Elective Aesthetics Clinic · Uncovered Cosmetic Implant (`ICD-10: Z41.1`, `CPT: 15777`, `0.01 ETH`) → **Fail-Closed Circuit Rejection Test**

---

## 3. Running & Verifying Locally

```bash
# Start the production web application on http://localhost:3000
pnpm --dir apps/web start

# Run circuit tests (11/11), Foundry tests + 128k-call invariant fuzzing (18/18), and Vitest unit tests (15/15)
pnpm circuits:test
forge test --root contracts -vvv
pnpm --dir apps/web test

# Run full Playwright E2E browser audits & live Sepolia bytecode/state verification
pnpm --dir apps/web run audit:browser
pnpm --dir apps/web run audit:multi-actor
pnpm --dir apps/web run audit:ecc
node scripts/verify-live.mjs --url http://127.0.0.1:3000
```

---

## 4. Documentation Index
- [`docs/HACKATHON_PITCH_AND_DEMO.md`](./docs/HACKATHON_PITCH_AND_DEMO.md) — 90-second pitch script, live demo playbook, prior-art benchmark & judge Q&A.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — System architecture, dataflow diagrams & trust boundaries.
- [`docs/CIRCUIT_SPEC.md`](./docs/CIRCUIT_SPEC.md) — `ClaimValidity(6)` R1CS constraints, 8 public signals & BN254 bit-length safety.
- [`docs/CONTRACTS_SPEC.md`](./docs/CONTRACTS_SPEC.md) — Solidity contract interfaces, state machines & custom errors.
- [`docs/CRYPTO_STORAGE_OCR_SPEC.md`](./docs/CRYPTO_STORAGE_OCR_SPEC.md) — WebCrypto AES-256-GCM, ECDH P-256 DEK wrapping, CIDv1 & local Tesseract WASM OCR.
- [`docs/THREAT_MODEL_AND_AUDIT.md`](./docs/THREAT_MODEL_AND_AUDIT.md) — STRIDE analysis, cryptographic honesty boundaries & audit checklists.
