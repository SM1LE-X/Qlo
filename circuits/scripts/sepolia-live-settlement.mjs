import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import {
  addressToField,
  buildPoseidonMerkleTree,
  computeHospitalLeaf,
  computeNullifier,
} from "./merkle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const circuitsDir = path.resolve(__dirname, "..");

const wasmPath = path.join(circuitsDir, "build", "ClaimValidity_js", "ClaimValidity.wasm");
const zkeyPath = path.join(circuitsDir, "build", "ClaimValidity.zkey");
const vkeyPath = path.join(circuitsDir, "build", "verification_key.json");
const deployPath = path.join(rootDir, "deployments", "sepolia.json");
const fixturesPath = path.join(rootDir, "apps", "web", "src", "lib", "canonicalFixtures.json");
const envPath = path.join(rootDir, ".env");

const foundryBin = path.join(process.env.USERPROFILE || "C:\\Users\\Delta", ".foundry", "bin");
const CAST = fs.existsSync(path.join(foundryBin, "cast.exe"))
  ? path.join(foundryBin, "cast.exe")
  : "cast";

function loadDotEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function toHex32(val) {
  return "0x" + BigInt(val).toString(16).padStart(64, "0");
}

function parseCastUint(raw) {
  const firstToken = String(raw).trim().split(/\s+/)[0];
  return BigInt(firstToken);
}

