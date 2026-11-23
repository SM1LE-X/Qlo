# Smart Contracts Specification (`contracts/src/`)

> **Compiler & Libraries:** Solidity `0.8.28`, EVM `cancun`, Optimizer enabled (`runs = 200`), OpenZeppelin Contracts v5 (`Ownable2Step`, `Pausable`, `ReentrancyGuard`).  
> **Target Chain:** Base Sepolia (Chain ID `84532`).  
> **Companion ABI:** [interfaces/claim-zk.md](../interfaces/claim-zk.md).

---

## 1. Global Contract Invariants

1. **Zero-PHI Event & Calldata Invariant:** No contract accepts, stores, or emits ICD-10 diagnosis codes, CPT procedure codes, prescriptions, patient names, or decrypted record contents in function parameters, storage, or events.
2. **SNARK Scalar Field Bound:** Every field element accepted by `HospitalRegistry`, `PolicyRegistry`, or `HealthRecords` is validated against `SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617`.
3. **Strict Production Governance:** Zero public demo self-registration backdoors. `HospitalRegistry` root updates and `ClaimsVault` emergency pause are gated by `Ownable2Step`.
4. **Checks-Effects-Interactions + ReentrancyGuard:** `ClaimsVault.submitClaim()` checks all 8 public signals, verifies the Groth16 proof, updates `nullifierUsed`, `policySpent`, `insurerEscrow`, and counters, emits `ClaimSettled`, and performs the native ETH `.call{value: claimAmount}("")` **last**.

---

## 2. Contract Specifications

### 2.1 `HospitalRegistry.sol`

Maintains the canonical Poseidon Merkle root of accredited hospitals and each hospital's ECDH P-256 encryption public key so patients can wrap AES-256-GCM DEKs on-chain without off-chain key servers.

- **Inheritance:** `Ownable2Step`
- **State:**
  - `uint256 public constant SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;`
  - `uint256 public hospitalRoot;`
  - `mapping(address => bytes) public hospitalEncryptionPubKey;` (raw 65-byte uncompressed P-256 public key `0x04 || X || Y`)
- **Custom Errors:** `FieldOverflow()`, `ZeroRoot()`, `InvalidPubKeyLength()`, `ZeroAddress()`
- **Events:**
  - `event HospitalRootUpdated(uint256 indexed previousRoot, uint256 indexed newRoot, uint64 updatedAt);`
  - `event HospitalPubKeyUpdated(address indexed hospital, bytes pubKey, uint64 updatedAt);`
- **Functions:**
  - `constructor(address initialOwner, uint256 initialRoot)` — validates `initialRoot != 0 && initialRoot < SNARK_SCALAR_FIELD`.
  - `updateHospitalRoot(uint256 newRoot) external onlyOwner` — validates non-zero & `< SNARK_SCALAR_FIELD`, emits `HospitalRootUpdated`.
  - `registerEncryptionPubKey(bytes calldata pubKey) external` — callable by any hospital for `msg.sender`; validates `pubKey.length == 65 && pubKey[0] == 0x04`.
  - `setHospitalEncryptionPubKey(address hospital, bytes calldata pubKey) external onlyOwner` — allows genesis seeding in `DeployBaseSepolia.s.sol`; validates non-zero address & `pubKey.length == 65 && pubKey[0] == 0x04`.

---

### 2.2 `PolicyRegistry.sol`

Allows insurers to register and deactivate opaque policy commitments without exposing subscriber identity, policy limits, covered CPT lists, or expiration timestamps on-chain.

- **State:**
  - `uint256 public constant SNARK_SCALAR_FIELD = ...;`
  - `struct PolicyMeta { address insurer; bool active; uint64 registeredAt; }`
  - `mapping(uint256 => PolicyMeta) private _policies;`
  - `mapping(address => uint256[]) private _insurerPolicies;`
- **Custom Errors:** `FieldOverflow()`, `ZeroCommitment()`, `PolicyAlreadyExists()`, `PolicyNotFound()`, `NotPolicyInsurer()`, `PolicyAlreadyInactive()`
- **Events:**
  - `event PolicyRegistered(uint256 indexed policyCommitment, address indexed insurer, uint64 registeredAt);`
  - `event PolicyDeactivated(uint256 indexed policyCommitment, address indexed insurer, uint64 deactivatedAt);`
- **Functions:**
  - `registerPolicy(uint256 policyCommitment) external` — reverts if `0`, `>= SNARK_SCALAR_FIELD`, or `_policies[policyCommitment].insurer != address(0)` (prevents hijacking an existing policy commitment!). Records `insurer = msg.sender`, `active = true`.
  - `deactivatePolicy(uint256 policyCommitment) external` — requires `_policies[policyCommitment].insurer == msg.sender` and currently `active`.
  - `getPolicy(uint256 policyCommitment) external view returns (address insurer, bool active)` — read by `ClaimsVault`.
  - `getPoliciesByInsurer(address insurer) external view returns (uint256[] memory)` — UI helper.

