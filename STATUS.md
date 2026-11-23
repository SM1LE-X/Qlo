# Qlo — Engineering & Launch Status

> Living tracker for **Qlo** (Zero-Knowledge Health Insurance Claims & Patient-Sovereign Records). Updated continuously as live Ethereum Sepolia contracts and Vercel production hosting are shipped and verified.

**Overall Status:** **Ethereum Sepolia (`11155111`) Contracts LIVE & Exact-Match Verified on Sourcify** | Local Production App LIVE (`http://localhost:3000`) | Public Vercel / GitHub Hosting Pending Sign-In & Remote URL

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
- **Initial ClaimsVault Escrow:** `0.02 ETH` funded live (`paused=false`, active + expired canonical policies seeded).

---

## 2. Build & Verification Checklist

| Layer | Deliverable | Status | Latest Verified Result |
|---|---|---|---|
| **Specs & Docs** | `README.md`, `SPEC.md`, `interfaces/claim-zk.md`, `docs/*` | Done | Strict `Qlo` branding outside VeriSure prior-art comparisons. |
| **Circom 2 ZK Circuit** | `ClaimValidity(6)` (`MerkleProof.circom`, `--O2`), EF `ppot_0080_13.ptau`, Groth16 fixtures | Done | **11 / 11 tests passed** (`4,349` non-linear constraints, `4,367` wires, Claim #1 in `478ms`). |
| **Solidity Smart Contracts** | `HospitalRegistry`, `PolicyRegistry`, `HealthRecords`, `ClaimsVault`, `Groth16Verifier` (`0.8.28`) | Done | **18 / 18 Foundry tests passed** (`QloSecurityTest`: 13, `QloProtocolTest`: 1, `QloInvariantsTest`: 4 w/ 256 runs, 128,000 calls, 0 reverts). |
| **Ethereum Sepolia Deployment** | `scripts/deploy-sepolia.ps1` → `DeploySepolia.s.sol` → `deployments/sepolia.json` → Sourcify | **LIVE & Verified** | All 5 contracts live at block `12194573`, **5 / 5 `exact_match` on Sourcify**, `scripts/verify-live.mjs` passed (`hospitalRoot`, seeded policies, `0.02 ETH` escrow, `paused=false`). |
| **Next.js App, Relay & Auth** | Wallet-Only Auth (`useWalletRoles.ts`), persistent `1. Patient -> 2. Hospital -> 3. Insurer` top bar, modular portal pages (`< 800` lines each), hardened **Zero-PHI Relay API**, OWASP 2025 `middleware.ts`, **HL7 FHIR R4 + ANSI X12 837P / 835** | **LIVE & Verified** | Rebuilt with live Sepolia addresses (`deployed: true`): Vitest **13 / 13**, `typecheck` **0 errors**, Next.js `15.5.29` build **0 errors** (`Middleware 32.5 kB`), `audit:ecc` **5 / 5 passed** reading live Sepolia contracts! |
| **GitHub & Vercel Production** | Push public repo → Deploy `apps/web` to Vercel Hobby → `verify-live.mjs --url ...` | **Pending User Input** | Waiting on GitHub remote URL & Vercel plugin sign-in. |

---

## 3. Remaining Step To Publish Public URL

1. **Sign in to the Vercel plugin** in chat (and optionally share your public GitHub repository URL so we can push `main`).
2. Once signed in, I will deploy `apps/web` to Vercel Hobby and run `node scripts/verify-live.mjs --url https://<your-live-domain>.vercel.app`.
