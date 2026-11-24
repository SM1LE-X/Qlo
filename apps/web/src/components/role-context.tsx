"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ROLE_META,
  canAccessRole,
  describeLockReason,
  type AppRole,
  type RoleMeta,
} from "@/lib/roles";
import { useWalletRoles, type WalletRolesState } from "@/lib/useWalletRoles";

const STORAGE_KEY = "qlo:active-role:v1";

function isAppRole(value: unknown): value is AppRole {
  return value === "patient" || value === "hospital" || value === "insurer";
}

export interface ActiveRoleContextValue {
  activeRole: AppRole;
  activeMeta: RoleMeta;
  mode: "wallet" | "sandbox";
  walletRoles: WalletRolesState;
  setActiveRole: (role: AppRole) => void;
  canAccess: (target: AppRole) => boolean;
  lockReason: (target: AppRole) => string;
}

const ActiveRoleContext = createContext<ActiveRoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const walletRoles = useWalletRoles();
  const [sandboxRole, setSandboxRole] = useState<AppRole>("patient");

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (isAppRole(saved)) setSandboxRole(saved);
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const setActiveRole = useCallback((next: AppRole) => {
    setSandboxRole(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const derivedWalletRole = useMemo<AppRole>(() => {
    if (walletRoles.isApprovedHospital && !walletRoles.isPatient) return "hospital";
    if (walletRoles.isInsurer && !walletRoles.isPatient) return "insurer";
    return sandboxRole;
  }, [walletRoles.isApprovedHospital, walletRoles.isInsurer, walletRoles.isPatient, sandboxRole]);

  const mode: "wallet" | "sandbox" = walletRoles.isConnected ? "wallet" : "sandbox";
  const activeRole = mode === "wallet" ? derivedWalletRole : sandboxRole;

  const canAccess = useCallback(
    (target: AppRole) =>
      canAccessRole(target, activeRole, {
        isConnected: walletRoles.isConnected,
        isPatient: walletRoles.isPatient,
        isApprovedHospital: walletRoles.isApprovedHospital,
        isInsurer: walletRoles.isInsurer,
      }),
    [
      activeRole,
      walletRoles.isConnected,
      walletRoles.isPatient,
      walletRoles.isApprovedHospital,
      walletRoles.isInsurer,
    ]
  );

  const lockReason = useCallback(
    (target: AppRole) => describeLockReason(target, activeRole, walletRoles.isConnected),
    [activeRole, walletRoles.isConnected]
  );

  const value = useMemo<ActiveRoleContextValue>(
    () => ({
      activeRole,
      activeMeta: ROLE_META[activeRole],
      mode,
      walletRoles,
      setActiveRole,
      canAccess,
      lockReason,
    }),
    [activeRole, mode, walletRoles, setActiveRole, canAccess, lockReason]
  );

  return <ActiveRoleContext.Provider value={value}>{children}</ActiveRoleContext.Provider>;
}

export function useActiveRole(): ActiveRoleContextValue {
  const ctx = useContext(ActiveRoleContext);
  if (!ctx) {
    throw new Error("useActiveRole must be used within RoleProvider");
  }
  return ctx;
}
