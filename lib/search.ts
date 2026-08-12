// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared matching rules for both search surfaces: the tag/keyword filter on a
 * domain index page, and the global Cmd+K palette.
 */

/**
 * Lowercase and strip diacritics, so a French query types as it sounds:
 * "geometrie" matches "géométrie", "energie" matches "énergie".
 *
 * "é" is a single code point (U+00E9); NFD decomposes it into "e" plus a
 * combining acute (U+0301), which `\p{Diacritic}` then removes. Query and
 * content both go through this, so the two always meet on the same alphabet.
 */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Split a query into normalized terms. All of them must match (an AND). */
export function queryTerms(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/**
 * A window of text around the first term, for showing *why* a result matched.
 * Falls back to the head of the text when no term is found.
 */
export function excerpt(text: string, terms: string[], radius = 90): string {
  const haystack = normalize(text);
  const at = terms.reduce((best, term) => {
    const i = haystack.indexOf(term);
    return i !== -1 && (best === -1 || i < best) ? i : best;
  }, -1);

  if (at === -1) {
    return text.length > radius * 2
      ? `${text.slice(0, radius * 2).trimEnd()}…`
      : text;
  }

  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${
    end < text.length ? "…" : ""
  }`;
}
