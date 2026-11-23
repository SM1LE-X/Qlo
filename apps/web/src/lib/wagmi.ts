import { createConfig, fallback, http, injected } from "wagmi";
import { baseSepolia } from "wagmi/chains";

const DEFAULT_BASE_SEPOLIA_RPCS = [
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.drpc.org",
] as const;

const customRpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL?.trim();

export const BASE_SEPOLIA_RPCS: readonly string[] = customRpcUrl
  ? [customRpcUrl, ...DEFAULT_BASE_SEPOLIA_RPCS]
  : [...DEFAULT_BASE_SEPOLIA_RPCS];

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: fallback(
      BASE_SEPOLIA_RPCS.map((url) =>
        http(url, {
          timeout: 12_000,
          retryCount: 2,
          retryDelay: 400,
        })
      ),
      { rank: false, retryCount: 2 }
    ),
  },
  batch: {
    multicall: true,
  },
  ssr: true,
});