function runCast(args, rpcUrl) {
  try {
    const finalArgs = rpcUrl ? [...args, "--rpc-url", rpcUrl] : args;
    return execFileSync(CAST, finalArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const safeStderr = String(err.stderr || err.message || "cast failed").replace(
      /[0-9a-fA-F]{64}/g,
      "<redacted-hex>"
    );
    throw new Error(`cast command failed: ${safeStderr}`);
  }
}

async function main() {
  const dotEnv = loadDotEnv(envPath);
  const rawPk = process.env.DEPLOYER_PRIVATE_KEY || dotEnv.DEPLOYER_PRIVATE_KEY || "";
  assert.ok(rawPk.trim().length >= 64, "DEPLOYER_PRIVATE_KEY not found in environment or .env");
  const normalizedPk = rawPk.startsWith("0x") ? rawPk.trim() : `0x${rawPk.trim()}`;
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    dotEnv.SEPOLIA_RPC_URL ||
    "https://sepolia.gateway.tenderly.co";

  const deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
  const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));

  assert.equal(deployment.deployed, true, "deployments/sepolia.json must be deployed");
  assert.equal(Number(deployment.chainId), 11155111, "Expected Sepolia chainId 11155111");

  const walletAddress = runCast(["wallet", "address", "--private-key", normalizedPk], null);
  const hospitalIdx = fixtures.hospitals.findIndex(
    (h) => h.address.toLowerCase() === walletAddress.toLowerCase()
  );
  assert.ok(
    hospitalIdx >= 0,
    `Wallet ${walletAddress} is not in canonicalFixtures.hospitals`
  );
  const hospitalEntry = fixtures.hospitals[hospitalIdx];

  const { HospitalRegistry, HealthRecords, ClaimsVault } = deployment.contracts;

  const onChainRoot = parseCastUint(
    runCast(["call", HospitalRegistry, "hospitalRoot()(uint256)"], rpcUrl)
  );
  assert.equal(
    onChainRoot.toString(),
    fixtures.hospitalRoot,
    "On-chain HospitalRegistry.hospitalRoot does not match canonicalFixtures.json"
  );

  const priorPolicySpent = parseCastUint(
    runCast(
      ["call", ClaimsVault, "policySpent(uint256)(uint256)", fixtures.activePolicy.commitment],
      rpcUrl
    )
  );
  const claimAmountWei = 5_000_000_000_000_000n; // 0.005 ETH (keeps 0.025 ETH cap headroom for live Case A + Case B demos)
  const annualLimitWei = BigInt(fixtures.activePolicy.annualLimitWei);
  assert.ok(
    priorPolicySpent + claimAmountWei <= annualLimitWei,
    `Policy cap would be exceeded: prior=${priorPolicySpent} + claim=${claimAmountWei} > ${annualLimitWei}`
  );

  const latestTimestamp = parseCastUint(
    runCast(["block", "latest", "--field", "timestamp"], rpcUrl)
  );

  // Build Merkle trees exactly matching on-chain roots
  const hospitalLeaves = await Promise.all(
    fixtures.hospitals.map((h) => computeHospitalLeaf(h.address, h.licenseId))
  );
  const hospitalTree = await buildPoseidonMerkleTree(hospitalLeaves);
  assert.equal(hospitalTree.root.toString(), fixtures.hospitalRoot, "Hospital tree root mismatch");
  const hospProof = hospitalTree.getProof(hospitalIdx);

  const cptTree = await buildPoseidonMerkleTree(fixtures.coveredCpts);
  assert.equal(cptTree.root.toString(), fixtures.coveredCptRoot, "CPT tree root mismatch");
  const cptProof = cptTree.getProof(0); // CPT 99285 (private witness only!)

  // Fresh 248-bit commitment for synthetic encrypted envelope (zero PHI on-chain)
  const entropyHex = crypto.randomBytes(16).toString("hex");
  const envelopeDigestHex = crypto
    .createHash("sha256")
    .update(`qlo-sepolia-live-settlement:${entropyHex}`)
    .digest("hex");
  const recordCommitment = BigInt(`0x${envelopeDigestHex}`) >> 8n;
  const recordCommitmentHex = toHex32(recordCommitment);
  const syntheticCid = `bafkrei${envelopeDigestHex.slice(0, 46)}`;

  const nullifier = await computeNullifier({
    policySalt: fixtures.activePolicy.policySalt,
    policyId: fixtures.activePolicy.policyId,
    recordCommitment,
  });

  const circuitInput = {
    hospitalRoot: hospitalTree.root.toString(),
    policyCommitment: fixtures.activePolicy.commitment,
    nullifier: nullifier.toString(),
    claimAmount: claimAmountWei.toString(),
    claimTimestamp: latestTimestamp.toString(),
    recordCommitment: recordCommitment.toString(),
    hospitalAddress: addressToField(walletAddress).toString(),
    priorPolicySpent: priorPolicySpent.toString(),
    hospitalLicenseId: hospitalEntry.licenseId,
    hospitalPathElements: hospProof.pathElements,
    hospitalPathIndices: hospProof.pathIndices,
    policyId: fixtures.activePolicy.policyId,
    patientCommit: fixtures.activePolicy.patientCommit,
    policyExpiry: fixtures.activePolicy.policyExpiry,
    annualLimit: fixtures.activePolicy.annualLimitWei,
    coveredCptRoot: fixtures.activePolicy.coveredCptRoot,
    policySalt: fixtures.activePolicy.policySalt,
    cptCode: String(fixtures.coveredCpts[0]),
    cptPathElements: cptProof.pathElements,
    cptPathIndices: cptProof.pathIndices,
  };

  console.log("[sepolia-e2e] Generating real Groth16 BN254 proof for live Ethereum Sepolia...");
  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    wasmPath,
    zkeyPath
  );
  const proveMs = Date.now() - t0;
  const localOk = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  assert.equal(localOk, true, "Local snarkjs verification failed");
  console.log(`[sepolia-e2e] Local Groth16 proof verified in ${proveMs}ms`);

  const pA = `[${toHex32(proof.pi_a[0])},${toHex32(proof.pi_a[1])}]`;
  const pB = `[[${toHex32(proof.pi_b[0][1])},${toHex32(proof.pi_b[0][0])}],[${toHex32(proof.pi_b[1][1])},${toHex32(proof.pi_b[1][0])}]]`;
  const pC = `[${toHex32(proof.pi_c[0])},${toHex32(proof.pi_c[1])}]`;
  const pub = `[${publicSignals.map(toHex32).join(",")}]`;

  console.log("[sepolia-e2e] 1/4 Registering encrypted record commitment in HealthRecords...");
  const regReceipt = JSON.parse(
    runCast(
      [
        "send",
        HealthRecords,
        "registerRecord(bytes32,string)",
        recordCommitmentHex,
        syntheticCid,
        "--private-key",
        normalizedPk,
        "--json",
      ],
      rpcUrl
    )
  );
  assert.equal(regReceipt.status, "0x1", "registerRecord failed");

  const recordId = parseCastUint(
    runCast(
      ["call", HealthRecords, "commitmentToRecordId(bytes32)(uint256)", recordCommitmentHex],
      rpcUrl
    )
  );
  assert.ok(recordId > 0n, "Failed to resolve newly registered recordId");
  console.log(`[sepolia-e2e]     Record #${recordId} registered (tx ${regReceipt.transactionHash})`);

  console.log("[sepolia-e2e] 2/4 Granting 10-minute patient consent + opaque wrapped DEK...");
  const opaqueWrappedDek = `0x04${crypto.randomBytes(124).toString("hex")}`;
  const grantReceipt = JSON.parse(
    runCast(
      [
        "send",
        HealthRecords,
        "grantAccess(uint256,address,uint64,bytes)",
        recordId.toString(),
        walletAddress,
        "600",
        opaqueWrappedDek,
        "--private-key",
        normalizedPk,
        "--json",
      ],
      rpcUrl
    )
  );
  assert.equal(grantReceipt.status, "0x1", "grantAccess failed");
  console.log(`[sepolia-e2e]     Access granted for 600s (tx ${grantReceipt.transactionHash})`);

  console.log("[sepolia-e2e] 3/4 Submitting Groth16 proof to ClaimsVault.submitClaim on Ethereum Sepolia...");
  const settleReceipt = JSON.parse(
    runCast(
      [
        "send",
        ClaimsVault,
        "submitClaim(uint256[2],uint256[2][2],uint256[2],uint256[8])",
        pA,
        pB,
        pC,
        pub,
        "--private-key",
        normalizedPk,
        "--json",
      ],
      rpcUrl
    )
  );
  assert.equal(settleReceipt.status, "0x1", "ClaimsVault.submitClaim failed on Sepolia");
  console.log(`[sepolia-e2e]     Claim SETTLED on Ethereum Sepolia! tx=${settleReceipt.transactionHash}`);

  // Zero-PHI scan on actual mined Ethereum Sepolia calldata
  const minedTx = JSON.parse(runCast(["tx", settleReceipt.transactionHash, "--json"], rpcUrl));
  const inputLower = String(minedTx.input || "").toLowerCase();
  const phiNeedles = ["I21.0", "99285", "Ticagrelor", "Aspirin", "SYNTH-CASE"];
  const phiHits = [];
  for (const needle of phiNeedles) {
    const hexNeedle = Buffer.from(needle, "utf8").toString("hex").toLowerCase();
    if (inputLower.includes(hexNeedle)) phiHits.push(needle);
  }
  assert.equal(phiHits.length, 0, `PHI terms leaked in calldata: ${phiHits.join(", ")}`);

  console.log("[sepolia-e2e] 4/4 Replenishing 0.005 ETH escrow so live demo pool remains at 0.02 ETH...");
  const topUpReceipt = JSON.parse(
    runCast(
      [
        "send",
        ClaimsVault,
        "depositEscrow()",
        "--value",
        claimAmountWei.toString(),
        "--private-key",
        normalizedPk,
        "--json",
      ],
      rpcUrl
    )
  );
  assert.equal(topUpReceipt.status, "0x1", "depositEscrow top-up failed");

  const escrowAfter = parseCastUint(
    runCast(["call", ClaimsVault, "insurerEscrow(address)(uint256)", walletAddress], rpcUrl)
  );
  const spentAfter = parseCastUint(
    runCast(
      ["call", ClaimsVault, "policySpent(uint256)(uint256)", fixtures.activePolicy.commitment],
      rpcUrl
    )
  );
  const totalSettled = parseCastUint(
    runCast(["call", ClaimsVault, "totalClaimsSettled()(uint256)"], rpcUrl)
  );

  const summary = {
    network: "sepolia",
    chainId: 11155111,
    wallet: walletAddress,
    recordId: recordId.toString(),
    proveMs,
    claimAmountEth: Number(claimAmountWei) / 1e18,
    registerTx: regReceipt.transactionHash,
    grantTx: grantReceipt.transactionHash,
    settleTx: settleReceipt.transactionHash,
    topUpTx: topUpReceipt.transactionHash,
    etherscanSettleUrl: `${deployment.explorerBaseUrl}/tx/${settleReceipt.transactionHash}`,
    phiHits: phiHits.length,
    escrowAfterEth: Number(escrowAfter) / 1e18,
    policySpentAfterEth: Number(spentAfter) / 1e18,
    totalClaimsSettled: totalSettled.toString(),
  };

  console.log("[sepolia-e2e] SUMMARY:\n" + JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("[sepolia-e2e] FAILED:", err.message || err);
  process.exit(1);
});
