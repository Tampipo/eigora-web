// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// Single source of truth for the tutorial slugs, in reading order. Each slug
// needs a content/{locale}/tutorials/{slug}.mdx and a
// tutorials.modules.{slug}.{title,summary,tags} entry in messages/{locale}.json.
export const TUTORIALS = ["getting-started", "plotting-eigenstates"] as const;

export type TutorialSlug = (typeof TUTORIALS)[number];
