import { describe, expect, it } from "vitest";
import { isBlockedPerimeterPath } from "@/lib/perimeter";

describe("OWASP 2025 Web Perimeter Path Blocker", () => {
  it("blocks git metadata, dotfiles, environment secrets, and lockfiles", () => {
    const blocked = [
      "/.git/HEAD",
      "/.git/config",
      "/.GIT/HEAD",
      "/.env",
      "/.env.local",
      "/.npmrc",
      "/.yarnrc.yml",
      "/package.json",
      "/package-lock.json",
      "/pnpm-lock.yaml",
      "/yarn.lock",
      "/docker-compose.yml",
      "/.secret",
      "/.secret/",
    ];

    for (const p of blocked) {
      expect(isBlockedPerimeterPath(p), `Expected ${p} to be blocked`).toBe(true);
    }
  });

  it("permits legitimate routes, ZK/OCR assets, API endpoints, and RFC 9116 discovery paths", () => {
    const allowed = [
      "/",
      "/patient",
      "/hospital",
      "/insurer",
      "/story",
      "/api/health",
      "/api/relay/state",
      "/api/relay/vault",
      "/zk/ClaimValidity.zkey",
      "/ocr/worker.min.js",
      "/.well-known/security.txt",
      "/.well-known/agent.json",
    ];

    for (const p of allowed) {
      expect(isBlockedPerimeterPath(p), `Expected ${p} to be allowed`).toBe(false);
    }
  });
});
