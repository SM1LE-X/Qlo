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
| **Circom 2 ZK Circuit** | `ClaimValidity(6)` (`MerkleProof.circom`, `--O2`), EF `ppot_0080_13.ptau`, Groth16 fixtures (epoch-safe `2030` / `2023` expiries + comma-separated multi-wallet `hospitalRoot`) | Done | **11 / 11 tests passed** (`4,349` non-linear constraints, `4,367` wires, Claim #1 in `472ms`). |
| **Solidity Smart Contracts** | `HospitalRegistry`, `PolicyRegistry`, `HealthRecords`, `ClaimsVault`, `Groth16Verifier` (`0.8.28`) | Done | **18 / 18 Foundry tests passed** (`QloSecurityTest`: 13, `QloProtocolTest`: 1, `QloInvariantsTest`: 4 w/ 256 runs, 128,000 calls, 0 reverts). |
| **Local EVM Broadcast Dry-Run** | `scripts/anvil-e2e.mjs` + `DeployBaseSepolia.s.sol` (graceful escrow scaling) + `verify-live.mjs` (drpc fallback, `paused()` & `/api/health` + Zero-PHI probes) | Done | **5 / 5 live RPC checks passed** on Anvil (`84532`); `deployments/base-sepolia.json` cleanly restored to `deployed: false`. |
| **Next.js App, Relay & Auth** | Wallet-Only Auth (`useWalletRoles.ts` using `useAccount().chainId ?? useChainId()` for real Mainnet/wrong-chain `Switch Network` detection + Wagmi/Viem automatic contract role detection), persistent `1. Patient -> 2. Hospital -> 3. Insurer` top bar (`wallet-auth-bar.tsx`), modular portal components (`hospital/page.tsx` `798` lines, `patient/page.tsx` `749` lines, `insurer/page.tsx` `553` lines — all `< 800`), Base Sepolia block-clock sync + chunked event scanner (`chainEvents.ts`) + preflight tx simulation & 16-error decoder (`txHelpers.ts`) + 3-RPC failover (`wagmi.ts`), hardened **Zero-PHI Relay API** (`relayStore.ts` + sliding-window per-IP `rateLimit.ts`, ICD-10/SSN + SHA-256 commitment check + `/api/health` + `error.tsx`/`not-found.tsx`), upload size/MIME validation, Zero-PHI DonutChart, **HL7 FHIR R4 + ANSI X12 837P / 835** | Done | Vitest **13 / 13 passed** (`4/4` files), `typecheck` **0 errors**, Next.js `15.5.29` build **0 errors** (`Middleware 32.5 kB`, `/api/health`, `/api/relay/state`, `/api/relay/vault` dynamic + `10` routes). |
| **ECC OWASP 2025 Perimeter & TDD** | Curated Everything Claude Code (`ecc@2.2.3`) plugin + [perimeter.ts](apps/web/src/lib/perimeter.ts), [middleware.ts](apps/web/src/middleware.ts) (`404` `no-store` on dotfiles/manifests), `security.txt`, `llms.txt`, `robots.ts`, `HSTS` & CSP headers, [ecc-hardening.tdd.md](docs/tdd/ecc-hardening.tdd.md) | Done | `ecc-wallet-perimeter-audit.mjs` **5 / 5 passed** (blocked dotfiles, headers/CORS/`X-RateLimit-Remaining`, mocked MetaMask `0x1` -> `Switch Network` -> `84532` role unlock); `0` `console.log` / `0` secret hits. |
| **Headless Chromium E2E (Single + Multi-Actor)** | `apps/web/e2e/browser-audit.mjs` + `apps/web/e2e/multi-actor-audit.mjs` + `apps/web/e2e/ecc-wallet-perimeter-audit.mjs` (`msedge.exe`) | Done | Single-browser **10 / 10 passed** (`796ms` OCR, `358ms` prover / `1007ms` wall, Attacks `1–5` blocked); **Multi-actor 6 / 6 passed**; **ECC MetaMask & Perimeter 5 / 5 passed** (`0` console/hydration errors). |
| **Single-Wallet & Open-Source Polish** | `LICENSE`, `.env.example`, `scripts/deploy-base-sepolia.ps1`, `scripts/verify-live.mjs`, UI wallet auto-sync | Done | Verified script syntax, selectors (`cast sig`), and post-edit full rebuild + 10/10 Chromium audit. |
| **Base Sepolia Deployment** | Broadcast `DeployBaseSepolia.s.sol` -> `deployments/base-sepolia.json` -> Sourcify/Basescan verify | **Pending User Input** | Waiting on funded `DEPLOYER_PRIVATE_KEY` in `.env`. |
| **GitHub & Vercel Production** | Commit & push public repo -> Deploy `apps/web` to Vercel Hobby -> `verify-live.mjs --url ...` | **Pending User Input** | Waiting on GitHub remote URL & Vercel plugin sign-in. |

---

## 3. Required From User To Go Live

1. **Create gitignored `.env` with a funded Base Sepolia key:**
   - Copy `.env.example` to `.env` at `C:\Users\Delta\Qlo\.env`.
   - Set `DEPLOYER_PRIVATE_KEY=0x...` to a dedicated testnet wallet holding **~0.05 Base Sepolia ETH** (free faucets: Alchemy Base Sepolia Faucet, QuickNode Base Sepolia Faucet, Coinbase CDP Faucet).
   - *(Optional)* Set `ETHERSCAN_API_KEY=...` in `.env` if you also want verified source code on `sepolia.basescan.org` alongside zero-key Sourcify verification.
   - *(Optional)* Set `EXTRA_HOSPITAL_ADDRESS=0xYourTeammateOrJudgeWallet` in `.env` (supports comma-separated addresses); `scripts/deploy-base-sepolia.ps1` ALWAYS merges your deployer wallet alongside any extra addresses inside Poseidon `hospitalRoot` so both wallets operate `/hospital`.
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
