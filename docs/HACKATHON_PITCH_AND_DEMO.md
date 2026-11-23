# Qlo — Hackathon Presentation, Architecture Study Guide & Live Judge Playbook

> **Live Network:** Ethereum Sepolia (`Chain ID 11155111`, Deployed & 5/5 `exact_match` Verified on Sourcify at Block `12194573`)  
> **Cryptographic Engine:** Groth16 over BN254 (`4,349` R1CS constraints, `8` frozen public signals) + WebCrypto `AES-256-GCM` & `ECDH P-256` + Browser-Local `Tesseract.js` WASM OCR  
> **License & Stack:** 100% Free & Open-Source (`MIT`) — Zero Paid SaaS APIs, Zero External PHI Servers

---

## 1. The 90-Second Winning Hackathon Pitch

### The Problem (\$4.5 Trillion Healthcare Friction vs. Privacy Paradox)
Every health insurance claim today forces a false choice:
1. **Traditional Clearinghouses:** Hospitals transmit raw patient diagnoses (`ICD-10`), procedures (`CPT`), prescriptions, and clinical notes across third-party servers, creating massive PHI breachhoneypots and 30–90 day manual adjudication delays.
2. **Naive Blockchain / AI Claims:** Putting medical records on-chain—or sending patient bills to off-chain AI servers for OCR—violates patient privacy and leaks sensitive medical histories forever.

### Our Solution: **Qlo Protocol**
**Qlo** is a live, zero-knowledge health insurance settlement protocol and patient-sovereign record vault on **Ethereum Sepolia**:
1. **100% Client-Side OCR & AES-256-GCM Vault (`/patient`):** Patients scan or upload any CMS-1500 medical bill (`PNG` or `JSON`) directly in their browser using local **Tesseract.js WASM OCR**. Zero bytes leave the device during OCR. The clinical payload is encrypted locally with a fresh 256-bit **AES-256-GCM** Data Encryption Key (DEK), anchored on-chain via a 248-bit truncated SHA-256 commitment and IPFS CIDv1, and shared with a hospital via a time-bound, revocable **ECDH P-256** wrapped DEK.
2. **Sub-Second In-Browser Groth16 Proving (`/hospital`):** The accredited hospital unwraps the DEK locally, inspects the record (with instant **HL7 FHIR R4** & **ANSI X12 837P** EDI generation), and generates a **4,349-constraint Groth16 BN254 proof** in a browser Web Worker (`~400–600ms`).
3. **Instant Atomic ETH Payout with 0 Bytes of PHI (`/insurer`):** `ClaimsVault.sol` verifies all **8 clinical and financial invariants** on Ethereum Sepolia and transfers native ETH to the hospital in the same transaction—while exposing **0 bytes of medical data** on-chain.

---

## 2. Why Qlo Wins Against Prior Art (`VeriSure` — ETHDenver 2025)

