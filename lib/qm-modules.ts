// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

// Single source of truth for the QM module slugs — drives the index grid
// (app/[locale]/qm/page.tsx) and the sidebar nav (components/ui/Sidebar.tsx).
// Each slug must have a matching content/{locale}/qm/{slug}.mdx and a
// qm.modules.{slug}.{title,summary} entry in messages/{locale}.json.
export const QM_MODULES = ["harmonic", "barrier", "well", "orbitals"] as const;
