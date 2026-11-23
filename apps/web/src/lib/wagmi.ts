import { createConfig, fallback, http, injected } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export const BASE_SEPOLIA_RPCS = [
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
] as const;

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: fallback(
      BASE_SEPOLIA_RPCS.map((url) => http(url)),
      { rank: false }
    ),
  },
  batch: {
    multicall: true,
  },
  ssr: true,
});
