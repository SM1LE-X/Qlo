"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";
import { RoleProvider } from "@/components/role-context";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Preload ZK proving artifacts during idle time so /hospital proves cleanly sub-second
  useEffect(() => {
    const preload = () => {
      fetch("/zk/ClaimValidity.wasm").catch(() => undefined);
      fetch("/zk/ClaimValidity.zkey").catch(() => undefined);
      fetch("/zk/verification_key.json").catch(() => undefined);
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(preload);
    } else {
      const id = setTimeout(preload, 800);
      return () => clearTimeout(id);
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RoleProvider>{children}</RoleProvider>
          <Toaster
            theme="light"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#FFFFFF",
                border: "1px solid #E4E4E7",
                color: "#09090B",
                boxShadow: "0 10px 28px -8px rgba(9, 9, 11, 0.12)",
              },
            }}
          />
        </QueryClientProvider>
      </WagmiProvider>
    </MotionConfig>
  );
}
