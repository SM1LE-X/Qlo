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
  computePolicyCommitment,
} from "./merkle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const circuitsDir = path.resolve(__dirname, "..");
const wasmPath = path.join(circuitsDir, "build", "ClaimValidity_js", "ClaimValidity.wasm");
const zkeyPath = path.join(circuitsDir, "build", "ClaimValidity.zkey");
const vkeyPath = path.join(circuitsDir, "build", "verification_key.json");
const fixturesDir = path.join(rootDir, "contracts", "test", "fixtures");
const webFixturesPath = path.join(rootDir, "apps", "web", "src", "lib", "canonicalFixtures.json");

function toHex32(val) {
  return "0x" + BigInt(val).toString(16).padStart(64, "0");
}

function sha256Truncated248(label) {
  const hash = crypto.createHash("sha256").update(label).digest("hex");
  return BigInt("0x" + hash) >> 8n;
}

function formatCalldataFixture(proof, publicSignals, extra = {}) {
  return {
    pA: [toHex32(proof.pi_a[0]), toHex32(proof.pi_a[1])],
    pB: [
      [toHex32(proof.pi_b[0][1]), toHex32(proof.pi_b[0][0])],
      [toHex32(proof.pi_b[1][1]), toHex32(proof.pi_b[1][0])],
    ],
    pC: [toHex32(proof.pi_c[0]), toHex32(proof.pi_c[1])],
    pubSignals: publicSignals.map(toHex32),
    pubSignalsDec: publicSignals.map((x) => x.toString()),
    ...extra,
  };
}

