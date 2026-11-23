# Qlo — Engineering & Launch Status

> Living tracker for **Qlo** (Zero-Knowledge Health Insurance Claims & Patient-Sovereign Records). Updated continuously as live Ethereum Sepolia contracts, end-to-end settlements, and production hardening are shipped and verified.

**Overall Status:** **Production-Hardened & Demo-Ready on Live Ethereum Sepolia (`11155111`)** | **Live Groth16 Settlement Mined & Verified (0 PHI Bytes)** | Local Production App LIVE (`http://localhost:3000`) | Public Vercel Hosting Ready Pending Sign-In

---

## 1. Live Ethereum Sepolia Deployment (`Chain ID 11155111`, Block `12194573`)

| Contract | Live Address | Sourcify (`exact_match`) | Etherscan |
|---|---|---|---|
| **Groth16Verifier** | `0x587FB82b3429d9Be80e23791809A92DAD352D019` | [Sourcify](https://repo.sourcify.dev/contracts/full_match/11155111/0x587FB82b3429d9Be80e23791809A92DAD352D019) | [Etherscan](https://sepolia.etherscan.io/address/0x587FB82b3429d9Be80e23791809A92DAD352D019) |
| **HospitalRegistry** | `0xCf150397a7416D54c3828ffaC1B808a5C51B563D` | [Sourcify](https://repo.sourcify.dev/contracts/full_match/11155111/0xCf150397a7416D54c3828ffaC1B808a5C51B563D) | [Etherscan](https://sepolia.etherscan.io/address/0xCf150397a7416D54c3828ffaC1B808a5C51B563D) |
| **PolicyRegistry** | `0xc37c6A5e705B9aa9eB2680aBb2A72Ebf9080ebCF` | [Sourcify](https://repo.sourcify.dev/contracts/full_match/11155111/0xc37c6A5e705B9aa9eB2680aBb2A72Ebf9080ebCF) | [Etherscan](https://sepolia.etherscan.io/address/0xc37c6A5e705B9aa9eB2680aBb2A72Ebf9080ebCF) |
| **HealthRecords** | `0x547273d15522AA461af233e5b4d7abb70D0bD8ce` | [Sourcify](https://repo.sourcify.dev/contracts/full_match/11155111/0x547273d15522AA461af233e5b4d7abb70D0bD8ce) | [Etherscan](https://sepolia.etherscan.io/address/0x547273d15522AA461af233e5b4d7abb70D0bD8ce) |
| **ClaimsVault** | `0xB170D66d32C26168A56516d0aDb464B7762cC559` | [Sourcify](https://repo.sourcify.dev/contracts/full_match/11155111/0xB170D66d32C26168A56516d0aDb464B7762cC559) | [Etherscan](https://sepolia.etherscan.io/address/0xB170D66d32C26168A56516d0aDb464B7762cC559) |

- **Deployer / Seeded Insurer / Accredited Hospital Wallet:** `0x9c1cDD59AA337bc9d3B48A109f532cE45e1fc718` (NPI `1234567890` included in Poseidon `hospitalRoot` `0x07fd69196215...`).
- **Live End-to-End Groth16 Settlement Proof (Mined on Sepolia):**
  - `HealthRecords.registerRecord` (#1): [`0x742035b9...50494e`](https://sepolia.etherscan.io/tx/0x742035b943904c6bdcde1a6ceeba505efa75b2fccaba2d549860ae5fb350494e)
  - `HealthRecords.grantAccess` (600s + wrapped DEK): [`0x155888e6...c93cb1`](https://sepolia.etherscan.io/tx/0x155888e6d36bb9849b1f9e066d20e4a10902ed618858d1de666dd12ba0c93cb1)
  - `ClaimsVault.submitClaim` (`0.005 ETH`, `574ms` prove, **`0 PHI bytes`**): [`0xf8cb4e31...aa2ed0`](https://sepolia.etherscan.io/tx/0xf8cb4e31169eac006b4c5dd0a69fa763de7b9ddb79a7cd25419062ead7aa2ed0)
  - `ClaimsVault.depositEscrow` (`+0.005 ETH` top-up): [`0x2c0fd149...fd0e8d`](https://sepolia.etherscan.io/tx/0x2c0fd149ea3059a677a704bea0dbbb711b02caa9055a94c73962a313a1fd0e8d)
- **Live ClaimsVault State:** `insurerEscrow = 0.0200 ETH`, `totalClaimsSettled = 1`, `policySpent = 0.005 ETH` (`0.025 ETH` annual cap headroom preserved for Case A `0.01 ETH` + Case B `0.015 ETH`), `paused = false`.

---

## 2. Build & Verification Checklist

| Layer | Deliverable | Status | Latest Verified Result |
|---|---|---|---|
| **Specs & Docs** | `README.md`, `SPEC.md`, `interfaces/claim-zk.md`, `docs/*` | Done | 100% synced to Ethereum Sepolia (`11155111`) with live verified contract addresses & Etherscan tx links. |
| **Circom 2 ZK Circuit** | `ClaimValidity(6)` (`MerkleProof.circom`, `--O2`), EF `ppot_0080_13.ptau`, Groth16 fixtures | Done | **11 / 11 tests passed** (`4,349` non-linear constraints, `4,367` wires, live Sepolia prove in `574ms`). |
| **Solidity Smart Contracts** | `HospitalRegistry`, `PolicyRegistry`, `HealthRecords`, `ClaimsVault`, `Groth16Verifier` (`0.8.28`) | Done | **18 / 18 Foundry tests passed** (`QloSecurityTest`: 13, `QloProtocolTest`: 1, `QloInvariantsTest`: 4 w/ 256 runs, 128,000 calls, 0 reverts). |
| **Ethereum Sepolia Live Chain** | `DeploySepolia.s.sol` + `sepolia-live-settlement.mjs` + Sourcify + `verify-live.mjs` | **LIVE & Verified** | 5 / 5 `exact_match` on Sourcify (block `12194573`), real live Groth16 claim settled (`0xf8cb4e31...`), **0 PHI bytes**, `0.02 ETH` escrow replenished. |
| **Next.js App, CSP & Perimeter** | Plain-English 3-Step UX (`1. Patient → 2. Hospital → 3. Insurer`), Production `Content-Security-Policy`, Live Relay Reset Guard (`403 RELAY_RESET_DISABLED_IN_LIVE_MODE`), OWASP 2025 `middleware.ts`, Wallet-Only Auth, FHIR R4 / X12 | **LIVE & Verified** | Rebuilt & verified with Vitest, TypeScript, Next.js 15.5.29 build, `audit:ecc` (CSP + live relay guard + MetaMask wrong-chain E2E), `verify-live.mjs`, and full-page visual inspection. |
| **GitHub & Vercel Production** | Push public repo → Deploy `apps/web` to Vercel Hobby → `verify-live.mjs --url ...` | **Pending User Sign-In** | Waiting on Vercel plugin sign-in (and optional GitHub remote URL). |

---

## 3. Remaining Step To Publish Public URL

1. **Sign in to the Vercel plugin** in chat (and optionally share your public GitHub repository URL so we can push `main`).
2. Once signed in, deploy `apps/web` to Vercel Hobby and run `node scripts/verify-live.mjs --url https://<your-live-domain>.vercel.app`.