| Dimension | VeriSure (ETHDenver 2025 Prior Art) | **Qlo Protocol (Our System)** |
| :--- | :--- | :--- |
| **Bill Intake & OCR Privacy** | Off-chain Gaia AI nodes parse claims (raw PHI leaves the patient's device) | **100% browser-local Tesseract WASM OCR** (`/public/ocr/*.wasm.js`) — **0 bytes of PHI ever leave the browser** |
| **What Zero-Knowledge Proves** | Proves form completeness only; policy coverage & caps left as future work | **Proves 8 real financial & clinical predicates** in `4,349` R1CS constraints: hospital accreditation Merkle tree, active policy commitment, policy expiry, covered CPT Merkle tree, positive claim amount, **cumulative private annual policy cap**, deterministic anti-replay nullifier, and anti-front-running `msg.sender` binding |
| **Settlement Trust Model** | Off-chain EigenLayer / Othentic AVS operators + RISC0 zkVM (`~2 min` latency) | **Direct on-chain verification** inside `ClaimsVault.sol` + `Groth16Verifier.sol` on Ethereum Sepolia (`< 1s` browser proof, atomic ETH payout) |
| **Patient Data Sovereignty** | No client encryption, DEK wrapping, or on-chain revocation enforcement | **AES-256-GCM + ECDH P-256 wrapped DEK** with on-chain `revokeAccess` that immediately blocks both decryption and `ClaimsVault` settlement |
| **Healthcare Standards** | Custom JSON only | Native **CMS-1500**, **HL7 FHIR R4 `Claim`**, **ANSI X12 837P** (`005010X222A1`), and **Zero-PHI ANSI X12 835 ERA** (`005010X221A1`) |

---

## 3. Ready-to-Use Sample Medical Bills (Included in App & `/public/samples/`)

We built **5 realistic, synthetic CMS-1500 hospital invoices** (available both as 1-click **OCR Scan / Load** cards inside `/patient` and as downloadable `.png` + `.json` files in `apps/web/public/samples/`):

| Sample Bill File | Facility & Clinical Scenario | ICD-10 | CPT | Claim Amount | Expected Protocol Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`bill-cardiac-er-99285.png`](../apps/web/public/samples/bill-cardiac-er-99285.png) | **Metro Cardiac Center** — Acute Anterior STEMI ER Stabilization | `I21.0` | `99285` | `0.0100 ETH` | **VALID (Claim #1):** Passes all 8 Groth16 predicates & settles `+0.0100 ETH` |
| [`bill-cardiology-followup-99214.png`](../apps/web/public/samples/bill-cardiology-followup-99214.png) | **Metro Cardiac Center** — Post-MI 14-Day Outpatient Cardiology Follow-Up | `I25.10` | `99214` | `0.0150 ETH` | **VALID (Cumulative Claim #2):** Proves `0.010 + 0.015 = 0.025 ETH <= 0.030 ETH` private annual cap |
| [`bill-ecg-diagnostic-93000.png`](../apps/web/public/samples/bill-ecg-diagnostic-93000.png) | **Metro Cardiac Center** — 12-Lead Diagnostic ECG & Cardiologist Report | `R07.9` | `93000` | `0.0040 ETH` | **VALID (Diagnostic Claim):** Covered cardiology CPT leaf in Poseidon depth-6 tree |
| [`bill-chest-xray-71046.png`](../apps/web/public/samples/bill-chest-xray-71046.png) | **Bay General Surgical** — Chest Radiograph 2-View Thoracic Imaging | `J18.9` | `71046` | `0.0050 ETH` | **VALID (Radiology Claim):** Covered radiology CPT leaf (`71046`) |
| [`bill-cosmetic-excluded-15777.png`](../apps/web/public/samples/bill-cosmetic-excluded-15777.png) | **Elective Aesthetics Clinic** — Uncovered Cosmetic Biologic Implant | `Z41.1` | `15777` | `0.0100 ETH` | **FAIL-CLOSED REJECT:** CPT `15777` is excluded from `coveredCptRoot`; witness generation fails closed |

---

## 4. Step-by-Step Live Judge Demo Playbook (3 Minutes)

### Step 1 — Protocol Overview (`/`)
- Show the live **Qlo Protocol** dashboard connected to **Ethereum Sepolia (`11155111`)**.
- Point out the 4 live metrics: **ClaimsVault Escrow (`0.0200 ETH` live on Sepolia)**, **Claims Settled**, **Accredited Hospital Poseidon Root (`0x07fd69...98daa`)**, and **Zero-Knowledge Circuit (`4,349 R1CS · 0 bytes PHI`)**, plus the 5 Sourcify-verified contracts.

### Step 2 — Patient Records Vault (`/patient`)
1. Under **Sample Medical Bills & Invoices**, click **OCR Scan** on **Cardiac STEMI Emergency Stabilization (`0.01 ETH`)** (or click **PNG** to download `bill-cardiac-er-99285.png` and upload it via the **Upload** button).
2. Watch browser-local **Tesseract.js WASM OCR** extract `Policy: 2026001`, `Patient: SYNTH-CASE-042`, `ICD-10: I21.0`, `CPT: 99285`, `Amount: 0.01 ETH`, and `NPI: 1234567890` in `< 1s` (`7/7 Ready`).
3. Click **Encrypt Record on Device** → generates a fresh 256-bit AES-GCM key, computes the 248-bit `recordCommitment`, and stores the ciphertext envelope in IndexedDB.
4. Click **Save Fingerprint On-Chain** → anchors `recordCommitment` + `CIDv1` in `HealthRecords.sol`.
5. Click **Grant Access** → wraps the AES-256-GCM DEK with the hospital's **ECDH P-256** public key for a 10-minute window.

### Step 3 — Hospital Claims Prover & Attack Lab (`/hospital`)
1. Click **Unlock & View Patient Record** → unwraps the ECDH P-256 DEK locally and decrypts the STEMI encounter in the browser.
2. Expand **HL7 FHIR R4 & X12 837P** to show enterprise healthcare interoperability (`resourceType: "Claim"` and ANSI X12 `005010X222A1`).
3. Click **Generate ZK Proof** → runs `snarkjs.groth16.fullProve` inside a Web Worker (`~400ms`), outputting `Proof Ready` and all 8 public signals.
4. Click **Submit Claim & Receive ETH** → settles `+0.0100 ETH` from `ClaimsVault`.
5. Scroll to **Fail-Closed Security Guardrails (Attack Lab)** and click all 5 attack buttons:
   - **Attack 1 (Replay Nullifier):** Reverts with `NullifierAlreadyUsed()`.
   - **Attack 2 (Uncovered CPT `15777`):** Circuit fails closed on Poseidon Merkle inclusion.
   - **Attack 3 (Expired Policy `2025099`):** Circuit fails closed on `claimTimestamp <= policyExpiry`.
   - **Attack 4 (Over Annual Cap `0.04 ETH > 0.03 ETH`):** Circuit fails closed on `priorPolicySpent + claimAmount <= annualLimit`.
   - **Attack 5 (Post-Revoke Claim):** After clicking **Revoke** in `/patient`, `ClaimsVault` reverts with `PatientAccessNotActive()`.

### Step 4 — Insurer Escrow Treasury (`/insurer`) & Protocol Spec (`/story`)
1. Open `/insurer` → inspect the settled transaction in the **Forensic Zero-PHI Calldata Inspector** (`0 Medical Bytes Found`) and click **835 ERA** to download a compliant Zero-PHI ANSI X12 835 Electronic Remittance Advice.
2. Open `/story` → show the live browser **WebCrypto SHA-256 verification** of `/zk/ClaimValidity.zkey` (`MATCHED`) and the 5 Sourcify-verified Sepolia contracts.

---

## 5. Judge Technical Q&A Cheat Sheet

1. **"How do you stop a hospital from submitting the same medical bill twice with a different random nonce?"**
   - In `ClaimValidity.circom`, the nullifier is **deterministic**: `nullifier = Poseidon(policySalt, policyId, recordCommitment)`. There is no free nonce input. The same encrypted medical record under the same policy always produces the exact same nullifier scalar, which `ClaimsVault.sol` permanently marks in `nullifierUsed[nullifier]`.
2. **"How do you enforce an annual coverage cap across multiple claims without revealing the patient's identity or total policy limit on-chain?"**
   - `ClaimsVault.sol` tracks `policySpent[policyCommitment]` keyed by the opaque Poseidon commitment `Poseidon(policyId, patientCommit, policyExpiry, annualLimit, coveredCptRoot, policySalt)`. Public signal `[7]` binds `priorPolicySpent` on-chain, while the circuit privately proves `priorPolicySpent + claimAmount <= annualLimit` using 97-bit range-checked comparators (`Num2Bits(96)`).
3. **"Can an MEV bot front-run a hospital's valid ZK proof in the mempool and steal the ETH payout?"**
   - No. Public signal `[6]` (`hospitalAddress`) is cryptographically bound inside the Groth16 proof AND checked in `ClaimsVault.sol` against `uint256(uint160(msg.sender))`. If an attacker submits the proof from any other wallet, `ClaimsVault` reverts immediately with `HospitalSenderMismatch()`.
4. **"Why truncate the SHA-256 recordCommitment to 248 bits?"**
   - The BN254 scalar field prime $r$ is $\approx 2^{253.6}$. A full 256-bit SHA-256 digest can exceed $r$ and alias modulo $r$. Truncating to the lower 248 bits (31 bytes) guarantees every commitment fits injectively inside a single BN254 field element without modulo wrap-around collisions.
5. **"What are the live Ethereum Sepolia contract addresses?"**
   - `Groth16Verifier`: `0x587FB82b3429d9Be80e23791809A92DAD352D019`
   - `HospitalRegistry`: `0xCf150397a7416D54c3828ffaC1B808a5C51B563D`
   - `PolicyRegistry`: `0xc37c6A5e705B9aa9eB2680aBb2A72Ebf9080ebCF`
   - `HealthRecords`: `0x547273d15522AA461af233e5b4d7abb70D0bD8ce`
   - `ClaimsVault`: `0xB170D66d32C26168A56516d0aDb464B7762cC559`
   - Live Sepolia Groth16 Claim Settlement Tx: `0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0`
