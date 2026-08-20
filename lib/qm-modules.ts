// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// Single source of truth for the QM module slugs — drives the index grid
// (app/[locale]/qm/page.tsx) and the sidebar nav (components/ui/Sidebar.tsx).
// Each slug must have a matching content/{locale}/qm/{slug}.mdx and a
// qm.modules.{slug}.{title,summary,tags} entry in messages/{locale}.json.
// Suggested reading order: the equation itself first — schrodinger states the
// postulate and shows that solving it reduces to an eigenvalue problem, which
// is what every module after it then goes and solves. Then measurement spells
// out the postulate that decomposition was already quietly assuming (outcomes,
// Born rule, collapse), and why Hermiticity is the condition that makes it
// work — used from here on by name, most visibly in spin. Then maser puts the
// two together on the smallest Hilbert space there is: a two-level Hamiltonian
// with an off-diagonal coupling, diagonalised and evolved exactly as
// schrodinger describes, then read with the Born rule exactly as measurement
// describes — a fully worked example before the continuous case. Then
// wavefunctions defines psi(x) and its momentum-space counterpart as
// position/momentum-basis coefficients of that same decomposition — a
// prerequisite for reading psi(x) in every module that follows. Then 1D bound
// states (harmonic sets up eigenstates, superposition and wavepackets; the
// finite well adds parity and counting), then the unbound counterpart
// (barrier reuses those wavepackets), then more dimensions (well-2d
// introduces separability and degeneracy, which orbitals builds straight on
// top of), and finally spin — a different formalism, with no wavefunction and
// no Schrödinger equation, so it stands apart.
export const QM_MODULES = [
  "schrodinger",
  "measurement",
  "maser",
  "wavefunctions",
  "harmonic",
  "well-bound-states",
  "barrier",
  "well-2d",
  "orbitals",
  "spin",
] as const;
