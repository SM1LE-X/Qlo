export const PUBLIC_WELL_KNOWN_PATHS = new Set([
  "/.well-known/security.txt",
  "/.well-known/agent.json",
]);

export const BLOCKED_PATH_PREFIXES = [
  "/.git",
  "/.env",
  "/.npmrc",
  "/.yarnrc.yml",
  "/package.json",
  "/package-lock.json",
  "/pnpm-lock.yaml",
  "/yarn.lock",
  "/docker-compose.yml",
] as const;

/**
 * Blocks direct public HTTP access to hidden dotfiles, Git object metadata,
 * dependency manifests/lockfiles, and environment configuration files while
 * preserving RFC 9116 / agent discovery metadata under `/.well-known/`.
 */
export function isBlockedPerimeterPath(pathname: string): boolean {
  const normalized = (pathname || "/").trim().toLowerCase().replace(/\/+$/, "") || "/";

  if (PUBLIC_WELL_KNOWN_PATHS.has(normalized)) {
    return false;
  }

  if (normalized.startsWith("/.")) {
    return true;
  }

  return BLOCKED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}
