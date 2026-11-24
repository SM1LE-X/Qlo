"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { SlackBlockMessage } from "@/lib/slack/blocks";

type Block = Record<string, unknown>;

const TOKEN = /\*([^*\n]+)\*|`([^`\n]+)`|<((?:https?:\/\/|\/)[^|>\s]+)(?:\|([^>]+))?>/g;

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

export function renderMrkdwn(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push(text.slice(last, index));
    }

    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[#09090B]">
          {match[1]}
        </strong>
      );
    } else if (match[2] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 font-mono-tabular text-[11.5px] text-[#059669]"
        >
          {match[2]}
        </code>
      );
    } else if (match[3] !== undefined && isSafeUrl(match[3])) {
      const href = match[3];
      const label = match[4] ?? href;
      const isExternal = /^https?:\/\//i.test(href);
      nodes.push(
        isExternal ? (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono-tabular text-[12px] text-[#0284C7] underline decoration-[#38BDF8]/40 underline-offset-2 transition hover:text-[#7DD3FC] hover:decoration-[#7DD3FC]"
          >
            <span>{label}</span>
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <Link
            key={key++}
            href={href}
            className="text-[#059669] underline decoration-[#10B981]/40 underline-offset-2 transition hover:text-[#059669]"
          >
            {label}
          </Link>
        )
      );
    }

    last = index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}

function textOf(value: unknown): string {
  if (value && typeof value === "object" && "text" in value) {
    const t = (value as { text?: unknown }).text;
    return typeof t === "string" ? t : "";
  }
  return "";
}

function ActionButton({ el }: { el: Block }) {
  const label = textOf(el.text);
  const url = typeof el.url === "string" && isSafeUrl(el.url) ? el.url : undefined;
  const style = el.style === "primary" || el.style === "danger" ? el.style : undefined;

  const tone =
    style === "primary"
      ? "border-[#059669]/50 bg-[#ECFDF5] text-[#059669] hover:border-[#059669] hover:bg-[#D1FAE5]"
      : style === "danger"
        ? "border-[#DC2626]/45 bg-[#FEF2F2] text-[#F87171] hover:border-[#DC2626] hover:bg-[#EF4444]/18"
        : "border-[#D4D4D8] bg-[#FFFFFF] text-[#18181B] hover:border-[#A1A1AA] hover:bg-[#1C2330]";

  const classes = `inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition ${tone}`;

  if (!url) {
    return (
      <span aria-label={label} className={classes}>
        {label}
      </span>
    );
  }

  const isExternal = /^https?:\/\//i.test(url);
  if (isExternal) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={classes}
      >
        <span>{label}</span>
        <ExternalLink className="h-3 w-3 opacity-75" aria-hidden="true" />
      </a>
    );
  }

  return (
    <Link href={url} aria-label={label} className={classes}>
      {label}
    </Link>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "header":
      return (
        <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#09090B]">
          {textOf(block.text)}
        </p>
      );
    case "section":
      return (
        <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-[#27272A]">
          {renderMrkdwn(textOf(block.text))}
        </p>
      );
    case "context": {
      const elements = Array.isArray(block.elements) ? (block.elements as unknown[]) : [];
      return (
        <div className="border-t border-[#E4E4E7]/80 pt-2 text-[11.5px] leading-relaxed text-[#52525B]">
          {elements.map((el, idx) => (
            <span key={idx}>{renderMrkdwn(textOf(el))}</span>
          ))}
        </div>
      );
    }
    case "actions": {
      const elements = Array.isArray(block.elements) ? (block.elements as Block[]) : [];
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          {elements.map((el, idx) => (
            <ActionButton key={idx} el={el} />
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

export interface BlockRendererProps {
  message: SlackBlockMessage;
  accentHex?: string;
}

export function BlockRenderer({ message, accentHex }: BlockRendererProps) {
  const isReject = /rejected|revoked/i.test(message.text);
  const barColor = isReject ? "#EF4444" : (accentHex ?? "#10B981");

  return (
    <div
      aria-label={message.text}
      className="max-w-2xl rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-3 shadow-[0_1px_2px_rgba(9,9,11,0.03)]"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: barColor,
      }}
    >
      <div className="space-y-2">
        {message.blocks.map((block, idx) => (
          <BlockView key={idx} block={block} />
        ))}
      </div>
    </div>
  );
}
