import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, "..");
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = "http://127.0.0.1:3000";

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server still starting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function attachListeners(page, label, bag) {
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") bag.consoleErrors.push(`[${label}] ${text}`);
    if (/hydration/i.test(text)) bag.hydrationErrors.push(`[${label}] ${text}`);
  });
  page.on("pageerror", (err) => bag.pageErrors.push(`[${label}] ${err.message}`));
}

async function main() {
  assert.ok(fs.existsSync(EDGE_PATH), `Edge executable not found at ${EDGE_PATH}`);

  const nextBin = path.join(webDir, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "start", "-p", "3000", "-H", "127.0.0.1"], {
    cwd: webDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    await waitForServer(`${BASE_URL}/`);
    console.log("[multi-actor] Next.js production server ready on http://127.0.0.1:3000");

    // Reset relay state cleanly
    const resetRes = await fetch(`${BASE_URL}/api/relay/state`, { method: "DELETE" });
    assert.equal(resetRes.status, 200, "Failed to reset clearinghouse relay state");

    // 1. Server Health, Zero-PHI & Cryptographic Integrity Guardrails
    console.log("[multi-actor] 1/6 Verifying /api/health, Zero-PHI & commitment enforcement...");
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert.equal(healthRes.status, 200, "/api/health must return 200");
    const healthJson = await healthRes.json();
    assert.equal(healthJson.ok, true, "/api/health ok must be true");
    assert.equal(Number(healthJson.chainId), 84532, "/api/health chainId must be 84532");

    const phiAttemptRes = await fetch(`${BASE_URL}/api/relay/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
        recordCommitmentHex: "0x" + "11".repeat(32),
        icd10Code: "I21.0",
        envelope: {
          version: 1,
          alg: "AES-256-GCM",
          ivBase64: "AAAAAAAAAAAAAAAA",
          ciphertextBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
      }),
    });
    assert.equal(phiAttemptRes.status, 400, "Server must reject plaintext PHI payloads");
    const phiErr = await phiAttemptRes.json();
    assert.equal(phiErr.error, "ZERO_PHI_POLICY_VIOLATION");

    const novelIcdRes = await fetch(`${BASE_URL}/api/relay/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
        recordCommitmentHex: "0x" + "11".repeat(32),
        note: "Patient diagnosed with E11.9",
        envelope: {
          version: 1,
          alg: "AES-256-GCM",
          ivBase64: "AAAAAAAAAAAAAAAA",
          ciphertextBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
      }),
    });
    assert.equal(novelIcdRes.status, 400, "Server must reject unencrypted ICD-10 patterns");
    const novelIcdErr = await novelIcdRes.json();
    assert.equal(novelIcdErr.error, "ZERO_PHI_POLICY_VIOLATION");

    const forgedCommitRes = await fetch(`${BASE_URL}/api/relay/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
        recordCommitmentHex: "0x" + "11".repeat(32),
        envelope: {
          version: 1,
          alg: "AES-256-GCM",
          ivBase64: "AAAAAAAAAAAAAAAA",
          ciphertextBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
      }),
    });
    assert.equal(forgedCommitRes.status, 400, "Server must reject forged recordCommitmentHex");
    const forgedErr = await forgedCommitRes.json();
    assert.equal(forgedErr.error, "INVALID_CIPHERTEXT_BUNDLE");

    browser = await chromium.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });

    const bag = { consoleErrors: [], hydrationErrors: [], pageErrors: [] };

    // Three genuinely isolated browser sessions (zero shared IndexedDB / localStorage)
    const hospitalCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const patientCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const insurerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const hospitalPage = await hospitalCtx.newPage();
    const patientPage = await patientCtx.newPage();
    const insurerPage = await insurerCtx.newPage();

    attachListeners(hospitalPage, "hospital", bag);
    attachListeners(patientPage, "patient", bag);
    attachListeners(insurerPage, "insurer", bag);

    // 2. Hospital Portal opens first -> role isolation check + auto-publishes real ECDH public key
    console.log("[multi-actor] 2/6 Opening isolated Hospital RCM browser context...");
    await hospitalPage.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    const hospHeaderText = await hospitalPage.locator("header").innerText();
    assert.ok(hospHeaderText.includes("1. Patient") && hospHeaderText.includes("2. Hospital") && hospHeaderText.includes("3. Insurer"), "Top bar 1->2->3 switcher missing");
    assert.ok(hospHeaderText.includes("Connect Wallet"), "Top bar Connect Wallet missing");
    assert.ok(!/Acting as:/i.test(hospHeaderText), "Acting-as copy must not appear in top bar");
    const hospSidebarText = await hospitalPage.locator("aside").innerText();
    assert.ok(hospSidebarText.includes("Qlo Clearinghouse"), "Hospital brand missing");
    assert.ok(!hospSidebarText.includes("Patient Vault"), "Hospital sidebar should isolate away Patient Vault");
    assert.ok(!hospSidebarText.includes("Escrow Reserves"), "Hospital sidebar should isolate away Insurer Reserve controls");

    await hospitalPage.waitForFunction(async () => {
      const res = await fetch("/api/relay/state");
      const json = await res.json();
      return Boolean(json.hospitalPubKeys?.["0x90f79bf6eb2c4f870365e785982e1f101e93b906"]);
    });

    // 3. Patient Portal opens -> inspect outgoing Zero-PHI POST + OCR -> Encrypt -> Register -> Grant using Hospital's public key
    console.log("[multi-actor] 3/6 Opening isolated Patient browser context & verifying zero PHI on network...");
    const relayVaultBodies = [];
    patientPage.on("request", (req) => {
      if (req.url().includes("/api/relay/vault") && req.method() === "POST") {
        relayVaultBodies.push(req.postData() || "");
      }
    });

    await patientPage.goto(`${BASE_URL}/patient`, { waitUntil: "networkidle" });
    const patSidebarText = await patientPage.locator("aside").innerText();
    assert.ok(patSidebarText.includes("Qlo Care"), "Patient portal brand missing");
    assert.ok(!patSidebarText.includes("Disbursement Ledger"), "Patient sidebar must isolate away Insurer Ledger");

    await patientPage.selectOption("#preset-select", { index: 0 });
    await patientPage.getByRole("button", { name: /Run Sample Bill OCR/i }).click();
    await patientPage.waitForSelector("text=7/7 Checks Valid", { timeout: 30000 });
    await patientPage.getByRole("button", { name: /Encrypt Locally/i }).click();
    await patientPage.waitForSelector("text=/bafkrei/i", { timeout: 10000 });
    await patientPage.getByRole("button", { name: /Register Commitment & CID On-Chain/i }).click();
    await patientPage.waitForSelector("text=/Record #1/i", { timeout: 10000 });
    await patientPage.getByRole("button", { name: /Grant 10m Access/i }).click();
    await patientPage.waitForSelector("text=Clearinghouse Directory ECDH", { timeout: 10000 });
    await patientPage.waitForSelector("text=Active Grant", { timeout: 10000 });

    assert.ok(relayVaultBodies.length > 0, "Expected Patient to push ciphertext envelope to relay");
    for (const rawBody of relayVaultBodies) {
      assert.ok(!/I21\.0|99285|Aspirin|SYNTH-CASE-042|summaryHint|icd10Code/i.test(rawBody), "Plaintext PHI detected in relay HTTP body!");
    }

    // 4. Hospital Browser refreshes inbox across isolated session -> Unwraps -> FHIR/X12 837P -> Groth16 -> Settle + 835 ERA
    console.log("[multi-actor] 4/6 Hospital refreshing cross-browser inbox, verifying FHIR/X12 & settling...");
    await hospitalPage.getByRole("button", { name: /Refresh Inbox/i }).click();
    await hospitalPage.waitForFunction(() => {
      const sel = document.querySelector("#vault-select");
      return Boolean(sel && sel.value && sel.value.startsWith("0x"));
    }, null, { timeout: 10000 });

    await hospitalPage.getByRole("button", { name: /Unwrap ECDH DEK & Decrypt Locally/i }).click();
    await hospitalPage.waitForSelector("text=Decrypted CMS-1500 Claim", { timeout: 10000 });
    await hospitalPage.waitForSelector("text=/\"resourceType\":\\s*\"Claim\"/", { timeout: 5000 });
    await hospitalPage.getByRole("button", { name: /ANSI X12 837P/i }).click();
    await hospitalPage.waitForSelector("text=/ST\\*837\\*/", { timeout: 5000 });

    await hospitalPage.getByRole("button", { name: /Generate Groth16 Proof/i }).click();
    await hospitalPage.waitForSelector("text=/Proved & Verified in \\d+ms/", { timeout: 25000 });
    await hospitalPage.getByRole("button", { name: /Submit & Auto-Settle ETH/i }).click();
    await hospitalPage.waitForSelector("text=Settled Tx", { timeout: 10000 });
    await hospitalPage.getByRole("button", { name: /Download X12 835 ERA/i }).waitFor({ timeout: 5000 });

    // 5. Insurer Browser opens -> sees settled claim & 0 PHI verified automatically
    console.log("[multi-actor] 5/6 Opening isolated Insurer Treasury context & verifying settlement sync...");
    await insurerPage.goto(`${BASE_URL}/insurer`, { waitUntil: "networkidle" });
    const insSidebarText = await insurerPage.locator("aside").innerText();
    assert.ok(insSidebarText.includes("Qlo Treasury"), "Insurer portal brand missing");
    assert.ok(!insSidebarText.includes("Patient Vault"), "Insurer sidebar must isolate away Patient Vault");

    await insurerPage.waitForSelector("text=0.9900 ETH", { timeout: 10000 });
    await insurerPage.waitForSelector("text=0.0100 ETH", { timeout: 10000 });
    await insurerPage.waitForSelector("text=approvedHospitalRoot:", { timeout: 10000 });
    await insurerPage.waitForSelector("text=0 PHI BYTES DETECTED IN CALLDATA", { timeout: 10000 });
    await insurerPage.getByRole("button", { name: /835 ERA/i }).waitFor({ timeout: 5000 });

    // 6. Cross-Browser Revocation Check (Patient revokes -> Hospital reloads & is blocked)
    console.log("[multi-actor] 6/6 Testing live cross-browser revocation (Patient -> Hospital blocked)...");
    await patientPage.getByRole("button", { name: /Revoke Immediately/i }).click();
    await patientPage.waitForSelector("text=Access Revoked", { timeout: 10000 });

    await hospitalPage.reload({ waitUntil: "networkidle" });
    await hospitalPage.waitForFunction(() => {
      const sel = document.querySelector("#vault-select");
      return Boolean(sel && sel.value && sel.value.startsWith("0x"));
    }, null, { timeout: 10000 });
    await hospitalPage.getByRole("button", { name: /Unwrap ECDH DEK & Decrypt Locally/i }).click();
    await hospitalPage.waitForSelector("text=/ACCESS DENIED/i", { timeout: 10000 });

    assert.equal(bag.consoleErrors.length, 0, `Console errors: ${bag.consoleErrors.join(" | ")}`);
    assert.equal(bag.hydrationErrors.length, 0, `Hydration errors: ${bag.hydrationErrors.join(" | ")}`);
    assert.equal(bag.pageErrors.length, 0, `Page errors: ${bag.pageErrors.join(" | ")}`);

    console.log("[multi-actor] ALL 6 MULTI-ACTOR 3-BROWSER ISOLATION & ZERO-PHI RELAY CHECKS PASSED!");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("[multi-actor] FAILED:", err);
  process.exit(1);
});
