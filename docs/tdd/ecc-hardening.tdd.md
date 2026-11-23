# Qlo — Everything Claude Code (ECC) TDD & Hardening Evidence Report

> Factual engineering log for applying Everything Claude Code (`ecc@2.2.3`) skills (`web-perimeter-owasp-2025-audit`, `tdd-workflow`, `frontend-patterns`, `react-patterns`, `e2e-testing`, `security-review`, `production-audit`, `verification-loop`) to **Qlo** on **Base Sepolia (`84532`)** (pre-deploy Sandbox configuration).

---

## 1. TDD Cycle Checkpoints (RED → GREEN → REFACTOR → FIX)

| Phase | Git Commit | Action | Observed Gate Output |
|---|---|---|---|
| **RED** | `422b901` | Installed `vitest@^2.1.9`; added [perimeter.test.ts](file:///c:/Users/Delta/Qlo/apps/web/tests/perimeter.test.ts), [txHelpers.test.ts](file:///c:/Users/Delta/Qlo/apps/web/tests/txHelpers.test.ts), [relay-and-ratelimit.test.ts](file:///c:/Users/Delta/Qlo/apps/web/tests/relay-and-ratelimit.test.ts), [healthcare-and-intake.test.ts](file:///c:/Users/Delta/Qlo/apps/web/tests/healthcare-and-intake.test.ts). | `pnpm --dir apps/web test` failed **RED** (`perimeter.test.ts`: `Cannot find module '@/lib/perimeter'`) while the other 3 suites passed (`11` tests). |
| **GREEN** | `97ab226` | Added [perimeter.ts](file:///c:/Users/Delta/Qlo/apps/web/src/lib/perimeter.ts), [middleware.ts](file:///c:/Users/Delta/Qlo/apps/web/src/middleware.ts), [security.txt](file:///c:/Users/Delta/Qlo/apps/web/public/.well-known/security.txt), [llms.txt](file:///c:/Users/Delta/Qlo/apps/web/public/llms.txt); updated [next.config.mjs](file:///c:/Users/Delta/Qlo/apps/web/next.config.mjs) (`poweredByHeader: false`, `productionBrowserSourceMaps: false`, `Strict-Transport-Security`, `Vary`) and [robots.ts](file:///c:/Users/Delta/Qlo/apps/web/src/app/robots.ts). | `pnpm --dir apps/web test` passed **GREEN** (`Test Files 4 passed (4), Tests 13 passed (13)`); `typecheck` passed with `0` errors. |
| **REFACTOR** | `d131e18` | Extracted 12 cohesive UI components under `apps/web/src/components/{hospital,patient,insurer}/` and [hospitalGuardrails.ts](file:///c:/Users/Delta/Qlo/apps/web/src/lib/hospitalGuardrails.ts). | Every editable source file dropped below the ECC 800-line ceiling (`vitest` `13/13`, `tsc --noEmit` `0` errors). |
| **E2E & BUG FIX** | Step 4 (`ecc` E2E) | Added [ecc-wallet-perimeter-audit.mjs](file:///c:/Users/Delta/Qlo/apps/web/e2e/ecc-wallet-perimeter-audit.mjs); Stage 5/5 exposed a real Wagmi v2 bug in [useWalletRoles.ts](file:///c:/Users/Delta/Qlo/apps/web/src/lib/useWalletRoles.ts) (`useChainId()` defaulted to `84532` when injected MetaMask was on `0x1`). Switched to `useAccount().chainId ?? useChainId()`. | Full post-edit web chain passed (`vitest` `13/13`, `typecheck` `0`, `next build`, `audit:browser` `10/10`, `audit:multi-actor` `6/6`, `audit:ecc` `5/5`). |

---

## 2. File Modularity (`< 800`-Line ECC Ceiling)

| Source File | Before Refactor | After Refactor |
|---|---:|---:|
| [apps/web/src/app/hospital/page.tsx](file:///c:/Users/Delta/Qlo/apps/web/src/app/hospital/page.tsx) | 1,517 lines | **798 lines** |
| [apps/web/src/app/patient/page.tsx](file:///c:/Users/Delta/Qlo/apps/web/src/app/patient/page.tsx) | 1,363 lines | **749 lines** |
| [apps/web/src/app/insurer/page.tsx](file:///c:/Users/Delta/Qlo/apps/web/src/app/insurer/page.tsx) | 890 lines | **553 lines** |

Next-largest editable source files verified in `apps/web/src`: [app-shell.tsx](file:///c:/Users/Delta/Qlo/apps/web/src/components/app-shell.tsx) (`629`), [relayStore.ts](file:///c:/Users/Delta/Qlo/apps/web/src/lib/relayStore.ts) (`566`), [page.tsx](file:///c:/Users/Delta/Qlo/apps/web/src/app/page.tsx) (`549`), [onboarding-guide.tsx](file:///c:/Users/Delta/Qlo/apps/web/src/components/ui/onboarding-guide.tsx) (`528`), [story/page.tsx](file:///c:/Users/Delta/Qlo/apps/web/src/app/story/page.tsx) (`363`). Auto-generated Foundry ABI export [abis.ts](file:///c:/Users/Delta/Qlo/apps/web/src/contracts/abis.ts) (`1,641`) was left untouched.

---

## 3. OWASP Top 10:2025 Perimeter & Security Hygiene Summary

- **Blocked Sensitive Paths (`404` + `Cache-Control: no-store`):** Verified against `/.git/HEAD`, `/.git/config`, `/.env`, `/package.json`, `/pnpm-lock.yaml`, and `/.npmrc` via Next.js [middleware.ts](file:///c:/Users/Delta/Qlo/apps/web/src/middleware.ts).
- **Security Headers & Origin Governance:** Verified `X-Powered-By` stripped, `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Vary` (`Accept-Encoding` on `/` and `Accept-Encoding, Origin` on `/api/health`), no arbitrary `Access-Control-Allow-Origin` reflection, and no `X-Forwarded-Host` body echo.
- **Discovery & AI Crawler Governance:** Verified HTTP `200` on `/.well-known/security.txt` (`Contact` + `Expires`), `/llms.txt`, and `/robots.txt` (`Disallow: /api/`).
- **API Rate Limiting & Zero-PHI Validation:** Verified numeric `X-RateLimit-Remaining` and `Cache-Control: no-store` on `/api/relay/state` (`180/min` read, `60/min` write -> HTTP `429`), alongside ICD-10/SSN + SHA-256 commitment enforcement.
- **Codebase & Secret Hygiene:** `0` `console.log(` matches in `apps/web/src/**/*.{ts,tsx}`, `0` hardcoded key/token hits, `.env` absent (`ENV_PRESENT=False`), and [base-sepolia.json](file:///c:/Users/Delta/Qlo/deployments/base-sepolia.json) remains at `"deployed": false`.

---

## 4. Full Observed Verification Results

| Gate | Command | Scope & Latest Observed Result |
|---|---|---|
| **1. ZK Circuit** | `pnpm --dir circuits test` | **11 / 11 passed** (`Claim #1` proved & verified in `472ms`; untouched since `d131e18`) |
| **2. Smart Contracts** | `forge test --root contracts -vvv` | **18 / 18 passed** (`QloProtocolTest` 1, `QloSecurityTest` 13, `QloInvariantsTest` 4 w/ 256 runs, 128,000 invariant calls, 0 reverts; untouched since `d131e18`) |
| **3. Anvil Deploy & RPC E2E** | `node scripts/anvil-e2e.mjs` | **5 / 5 passed** on Anvil chain `84532` (DeployBaseSepolia, grant, Zero-PHI claim #1 settle, replay revert `0xcad2ae02`, post-revoke revert `0x4903318f`; untouched since `d131e18`) |
| **4. Web Unit TDD Suite** | `pnpm --dir apps/web test` | **4 / 4 files, 13 / 13 tests passed** (post final edit) |
| **5. TypeScript** | `pnpm --dir apps/web typecheck` | **0 errors** (`tsc --noEmit`, post final edit) |
| **6. Production Build** | `pnpm --dir apps/web build` | **0 errors** (Next.js `15.5.29`, `Middleware 32.5 kB`, 10 routes + APIs, post final edit) |
| **7. Browser Single-User E2E** | `pnpm --dir apps/web run audit:browser` | **10 / 10 passed, 0 console/hydration errors** (WASM OCR `796ms`, Prover `358ms` / wall `1007ms`, cumulative `0.0250 ETH`, Attacks 1–5 blocked, post final edit) |
| **8. Multi-Actor 3-Browser E2E** | `pnpm --dir apps/web run audit:multi-actor` | **6 / 6 passed** (3 isolated Edge contexts: `/api/health`, Zero-PHI rejections, cross-browser relay settle & revocation, post final edit) |
| **9. ECC Perimeter & MetaMask E2E** | `pnpm --dir apps/web run audit:ecc` | **5 / 5 passed** (OWASP 2025 paths/headers/CORS/404 + mocked EIP-1193 MetaMask `0x1` -> `Switch Network` -> `0x14a34` unlocking `Patient` & `Approved Hospital`, post final edit) |
