// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [
      rehypeKatex,
      [rehypePrettyCode, { theme: "github-dark-dimmed", keepBackground: false }],
    ],
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Tutorial cells live in content/cells as real Python files, imported as text.
  webpack(config) {
    config.module.rules.push({ test: /\.py$/, type: "asset/source" });
    return config;
  },
};

export default withNextIntl(withMDX(nextConfig));
