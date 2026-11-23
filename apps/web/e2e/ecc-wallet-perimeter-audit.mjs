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
const TEST_HOSPITAL_WALLET = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

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

async function main() {
  assert.ok(fs.existsSync(EDGE_PATH), `Edge executable not found at ${EDGE_PATH}`);

  const nextBin = path.join(webDir, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "start", "-p", "3000", "-H", "127.0.0.1"], {
    cwd: webDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    await waitForServer(`${BASE_URL}/api/health`);
    console.log("[audit:ecc] 1/5 Verifying OWASP 2025 blocked dotfiles & manifests...");

    const blockedPaths = [
      "/.git/HEAD",
      "/.git/config",
      "/.env",
      "/package.json",
      "/pnpm-lock.yaml",
      "/.npmrc",
    ];
    for (const p of blockedPaths) {
      const res = await fetch(`${BASE_URL}${p}`, { redirect: "manual" });
      assert.equal(res.status, 404, `Blocked perimeter path ${p} must return 404`);
      const cacheControl = res.headers.get("cache-control") || "";
      assert.match(cacheControl, /no-store/i, `${p} must send Cache-Control: no-store`);
    }

    console.log("[audit:ecc] 2/5 Verifying .well-known/security.txt, llms.txt & robots.txt...");
    const secTxt = await fetch(`${BASE_URL}/.well-known/security.txt`);
    assert.equal(secTxt.status, 200, "security.txt must return 200");
    const secBody = await secTxt.text();
    assert.match(secBody, /Contact:/i, "security.txt must declare Contact");
    assert.match(secBody, /Expires:/i, "security.txt must declare Expires");

    const llmsTxt = await fetch(`${BASE_URL}/llms.txt`);
    assert.equal(llmsTxt.status, 200, "llms.txt must return 200");
    assert.match(await llmsTxt.text(), /Qlo/i, "llms.txt must describe Qlo");

    const robotsTxt = await fetch(`${BASE_URL}/robots.txt`);
    assert.equal(robotsTxt.status, 200, "robots.txt must return 200");
    assert.match(await robotsTxt.text(), /Disallow:\s*\/api\//i, "robots.txt must disallow /api/");

    console.log("[audit:ecc] 3/5 Verifying security headers, CORS & clean 404 errors...");
    const rootRes = await fetch(`${BASE_URL}/`, {
      headers: {
        Origin: "https://evil.example",
        "X-Forwarded-Host": "evil.example",
      },
    });
    assert.equal(rootRes.status, 200, "/ must return 200");
    assert.equal(rootRes.headers.get("x-powered-by"), null, "X-Powered-By must be stripped");
    assert.match(
      rootRes.headers.get("strict-transport-security") || "",
      /max-age=31536000/,
      "Strict-Transport-Security must be present"
    );
    assert.equal(rootRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(rootRes.headers.get("x-frame-options"), "DENY");
    assert.equal(rootRes.headers.get("referrer-policy"), "no-referrer");
    assert.match(rootRes.headers.get("vary") || "", /Accept-Encoding/i);
    const corsOrigin = rootRes.headers.get("access-control-allow-origin");
    assert.ok(
      !corsOrigin || (corsOrigin !== "https://evil.example" && corsOrigin !== "*"),
      `Unexpected permissive CORS header: ${corsOrigin}`
    );
    const rootHtml = await rootRes.text();
    assert.equal(
      rootHtml.includes("evil.example"),
      false,
      "HTML must not echo spoofed X-Forwarded-Host header"
    );

    const healthRes = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(healthRes.status, 200);
    assert.match(healthRes.headers.get("vary") || "", /Origin/i);
    const apiCorsOrigin = healthRes.headers.get("access-control-allow-origin");
    assert.ok(
      !apiCorsOrigin || (apiCorsOrigin !== "https://evil.example" && apiCorsOrigin !== "*"),
      `Unexpected permissive API CORS header: ${apiCorsOrigin}`
    );

    const relayStateRes = await fetch(`${BASE_URL}/api/relay/state`);
    assert.equal(relayStateRes.status, 200);
    assert.match(relayStateRes.headers.get("cache-control") || "", /no-store/i);
    const remainingHeader = relayStateRes.headers.get("x-ratelimit-remaining");
    assert.ok(
      remainingHeader !== null && /^\d+$/.test(remainingHeader),
      `Expected numeric X-RateLimit-Remaining header on /api/relay/state, got ${remainingHeader}`
    );

    const notFoundRes = await fetch(`${BASE_URL}/non-existent-route-ecc-probe`);
    assert.equal(notFoundRes.status, 404, "Unknown route must return 404");
    const notFoundText = await notFoundRes.text();
    assert.equal(/node_modules|TypeError:/i.test(notFoundText), false, "404 must not leak internals");

    console.log("[audit:ecc] 4/5 Launching Edge with mocked EIP-1193 MetaMask wallet on wrong chain (0x1)...");
    browser = await chromium.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    await context.addInitScript((walletAddress) => {
      let authorized = false;
      let chainId = "0x1";
      const listeners = new Map();

      function emit(event, payload) {
        const set = listeners.get(event);
        if (!set) return;
        for (const fn of Array.from(set)) {
          try {
            fn(payload);
          } catch {
            // ignore listener failure
          }
        }
      }

      const provider = {
        isMetaMask: true,
        selectedAddress: null,
        chainId,
        on(event, fn) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(fn);
          return provider;
        },
        removeListener(event, fn) {
          listeners.get(event)?.delete(fn);
          return provider;
        },
        async request({ method, params }) {
          if (method === "eth_requestAccounts") {
            authorized = true;
            provider.selectedAddress = walletAddress;
            setTimeout(() => emit("accountsChanged", [walletAddress]), 0);
            return [walletAddress];
          }
          if (method === "eth_accounts") {
            return authorized ? [walletAddress] : [];
          }
          if (method === "eth_chainId") {
            return chainId;
          }
          if (method === "net_version") {
            return chainId === "0xaa36a7" ? "11155111" : "1";
          }
          if (method === "wallet_switchEthereumChain") {
            const nextId = params?.[0]?.chainId;
            if (typeof nextId === "string" && nextId.startsWith("0x")) {
              chainId = nextId.toLowerCase();
              provider.chainId = chainId;
              emit("chainChanged", chainId);
            }
            return null;
          }
          if (method === "eth_getBalance") {
            return "0x16345785d8a0000";
          }
          if (method === "eth_blockNumber") {
            return "0x100";
          }
          return null;
        },
      };

      Object.defineProperty(window, "ethereum", {
        value: provider,
        configurable: true,
        writable: true,
      });
    }, TEST_HOSPITAL_WALLET);

    const page = await context.newPage();
    const pageErrors = [];
    const hydrationErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (/hydration/i.test(msg.text())) hydrationErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/hospital`, { waitUntil: "networkidle" });
    const connectBtn = page.getByRole("button", { name: /Connect Wallet/i }).first();
    await connectBtn.waitFor({ state: "visible", timeout: 10000 });
    await connectBtn.click();

    console.log("[audit:ecc] 5/5 Verifying wrong-chain Switch Network -> Ethereum Sepolia (11155111) role unlock...");
    const switchBtn = page.getByRole("button", { name: /Switch Network/i }).first();
    await switchBtn.waitFor({ state: "visible", timeout: 10000 });
    await switchBtn.click();

    const header = page.locator("header").first();
    await header.getByText(/0x90F7/i).waitFor({ state: "visible", timeout: 10000 });
    await header.getByText(/^Approved Hospital$/).waitFor({ state: "visible", timeout: 10000 });
    await header.getByText(/^Patient$/).waitFor({ state: "visible", timeout: 10000 });
    await page
      .getByText(/Approved Hospital · In Poseidon hospitalRoot/i)
      .waitFor({ state: "visible", timeout: 10000 });

    await header.getByRole("link", { name: /1\. Patient/i }).click();
    await page.waitForURL("**/patient", { timeout: 10000 });
    await page.getByText(/Patient Wallet Connected/i).waitFor({ state: "visible", timeout: 10000 });

    assert.equal(hydrationErrors.length, 0, `Hydration errors: ${hydrationErrors.join(" | ")}`);
    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join(" | ")}`);
    console.log("[audit:ecc] PASSED all OWASP 2025 perimeter & MetaMask E2E assertions!");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("[audit:ecc] FAILED:", err);
  process.exit(1);
});
