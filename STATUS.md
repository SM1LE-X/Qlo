# Qlo — Engineering & Launch Status

> Living tracker for **Qlo** (Zero-Knowledge Health Insurance Claims & Patient-Sovereign Records). Updated continuously until live Base Sepolia contracts and Vercel production hosting are shipped and verified.

**Overall Status:** Local Stack **100% Complete & Hardened** | Production Launch **Blocked on User Credentials & Sign-In**

---

## 1. Locked Launch Decisions

| Decision | Selection | Notes |
|---|---|---|
| **Wallet Architecture** | Single MetaMask wallet for all 3 roles | `scripts/deploy-base-sepolia.ps1` automatically injects the deployer wallet into Poseidon `hospitalRoot` (NPI `1234567890`) so 1 wallet can operate `/patient`, `/hospital`, and `/insurer`. |
| **Hosting & Source** | Public GitHub repo + Vercel Hobby (`apps/web`) | Free \$0 tier; root directory `apps/web` or monorepo-aware Next.js build. |
| **Verification & Escrow** | Sourcify (zero-key) + optional Basescan V2 + `0.02 ETH` initial escrow | Needs ~`0.05 Base Sepolia ETH` on the deployer wallet to cover contract deployment gas + `0.02 ETH` initial `ClaimsVault` escrow. |
| **Production Readiness** | MIT `LICENSE`, `.env.example`, `deploy-base-sepolia.ps1`, `verify-live.mjs`, CI OCR setup | Implemented in repo. |

---

## 2. Build & Verification Checklist

| Layer | Deliverable | Status | Latest Verified Result |
|---|---|---|---|
| **Specs & Docs** | `README.md`, `SPEC.md`, `interfaces/claim-zk.md`, `docs/*` (5 guides) | Done | Zero `TBD`/`TODO` placeholders; strict `Qlo` branding outside VeriSure prior-art comparisons. |
| **Circom 2 ZK Circuit** | `ClaimValidity(6)` (`MerkleProof.circom`, `--O2`), EF `ppot_0080_13.ptau`, Groth16 fixtures | Done | **11 / 11 tests passed** (`4,349` non-linear constraints, `4,367` wires, `zkeySha256 = 7f261630...`). |
| **Solidity Smart Contracts** | `HospitalRegistry`, `PolicyRegistry`, `HealthRecords`, `ClaimsVault`, `Groth16Verifier` (`0.8.28`) | Done | **18 / 18 Foundry tests passed** (`Solc 0.8.28`, `0` warnings; `QloInvariantsTest`: 256 runs, 128,000 calls, 0 reverts). |
| **Local EVM Broadcast Dry-Run** | `scripts/anvil-e2e.mjs` + `DeployBaseSepolia.s.sol` | Done | **5 / 5 live RPC checks passed** on Anvil (`84532`); `deployments/base-sepolia.json` cleanly restored to `deployed: false`. |
| **Next.js App, Relay & Standards** | 3-Stakeholder role-isolated platform (`Qlo Care` `/patient`, `Qlo Clearinghouse` `/hospital`, `Qlo Treasury` `/insurer`, plus public `/` and `/story`), **Zero-PHI Relay API** (`/api/relay/vault` + `/api/relay/state` with server plaintext PHI rejection via `relayStore.ts`), **HL7 FHIR R4 + ANSI X12 837P / 835** (`healthcareStandards.ts`), SMART-on-FHIR Consent Disclosure, **EasyUI + OpenSourceUI** light SaaS kit (`Stepper`, `StatCard`, `InteractiveAreaChart`, `DonutChart`, `SmoothAccordion`, `WalletPassCard`, `PaymentNotificationBanner`, `OrbitalProver`, `PaymentReceiptPrinter`, `BrowserMockupCard`, `OnboardingChecklistRail`, `OnboardingModal`), local `/ocr/*` bundle | Done | `typecheck` **0 errors**, Next.js `15.5.29` build **0 errors** (`/api/relay/*` dynamic + 10 static routes). |
| **Headless Chromium E2E (Single + Multi-Actor)** | `apps/web/e2e/browser-audit.mjs` + `apps/web/e2e/multi-actor-audit.mjs` (`msedge.exe`) | Done | Single-browser **10 / 10 passed** (`1215ms` OCR, `357ms` prover / `944ms` wall, Attacks `1–5` blocked); **Multi-actor 3-browser context 6 / 6 passed** (Zero-PHI HTTP `400` check, isolated Patient/Hospital/Insurer contexts, live relay wrap/unwrap/settle/revoke, FHIR R4 / X12 837P / X12 835 verified, `0` console/hydration errors). |
| **Single-Wallet & Open-Source Polish** | `LICENSE`, `.env.example`, `scripts/deploy-base-sepolia.ps1`, `scripts/verify-live.mjs`, UI wallet auto-sync | Done | Verified script syntax, selectors (`cast sig`), and post-edit full rebuild + 10/10 Chromium audit. |
| **Base Sepolia Deployment** | Broadcast `DeployBaseSepolia.s.sol` -> `deployments/base-sepolia.json` -> Sourcify/Basescan verify | **Pending User Input** | Waiting on funded `DEPLOYER_PRIVATE_KEY` in `.env`. |
| **GitHub & Vercel Production** | Commit & push public repo -> Deploy `apps/web` to Vercel Hobby -> `verify-live.mjs --url ...` | **Pending User Input** | Waiting on GitHub remote URL & Vercel plugin sign-in. |

