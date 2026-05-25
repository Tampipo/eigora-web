"use client";

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
