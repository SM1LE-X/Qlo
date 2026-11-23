import { createConfig, fallback, http, injected } from "wagmi";
import { sepolia } from "wagmi/chains";

const DEFAULT_SEPOLIA_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
  "https://sepolia.gateway.tenderly.co",
] as const;

const customRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim();

export const SEPOLIA_RPCS: readonly string[] = customRpcUrl
  ? [customRpcUrl, ...DEFAULT_SEPOLIA_RPCS]
  : [...DEFAULT_SEPOLIA_RPCS];

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: fallback(
      SEPOLIA_RPCS.map((url) =>
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
