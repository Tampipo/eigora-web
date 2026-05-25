import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import createMDX from "@next/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

export default withNextIntl(withMDX(nextConfig));
