"use client";

import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

export function NumberTicker({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const spring = useSpring(value, { stiffness: 130, damping: 24 });

  useEffect(() => {
    spring.set(value);
    const unsub = spring.on("change", (latest) => {
      setShown(latest);
    });
    return () => unsub();
  }, [value, spring]);

  const formatted =
    decimals === 0
      ? Math.round(shown).toLocaleString("en-US")
      : shown.toFixed(decimals);

  return (
    <span className={className ?? "font-mono-tabular"}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export function SlidingCountdown({ secondsLeft }: { secondsLeft: number }) {
  const clamped = Math.max(0, Math.floor(secondsLeft));
  const mins = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const secs = (clamped % 60).toString().padStart(2, "0");

  return (
    <motion.span
      key={`${mins}:${secs}`}
      initial={{ y: -2, opacity: 0.75 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 font-mono-tabular text-xs font-semibold text-[#B45309]"
      aria-live="polite"
    >
      {mins}:{secs}
    </motion.span>
  );
}
