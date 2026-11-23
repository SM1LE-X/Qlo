"use client";

import { useEffect, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+";

/**
 * EasyUI TextScrambleDecoder (MIT): clean high-contrast scramble on porcelain surfaces.
 */
export function DecryptedText({
  text,
  encrypted,
  className,
}: {
  text: string;
  encrypted: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 14;
    const target = encrypted
      ? Array.from(text)
          .map((_, idx) => CHARS[(idx * 7 + 13) % CHARS.length])
          .join("")
      : text;

    const timer = setInterval(() => {
      frame += 1;
      const ratio = frame / totalFrames;
      const lockedLen = Math.floor(target.length * ratio);
      let next = "";
      for (let i = 0; i < target.length; i++) {
        next +=
          i < lockedLen
            ? target[i]
            : CHARS[(i * 11 + frame * 5) % CHARS.length];
      }
      setDisplay(next);
      if (frame >= totalFrames) {
        clearInterval(timer);
        setDisplay(target);
      }
    }, 20);

    return () => clearInterval(timer);
  }, [text, encrypted]);

  return (
    <span
      className={
        className ??
        (encrypted
          ? "font-mono-tabular text-[#B45309] font-medium tracking-wider"
          : "font-mono-tabular text-[#047857] font-medium")
      }
    >
      {display}
    </span>
  );
}
