# Qlo — Clinical-Ops UI/UX & MIT Component Specification (`apps/web/`)

> **Goal:** Deliver a **Clinical Operations Console** branded strictly as **`Qlo`** that looks unmistakably purpose-built for zero-knowledge medical claims—never a generic template—and makes all 8 working ZK predicates, fail-closed attacks, and zero-PHI calldata inspection effortless for a tired judge in under 3 minutes.

---

## 1. Visual Identity & Clinical-Ops Design System

| Token | Value | Semantic Usage |
|---|---|---|
| `--bg-canvas` | `#0B1016` | Deep charcoal-slate console background (zero purple neon) |
| `--bg-surface` | `#111822` | Elevated operational cards & split-screen panes |
| `--bg-inset` | `#070B10` | Terminal & raw calldata inspection wells |
| `--border-hairline` | `#1E293B` | Crisp 1px structural borders |
| `--text-primary` | `#F1F5F9` | Primary headings & clinical labels |
| `--text-muted` | `#94A3B8` | Metadata, helper copy, inactive states |
| `--accent-emerald` | `#10B981` | Verified Groth16 predicates, active patient grant, ETH payout settled |
| `--accent-amber` | `#F59E0B` | Active Web Worker proving, live grant countdown, warning badges |
| `--accent-crimson` | `#EF4444` | Zero-PHI firewall, fail-closed circuit/revert rejections, revoked access |
| `--font-sans` | `Plus Jakarta Sans` (`next/font/google`) | Crisp clinical typography |
| `--font-mono` | `JetBrains Mono` (`tabular-nums`) | Hashes, wei amounts, R1CS counts, proof ms, raw calldata |

---

## 2. 100% MIT Open-Source Component Stack (`apps/web/src/components/ui/`)

All interactive components live locally in `apps/web/src/components/ui/` (open-code registry model, MIT-licensed, zero black-box styling lock-in):

| Source Library (MIT) | Component File | Exact Usage in Qlo |
|---|---|---|
| **shadcn/ui** + **Origin UI** | `button.tsx`, `card.tsx`, `badge.tsx`, `tabs.tsx`, `input.tsx`, `copy-hash.tsx`, `audit-timeline.tsx` | Accessible radix/tailwind controls, 1-click copyable hashes with explorer links, clinical audit event log |
| **EasyUI** (`easyui.site`) | `tactile-button.tsx`, `metric-card.tsx` | Spring-physics tactile buttons (`whileTap`/`whileHover`) and crisp KPI cards |
| **Magic UI** (`@magicui`) | `animated-beam.tsx`, `border-beam.tsx`, `terminal.tsx`, `number-ticker.tsx` | • `AnimatedBeam`: Hero live dataflow (`Patient AES-GCM -> CIDv1 -> Hospital Groth16 -> ClaimsVault -> ETH`) crossed by a crimson PHI barrier.<br>• `BorderBeam`: Active perimeter pulse on `/hospital` prover card.<br>• `Terminal`: Real-time witness/constraint & calldata inspection console.<br>• `NumberTicker`: Animated escrow ETH, `~4,400` R1CS, proof ms, and `0` PHI bytes. |
| **React Bits** + **Motion Primitives** | `decrypted-text.tsx`, `sliding-number.tsx`, `transition-panel.tsx` | • `DecryptedText`: Visually scrambles plaintext `I21.0` / `99285` / `Rx` into AES-256-GCM hex on encrypt, decrypts cleanly when grant is active, snaps back to cipher on Revoke.<br>• `SlidingNumber`: Ticking `MM:SS` countdown for patient grants.<br>• `TransitionPanel`: Smooth Attack Lab tab transitions. |
| **Sonner** + **Lucide React** | `<Toaster />` + direct named icon imports | Non-blocking Ethereum Sepolia tx status toasts with clickable Etherscan links |

---

## 3. Route-by-Route Specifications (5 Purpose-Built Routes)