---

### 2.3 `HealthRecords.sol`

Patient-sovereign encrypted medical record registry, ECDH wrapped DEK escrow, time-bound grant/revoke access controller, and immutable audit log—directly enforced by `ClaimsVault` at settlement time.

- **Constants:**
  - `uint256 public constant SNARK_SCALAR_FIELD = ...;`
  - `uint64 public constant MIN_GRANT_DURATION = 60;` (1 minute)
  - `uint64 public constant MAX_GRANT_DURATION = 30 days;`
- **State:**
  - `struct Record { address patient; bytes32 recordCommitment; string cid; uint64 createdAt; bool exists; }`
  - `struct AccessGrant { uint64 expiresAt; bytes encryptedDek; }`
  - `uint256 public nextRecordId = 1;`
  - `mapping(uint256 => Record) private _records;`
  - `mapping(bytes32 => uint256) public commitmentToRecordId;`
  - `mapping(uint256 => mapping(address => AccessGrant)) private _grants;`
  - `mapping(address => uint256[]) private _patientRecordIds;`
- **Custom Errors:** `InvalidRecordCommitment()`, `DuplicateRecordCommitment()`, `EmptyCid()`, `RecordNotFound()`, `NotRecordOwner()`, `ZeroAddress()`, `InvalidDuration()`, `EmptyEncryptedDek()`, `AccessDeniedOrExpired()`
- **Events (Zero PHI):**
  - `event RecordRegistered(uint256 indexed recordId, address indexed patient, bytes32 indexed recordCommitment, string cid, uint64 createdAt);`
  - `event AccessGranted(uint256 indexed recordId, address indexed patient, address indexed hospital, uint64 expiresAt);`
  - `event AccessRevoked(uint256 indexed recordId, address indexed patient, address indexed hospital, uint64 revokedAt);`
  - `event RecordAccessed(uint256 indexed recordId, address indexed hospital, uint64 accessedAt);`
- **Functions:**
  - `registerRecord(bytes32 recordCommitment, string calldata cid) external returns (uint256 recordId)`:
    - Requires `uint256(recordCommitment) != 0 && uint256(recordCommitment) < SNARK_SCALAR_FIELD`, `commitmentToRecordId[recordCommitment] == 0`, `bytes(cid).length > 0 && bytes(cid).length <= 128`.
    - Stores `Record`, maps `commitmentToRecordId[recordCommitment] = recordId`, appends `_patientRecordIds[msg.sender]`, emits `RecordRegistered`.
  - `grantAccess(uint256 recordId, address hospital, uint64 durationSeconds, bytes calldata encryptedDek) external`:
    - Patient-only (`_records[recordId].patient == msg.sender`), `hospital != address(0)`, `MIN_GRANT_DURATION <= durationSeconds <= MAX_GRANT_DURATION`, `encryptedDek.length > 0 && encryptedDek.length <= 512`.
    - Sets `expiresAt = uint64(block.timestamp) + durationSeconds`, stores `encryptedDek`, emits `AccessGranted`.
  - `revokeAccess(uint256 recordId, address hospital) external`:
    - Patient-only; sets `_grants[recordId][hospital].expiresAt = 0` and `delete _grants[recordId][hospital].encryptedDek`; emits `AccessRevoked`.
  - `logAccess(uint256 recordId) external`:
    - Reverts with `AccessDeniedOrExpired()` unless `hasActiveAccess(recordId, msg.sender)`. Emits `RecordAccessed`.
  - `hasActiveAccess(uint256 recordId, address hospital) public view returns (bool)`:
    - Returns `_records[recordId].exists && _grants[recordId][hospital].expiresAt > block.timestamp`.
  - `hasActiveAccessByCommitment(bytes32 recordCommitment, address hospital) external view returns (bool)`:
    - Looks up `recordId = commitmentToRecordId[recordCommitment]`; returns `recordId != 0 && hasActiveAccess(recordId, hospital)`. **Called by `ClaimsVault` without revealing `patientAddress` in vault events.**
  - `getRecord(uint256 recordId) external view returns (Record memory)`
  - `getGrant(uint256 recordId, address hospital) external view returns (uint64 expiresAt, bytes memory encryptedDek)`:
    - **Privacy guard:** if `_grants[recordId][hospital].expiresAt <= block.timestamp`, returns `(0, "")` so expired wrapped DEKs are no longer served via view calls!
  - `getRecordsByPatient(address patient) external view returns (Record[] memory)`

---

### 2.4 `ClaimsVault.sol`

