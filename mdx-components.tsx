// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MDXComponents } from "mdx/types";
import { EigenstateViewer } from "@/components/simulations/EigenstateViewer";
import { WavepacketEvolution } from "@/components/simulations/WavepacketEvolution";
import { BarrierScattering } from "@/components/simulations/BarrierScattering";
import { FiniteWellGraphical } from "@/components/simulations/FiniteWellGraphical";
import { FiniteWellStates } from "@/components/simulations/FiniteWellStates";
import { InfiniteLeftWellStates } from "@/components/simulations/InfiniteLeftWellStates";
import { OrbitalViewer } from "@/components/simulations/OrbitalViewer";
import { DegeneracyLattice } from "@/components/simulations/DegeneracyLattice";
import { PositionBins } from "@/components/simulations/PositionBins";
import { SeparableStateViewer } from "@/components/simulations/SeparableStateViewer";
import { SpinMeasurement } from "@/components/simulations/SpinMeasurement";
import { SuperpositionPhases } from "@/components/simulations/SuperpositionPhases";
import { FormulaBlock } from "@/components/ui/FormulaBlock";
import { Tex } from "@/components/ui/Tex";
import { Video } from "@/components/ui/Video";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    EigenstateViewer,
    WavepacketEvolution,
    BarrierScattering,
    FiniteWellGraphical,
    FiniteWellStates,
    InfiniteLeftWellStates,
    OrbitalViewer,
    DegeneracyLattice,
    PositionBins,
    SeparableStateViewer,
    SpinMeasurement,
    SuperpositionPhases,
    FormulaBlock,
    Tex,
    Video,
  };
}
