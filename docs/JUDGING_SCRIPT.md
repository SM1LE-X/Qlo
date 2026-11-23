# Qlo 3-Minute Judging Script & Live Base Sepolia Acceptance Playbook

> **Audience:** Track judges with ~3 minutes per team. Every click proves a concrete cryptographic predicate, a fail-closed attack resistance, or on-chain patient sovereignty—with **zero fake mocks** and **live Base Sepolia explorer verification**.

---

## 1. Exact 3-Minute Live Demo Script

### `0:00 – 0:25` | Hook & Mission Control (`/`)
- **Action:** Open deployed Vercel URL on `/` (Mission Control). Point to the live Base Sepolia contract badges (`Sourcify Verified`) and the `AnimatedBeam` flow.
- **Pitch:** *"Last year, the Change Healthcare clearinghouse breach affected 192.7 million patients and cost $2.45 billion because clearinghouses hold unencrypted PHI for weeks. Naive blockchain demos only check form completeness or rely on external AVS operators. Qlo proves **all 8 coverage and consent predicates mathematically in Groth16 in under 3 seconds in the browser** and settles native ETH on Base Sepolia—for $0."*

### `0:25 – 1:05` | Patient Sovereignty & Local OCR (`/patient`)
- **Action:**
  1. Select **Case A (Valid STEMI Cardiac Encounter — ICD `I21.0`, CPT `99285`, `0.01 ETH`)**—or drop the sample CMS-1500 bill image to show **100% browser-local `tesseract.js` OCR** + deterministic form completeness checks passing.
  2. Click **Encrypt Locally (AES-256-GCM)** $\to$ `DecryptedText` scrambles clinical data into ciphertext; show deterministic **IPFS CIDv1** (`bafkrei...`) + **248-bit `recordCommitment`**.
  3. Click **Register Record On-Chain** $\to$ confirm in MetaMask.
  4. Click **Grant 10-Min Access** to Hospital $\to$ browser wraps the DEK via **ECDH P-256** and stores the opaque `encryptedDek` on-chain; `SlidingNumber` countdown ticks down live.

### `1:05 – 1:55` | Hospital `< 3s` ZK Prove & Live Basescan Settlement (`/hospital` $\to$ `/insurer`)
- **Action:**
  1. Switch MetaMask to the seeded **Hospital** wallet (or view the pre-authorized account).
  2. Click **Unwrap DEK & Decrypt** $\to$ record unlocks cleanly and fires `logAccess()`.
  3. Click **Generate Claim Validity Proof** $\to$ watch all **8 predicates** turn emerald in `< 3 seconds` inside the Web Worker.
  4. Click **Submit & Auto-Settle Claim** $\to$ `ClaimsVault` verifies the Groth16 pairing + active patient grant and transfers **`0.01 ETH`** atomically to the hospital.
  5. Open `/insurer` **Split-Screen "What the Chain Sees vs. Private Clinical Reality"**, paste/click the live tx hash, click **Inspect Live Base Sepolia Calldata** $\to$ show **Basescan tx** + **`0 PHI BYTES FOUND`** (`I21.0`, `99285`, Rx completely absent from calldata and events!).

### `1:55 – 2:35` | Fail-Closed Attack Lab (`/hospital`)
- **Action:** Fire the interactive **Attack Lab** presets one by one:
  1. **Replay Attack:** Re-submits exact Claim #1 proof $\to$ Base Sepolia reverts with `NullifierAlreadyUsed()`.
  2. **Uncovered CPT (`15777`):** Prover fails closed immediately at Predicate #4 (`coveredCptRoot` mismatch).
  3. **Expired Policy / Backdate:** Prover fails closed at Predicate #3; backdated proof reverts on-chain with `ClaimTimestampOutOfWindow()`.
  4. **Over Cumulative Annual Cap (`0.04 ETH > 0.03 ETH`):** Prover fails closed at Predicate #6—while `annualLimit` remains private!

### `2:35 – 3:00` | Instant Revoke & Cryptographic Honesty (`/patient` $\to$ `/hospital` $\to$ `/story`)
- **Action:**
  1. Return to `/patient` $\to$ click **Revoke Access** $\to$ confirm `AccessRevoked` event on Base Sepolia.
  2. Return to `/hospital` $\to$ attempt decryption / settlement $\to$ immediately blocked (`PatientAccessNotActive()`, `getGrant` returns empty DEK).
  3. Flash `/story` to show the STRIDE Threat Model, live in-browser `.zkey` SHA-256 verification widget, and Qlo vs. VeriSure comparison table.

---

## 2. 7-Point Live Base Sepolia Acceptance Checklist

| # | Acceptance Check | Expected Proof |
|---|---|---|
| 1 | Live Vercel Hobby URL loads with MetaMask connected to **Base Sepolia (`84532`)** | Green network badge, `.zkey` SHA-256 verified, zero console errors |
| 2 | Insurer deposits Base Sepolia faucet ETH into `ClaimsVault` | `insurerEscrow` balance updates via `EscrowDeposited` event |
| 3 | Patient encrypts CMS-1500 bill, registers CIDv1 + commitment, grants 10–30m access | `RecordRegistered` + `AccessGranted` on explorer; `SlidingNumber` countdown active |
| 4 | Hospital unwraps DEK, proves in `< 3s`, settles claim | Basescan tx shows `Groth16Verifier` success + ETH transfer + **0 ICD/CPT/Rx in calldata** |
| 5 | Replay identical proof | Reverts on-chain (`NullifierAlreadyUsed()`) |
| 6 | Uncovered CPT / Expired Policy / Over Cap attacks | Fail closed in prover or revert (`ClaimTimestampOutOfWindow()`)—never settle ETH |
| 7 | Patient revokes access | `AccessRevoked` on explorer; hospital decryption & settlement blocked (`PatientAccessNotActive()`) |

---

## 3. Free Base Sepolia Faucets & Explorer Links ($0 Stack)

- **Public Base Sepolia RPCs:** `https://sepolia.base.org` | `https://base-sepolia-rpc.publicnode.com`
- **Free Faucets (No Paid Keys):**
  - **Coinbase Developer Platform (CDP) Faucet:** Search Coinbase CDP Faucet (free developer login; drips Base Sepolia ETH)
  - **Thirdweb Base Sepolia Portal:** `https://thirdweb.com/base-sepolia-testnet`
  - **Alchemy Base Sepolia Faucet:** `https://www.alchemy.com/faucets/base-sepolia`
- **Contract Explorers & Verifiers:**
  - **Sourcify (Zero-Key Verification):** `https://repo.sourcify.dev/contracts/full_match/84532/`
  - **Basescan Sepolia:** `https://sepolia.basescan.org`
  - **Blockscout Base Sepolia:** `https://base-sepolia.blockscout.com`

---

## 4. Emergency Venue Wi-Fi Fallback Protocol

If conference Wi-Fi temporarily throttles public Base Sepolia RPC or MetaMask popups during live judging:
1. Run the **entire cryptographic workflow locally in-browser**: CMS-1500 intake + `tesseract.js` OCR + AES-256-GCM encryption + `.qlo.json` encrypted bundle + **real `< 3s` Web Worker Groth16 proving** + **Fail-Closed Attack Lab** (Uncovered CPT / Expired Policy / Over Cap all fail mathematically inside WebAssembly with zero RPC dependency!).
2. Open the pre-verified **Basescan / Sourcify explorer URLs** recorded in `deployments/base-sepolia.json` and `README.md` showing settled claim calldata and `ClaimSettled` events with zero PHI.
