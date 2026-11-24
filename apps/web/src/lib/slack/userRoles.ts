import type { SlackRole } from "./blocks";

const userRoleStore = new Map<string, SlackRole>();

export function getSlackUserRole(userId: string): SlackRole | undefined {
  return userRoleStore.get(userId);
}

export function setSlackUserRole(userId: string, role: SlackRole): void {
  userRoleStore.set(userId, role);
}
