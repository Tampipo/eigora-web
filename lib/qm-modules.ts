// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// Single source of truth for the QM module slugs — drives the index grid
// (app/[locale]/qm/page.tsx) and the sidebar nav (components/ui/Sidebar.tsx).
// Each slug must have a matching content/{locale}/qm/{slug}.mdx and a
// qm.modules.{slug}.{title,summary,tags} entry in messages/{locale}.json.
// Suggested reading order: the equation itself first — schrodinger states the
// postulate and shows that solving it reduces to an eigenvalue problem, which
// is what every module after it then goes and solves. Then 1D bound states
// (harmonic sets up eigenstates, superposition and wavepackets; the finite
// well adds parity and counting), then the unbound counterpart (barrier reuses
// those wavepackets), then more dimensions (well-2d introduces separability
// and degeneracy, which orbitals builds straight on top of), and finally spin
// — a different formalism, with no wavefunction and no Schrödinger equation,
// so it stands apart.
export const QM_MODULES = [
  "schrodinger",
  "harmonic",
  "well-bound-states",
  "barrier",
  "well-2d",
  "orbitals",
  "spin",
] as const;