### 3.1 `/` — Plain-English 3-Step Overview
- **Unified Top Navigation Bar:** `Qlo | 1. Patient → 2. Hospital → 3. Insurer | How it works | Sepolia | Connect Wallet`.
- **3-Step Guided Cards:** Plain-English walkthrough (**1. Patient locks & shares record** → **2. Hospital proves & gets paid** → **3. Insurer checks zero-PHI proof**) with direct action buttons and live Ethereum Sepolia status.

### 3.2 `/patient` — Sovereign Record Vault & Time-Bound Consent
1. **CMS-1500 Intake Panel:**
   - Choose one of the 5 synthetic clinical cases, drop JSON/TXT, or run **in-browser `tesseract.js` OCR** on a sample/uploaded bill image (progress bar + immediate worker termination).
   - Live **Form Completeness Checklist** (Box `1a`, `21`, `24A`, `24D`, `24F`, `24J`).
2. **Local Encryption & Storage Panel:**
   - Click **Encrypt Locally (AES-256-GCM)** $\to$ `DecryptedText` animates plaintext collapsing into ciphertext; displays **248-bit `recordCommitment`**, deterministic **IPFS CIDv1** (`bafkrei...`), IndexedDB save badge, and **Download `.qlo.json` Encrypted Bundle**.
3. **Ethereum Sepolia Consent & Audit Panel:**
   - Click **Register Record On-Chain** (`HealthRecords.registerRecord`).
   - **Grant Access:** Defaults hospital target to the connected wallet (editable) + duration (`10 min` or `30 min`) $\to$ fetches Hospital ECDH P-256 pubkey, wraps DEK locally, calls `grantAccess(...)`, starts `SlidingNumber` countdown, and displays a direct **"Continue to Step 2: Hospital →"** button.
   - **Instant Revoke:** 1-click `revokeAccess(...)` clears wrapped DEK and blocks hospital immediately.
   - **Live On-Chain Audit Log:** Fetches `RecordRegistered`, `AccessGranted`, `AccessRevoked`, `RecordAccessed` events directly from Ethereum Sepolia RPC.

### 3.3 `/hospital` — ZK Prover, Auto-Settlement & Collapsed Advanced Tools
1. **Inline Key Setup & Record Unwrap:**
   - If the connected hospital wallet has not yet published its browser ECDH P-256 public key on-chain, an inline 1-click **Register Hospital Key** banner calls `HospitalRegistry.registerEncryptionPubKey(...)`.
   - Load from IndexedDB, paste CID / Record ID, or import `.qlo.json`, then click **Unwrap DEK & Decrypt** $\to$ calls `HealthRecords.getGrant(...)`; if active, unwraps DEK via hospital ECDH key, reveals CMS-1500 record, and triggers `logAccess()`. If revoked/expired, renders crimson **`ACCESS DENIED BY ON-CHAIN CONSENT`**.
2. **Groth16 Web Worker Prover Card:**
   - Click **Generate Claim Validity Proof** $\to$ launches `prover.worker.ts` (zero UI freeze!).
   - Displays 4 plain-English verification checks (covering all 8 Groth16 public signals underneath): Approved Hospital, Policy Active & Under Limit, Covered Procedure Code, and Fresh Non-Replayable Proof, plus exact proof generation time and R1CS stats.
3. **Auto-Settle on Ethereum Sepolia:**
   - Calls `ClaimsVault.submitClaim(pA, pB, pC, pubSignals)` $\to$ toast + clickable **Sepolia Etherscan Tx Link** + **"Continue to Step 3: Insurer →"**.
4. **Collapsed Advanced Demo Tools Drawer:**
   - Houses the **5-Attack Security Lab** (Replay, Uncovered CPT `15777`, Expired Policy, Over Annual Cap, Post-Revoke) and **HL7 FHIR R4 / ANSI X12 837P & 835** interoperability exports without cluttering the primary flow.

