declare module "circomlibjs" {
  export interface PoseidonHasher {
    (inputs: (bigint | number | string)[]): unknown;
    F: {
      toObject(val: unknown): bigint;
    };
  }
  export function buildPoseidon(): Promise<PoseidonHasher>;
}

declare module "snarkjs" {
  export interface Groth16Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol?: string;
    curve?: string;
  }

  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;
    verify(
      vKey: unknown,
      publicSignals: string[],
      proof: Groth16Proof
    ): Promise<boolean>;
  };
}
