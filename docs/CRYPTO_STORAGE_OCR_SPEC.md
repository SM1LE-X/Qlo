# Qlo — Client Cryptography, Decentralized Storage & CMS-1500 OCR Spec

> **Design Principle:** Zero unencrypted PHI ever leaves the patient's or hospital's browser—neither to RPC nodes, nor to IPFS/Helia peers, nor to external AI OCR servers. Every cryptographic primitive runs natively via **WebCrypto**, **`multiformats`**, **`circomlibjs`**, **`snarkjs`**, and client-only **`tesseract.js`**.

---

## 1. End-to-End Encryption & ECDH Key Wrapping (`apps/web/src/lib/crypto.ts`)

### 1.1 Record Encryption (AES-256-GCM)

1. Generate a fresh per-record 256-bit Data Encryption Key (`DEK`) via `crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])`.
2. Generate a random 96-bit `iv = crypto.getRandomValues(new Uint8Array(12))`.
3. Serialize the structured synthetic CMS-1500 medical payload (`JSON.stringify(recordPayload)`) to UTF-8 bytes and encrypt with AES-256-GCM.
4. Construct the canonical **Ciphertext Envelope Bytes**:
   $$\text{envelopeBytes} = \text{JSON.stringify}(\{\ \text{version: 1, alg: "AES-256-GCM", ivBase64, ciphertextBase64}\ \})$$
5. Compute the **BN254 Field-Safe 248-Bit Record Commitment**:
   - `sha256Bytes = await crypto.subtle.digest("SHA-256", envelopeBytes)`
   - `recordCommitment = BigInt("0x" + toHex(sha256Bytes)) >> 8n`
   - `recordCommitmentHex = "0x" + recordCommitment.toString(16).padStart(64, "0")` (top byte `0x00`, strictly $< 2^{248} < \text{SNARK\_SCALAR\_FIELD}$).

### 1.2 Hospital Key Management (ECDH P-256)

1. On `/hospital`, the hospital browser loads or generates an **ECDH P-256** keypair via WebCrypto (`extractable: false` private key stored in IndexedDB `qlo-keys`, or deterministic test keypair for canonical demo hospitals so multi-tab demos stay seamless) and exports the **65-byte uncompressed raw public key** (`0x04 || X(32) || Y(32)`).
2. The hospital registers that 65-byte key in `HospitalRegistry.registerEncryptionPubKey(pubKeyBytes)` (or via the 1-click **Register Hospital Key** button on `/hospital`).

### 1.3 Patient Grant DEK Wrapping & Revocation

1. When the patient clicks **Grant Access** for a target `hospital` address:
   - Read `pubKeyBytes = await hospitalRegistry.hospitalEncryptionPubKey(hospital)`.
   - Generate an **ephemeral ECDH P-256 keypair** (`ephemeralPub` 65 bytes + `ephemeralPriv`).
   - Derive a 256-bit shared AES-GCM key-wrapping key via `ECDH(ephemeralPriv, hospitalPubKey)` $\to$ `HKDF-SHA256(info: "qlo-dek-wrap-v1")`.
   - Generate a random 12-byte `wrapIv` and AES-256-GCM encrypt the raw 32-byte record `DEK` $\to$ `wrappedDek` (48 bytes including 16-byte GCM tag).
   - Pack binary `encryptedDek = ephemeralPub (65B) || wrapIv (12B) || wrappedDek (48B)` (**125 bytes total**, fits well under `HealthRecords` 512-byte limit).
   - Submit `healthRecords.grantAccess(recordId, hospital, durationSeconds, encryptedDek)`.
2. When the hospital clicks **Fetch & Unwrap Record**:
   - Reads `(expiresAt, encryptedDek)` via `healthRecords.getGrant(recordId, hospitalAddress)`.
   - If expired or revoked, `HealthRecords.getGrant` returns `(0, "0x")` and `hasActiveAccess` returns `false`—hospital UI displays **`ACCESS BLOCKED: PATIENT GRANT EXPIRED OR REVOKED`**.
   - Otherwise slices `ephemeralPub` (65B), `wrapIv` (12B), `wrappedDek` (48B), unwraps `DEK` using hospital's private ECDH P-256 key, decrypts the AES-256-GCM envelope, and calls `healthRecords.logAccess(recordId)` to record the immutable `RecordAccessed` event.
3. On **Revoke Access**:
   - Patient executes `healthRecords.revokeAccess(recordId, hospital)`.
   - Contract immediately sets `expiresAt = 0` and deletes `encryptedDek`; `ClaimsVault.submitClaim()` reverts with `PatientAccessNotActive()`.

---

## 2. Content-Addressed Storage & Portability (`apps/web/src/lib/storage.ts`)

| Storage Layer | Role | Mechanism & Cost |
|---|---|---|
| **Deterministic IPFS CIDv1** | Content-addressed cryptographic identifier stored on-chain in `HealthRecords.cid` | `CID.createV1(0x55, await sha256.digest(envelopeBytes)).toString()` (`raw` codec `0x55` + `sha2-256`, yielding canonical `bafkrei...` base32 CID). **$0**. |
| **IndexedDB (`qlo-vault`)** | Primary zero-flake local blockstore | Keyed by `cid` AND `recordCommitmentHex`. Ensures patient $\to$ hospital handoff works 100% deterministically in browser demos even on restricted hackathon Wi-Fi. **$0**. |
| **`.qlo.json` Encrypted Bundle** | Cross-browser / cross-device portability | 1-click export/import JSON containing `{ schema: "qlo.encrypted-record.v1", recordId, cid, recordCommitment, envelope }` (strictly ciphertext only—never plaintext or unwrapped DEK!). Importer re-computes `CIDv1` and 248-bit `recordCommitment` and verifies exact match before accepting! **$0**. |
| **Optional Lazy Helia Worker** | Best-effort P2P IPFS publish | Loaded strictly asynchronously after encryption with a **3.0-second timeout** and graceful `"IndexedDB Primary / Helia Offline-Safe"` status pill. **Hard H9 Build Cutoff:** If `helia` causes any Next.js Webpack polyfill regression, disable the Helia background import while retaining exact `multiformats` CIDv1 + IndexedDB + `.qlo.json` parity. |

