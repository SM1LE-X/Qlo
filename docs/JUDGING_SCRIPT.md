# Qlo 3-Minute Judging Script & Live Ethereum Sepolia Acceptance Playbook

> **Audience:** Track judges with ~3 minutes per team. Every click proves a concrete cryptographic predicate, fail-closed attack resistance, or on-chain patient sovereignty—with **zero fake mocks** and **live Ethereum Sepolia (`11155111`) Etherscan & Sourcify verification**.

---

## 1. Exact 3-Minute Live Demo Script

### `0:00 – 0:25` | Hook & 3-Step Overview (`/`)
- **Action:** Open Qlo on `/` (`http://localhost:3000` or deployed Vercel URL). Point to the clean top navigation (`1. Patient → 2. Hospital → 3. Insurer | How it works`) and the **Ethereum Sepolia (`11155111`)** network badge.
- **Pitch:** *"Last year, the Change Healthcare clearinghouse breach affected 192.7 million patients and cost $2.45 billion because clearinghouses hold unencrypted PHI for weeks. Qlo lets patients encrypt their own medical bills in the browser, lets hospitals prove **all 8 coverage and consent predicates mathematically in Groth16 in under 3 seconds**, and settles native ETH on Ethereum Sepolia—with **zero PHI on-chain** and **$0 infrastructure cost**."*

### `0:25 – 1:05` | Step 1: Patient Sovereignty & Local OCR (`/patient`)
- **Action:**
  1. Select **Case A (Emergency Heart Attack — ICD `I21.0`, CPT `99285`, `0.01 ETH`)**—or upload/generate the sample CMS-1500 bill image to show **100% browser-local `tesseract.js` OCR** + completeness validation.
  2. Click **Encrypt Locally (AES-256-GCM)** $\to$ `DecryptedText` scrambles clinical data into ciphertext; show deterministic **IPFS CIDv1** (`bafkrei...`) + **248-bit `recordCommitment`**.
  3. Click **Register Record On-Chain** $\to$ confirm in MetaMask (`HealthRecords`).
  4. Click **Grant 10-Min Access** to your connected hospital wallet $\to$ wraps the DEK via **ECDH P-256** and stores the opaque `encryptedDek` on Ethereum Sepolia; live countdown ticks down. Click **Continue to Step 2: Hospital**.

