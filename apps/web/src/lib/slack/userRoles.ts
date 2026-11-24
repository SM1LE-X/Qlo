import type { SlackRole } from "./blocks";

const userRoleStore = new Map<string, SlackRole>();

export function getSlackUserRole(userId: string): SlackRole | undefined {
  return userRoleStore.get(userId);
}

export function setSlackUserRole(userId: string, role: SlackRole): void {
  userRoleStore.set(userId, role);
}

const welcomedUsers = new Set<string>();

/** True exactly once per user per server lifetime — used to send the first-open welcome DM. */
export function markWelcomed(userId: string): boolean {
  if (welcomedUsers.has(userId)) return false;
  welcomedUsers.add(userId);
  return true;
}