async function main() {
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.mkdirSync(path.dirname(webFixturesPath), { recursive: true });

  const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));

  const demoAccounts = {
    deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    insurer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    patient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    hospital1: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    hospital2: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    attacker: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  };

  const hospitals = [
    {
      address: demoAccounts.hospital1,
      licenseId: "1234567890",
      name: "Metro Cardiac Center",
    },
    {
      address: demoAccounts.hospital2,
      licenseId: "1987654321",
      name: "Bay General Surgical",
    },
  ];

  const extraRaw = [process.env.EXTRA_HOSPITAL_ADDRESS, process.env.EXTRA_HOSPITAL_ADDRESSES]
    .filter(Boolean)
    .join(",");
  if (extraRaw.trim()) {
    const extraAddrs = extraRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s));
    const extraNpis = (process.env.EXTRA_HOSPITAL_NPI || "1234567890")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const seen = new Set(hospitals.map((h) => h.address.toLowerCase()));
    let addedCount = 0;
    extraAddrs.forEach((addr, idx) => {
      const lower = addr.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      addedCount += 1;
      const licenseId = extraNpis[idx] || extraNpis[0] || "1234567890";
      hospitals.push({
        address: addr,
        licenseId,
        name:
          addedCount === 1
            ? "Primary Deployer Facility"
            : `Accredited Judge / Partner Hospital #${addedCount}`,
      });
    });
  }

  const hospitalLeaves = await Promise.all(
    hospitals.map((h) => computeHospitalLeaf(h.address, h.licenseId))
  );
  const hospitalTree = await buildPoseidonMerkleTree(hospitalLeaves);
  const hosp1Proof = hospitalTree.getProof(0);

  const coveredCpts = [99285, 99214, 27750, 93000, 71046, 80053, 36415, 99284];
  const cptTree = await buildPoseidonMerkleTree(coveredCpts);
  const cpt0Proof = cptTree.getProof(0); // 99285
  const cpt1Proof = cptTree.getProof(1); // 99214

  const baseTimestamp = 1795300000n;
  const activePolicy = {
    policyId: "2026001",
    patientCommit: "884422119900776655",
    policyExpiry: "1893456000", // 2030-01-01T00:00:00Z (hackathon-safe future expiry)
    annualLimitWei: "30000000000000000", // 0.03 ETH
    coveredCptRoot: cptTree.root.toString(),
    policySalt: "9182736455463728191029384756",
  };
  const activePolicyCommitment = await computePolicyCommitment({
    policyId: activePolicy.policyId,
    patientCommit: activePolicy.patientCommit,
    policyExpiry: activePolicy.policyExpiry,
    annualLimit: activePolicy.annualLimitWei,
    coveredCptRoot: activePolicy.coveredCptRoot,
    policySalt: activePolicy.policySalt,
  });

  const expiredPolicy = {
    policyId: "2025099",
    patientCommit: "884422119900776655",
    policyExpiry: "1700000000", // 2023-11-14T22:13:20Z (unconditionally expired on all post-2023 clocks)
    annualLimitWei: "30000000000000000",
    coveredCptRoot: cptTree.root.toString(),
    policySalt: "1928374655647382910192837465",
  };
  const expiredPolicyCommitment = await computePolicyCommitment({
    policyId: expiredPolicy.policyId,
    patientCommit: expiredPolicy.patientCommit,
    policyExpiry: expiredPolicy.policyExpiry,
    annualLimit: expiredPolicy.annualLimitWei,
    coveredCptRoot: expiredPolicy.coveredCptRoot,
    policySalt: expiredPolicy.policySalt,
  });

  // Claim #1: 0.01 ETH, priorPolicySpent = 0
  const recordCommit1 = sha256Truncated248("qlo-fixture-record-1");
  const nullifier1 = await computeNullifier({
    policySalt: activePolicy.policySalt,
    policyId: activePolicy.policyId,
    recordCommitment: recordCommit1,
  });
  const claimAmount1 = 10000000000000000n; // 0.01 ETH
  const input1 = {
    hospitalRoot: hospitalTree.root.toString(),
    policyCommitment: activePolicyCommitment.toString(),
    nullifier: nullifier1.toString(),
    claimAmount: claimAmount1.toString(),
    claimTimestamp: baseTimestamp.toString(),
    recordCommitment: recordCommit1.toString(),
    hospitalAddress: addressToField(demoAccounts.hospital1).toString(),
    priorPolicySpent: "0",
    hospitalLicenseId: hospitals[0].licenseId,
    hospitalPathElements: hosp1Proof.pathElements,
    hospitalPathIndices: hosp1Proof.pathIndices,
    policyId: activePolicy.policyId,
    patientCommit: activePolicy.patientCommit,
    policyExpiry: activePolicy.policyExpiry,
    annualLimit: activePolicy.annualLimitWei,
    coveredCptRoot: activePolicy.coveredCptRoot,
    policySalt: activePolicy.policySalt,
    cptCode: coveredCpts[0].toString(),
    cptPathElements: cpt0Proof.pathElements,
    cptPathIndices: cpt0Proof.pathIndices,
  };

  const t0 = Date.now();
  const { proof: proof1, publicSignals: pub1 } = await snarkjs.groth16.fullProve(
    input1,
    wasmPath,
    zkeyPath
  );
  const proveMs1 = Date.now() - t0;
  const ok1 = await snarkjs.groth16.verify(vKey, pub1, proof1);
  if (!ok1) throw new Error("Claim #1 proof failed local snarkjs verify!");

  // Claim #2: 0.015 ETH, priorPolicySpent = 0.01 ETH (total 0.025 ETH <= 0.03 ETH cap)
  const recordCommit2 = sha256Truncated248("qlo-fixture-record-2");
  const nullifier2 = await computeNullifier({
    policySalt: activePolicy.policySalt,
    policyId: activePolicy.policyId,
    recordCommitment: recordCommit2,
  });
  const claimAmount2 = 15000000000000000n; // 0.015 ETH
  const claimTimestamp2 = baseTimestamp + 120n;
  const input2 = {
    hospitalRoot: hospitalTree.root.toString(),
    policyCommitment: activePolicyCommitment.toString(),
    nullifier: nullifier2.toString(),
    claimAmount: claimAmount2.toString(),
    claimTimestamp: claimTimestamp2.toString(),
    recordCommitment: recordCommit2.toString(),
    hospitalAddress: addressToField(demoAccounts.hospital1).toString(),
    priorPolicySpent: claimAmount1.toString(),
    hospitalLicenseId: hospitals[0].licenseId,
    hospitalPathElements: hosp1Proof.pathElements,
    hospitalPathIndices: hosp1Proof.pathIndices,
    policyId: activePolicy.policyId,
    patientCommit: activePolicy.patientCommit,
    policyExpiry: activePolicy.policyExpiry,
    annualLimit: activePolicy.annualLimitWei,
    coveredCptRoot: activePolicy.coveredCptRoot,
    policySalt: activePolicy.policySalt,
    cptCode: coveredCpts[1].toString(),
    cptPathElements: cpt1Proof.pathElements,
    cptPathIndices: cpt1Proof.pathIndices,
  };

  const { proof: proof2, publicSignals: pub2 } = await snarkjs.groth16.fullProve(
    input2,
    wasmPath,
    zkeyPath
  );
  const ok2 = await snarkjs.groth16.verify(vKey, pub2, proof2);
  if (!ok2) throw new Error("Claim #2 proof failed local snarkjs verify!");

  const fixture1 = formatCalldataFixture(proof1, pub1, {
    cid: "bafkreihqlo1fixturecardiac99285record1",
    proveMs: proveMs1,
  });
  const fixture2 = formatCalldataFixture(proof2, pub2, {
    cid: "bafkreihqlo2fixturefollowup99214record2",
  });
  const genesis = {
    hospitalRoot: toHex32(hospitalTree.root),
    hospitalRootDec: hospitalTree.root.toString(),
    activePolicyCommitment: toHex32(activePolicyCommitment),
    activePolicyCommitmentDec: activePolicyCommitment.toString(),
    expiredPolicyCommitment: toHex32(expiredPolicyCommitment),
    expiredPolicyCommitmentDec: expiredPolicyCommitment.toString(),
    accounts: demoAccounts,
  };

  fs.writeFileSync(path.join(fixturesDir, "claim1_proof.json"), JSON.stringify(fixture1, null, 2));
  fs.writeFileSync(path.join(fixturesDir, "claim2_proof.json"), JSON.stringify(fixture2, null, 2));
  fs.writeFileSync(path.join(fixturesDir, "genesis.json"), JSON.stringify(genesis, null, 2));

  const webFixtures = {
    depth: 6,
    accounts: demoAccounts,
    hospitals,
    hospitalRoot: hospitalTree.root.toString(),
    hospitalRootHex: toHex32(hospitalTree.root),
    coveredCpts,
    coveredCptRoot: cptTree.root.toString(),
    uncoveredTestCpt: 15777,
    activePolicy: {
      ...activePolicy,
      commitment: activePolicyCommitment.toString(),
      commitmentHex: toHex32(activePolicyCommitment),
    },
    expiredPolicy: {
      ...expiredPolicy,
      commitment: expiredPolicyCommitment.toString(),
      commitmentHex: toHex32(expiredPolicyCommitment),
    },
  };
  fs.writeFileSync(webFixturesPath, JSON.stringify(webFixtures, null, 2));

  console.log(
    `[fixtures] Generated Claim #1 (${proveMs1}ms) & Claim #2 real Groth16 fixtures + canonicalFixtures.json`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