### `1:05 – 1:55` | Step 2: Hospital `< 3s` ZK Prove & Live Etherscan Settlement (`/hospital` $\to$ `/insurer`)
- **Action:**
  1. If prompted by the inline banner on first use in a fresh browser, click **Register Hospital Key** once (`HospitalRegistry.registerEncryptionPubKey`).
  2. Click **Unwrap DEK & Decrypt** $\to$ record unlocks cleanly in-browser and logs `RecordAccessed`.
  3. Click **Generate Claim Validity Proof** $\to$ watch the Web Worker prove all **8 Groth16 predicates** in `< 3 seconds` across the 4 plain-English checks (Approved Hospital, Policy Active & Under Limit, Covered Procedure, Fresh Non-Replayable Proof).
  4. Click **Submit & Auto-Settle Claim** $\to$ `ClaimsVault` verifies the BN254 Groth16 pairing + active patient grant and transfers **`0.01 ETH`** atomically to the hospital. Click **Continue to Step 3: Insurer**.
  5. On `/insurer`, inspect the live **Split-Screen "What the Chain Sees vs. What Stays Private"** panel (already populated with our live mined Sepolia settlement [`0xf8cb4e31...aa2ed0`](https://sepolia.etherscan.io/tx/0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0) plus your newly settled claim!) $\to$ show **Sepolia Etherscan tx** + **`0 PHI BYTES FOUND`** (`I21.0`, `99285`, Rx completely absent from calldata and events!).

### `1:55 – 2:35` | Fail-Closed Attack Lab (`/hospital` → Advanced Demo Tools)
- **Action:** Expand **Advanced Demo Tools** on `/hospital` and fire the interactive **Security Attack Lab** presets:
  1. **Replay Attack:** Re-submits an already settled proof $\to$ Ethereum Sepolia reverts with `NullifierAlreadyUsed()`.
  2. **Uncovered CPT (`15777`):** Prover fails closed immediately at Predicate #4 (`coveredCptRoot` mismatch).
  3. **Expired Policy / Backdate:** Prover fails closed at Predicate #3; backdated proof reverts on-chain with `ClaimTimestampOutOfWindow()`.
  4. **Over Cumulative Annual Cap (`0.04 ETH > 0.03 ETH`):** Prover fails closed at Predicate #6—while `annualLimit` remains strictly private!

### `2:35 – 3:00` | Instant Revoke & Cryptographic Trust Center (`/patient` $\to$ `/hospital` $\to$ `/story`)
- **Action:**
  1. Return to `/patient` $\to$ click **Revoke Access** $\to$ confirm `AccessRevoked` event on Ethereum Sepolia.
  2. Return to `/hospital` $\to$ attempt decryption / settlement $\to$ immediately blocked (`PatientAccessNotActive()`, `getGrant` returns empty DEK).
  3. Open `/story` (`How it works`) to show all 5 **Sourcify `exact_match`** contracts, the live in-browser **`.zkey` SHA-256** verification widget, STRIDE threat model, and Qlo vs. VeriSure comparison table.

---

## 2. 7-Point Live Ethereum Sepolia Acceptance Checklist

| # | Acceptance Check | Expected Proof |
|---|---|---|
| 1 | App loads with MetaMask connected to **Ethereum Sepolia (`11155111`)** | Green Sepolia network badge, CSP active, `.zkey` SHA-256 verified, zero console errors |
| 2 | `ClaimsVault` holds funded native ETH escrow (`0.0200 ETH` seeded live) | `insurerEscrow` balance updates via `EscrowDeposited` event |
| 3 | Patient encrypts CMS-1500 bill, registers CIDv1 + commitment, grants 10–30m access | `RecordRegistered` + `AccessGranted` on Sepolia Etherscan; live countdown active |
| 4 | Hospital unwraps DEK, proves in `< 3s`, settles claim | Etherscan tx shows `Groth16Verifier` success + ETH payout + **0 ICD/CPT/Rx in calldata** (pre-verified live tx: [`0xf8cb4e31...`](https://sepolia.etherscan.io/tx/0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0)) |
| 5 | Replay identical proof | Reverts on-chain (`NullifierAlreadyUsed()`) |
| 6 | Uncovered CPT / Expired Policy / Over Cap attacks | Fail closed in prover or revert (`ClaimTimestampOutOfWindow()`)—never settle ETH |
| 7 | Patient revokes access | `AccessRevoked` on Etherscan; hospital decryption & settlement blocked (`PatientAccessNotActive()`) |

---

## 3. Free Ethereum Sepolia Faucets & Explorer Links ($0 Stack)

- **Public Ethereum Sepolia RPCs:** `https://ethereum-sepolia-rpc.publicnode.com` | `https://1rpc.io/sepolia` | `https://sepolia.gateway.tenderly.co`
- **Free Faucets (No Paid Keys):**
  - **Google Cloud Web3 Sepolia Faucet:** `https://cloud.google.com/application/web3/faucet/ethereum/sepolia`
  - **Alchemy Ethereum Sepolia Faucet:** `https://www.alchemy.com/faucets/ethereum-sepolia`
  - **Sepolia PoW Faucet:** `https://sepolia-faucet.pk910.de`
- **Contract Explorers & Verifiers:**
  - **Sourcify (`5 / 5 exact_match`, Zero-Key):** `https://repo.sourcify.dev/contracts/full_match/11155111/`
  - **Ethereum Sepolia Etherscan:** `https://sepolia.etherscan.io`

---

## 4. Emergency Venue Wi-Fi Fallback Protocol

If conference Wi-Fi temporarily throttles public Ethereum Sepolia RPC or MetaMask popups during live judging:
1. Run the **entire cryptographic workflow locally in-browser**: CMS-1500 intake + `tesseract.js` OCR + AES-256-GCM encryption + `.qlo.json` encrypted bundle + **real `< 3s` Web Worker Groth16 proving** + **Fail-Closed Attack Lab** (Uncovered CPT / Expired Policy / Over Cap all fail mathematically inside WebAssembly with zero RPC dependency!).
2. Open the pre-verified **Sepolia Etherscan & Sourcify URLs** recorded in `deployments/sepolia.json` and `README.md`, including our live verified zero-PHI claim settlement tx [`0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0`](https://sepolia.etherscan.io/tx/0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0).
