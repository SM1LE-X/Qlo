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
| **Sonner** + **Lucide React** | `<Toaster />` + direct named icon imports | Non-blocking Base Sepolia tx status toasts with clickable Basescan links |

---

## 3. Route-by-Route Specifications (5 Purpose-Built Routes)

### 3.1 `/` — Mission Control & 3-Minute Judge Guided Path
- **Header Telemetry Strip:** Sole **`Qlo`** brand mark + Connected MetaMask address + Base Sepolia (`84532`) network switch/add button + live `.zkey` SHA-256 verified badge + total ETH settled & escrow balance (`NumberTicker`).
- **Benchmark Bar:** Interactive speed comparison: **Traditional EDI Clearinghouse (14–30+ days / $2.45B outage risk)** $\to$ **Qlo Groth16 (< 3s client prove + instant Base Sepolia payout)**.
- **Magic UI `AnimatedBeam` Architecture Map:** Animated packets flowing from Patient $\to$ Storage $\to$ Hospital $\to$ Base Sepolia, visually demonstrating that PHI never crosses the crimson **Zero-PHI Boundary**.
- **Interactive 4-Step Judge Checklist:** Tracks completion locally as the judge clicks through `/patient` $\to$ `/hospital` $\to$ `/insurer` $\to$ `/story`, plus verified Sourcify/Basescan contract badges.

### 3.2 `/patient` — Sovereign Record Vault & Time-Bound Consent
1. **CMS-1500 Intake Panel:**
   - Choose one of the 5 synthetic clinical cases, drop JSON/TXT, or run **in-browser `tesseract.js` OCR** on a sample/uploaded bill image (progress bar + immediate worker termination).
   - Live **Form Completeness Checklist** (Box `1a`, `21`, `24A`, `24D`, `24F`, `24J`).
2. **Local Encryption & Storage Panel:**
   - Click **Encrypt Locally (AES-256-GCM)** $\to$ `DecryptedText` animates plaintext collapsing into ciphertext; displays **248-bit `recordCommitment`**, deterministic **IPFS CIDv1** (`bafkrei...`), IndexedDB save badge, optional Helia status, and **Download `.qlo.json` Encrypted Bundle**.
3. **Base Sepolia Consent & Audit Panel:**
   - Click **Register Record On-Chain** (`HealthRecords.registerRecord`).
   - **Grant Access:** Pick Hospital address (pre-filled with seeded Hospital) + duration (`10 min` or `30 min`) $\to$ fetches Hospital ECDH P-256 pubkey, wraps DEK locally, calls `grantAccess(...)`, starts `SlidingNumber` countdown.
   - **Instant Revoke:** 1-click `revokeAccess(...)` clears wrapped DEK and blocks hospital immediately.
   - **Live On-Chain Audit Log:** Fetches `RecordRegistered`, `AccessGranted`, `AccessRevoked`, `RecordAccessed` events directly from Base Sepolia RPC.

### 3.3 `/hospital` — ZK Prover, Auto-Settlement & Fail-Closed Attack Lab
1. **Encrypted Record Intake & ECDH Unwrap:**
   - Load from IndexedDB, paste CID / Record ID, or import `.qlo.json`.
   - Click **Unwrap DEK & Decrypt** $\to$ calls `HealthRecords.getGrant(...)`; if active, unwraps DEK via hospital ECDH key, reveals CMS-1500 record with `DecryptedText`, and triggers `logAccess()`. If revoked/expired, renders crimson **`ACCESS DENIED BY ON-CHAIN CONSENT`**.
2. **Groth16 Web Worker Prover Card (Wrapped in `BorderBeam`):**
   - Click **Generate Claim Validity Proof** $\to$ launches `prover.worker.ts` (zero UI freeze!).
   - Streams live progress across the **8-Predicate Circuit Trace Visualizer**:
     1. Hospital Merkle Membership (`Poseidon(address, licenseId)`)
     2. Policy Commitment Preimage (`Poseidon(6)`)
     3. Active Unexpired Policy (`claimTimestamp < policyExpiry`)
     4. Covered CPT Merkle Membership (`cptCode ∈ coveredCptRoot`)
     5. Positive Claim Amount (`claimAmount > 0`)
     6. Private Cumulative Annual Cap (`priorSpent + claimAmount <= annualLimit`)
     7. Deterministic Non-Replayable Nullifier (`Poseidon(3)`)
     8. Anti-Front-Run Sender Binding (`hospitalAddress == msg.sender`)
   - Displays exact proof generation time (e.g. `1.84s`), R1CS constraint count, and `Terminal` output.
3. **Auto-Settle on Base Sepolia:**
   - Calls `ClaimsVault.submitClaim(pA, pB, pC, pubSignals)` $\to$ toast + clickable **Basescan / Blockscout Tx Link**.