### 3.4 `/insurer` — Native ETH Escrow & Split-Screen Zero-PHI Inspector
1. **Escrow & Policy Console:**
   - 3 real live cards (`Insurer Escrow Balance`, `Settled Claims`, `Policy Spend vs Private Annual Cap`), 1-click **Deposit Sepolia ETH** / **Withdraw**, and **Policy Commitment Builder** (`PolicyRegistry.registerPolicy`).
2. **Hero Split-Screen Inspector ("What the Chain Sees vs. What Stays Private"):**
   - **Left Pane (Public On-Chain State — Live Ethereum Sepolia RPC):** Inspect any settled `txHash` via `publicClient.getTransaction()` + `getTransactionReceipt()`. Prints decoded `submitClaim` calldata (`pA`, `pB`, `pC`, 8 `pubSignals`), `ClaimSettled` event logs, ETH transfer, and runs a **Live Zero-PHI Calldata Scanner** checking the raw hex calldata + logs for synthetic ICD-10 (`I21.0`), CPT (`99285`), Rx, and patient alias $\to$ outputs **`0 PHI BYTES DETECTED`**.
   - **Right Pane (Locked Private Clinical Data):** Honestly displays locked clinical fields (`Diagnosis`, `Procedure`, `Prescription`, `Annual Cap`) that never reach the insurer or blockchain.

### 3.5 `/story` — Architecture, Threat Model & Qlo vs. VeriSure
- Frozen 8-signal ABI table & live Ethereum Sepolia Sourcify/Etherscan Contract Registry.
- Full STRIDE threat model & Cryptographic Honesty disclosures (from `docs/THREAT_MODEL_AND_VERISURE.md`).
- **Live `.zkey` SHA-256 Verification Widget:** Re-hashes `/zk/ClaimValidity.zkey` inside the user's browser on demand and compares bit-for-bit against `manifest.json` & `deployments/sepolia.json`.
- Side-by-side **Qlo vs. VeriSure (ETHDenver 2025)** engineering breakdown.

---

## 4. Next.js Build, Web3 & Performance Architecture

1. **Webpack & Polyfill Configuration (`apps/web/next.config.mjs`):**
   - Client `resolve.fallback` provides `crypto: crypto-browserify`, `stream: stream-browserify`, `buffer: buffer/`, and `fs: false`, `path: false`, `os: false`, plus `ProvidePlugin` for `Buffer`.
   - Production security headers include `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Cache-Control: public, max-age=31536000, immutable` for `/zk/*` and `/ocr/*`.
2. **Wallet & RPC Resilience (`apps/web/src/lib/wagmi.ts`):**
   - `injected()` EIP-1193 provider—zero WalletConnect Cloud ID required.
   - `sepolia` transport uses `fallback([http('https://ethereum-sepolia-rpc.publicnode.com'), http('https://1rpc.io/sepolia'), http('https://sepolia.gateway.tenderly.co')])` with `batch: { multicall: true }`.
   - Graceful pre-deploy mode: if `deployments/sepolia.json` has `deployed: false`, UI clearly banners sandbox mode while still running 100% of AES-GCM, OCR, CIDv1, Merkle, and real Web Worker Groth16 proving!
3. **Vercel `react-best-practices` & Chrome DevTools Compliance:**
   - Named-only `lucide-react` imports (`bundle-barrel-imports`).
   - `next/dynamic(..., { ssr: false })` on all components referencing `indexedDB`, `snarkjs`, `circomlibjs`, or `tesseract.js`.
   - Preload `/zk/ClaimValidity.wasm` and `/zk/ClaimValidity.zkey` quietly on idle (`requestIdleCallback`) so `/hospital` proves immediately with zero cold-fetch wait.
   - Accessibility (`a11y-debugging`): proper `<label>`/`htmlFor` pairs, `aria-live="polite"` on prover status & countdowns, >= 4.5:1 contrast across all slate/emerald/amber/crimson pairs, keyboard-reachable Attack Lab tabs.
