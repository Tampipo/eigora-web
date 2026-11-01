"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type ComponentProps } from "react";

/** A fenced code block with a copy button. Replaces `pre` in all MDX content. */
export function CodeBlock(props: ComponentProps<"pre">) {
  const t = useTranslations("tutorials.cell");
  const pre = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(pre.current?.textContent ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative">
      <pre ref={pre} {...props} />
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t("copied") : t("copy")}
        className="absolute right-2 top-2 rounded-md border border-border bg-surface-2 p-1.5 text-muted opacity-100 transition-colors hover:text-foreground sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
