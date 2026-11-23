# Qlo — Engineering & Launch Status

> Living tracker for **Qlo** (Zero-Knowledge Health Insurance Claims & Patient-Sovereign Records). Updated continuously until live Ethereum Sepolia contracts and Vercel production hosting are shipped and verified.

**Overall Status:** Local Stack **100% Complete & Hardened** | Production Launch **Blocked on User Credentials & Sign-In**

---

## 1. Locked Launch Decisions

| Decision | Selection | Notes |
|---|---|---|
| **Target Testnet** | Ethereum Sepolia (`11155111`) | Uses your existing `0.05 SepoliaETH` directly without bridging; Etherscan (`sepolia.etherscan.io`) & Sourcify supported. |
| **Wallet Architecture** | Single MetaMask wallet for all 3 roles | `scripts/deploy-sepolia.ps1` automatically injects the deployer wallet into Poseidon `hospitalRoot` (NPI `1234567890`) so 1 wallet can operate `/patient`, `/hospital`, and `/insurer`. |
| **Hosting & Source** | Public GitHub repo + Vercel Hobby (`apps/web`) | Free \$0 tier; root directory `apps/web` or monorepo-aware Next.js build. |
| **Verification & Escrow** | Sourcify (zero-key) + optional Etherscan V2 + `0.02 ETH` initial escrow | Needs ~`0.05 SepoliaETH` on the deployer wallet to cover L1 contract deployment gas + `0.02 ETH` initial `ClaimsVault` escrow. |
| **Production Readiness** | MIT `LICENSE`, `.env.example`, `deploy-sepolia.ps1`, `verify-live.mjs`, CI OCR setup | Implemented in repo. |

---

## 2. Build & Verification Checklist