Holds native ETH insurer escrow, validates all 8 public ZK signals against live chain state and patient consent, verifies Groth16 pairings, tracks cumulative per-policy spend, and atomically settles ETH to the proving hospital.

- **Inheritance:** `Ownable2Step`, `Pausable`, `ReentrancyGuard`
- **Immutables & Constants:**
  - `IGroth16Verifier public immutable verifier;`
  - `HospitalRegistry public immutable hospitalRegistry;`
  - `PolicyRegistry public immutable policyRegistry;`
  - `HealthRecords public immutable healthRecords;`
  - `uint64 public constant MAX_PAST_SKEW = 900;` (15 minutes)
  - `uint64 public constant MAX_FUTURE_SKEW = 60;` (1 minute clock drift tolerance)
- **State:**
  - `mapping(address => uint256) public insurerEscrow;`
  - `mapping(uint256 => bool) public nullifierUsed;`
  - `mapping(uint256 => uint256) public policySpent;`
  - `uint256 public totalClaimsSettled;`
  - `uint256 public totalPayoutWei;`
- **Custom Errors:**
  `ZeroAddress()`, `ZeroDeposit()`, `InsufficientEscrow()`, `InvalidHospitalRoot()`, `PolicyNotActive()`, `NullifierAlreadyUsed()`, `InvalidClaimAmount()`, `ClaimTimestampOutOfWindow()`, `HospitalSenderMismatch()`, `PatientAccessNotActive()`, `PriorSpentMismatch()`, `InvalidProof()`, `TransferFailed()`
- **Events (Zero PHI):**
  - `event EscrowDeposited(address indexed insurer, uint256 amount, uint256 newBalance);`
  - `event EscrowWithdrawn(address indexed insurer, uint256 amount, uint256 newBalance);`
  - `event ClaimSettled(uint256 indexed nullifier, uint256 indexed policyCommitment, bytes32 indexed recordCommitment, address hospital, address insurer, uint256 amount, uint64 settledAt);`
- **Functions & Exact Validation Order in `submitClaim`:**
  1. Modifier checks: `nonReentrant`, `whenNotPaused`.
  2. `if (pubSignals[0] != hospitalRegistry.hospitalRoot()) revert InvalidHospitalRoot();`
  3. `(address insurer, bool active) = policyRegistry.getPolicy(pubSignals[1]); if (!active || insurer == address(0)) revert PolicyNotActive();`
  4. `if (nullifierUsed[pubSignals[2]]) revert NullifierAlreadyUsed();`
  5. `uint256 claimAmount = pubSignals[3]; if (claimAmount == 0) revert InvalidClaimAmount(); if (insurerEscrow[insurer] < claimAmount) revert InsufficientEscrow();`
  6. `uint256 claimTs = pubSignals[4]; if (claimTs > block.timestamp + MAX_FUTURE_SKEW || block.timestamp > claimTs + MAX_PAST_SKEW) revert ClaimTimestampOutOfWindow();`
  7. `if (address(uint160(pubSignals[6])) != msg.sender) revert HospitalSenderMismatch();`
  8. `if (!healthRecords.hasActiveAccessByCommitment(bytes32(pubSignals[5]), msg.sender)) revert PatientAccessNotActive();`
  9. `if (pubSignals[7] != policySpent[pubSignals[1]]) revert PriorSpentMismatch();`
  10. `if (!verifier.verifyProof(pA, pB, pC, pubSignals)) revert InvalidProof();`
  11. **Effects:** `nullifierUsed[pubSignals[2]] = true; policySpent[pubSignals[1]] += claimAmount; insurerEscrow[insurer] -= claimAmount; totalClaimsSettled += 1; totalPayoutWei += claimAmount;`
  12. Emit `ClaimSettled(...)`.
  13. **Interaction:** `(bool ok, ) = payable(msg.sender).call{value: claimAmount}(""); if (!ok) revert TransferFailed();`
- **Admin & Escrow Functions:**
  - `depositEscrow() external payable` (reverts `ZeroDeposit()` if `msg.value == 0`)
  - `withdrawEscrow(uint256 amount) external nonReentrant` (checks `insurerEscrow[msg.sender] >= amount`, transfers via `.call`)
  - `pause() external onlyOwner` / `unpause() external onlyOwner`

---

## 3. Role & Access Control Matrix