---

## 3. Required From User To Go Live

1. **Create gitignored `.env` with a funded Base Sepolia key:**
   - Copy `.env.example` to `.env` at `C:\Users\Delta\Qlo\.env`.
   - Set `DEPLOYER_PRIVATE_KEY=0x...` to a dedicated testnet wallet holding **~0.05 Base Sepolia ETH** (free faucets: Alchemy Base Sepolia Faucet, QuickNode Base Sepolia Faucet, Coinbase CDP Faucet).
   - *(Optional)* Set `ETHERSCAN_API_KEY=...` in `.env` if you also want verified source code on `sepolia.basescan.org` alongside zero-key Sourcify verification.
   - *(Optional)* Set `EXTRA_HOSPITAL_ADDRESS=0x...` only if you want a *different* MetaMask wallet as Hospital; otherwise `scripts/deploy-base-sepolia.ps1` automatically accredits your deployer wallet so one MetaMask account runs all 3 roles.
2. **Sign in to the Vercel plugin in Antigravity:**
   - Authenticate when prompted on the Vercel plugin card so we can deploy directly from the workspace. *(Note: global `vercel` CLI and `gh` CLI are not currently installed on PATH.)*
3. **Provide your public GitHub repository URL (or confirm creating/pushing):**
   - Example: `https://github.com/<your-handle>/Qlo.git` so we can make the initial commit and push `main` (triggering GitHub Actions CI + enabling clean Vercel Git integration).

---

## 4. Exact Go-Live Execution Sequence (Once Inputs Are Provided)

1. Run `pnpm deploy:base-sepolia` (`scripts/deploy-base-sepolia.ps1`):
   - Re-computes `hospitalRoot` with your live MetaMask wallet, broadcasts all 5 contracts to Base Sepolia (`84532`), seeds `0.02 ETH` escrow + policies, updates `deployments/base-sepolia.json` and `apps/web/src/contracts/deployment.json`, verifies on Sourcify (+ Basescan if key supplied), and executes `node scripts/verify-live.mjs`.
2. Re-run `cmd /c "pnpm --dir apps/web typecheck && pnpm --dir apps/web build"` with the live contract addresses baked in, commit non-secret deployment artifacts (`deployments/base-sepolia.json`, `apps/web/src/contracts/deployment.json`, `canonicalFixtures.json`, `contracts/test/fixtures/*`, `README.md`, `STATUS.md`), and push to GitHub.
3. Deploy `apps/web` to Vercel Hobby (setting **Root Directory** = `apps/web`), run `node scripts/verify-live.mjs --url https://<your-live-domain>.vercel.app`, and complete one live MetaMask end-to-end transaction run across `/patient` -> `/hospital` -> `/insurer`.
4. Mark every row in `STATUS.md` as **Shipped & Verified** with live contract addresses, Sourcify/Basescan links, and Vercel production URL.
