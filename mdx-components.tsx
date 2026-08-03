// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MDXComponents } from "mdx/types";
import { EigenstateViewer } from "@/components/simulations/EigenstateViewer";
import { WavepacketEvolution } from "@/components/simulations/WavepacketEvolution";
import { BarrierScattering } from "@/components/simulations/BarrierScattering";
import { OrbitalViewer } from "@/components/simulations/OrbitalViewer";
import { DegeneracyLattice } from "@/components/simulations/DegeneracyLattice";
import { SeparableStateViewer } from "@/components/simulations/SeparableStateViewer";
import { FormulaBlock } from "@/components/ui/FormulaBlock";
import { Video } from "@/components/ui/Video";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    EigenstateViewer,
    WavepacketEvolution,
    BarrierScattering,
    OrbitalViewer,
    DegeneracyLattice,
    SeparableStateViewer,
    FormulaBlock,
    Video,
  };
}