---

## 3. Qlo Browser-Local CMS-1500 Intake, OCR & Validation (`apps/web/src/lib/intake.ts`)

Qlo performs full CMS-1500 document extraction, OCR, and form completeness checking **100% inside the client browser**—sending zero bytes of PHI to external AI endpoints—and immediately feeds the validated claim into Groth16 coverage enforcement.

### 3.1 Canonical CMS-1500 (02/12) Synthetic Claim Schema

| CMS-1500 Box | Field Name | Format / Example | Private vs. On-Chain |
|---|---|---|---|
| **Box 1a** | `insuredPolicyId` | Numeric policy ID (`e.g., 2026001`) | **Private only** (hashed into `policyCommitment`) |
| **Box 2** | `patientAlias` | Synthetic pseudonym (`e.g., "SYNTH-CASE-042"`) | **Private only** (AES-GCM encrypted) |
| **Box 21 (Ind `0`)** | `icd10Code` | ICD-10-CM without/with dot (`e.g., "I21.0"`) | **Private only** (never enters ZK public inputs or chain) |
| **Box 24A** | `serviceDate` | ISO Date / Unix seconds (`claimTimestamp`) | Public timestamp window `[now - 900s, now + 60s]` |
| **Box 24D** | `cptCode` | 5-digit numeric CPT (`e.g., "99285"`) | **Private only** (proven $\in$ `coveredCptRoot` in ZK!) |
| **Box 24F** | `claimAmountWei` | Claim payout in ETH/wei (`e.g., "0.01"`) | Public `claimAmount` (transferred on-chain on settle) |
| **Box 24J** | `renderingNpi` | 10-digit NPI (`e.g., "1234567890"`) | **Private only** (`hospitalLicenseId` in hospital leaf) |
| **Rx / Clinical** | `prescription` & `notes` | Text string (e.g., `"Aspirin 325mg + Ticagrelor"`) | **Private only** (AES-GCM encrypted) |

### 3.2 Three Zero-Cost Client Intake Modes

1. **Five 1-Click Synthetic CMS-1500 Presets:**
   - **Case A (Valid Primary Claim):** STEMI Emergency (`I21.0`, CPT `99285`, `0.01 ETH`, Active Policy) $\to$ passes Completeness + all 8 ZK predicates.
   - **Case B (Valid 2nd Cumulative Claim):** Cardiology Follow-up (`I25.10`, CPT `99214`, `0.015 ETH`, Active Policy) $\to$ demonstrates `priorPolicySpent (0.01) + 0.015 <= 0.03` cumulative annual cap!
   - **Case C (Attack — Uncovered CPT):** Elective Cosmetic Implant (`Z41.1`, CPT `15777`, `0.01 ETH`) $\to$ passes CMS-1500 syntax, **fails closed in Groth16 Predicate #4** (`cptCode` not in `coveredCptRoot`).
   - **Case D (Attack — Expired Policy):** Emergency Eval (`J18.9`, CPT `99284`, `0.008 ETH`, Expired Policy) $\to$ **fails closed in Groth16 Predicate #3** (`claimTimestamp < policyExpiry`) AND fails on-chain if backdated (`ClaimTimestampOutOfWindow`).
   - **Case E (Attack — Over Annual Cap):** Cardiac Cath (`I21.0`, CPT `99285`, `0.04 ETH > 0.03 ETH` cap) $\to$ **fails closed in Groth16 Predicate #5** (`LessEqThan(97)`).
2. **Drag-and-Drop JSON / TXT Medical Bill Parser:** Regex + JSON parser extracting CMS-1500 boxes directly in browser.
3. **In-Browser Image Bill OCR (`tesseract.js`):**
   - Strictly dynamic-imported inside a `'use client'` module (`const { createWorker } = await import('tesseract.js')`).
   - Runs `createWorker('eng', 1, { logger })` $\to$ `worker.recognize(file)` $\to$ `await worker.terminate()` on uploaded PNG/JPG medical bills (plus a downloadable **Sample Synthetic CMS-1500 Bill PNG** generator button right inside the UI so judges can test live client OCR in 1 click!).
   - Deterministic regex parser maps extracted text (`ICD`, `CPT`, `NPI`, `Policy`, `Amount`) into the CMS-1500 form fields with confidence highlights.

### 3.3 Deterministic Form Completeness Validator

Before encryption or ZK proving, `validateCms1500Completeness(claim)` checks all 6 structural rules and reports pass/fail badges:
1. `insuredPolicyId`: non-empty numeric ID
2. `patientAlias`: non-empty synthetic label
3. `icd10Code`: matches `/^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?$/i`
4. `cptCode`: matches `/^\d{5}$/`
5. `renderingNpi`: 10 digits `/^\d{10}$/`
6. `claimAmountEth`: finite positive number `> 0` and $\le 10$ ETH