| Layer | Deliverable | Status | Latest Verified Result |
|---|---|---|---|
| **Specs & Docs** | `README.md`, `SPEC.md`, `interfaces/claim-zk.md`, `docs/*` (5 guides) | Done | Zero `TBD`/`TODO` placeholders; strict `Qlo` branding outside VeriSure prior-art comparisons. |
| **Circom 2 ZK Circuit** | `ClaimValidity(6)` (`MerkleProof.circom`, `--O2`), EF `ppot_0080_13.ptau`, Groth16 fixtures (epoch-safe `2030` / `2023` expiries + comma-separated multi-wallet `hospitalRoot`) | Done | **11 / 11 tests passed** (`4,349` non-linear constraints, `4,367` wires, Claim #1 in `472ms`). |
| **Solidity Smart Contracts** | `HospitalRegistry`, `PolicyRegistry`, `HealthRecords`, `ClaimsVault`, `Groth16Verifier` (`0.8.28`) | Done | **18 / 18 Foundry tests passed** (`QloSecurityTest`: 13, `QloProtocolTest`: 1, `QloInvariantsTest`: 4 w/ 256 runs, 128,000 calls, 0 reverts). |
| **Local EVM Broadcast Dry-Run** | `scripts/anvil-e2e.mjs` + `DeploySepolia.s.sol` (graceful escrow scaling) + `verify-live.mjs` (multi-RPC failover, `paused()` & `/api/health` + Zero-PHI probes) | Done | Verified on Anvil (`11155111`); `deployments/sepolia.json` cleanly restored to `deployed: false`. |
| **Next.js App, Relay & Auth** | Wallet-Only Auth (`useWalletRoles.ts` using `useAccount().chainId ?? useChainId()` for real Mainnet/wrong-chain `Switch Network` detection + Wagmi/Viem automatic contract role detection), persistent `1. Patient -> 2. Hospital -> 3. Insurer` top bar (`wallet-auth-bar.tsx`), modular portal components (`hospital/page.tsx` `798` lines, `patient/page.tsx` `749` lines, `insurer/page.tsx` `553` lines — all `< 800`), Ethereum Sepolia block-clock sync + chunked event scanner (`chainEvents.ts`) + preflight tx simulation & 16-error decoder (`txHelpers.ts`) + 3-RPC failover (`wagmi.ts`), hardened **Zero-PHI Relay API** (`relayStore.ts` + sliding-window per-IP `rateLimit.ts`, ICD-10/SSN + SHA-256 commitment check + `/api/health` + `error.tsx`/`not-found.tsx`), upload size/MIME validation, Zero-PHI DonutChart, **HL7 FHIR R4 + ANSI X12 837P / 835** | Done | Vitest **13 / 13 passed** (`4/4` files), `typecheck` **0 errors**, Next.js build **0 errors** (`Middleware`, `/api/health`, `/api/relay/state`, `/api/relay/vault` + `10` routes). |
| **ECC OWASP 2025 Perimeter & TDD** | Curated Everything Claude Code (`ecc@2.2.3`) plugin + [perimeter.ts](apps/web/src/lib/perimeter.ts), [middleware.ts](apps/web/src/middleware.ts) (`404` `no-store` on dotfiles/manifests), `security.txt`, `llms.txt`, `robots.ts`, `HSTS` & CSP headers, [ecc-hardening.tdd.md](docs/tdd/ecc-hardening.tdd.md) | Done | `ecc-wallet-perimeter-audit.mjs` **5 / 5 passed** (blocked dotfiles, headers/CORS/`X-RateLimit-Remaining`, mocked MetaMask `0x1` -> `Switch Network` -> `11155111` role unlock); `0` `console.log` / `0` secret hits. |
| **Headless Chromium E2E (Single + Multi-Actor)** | `apps/web/e2e/browser-audit.mjs` + `apps/web/e2e/multi-actor-audit.mjs` + `apps/web/e2e/ecc-wallet-perimeter-audit.mjs` (`msedge.exe`) | Done | Single-browser **10 / 10 passed**, Multi-actor **6 / 6 passed**, ECC MetaMask & Perimeter **5 / 5 passed** (`0` console/hydration errors). |
| **Single-Wallet & Open-Source Polish** | `LICENSE`, `.env.example`, `scripts/deploy-sepolia.ps1`, `scripts/verify-live.mjs`, UI wallet auto-sync | Done | Verified script syntax, selectors (`cast sig`), and full multi-suite Chromium audit. |
| **Ethereum Sepolia Deployment** | Broadcast `DeploySepolia.s.sol` -> `deployments/sepolia.json` -> Sourcify/Etherscan verify | **Pending User Input** | Waiting on funded `DEPLOYER_PRIVATE_KEY` in `.env`. |
| **GitHub & Vercel Production** | Commit & push public repo -> Deploy `apps/web` to Vercel Hobby -> `verify-live.mjs --url ...` | **Pending User Input** | Waiting on GitHub remote URL & Vercel plugin sign-in. |

---

## 3. Required From User To Go Live

1. **Create gitignored `.env` with a funded Ethereum Sepolia key:**
   - Copy `.env.example` to `.env` at `C:\Users\Delta\Qlo\.env`.
   - Set `DEPLOYER_PRIVATE_KEY=0x...` to your testnet wallet holding **~0.05 SepoliaETH**.
   - *(Optional)* Set `ETHERSCAN_API_KEY=...` in `.env` if you also want verified source code on `sepolia.etherscan.io` alongside zero-key Sourcify verification.
   - *(Optional)* Set `EXTRA_HOSPITAL_ADDRESS=0xYourTeammateOrJudgeWallet` in `.env` (supports comma-separated addresses); `scripts/deploy-sepolia.ps1` ALWAYS merges your deployer wallet alongside any extra addresses inside Poseidon `hospitalRoot` so both wallets operate `/hospital`.
2. **Sign in to the Vercel plugin in Antigravity:**
   - Authenticate when prompted on the Vercel plugin card so we can deploy directly from the workspace.
3. **Provide your public GitHub repository URL (or confirm creating/pushing):**
   - Example: `https://github.com/<your-handle>/Qlo.git` so we can push `main` (triggering GitHub Actions CI + enabling clean Vercel Git integration).

---

## 4. Exact Go-Live Execution Sequence (Once Inputs Are Provided)

1. Run `pnpm deploy:sepolia` (`scripts/deploy-sepolia.ps1`):
   - Re-computes `hospitalRoot` with your live MetaMask wallet, broadcasts all 5 contracts to Ethereum Sepolia (`11155111`), seeds `0.02 ETH` escrow + policies, updates `deployments/sepolia.json` and `apps/web/src/contracts/deployment.json`, verifies on Sourcify (+ Etherscan if key supplied), and executes `node scripts/verify-live.mjs`.
2. Re-run `cmd /c "pnpm --dir apps/web typecheck && pnpm --dir apps/web build"` with the live contract addresses baked in, commit non-secret deployment artifacts (`deployments/sepolia.json`, `apps/web/src/contracts/deployment.json`, `canonicalFixtures.json`, `contracts/test/fixtures/*`, `README.md`, `STATUS.md`), and push to GitHub.
3. Deploy `apps/web` to Vercel Hobby (setting **Root Directory** = `apps/web`), run `node scripts/verify-live.mjs --url https://<your-live-domain>.vercel.app`, and complete one live MetaMask end-to-end transaction run across `/patient` -> `/hospital` -> `/insurer`.
4. Mark every row in `STATUS.md` as **Shipped & Verified** with live contract addresses, Sourcify/Etherscan links, and Vercel production URL.
