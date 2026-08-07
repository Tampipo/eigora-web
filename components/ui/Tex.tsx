"use client";

// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import katex from "katex";
import { useMemo } from "react";

export function Tex({
  children,
  block = false,
  className,
}: {
  children: string;
  block?: boolean;
  className?: string;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: block,
        throwOnError: false,
        output: "html",
        strict: "ignore",
      }),
    [children, block],
  );

  return (
    <span
      className={
        (block ? "block" : "inline") + (className ? ` ${className}` : "")
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
