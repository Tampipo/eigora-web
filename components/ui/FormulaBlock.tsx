// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import katex from "katex";

export function FormulaBlock({
  expression,
  display = true,
}: {
  expression: string;
  display?: boolean;
}) {
  const html = katex.renderToString(expression, {
    displayMode: display,
    throwOnError: false,
    output: "html",
  });

  return (
    <span
      className={display ? "block my-4 text-center" : "inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