| Action | Owner | Insurer | Patient | Accredited Hospital | Unauthenticated |
|---|---|---|---|---|---|
| `HospitalRegistry.updateHospitalRoot` | Allowed | Reverts | Reverts | Reverts | Reverts |
| `HospitalRegistry.registerEncryptionPubKey` | Allowed | Allowed | Allowed | **Allowed** | Allowed (self only) |
| `PolicyRegistry.registerPolicy` | Allowed | **Allowed** | Allowed | Allowed | Allowed (new commitment only) |
| `PolicyRegistry.deactivatePolicy` | Reverts | **Owner only** | Reverts | Reverts | Reverts |
| `HealthRecords.registerRecord` | Allowed | Allowed | **Allowed** | Allowed | Reverts if duplicate |
| `HealthRecords.grantAccess` / `revokeAccess` | Reverts | Reverts | **Owner only** | Reverts | Reverts |
| `ClaimsVault.depositEscrow` / `withdrawEscrow` | Reverts (unless own balance) | **Allowed** | Reverts if 0 bal | Reverts if 0 bal | Reverts |
| `ClaimsVault.submitClaim` | Reverts | Reverts | Reverts | **Allowed (active grant + proof)** | Reverts |
| `ClaimsVault.pause` / `unpause` | **Allowed** | Reverts | Reverts | Reverts | Reverts |

---

## 4. Mandatory Foundry Test Suite (13+ Tests)

- **`contracts/test/QloProtocol.t.sol`** (Real Circom Groth16 Proofs loaded via `vm.readFile` + `stdJson`):
  1. Settle Claim #1 (`claim1_proof.json`, `priorPolicySpent = 0`, `claimAmount = 0.01 ETH`) $\to$ verify exact ETH balance delta, `nullifierUsed == true`, `policySpent == 0.01 ETH`, `insurerEscrow` reduced.
  2. Settle Claim #2 (`claim2_proof.json`, `priorPolicySpent = 0.01 ETH`, `claimAmount = 0.015 ETH`) $\to$ verify cumulative `policySpent == 0.025 ETH` across multiple records under the same private `annualLimit`!
- **`contracts/test/QloSecurity.t.sol`:**
  1. Replay identical Claim #1 proof $\to$ reverts `NullifierAlreadyUsed()`.
  2. Front-run Claim #1 proof from attacker address $\to$ reverts `HospitalSenderMismatch()`.
  3. Backdated timestamp (`block.timestamp - 901`) $\to$ reverts `ClaimTimestampOutOfWindow()`.
  4. Future timestamp (`block.timestamp + 61`) $\to$ reverts `ClaimTimestampOutOfWindow()`.
  5. Claim after `revokeAccess()` $\to$ reverts `PatientAccessNotActive()`.
  6. Claim after `vm.warp` past `grantAccess` expiry $\to$ reverts `PatientAccessNotActive()` and `getGrant()` returns empty DEK.
  7. Claim #2 submitted with stale `priorPolicySpent = 0` after Claim #1 settled $\to$ reverts `PriorSpentMismatch()`.
  8. Mutated proof byte / flipped coordinate $\to$ reverts `InvalidProof()`.
  9. Underfunded `insurerEscrow` $\to$ reverts `InsufficientEscrow()`.
  10. Paused vault (`claimsVault.pause()`) $\to$ reverts `EnforcedPause()`.
  11. Malicious reentrant hospital contract attempting recursive `submitClaim()` in `receive()` $\to$ reverts `ReentrancyGuardReentrantCall()` / `TransferFailed()`.
  12. Unauthorized governance calls (`updateHospitalRoot`, `pause`, `deactivatePolicy`, `grantAccess`, duplicate `PolicyRegistry` overwrite) $\to$ all revert with exact custom errors.
  13. `vm.recordLogs()` inspection across full lifecycle confirming **zero PHI** (`I21.0`, `99285`, patient name, Rx) in any emitted log topic or data payload.

---

## 5. Base Sepolia Deployment & Free Verification Spec

- **RPC:** `https://sepolia.base.org` (Chain ID `84532`)
- **Output Artifact:** `deployments/base-sepolia.json` storing `{ chainId: 84532, network: "base-sepolia", explorerBaseUrl: "https://sepolia.basescan.org", sourcifyUrl: "https://repo.sourcify.dev/contracts/full_match/84532/", zkeySha256, contracts: { Groth16Verifier, HospitalRegistry, PolicyRegistry, HealthRecords, ClaimsVault }, seeded: { hospitalAddress, hospitalRoot, activePolicyCommitment, expiredPolicyCommitment } }`.
- **Zero-Key Sourcify Verification (Guaranteed Baseline):**
  ```powershell
  forge verify-contract --chain-id 84532 --verifier sourcify --watch <ADDRESS> src/<File.sol>:<Contract>
  ```
- **Optional Etherscan V2 Verification (if free API key provided):**
  ```powershell
  forge verify-contract --verifier etherscan --verifier-url "https://api.etherscan.io/v2/api?chainid=84532" --etherscan-api-key $env:ETHERSCAN_API_KEY --watch <ADDRESS> src/<File.sol>:<Contract>
  ```
