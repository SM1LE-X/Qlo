import { keccak256, toBytes } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  decodeContractError,
  ensureBaseSepoliaChain,
  validatePositiveEthInput,
} from "@/lib/txHelpers";

describe("txHelpers — Base Sepolia Validation & Error Decoding", () => {
  it("validatePositiveEthInput parses valid decimal ETH amounts and rejects invalid/zero values", () => {
    expect(validatePositiveEthInput("0.01")).toBe(10_000_000_000_000_000n);
    expect(validatePositiveEthInput(" 1.25 ", "Escrow deposit")).toBe(1_250_000_000_000_000_000n);

    expect(() => validatePositiveEthInput("0")).toThrow(/positive ETH amount/i);
    expect(() => validatePositiveEthInput("-0.1")).toThrow(/valid decimal ETH number/i);
    expect(() => validatePositiveEthInput("abc")).toThrow(/valid decimal ETH number/i);
    expect(() => validatePositiveEthInput("")).toThrow(/valid decimal ETH number/i);
  });

  it("decodeContractError maps wallet rejections, insufficient gas, and Qlo custom error names & 4-byte selectors", () => {
    expect(decodeContractError(new Error("UserRejectedRequestError: User denied transaction"))).toBe(
      "Transaction cancelled in wallet."
    );
    expect(decodeContractError({ shortMessage: "MetaMask Tx Signature: User rejected (4001)" })).toBe(
      "Transaction cancelled in wallet."
    );
    expect(decodeContractError(new Error("insufficient funds for gas * price + value"))).toContain(
      "Insufficient Base Sepolia ETH"
    );

    expect(decodeContractError(new Error("execution reverted: NullifierAlreadyUsed"))).toContain(
      "ClaimsVault.NullifierAlreadyUsed()"
    );
    expect(decodeContractError(new Error("PatientAccessNotActive"))).toContain(
      "ClaimsVault.PatientAccessNotActive()"
    );
    expect(decodeContractError(new Error("ClaimTimestampOutOfWindow"))).toContain(
      "ClaimsVault.ClaimTimestampOutOfWindow()"
    );
    expect(decodeContractError(new Error("EnforcedPause"))).toContain(
      "ClaimsVault.EnforcedPause()"
    );

    const nullifierSelector = keccak256(toBytes("NullifierAlreadyUsed()")).slice(0, 10);
    expect(
      decodeContractError({ cause: { data: nullifierSelector } })
    ).toContain("ClaimsVault.NullifierAlreadyUsed()");
  });

  it("ensureBaseSepoliaChain skips switching on 84532 and switches cleanly from wrong chain", async () => {
    const switchFn = vi.fn(async () => undefined);
    await ensureBaseSepoliaChain(84532, switchFn);
    expect(switchFn).not.toHaveBeenCalled();

    await ensureBaseSepoliaChain(1, switchFn);
    expect(switchFn).toHaveBeenCalledWith({ chainId: 84532 });

    const rejectingSwitch = vi.fn(async () => {
      throw new Error("User rejected the request (4001)");
    });
    await expect(ensureBaseSepoliaChain(1, rejectingSwitch)).rejects.toThrow(
      "Transaction cancelled in wallet."
    );
  });
});
