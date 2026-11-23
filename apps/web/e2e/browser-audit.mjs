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
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function assertAllInputsLabeled(page, routeName) {
  const unlabeled = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));
    return els
      .filter((el) => {
        const id = el.getAttribute("id");
        const hasLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
        const hasAria = Boolean(el.getAttribute("aria-label"));
        return !hasLabel && !hasAria;
      })
      .map((el) => el.tagName + "#" + (el.getAttribute("id") || "no-id"));
  });
  assert.equal(unlabeled.length, 0, `Unlabeled controls on ${routeName}: ${unlabeled.join(", ")}`);
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
    console.log("[audit] Next.js production server ready on http://127.0.0.1:3000");

    browser = await chromium.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const hydrationErrors = [];
    const pageErrors = [];
    const httpFailures = [];
    const zkAssetStatuses = {};
    const ocrAssetStatuses = {};

    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") consoleErrors.push(text);
      if (/hydration/i.test(text)) hydrationErrors.push(text);
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      const u = res.url();
      if (u.includes("/zk/")) {
        zkAssetStatuses[new URL(u).pathname] = res.status();
      }
      if (u.includes("/ocr/")) {
        ocrAssetStatuses[new URL(u).pathname] = res.status();
      }
      if (res.status() >= 400 && u.startsWith(BASE_URL)) {
        httpFailures.push(`${res.status()} ${u}`);
      }
    });

    // 1. Mission Control (/)
    console.log("[audit] 1/10 Checking / (Mission Control)...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const h1Home = await page.locator("h1").first().innerText();
    assert.ok(h1Home.includes("Zero-Knowledge Health Claims"), `Unexpected home h1: ${h1Home}`);
    const bodyHome = await page.locator("body").innerText();
    assert.ok(!/VeriSure/i.test(bodyHome), "VeriSure should NOT appear on / Mission Control");
    await page.waitForSelector("text=/zkey [0-9a-f]{6}/i", { timeout: 10000 });
    console.log("[audit]     Verified Qlo branding & .zkey navbar pill");

    // 2. Live Tesseract WASM OCR on /patient
    console.log("[audit] 2/10 Testing browser-local Tesseract WASM OCR on /patient...");
    await page.goto(`${BASE_URL}/patient`, { waitUntil: "networkidle" });
    await assertAllInputsLabeled(page, "/patient");
    await page.selectOption("#preset-select", { index: 2 }); // Case C (Z41.1 / 15777)
    assert.equal(await page.inputValue("#box24d"), "15777");
    const ocrT0 = Date.now();
    await page.getByRole("button", { name: /Run Sample Bill OCR/i }).click();
    try {
      await page.waitForFunction(
        () => {
          const box1a = document.querySelector("#box1a");
          const box2 = document.querySelector("#box2");
          const box21 = document.querySelector("#box21");
          const box24d = document.querySelector("#box24d");
          const box24j = document.querySelector("#box24j");
          return (
            box1a?.value === "2026001" &&
            box2?.value === "SYNTH-CASE-042" &&
            box21?.value === "I21.0" &&
            box24d?.value === "99285" &&
            box24j?.value === "1234567890"
          );
        },
        null,
        { timeout: 45000 }
      );
    } catch (err) {
      const snapshot = await page.evaluate(() => ({
        box1a: document.querySelector("#box1a")?.value,
        box2: document.querySelector("#box2")?.value,
        box21: document.querySelector("#box21")?.value,
        box24d: document.querySelector("#box24d")?.value,
        box24f: document.querySelector("#box24f")?.value,
        box24j: document.querySelector("#box24j")?.value,
        bodySnippet: document.body.innerText.slice(0, 600),
      }));
      console.error(
        "[audit] OCR diagnostic snapshot:",
        JSON.stringify({ snapshot, ocrAssetStatuses, consoleErrors })
      );
      throw err;
    }
    const ocrElapsedMs = Date.now() - ocrT0;
    await page.waitForSelector("text=7/7 Checks Valid");
    console.log(`[audit]     Tesseract OCR extracted all CMS-1500 fields in ${ocrElapsedMs}ms!`);

    // 3. Encrypt Case A, Register #1, Grant 10m
    console.log("[audit] 3/10 Encrypting Case A, checking .qlo.json + registering Record #1 + Grant...");
    await page.selectOption("#preset-select", { index: 0 });
    await page.getByRole("button", { name: /Encrypt Locally/i }).click();
    await page.waitForSelector("text=/bafkrei/i", { timeout: 10000 });
    await page.waitForSelector("text=248-bit Commit");
    await page.getByRole("button", { name: /\.qlo\.json/i }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /Register Commitment & CID On-Chain/i }).click();
    await page.waitForSelector("text=/Record #1/i", { timeout: 10000 });
    await page.getByRole("button", { name: /Grant 10m Access/i }).click();
    await page.waitForSelector("text=Active Grant", { timeout: 10000 });

    // 4. Hospital Unwrap + Log Access + Groth16 Claim #1 + Auto-Settle
    console.log("[audit] 4/10 Proving & settling Claim #1 on /hospital...");
    await page.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    await assertAllInputsLabeled(page, "/hospital");
    await page.getByRole("button", { name: /Unwrap ECDH DEK & Decrypt Locally/i }).click();
    await page.waitForSelector("text=Decrypted CMS-1500 Claim", { timeout: 10000 });
    await page.getByRole("button", { name: /Log Access Audit On-Chain/i }).click();
    await page.waitForSelector("text=/Explicit RecordAccessed\\(1\\)/i", { timeout: 10000 });

    const proveT0 = Date.now();
    await page.getByRole("button", { name: /Generate Groth16 Proof/i }).click();
    const badgeLocator = page.locator("text=/Proved & Verified in \\d+ms/");
    await badgeLocator.waitFor({ timeout: 25000 });
    console.log(`[audit]     Claim #1 ${await badgeLocator.innerText()} (wall ${Date.now() - proveT0}ms)`);
    await page.getByRole("button", { name: /Submit & Auto-Settle ETH/i }).click();
    await page.waitForSelector("text=Settled Tx", { timeout: 10000 });

    // 5. Cumulative Claim #2 E2E (Case B: 0.015 ETH, priorSpent = 0.01 ETH)
    console.log("[audit] 5/10 Running Cumulative Claim #2 (0.01 + 0.015 <= 0.03 ETH)...");
    await page.goto(`${BASE_URL}/patient`, { waitUntil: "networkidle" });
    await page.selectOption("#preset-select", { index: 1 }); // Case B
    await page.getByRole("button", { name: /Encrypt Locally/i }).click();
    await page.waitForSelector("text=/248-bit Commit/i", { timeout: 10000 });
    await page.getByRole("button", { name: /Register Commitment & CID On-Chain/i }).click();
    await page.waitForSelector("text=/Record #2/i", { timeout: 10000 });
    await page.getByRole("button", { name: /Grant 10m Access/i }).click();
    await page.waitForSelector("text=Active Grant", { timeout: 10000 });

    await page.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Unwrap ECDH DEK & Decrypt Locally/i }).click();
    await page.waitForSelector("text=/CPT 99214 \\| 0\\.015 ETH/i", { timeout: 10000 });
    await page.getByRole("button", { name: /Generate Groth16 Proof/i }).click();
    await badgeLocator.waitFor({ timeout: 25000 });
    await page.waitForSelector("text=/priorSpent=0\\.0100 ETH/i", { timeout: 10000 });
    await page.getByRole("button", { name: /Submit & Auto-Settle ETH/i }).click();
    await page.waitForSelector("text=/Settled 0\\.0150 ETH/i", { timeout: 10000 });
    console.log("[audit]     Cumulative Claim #2 settled (priorSpent=0.0100 + 0.0150 = 0.0250 ETH)");

    // 6. Attack Lab Scenarios 1-4
    console.log("[audit] 6/10 Testing Fail-Closed Attack Lab (Replay, CPT, Expired, Cap)...");
    const consoleErrorsBeforeAttacks = consoleErrors.length;

    await page.getByRole("button", { name: /Attack 1: Replay Nullifier/i }).click();
    await page.waitForSelector("text=/NullifierAlreadyUsed/i", { timeout: 10000 });

    await page.getByRole("button", { name: /Attack 2: Uncovered CPT/i }).click();
    await page.waitForSelector("text=/ATTACK BLOCKED \\[CPT\\]/i", { timeout: 15000 });

    await page.getByRole("button", { name: /Attack 3: Expired Policy/i }).click();
    await page.waitForSelector("text=/ATTACK BLOCKED \\[EXPIRED\\]/i", { timeout: 15000 });

    await page.getByRole("button", { name: /Attack 4: Over Annual Cap/i }).click();
    await page.waitForSelector("text=/ATTACK BLOCKED \\[CAP\\]/i", { timeout: 15000 });
    console.log("[audit]     All 4 circuit/replay attacks failed closed cleanly");

    // 7. Insurer Console (/insurer)
    console.log("[audit] 7/10 Checking /insurer escrow, cumulative spend, withdraw, policy & Zero-PHI...");
    await page.goto(`${BASE_URL}/insurer`, { waitUntil: "networkidle" });
    await assertAllInputsLabeled(page, "/insurer");
    await page.waitForSelector("text=0.9750 ETH", { timeout: 10000 });
    await page.waitForSelector("text=0.0250 ETH", { timeout: 10000 });
    await page.waitForSelector("text=0 PHI BYTES DETECTED IN CALLDATA", { timeout: 10000 });
    await page.getByRole("button", { name: /Withdraw ETH/i }).click();
    await page.waitForSelector("text=0.9500 ETH", { timeout: 10000 });
    await page.getByRole("button", { name: /^Register$/i }).click();
    await page.waitForSelector("text=/Verified BN254 commitment/i", { timeout: 10000 });
    console.log("[audit]     Escrow 0.9750->0.9500 ETH, cumulative 0.0250 ETH, 0 PHI bytes verified");

    // 8. Story (/story)
    console.log("[audit] 8/10 Checking /story (.zkey SHA-256 MATCHED + VeriSure table)...");
    await page.goto(`${BASE_URL}/story`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=/MATCHED \\(\\d+ms\\)/", { timeout: 15000 });
    await page.waitForSelector("text=/VeriSure \\(ETHDenver 2025\\)/i", { timeout: 5000 });

    // 9. Revocation E2E (/patient -> Revoke -> /hospital blocked + Attack 5)
    console.log("[audit] 9/10 Checking Post-Revoke persistence (/patient -> Revoke -> /hospital)...");
    await page.goto(`${BASE_URL}/patient`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Active Grant", { timeout: 10000 });
    await page.getByRole("button", { name: /Revoke Immediately/i }).click();
    await page.waitForSelector("text=Access Revoked", { timeout: 10000 });

    await page.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Unwrap ECDH DEK & Decrypt Locally/i }).click();
    await page.waitForSelector("text=/ACCESS DENIED/i", { timeout: 10000 });
    await page.getByRole("button", { name: /Attack 5: Post-Revoke Claim/i }).click();
    await page.waitForSelector("text=/ATTACK BLOCKED \\[REVOKED\\]/i", { timeout: 10000 });
    console.log("[audit]     Post-revoke decryption & Attack 5 both blocked (PatientAccessNotActive)");

    // 10. Asset & Error Integrity
    console.log("[audit] 10/10 Checking ZK + OCR assets, HTTP responses, hydration & console errors...");
    assert.equal(zkAssetStatuses["/zk/ClaimValidity.wasm"], 200);
    assert.equal(zkAssetStatuses["/zk/ClaimValidity.zkey"], 200);
    assert.equal(zkAssetStatuses["/zk/manifest.json"], 200);
    assert.equal(zkAssetStatuses["/zk/verification_key.json"], 200);
    assert.equal(ocrAssetStatuses["/ocr/worker.min.js"], 200);
    assert.equal(ocrAssetStatuses["/ocr/eng.traineddata.gz"], 200);
    assert.ok(
      ocrAssetStatuses["/ocr/tesseract-core-simd-lstm.wasm.js"] === 200 ||
        ocrAssetStatuses["/ocr/tesseract-core-lstm.wasm.js"] === 200,
      `Expected local tesseract-core-*lstm.wasm.js 200 status, got: ${JSON.stringify(ocrAssetStatuses)}`
    );
    assert.equal(httpFailures.length, 0, `HTTP >= 400 errors: ${httpFailures.join(" | ")}`);
    assert.equal(hydrationErrors.length, 0, `Hydration warnings: ${hydrationErrors.join(" | ")}`);
    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join(" | ")}`);
    assert.equal(
      consoleErrorsBeforeAttacks,
      0,
      `Console errors prior to Attack Lab: ${consoleErrors.slice(0, consoleErrorsBeforeAttacks).join(" | ")}`
    );

    console.log("[audit] ALL 10 FULL-COVERAGE CHROMIUM E2E CHECKS PASSED WITH 0 ERRORS!");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("[audit] FAILED:", err);
  process.exit(1);
});