4. **Fail-Closed Attack Lab (`TransitionPanel`):**
   - Interactive 5-attack suite judges can fire in 1 click:
     - **Attack 1 — Replay Proof:** Submits identical proof on-chain $\to$ catches & displays exact `NullifierAlreadyUsed()` revert.
     - **Attack 2 — Uncovered CPT (`15777`):** Prover fails closed at Predicate #4 (witness assertion error).
     - **Attack 3 — Expired Policy / Backdate:** Prover fails closed at Predicate #3; backdated fixture reverts on-chain with `ClaimTimestampOutOfWindow()`.
     - **Attack 4 — Over Annual Cap (`0.04 ETH > 0.03 ETH`):** Prover fails closed at Predicate #6.
     - **Attack 5 — Post-Revoke Claim:** Attempts claim after patient revokes $\to$ blocked at decryption & reverts on-chain with `PatientAccessNotActive()`.

### 3.4 `/insurer` — Native ETH Escrow & Split-Screen "What the Chain Sees" Money Shot
1. **Escrow & Policy Console:**
   - Live `insurerEscrow` ETH balance, 1-click **Deposit Base Sepolia ETH** / **Withdraw**, and **Policy Commitment Builder** (`PolicyRegistry.registerPolicy`) showing how `policySpent[commitment]` tracks cumulative payouts while **`annualLimit` remains strictly private**.
2. **Hero Split-Screen Inspector ("What the Chain Sees vs. Private Clinical Reality"):**
   - **Left Pane (Public On-Chain State — Live Base Sepolia RPC):** Inspect any settled `txHash` via `publicClient.getTransaction()` + `getTransactionReceipt()`. Prints decoded `submitClaim` calldata (`pA`, `pB`, `pC`, 8 `pubSignals`), `ClaimSettled` event logs, ETH transfer, and runs a **Live Zero-PHI Calldata Scanner** checking the raw hex calldata + logs for synthetic ICD-10 (`I21.0`), CPT (`99285`), Rx, and patient alias $\to$ outputs **`0 PHI BYTES DETECTED`**.
   - **Right Pane (Private Off-Chain Clinical Reality):** Blurred/vault-locked panel displaying what the insurer/public chain **never saw** (ICD-10 diagnosis, CPT procedure, Rx, clinical note, private annual limit, plaintext DEK).

### 3.5 `/story` — Architecture, Threat Model & Qlo vs. VeriSure
- Interactive system diagram + frozen 8-signal ABI table.
- Full STRIDE threat model & Cryptographic Honesty disclosures (from `docs/THREAT_MODEL_AND_VERISURE.md`).
- **Live `.zkey` SHA-256 Verification Widget:** Re-hashes `/zk/ClaimValidity.zkey` inside the user's browser on demand and compares bit-for-bit against `manifest.json` & `deployments/base-sepolia.json`.
- Side-by-side **Qlo vs. VeriSure (ETHDenver 2025)** engineering breakdown.

---

## 4. Next.js Build, Web3 & Performance Architecture

1. **Webpack & Polyfill Configuration (`apps/web/next.config.mjs`):**
   - Scripts explicitly pass `--webpack` (`next dev --webpack`, `next build --webpack`) so `circomlibjs` and `snarkjs` never fail Turbopack module resolution.
   - Client `resolve.fallback` provides `crypto: crypto-browserify`, `stream: stream-browserify`, `buffer: buffer/`, and `fs: false`, `path: false`, `os: false`, plus `ProvidePlugin` for `Buffer`.
   - `Cache-Control: public, max-age=31536000, immutable` for `/zk/*`.
2. **Wallet & RPC Resilience (`apps/web/src/lib/wagmi.ts`):**
   - `injected({ target: 'metaMask' })` / standard injected EIP-1193 provider—zero WalletConnect Cloud ID required.
   - `baseSepolia` transport uses `fallback([http('https://sepolia.base.org'), http('https://base-sepolia-rpc.publicnode.com')])` with `batch: { multicall: true }`.
   - Graceful pre-deploy mode: if `deployments/base-sepolia.json` has placeholder zero addresses before live deploy, UI clearly banners `"Local ZK & Crypto Mode — Deploy Contracts to Enable Live Settlement"` while still running 100% of AES-GCM, OCR, CIDv1, Merkle, and real Web Worker Groth16 proving!
3. **Vercel `react-best-practices` & Chrome DevTools Compliance:**
   - Named-only `lucide-react` imports (`bundle-barrel-imports`).
   - `next/dynamic(..., { ssr: false })` on all components referencing `indexedDB`, `snarkjs`, `circomlibjs`, or `tesseract.js`.
   - Preload `/zk/ClaimValidity.wasm` and `/zk/ClaimValidity.zkey` quietly on idle (`requestIdleCallback`) so `/hospital` proves immediately with zero cold-fetch wait.
   - Accessibility (`a11y-debugging`): proper `<label>`/`htmlFor` pairs, `aria-live="polite"` on prover status & countdowns, >= 4.5:1 contrast across all slate/emerald/amber/crimson pairs, keyboard-reachable Attack Lab tabs.
