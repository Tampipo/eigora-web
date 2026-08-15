// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { promises as fs } from "node:fs";
import path from "node:path";
import { getTranslations } from "next-intl/server";

/**
 * Build-time full-text index over the MDX course content.
 *
 * The whole thing is driven by the shape of `content/{locale}/{domain}/{slug}.mdx`
 * — domains are whatever directories exist, never a hardcoded list. Adding
 * `content/en/thermo/` puts thermo in the index with no change here.
 *
 * Runs on the server only (it reads the filesystem); the result is served as
 * static JSON by app/[locale]/search-index.json/route.ts.
 */

export type SearchEntry = {
  domain: string;
  slug: string;
  /** Localized module title, so the client needs no message catalogue. */
  title: string;
  /** Nearest heading above the text — the section the hit lives in. */
  heading: string;
  text: string;
};

const CONTENT_ROOT = path.join(process.cwd(), "content");

/**
 * Content directories that are not course material.
 *
 * `legal` follows the same `content/{locale}/{domain}/{slug}.mdx` shape and is
 * rendered by the same MDX pipeline, but it is boilerplate, not physics — a
 * search for "état" should not surface the privacy policy.
 */
const NON_COURSE_DOMAINS = new Set(["legal"]);

/** Text short enough to be a stray fragment rather than a real section. */
const MIN_SECTION_CHARS = 40;

/**
 * Turn one MDX section into plain prose.
 *
 * Order matters: `caption` strings are harvested *before* the JSX is dropped,
 * because captions carry real prose ("The Bloch sphere. |u⟩ and |d⟩ are
 * mutually exclusive…") that readers will search for. Everything else about a
 * component — its props, its numbers — is noise.
 */
function toPlainText(block: string): string {
  const captions = [...block.matchAll(/caption=(?:"([^"]*)"|'([^']*)')/g)].map(
    (m) => m[1] ?? m[2] ?? "",
  );

  const text = block
    // MDX import/export statements
    .replace(/^\s*(?:import|export)\s.*$/gm, " ")
    // Self-closing components, which may span several lines
    .replace(/<[A-Z][\s\S]*?\/>/g, " ")
    // Any remaining tags, opening or closing
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")
    // Display then inline math — LaTeX source is noise as search text
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ")
    // Links keep their label, drop the URL
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Residual markdown punctuation
    .replace(/[*_`>#|]/g, " ");

  return [text, ...captions].join(" ").replace(/\s+/g, " ").trim();
}

/** Split one file into sections keyed by their nearest heading. */
function toSections(source: string): { heading: string; text: string }[] {
  // Fenced code blocks first — their contents must not be parsed as headings.
  const body = source.replace(/```[\s\S]*?```/g, " ");

  const sections: { heading: string; raw: string[] }[] = [];
  let current = { heading: "", raw: [] as string[] };

  for (const line of body.split("\n")) {
    const match = /^(#{1,4})\s+(.*)$/.exec(line);
    if (match) {
      sections.push(current);
      current = { heading: match[2].trim(), raw: [] };
    } else {
      current.raw.push(line);
    }
  }
  sections.push(current);

  return sections
    .map((s) => ({ heading: s.heading, text: toPlainText(s.raw.join("\n")) }))
    .filter((s) => s.text.length >= MIN_SECTION_CHARS);
}

/** Directory names under content/{locale}, i.e. the domains that exist. */
async function listDomains(locale: string): Promise<string[]> {
  const root = path.join(CONTENT_ROOT, locale);
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !NON_COURSE_DOMAINS.has(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Look up a module's localized title. Falls back to the slug so a module whose
 * messages are not written yet still appears in results instead of crashing
 * the whole index.
 */
async function moduleTitle(
  locale: string,
  domain: string,
  slug: string,
): Promise<string> {
  try {
    const t = await getTranslations({
      locale,
      namespace: `${domain}.modules`,
    });
    return t(`${slug}.title`);
  } catch {
    return slug;
  }
}

export async function buildSearchIndex(locale: string): Promise<SearchEntry[]> {
  const entries: SearchEntry[] = [];

  for (const domain of await listDomains(locale)) {
    const dir = path.join(CONTENT_ROOT, locale, domain);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".mdx"));

    for (const file of files.sort()) {
      const slug = file.replace(/\.mdx$/, "");
      const source = await fs.readFile(path.join(dir, file), "utf8");
      const title = await moduleTitle(locale, domain, slug);

      for (const section of toSections(source)) {
        entries.push({
          domain,
          slug,
          title,
          // A section before any heading belongs to the module as a whole.
          heading: section.heading || title,
          text: section.text,
        });
      }
    }
  }

  return entries;
}
