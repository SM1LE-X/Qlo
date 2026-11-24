import { describe, expect, it } from "vitest";
import {
  ROLE_META,
  ROLE_ORDER,
  canAccessRole,
  describeLockReason,
  roleForPathname,
} from "@/lib/roles";

describe("RBAC role access rules", () => {
  it("enforces strict role account isolation when signed in without wallet", () => {
    const sessionOnly = {
      isConnected: false,
      isPatient: false,
      isApprovedHospital: false,
      isInsurer: false,
    };
    for (const active of ROLE_ORDER) {
      for (const target of ROLE_ORDER) {
        expect(canAccessRole(target, active, sessionOnly)).toBe(target === active);
      }
    }
  });

  it("enforces verified wallet roles when connected on Sepolia", () => {
    const hospitalOnly = {
      isConnected: true,
      isPatient: false,
      isApprovedHospital: true,
      isInsurer: false,
    };
    expect(canAccessRole("hospital", "patient", hospitalOnly)).toBe(true);
    expect(canAccessRole("patient", "patient", hospitalOnly)).toBe(false);
    expect(canAccessRole("insurer", "insurer", hospitalOnly)).toBe(false);
  });

  it("maps portal pathnames cleanly", () => {
    expect(roleForPathname("/patient")).toBe("patient");
    expect(roleForPathname("/hospital")).toBe("hospital");
    expect(roleForPathname("/insurer")).toBe("insurer");
    expect(roleForPathname("/slack")).toBeNull();
    expect(roleForPathname("/onboarding")).toBeNull();
  });

  it("describes institutional lock reasons without persona jargon", () => {
    const msg = describeLockReason("hospital", "patient", false);
    expect(msg).toContain("Patient");
    expect(msg).toContain("requires Hospital access");
    expect(msg).not.toContain(ROLE_META.hospital.contractGate);
    expect(msg.toLowerCase()).not.toContain("persona");

    const walletMsg = describeLockReason("insurer", "insurer", true);
    expect(walletMsg).toContain("Connected Ethereum Sepolia wallet");
    expect(walletMsg).toContain(ROLE_META.insurer.contractGate);
  });
});
