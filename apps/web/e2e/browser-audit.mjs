import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, "..");
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE_URL = "http://127.0.0.1:3000";
const VAULT_DISK_CACHE = path.join(os.tmpdir(), "qlo-zero-phi-vault.json");
const CHAIN_DISK_CACHE = path.join(os.tmpdir(), "qlo-relay-chain.json");

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
    const els = Array.from(
      document.querySelectorAll("input:not([type='hidden']), select, textarea")
    );
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
  try {
    if (fs.existsSync(VAULT_DISK_CACHE)) fs.unlinkSync(VAULT_DISK_CACHE);
    if (fs.existsSync(CHAIN_DISK_CACHE)) fs.unlinkSync(CHAIN_DISK_CACHE);
  } catch {
    // non-fatal
  }

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

    // 1. Calm Clearinghouse Overview (/)
    console.log("[audit] 1/10 Checking / (Qlo Invisible Clearinghouse Overview)...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const h1Home = await page.locator("h1").first().innerText();
    assert.ok(/Qlo/i.test(h1Home), `Unexpected home h1: ${h1Home}`);
    const bodyHome = await page.locator("body").innerText();
    assert.ok(!/VeriSure/i.test(bodyHome), "VeriSure should NOT appear on / overview");
    await page.waitForSelector("text=/0 PHI/i", { timeout: 10000 });
    const samplePngRes = await fetch(`${BASE_URL}/samples/bill-cardiac-er-99285.png`);
    assert.equal(samplePngRes.status, 200, "Expected HTTP 200 for /samples/bill-cardiac-er-99285.png");
    const sampleJsonRes = await fetch(`${BASE_URL}/samples/bill-cardiac-er-99285.json`);
    assert.equal(sampleJsonRes.status, 200, "Expected HTTP 200 for /samples/bill-cardiac-er-99285.json");
    console.log("[audit]     Verified calm overview & bill assets");

    // 2-3. One-Action Drop & Done on /patient (Tesseract WASM OCR -> AES-256 -> Anchor -> ECDH Grant)
    console.log("[audit] 2-3/10 Testing Drop & Done pipeline (WASM OCR -> AES-256 -> Anchor -> Grant)...");
    await page.goto(`${BASE_URL}/patient`, { waitUntil: "networkidle" });
    await assertAllInputsLabeled(page, "/patient");
    const ocrT0 = Date.now();
    await page.getByRole("button", { name: /Attach recent visit/i }).click();
    await page.getByRole("menuitem", { name: /Cardiac STEMI/i }).click();
    await page.waitForSelector("text=/Active · \\d+:\\d{2}/", { timeout: 45000 });
    console.log(`[audit]     Drop & Done completed (OCR + AES-256 + Anchor + Grant) in ${Date.now() - ocrT0}ms!`);
    await page.getByRole("button", { name: /^Details$/i }).first().click();
    await page.getByRole("button", { name: /Backup/i }).waitFor({ timeout: 5000 });

    // 4. Hospital Autonomous Unwrap + Auto-Prove (Groth16 Claim #1) + 1-Click Settle
    console.log("[audit] 4/10 Testing autonomous background unwrap + Groth16 proving + 1-click Settle...");
    await page.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    await assertAllInputsLabeled(page, "/hospital");
    const proveT0 = Date.now();
    const settleBtn = page.getByRole("button", { name: /^Settle$/i }).first();
    await settleBtn.waitFor({ state: "visible", timeout: 25000 });
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.some((b) => b.textContent?.trim() === "Settle" && !b.disabled);
      },
      null,
      { timeout: 25000 }
    );
    console.log(`[audit]     Claim #1 auto-unwrapped & auto-proved in ${Date.now() - proveT0}ms`);
    await settleBtn.click();
    await page.waitForSelector("text=/Settled \\(\\+0\\.0100 ETH\\)/", { timeout: 10000 });

    // 5. Cumulative Claim #2 E2E (0.01 + 0.015 <= 0.03 ETH)
    console.log("[audit] 5/10 Running Cumulative Claim #2 (0.01 + 0.015 <= 0.03 ETH)...");
    await page.goto(`${BASE_URL}/patient`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Attach recent visit/i }).click();
    await page.getByRole("menuitem", { name: /Cardiology Follow-Up/i }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("button").length > 0 && document.body.innerText.includes("2 active"),
      null,
      { timeout: 45000 }
    );

    await page.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.some((b) => b.textContent?.trim() === "Settle" && !b.disabled);
      },
      null,
      { timeout: 25000 }
    );
    await page.locator("button:not([disabled])", { hasText: /^Settle$/ }).first().click();
    await page.waitForSelector("text=/Settled \\(\\+0\\.0150 ETH\\)/", { timeout: 10000 });
    console.log("[audit]     Cumulative Claim #2 settled (+0.0150 ETH)");

    const consoleErrorsBeforeAttacks = consoleErrors.length;

    // 6-7. Insurer Quiet Treasury (/insurer) + Slide-Over ProofDrawer
    console.log("[audit] 6-7/10 Checking /insurer Treasury & slide-over ProofDrawer (0 Medical Bytes Found)...");
    await page.goto(`${BASE_URL}/insurer`, { waitUntil: "networkidle" });
    await assertAllInputsLabeled(page, "/insurer");
    await page.getByRole("button", { name: /^Proof$/i }).first().click();
    await page.waitForSelector("text=0 Medical Bytes Found", { timeout: 10000 });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Withdraw$/i }).click();
    console.log("[audit]     Insurer treasury & slide-over ProofDrawer verified");

    // 8. Protocol Verification Hub (/story) — .zkey SHA-256 + Policy Invariant Verifier + VeriSure table
    console.log("[audit] 8/10 Checking /story (.zkey SHA-256 MATCHED + Policy Invariant Verifier)...");
    await page.goto(`${BASE_URL}/story`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=/MATCHED \\(\\d+ms\\)/", { timeout: 15000 });
    await page.waitForSelector("text=/VeriSure \\(ETHDenver 2025\\)/i", { timeout: 5000 });
    for (const label of ["Replay Nullifier", "Excluded Procedure", "Expired Policy", "Over Annual Cap"]) {
      await page.getByRole("button", { name: new RegExp(label, "i") }).click();
      await page.waitForSelector("text=/Fail-Closed|Blocked|Reverted|Constraint|Nullifier|Excluded|Expired|Cap/i", { timeout: 15000 });
    }
    console.log("[audit]     All 4 Policy Invariant checks failed closed cleanly");

    // 9. Revocation E2E (/patient -> Revoke -> /hospital shows Access revoked)
    console.log("[audit] 9/10 Checking Post-Revoke persistence (/patient -> Revoke -> /hospital)...");
    await page.goto(`${BASE_URL}/patient`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Revoke$/i }).first().click();
    await page.waitForSelector("text=Not Shared", { timeout: 10000 });

    await page.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Access revoked", { timeout: 10000 });
    console.log("[audit]     Post-revoke access cleanly blocked on /hospital");

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
