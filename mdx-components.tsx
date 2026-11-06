// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MDXComponents } from "mdx/types";
import { AmmoniaConfigurations } from "@/components/simulations/AmmoniaConfigurations";
import { AmmoniaInversion } from "@/components/simulations/AmmoniaInversion";
import { DoubleWellStates } from "@/components/simulations/DoubleWellStates";
import { EigenstateViewer } from "@/components/simulations/EigenstateViewer";
import { WavepacketEvolution } from "@/components/simulations/WavepacketEvolution";
import { BarrierScattering } from "@/components/simulations/BarrierScattering";
import { FiniteWellGraphical } from "@/components/simulations/FiniteWellGraphical";
import { FiniteWellStates } from "@/components/simulations/FiniteWellStates";
import { InfiniteLeftWellStates } from "@/components/simulations/InfiniteLeftWellStates";
import { OrbitalViewer } from "@/components/simulations/OrbitalViewer";
import { DegeneracyLattice } from "@/components/simulations/DegeneracyLattice";
import { EnsembleExplorer } from "@/components/simulations/EnsembleExplorer";
import { PhaseCoexistence } from "@/components/simulations/PhaseCoexistence";
import { IsingLattice } from "@/components/simulations/IsingLattice";
import { GasMonteCarlo } from "@/components/simulations/GasMonteCarlo";
import { OperatorMeasurement } from "@/components/simulations/OperatorMeasurement";
import { PositionBins } from "@/components/simulations/PositionBins";
import { SeparableStateViewer } from "@/components/simulations/SeparableStateViewer";
import { SpinMeasurement } from "@/components/simulations/SpinMeasurement";
import { SuperpositionPhases } from "@/components/simulations/SuperpositionPhases";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { CodeCell } from "@/components/ui/CodeCell";
import { FormulaBlock } from "@/components/ui/FormulaBlock";
import { Tex } from "@/components/ui/Tex";
import { Video } from "@/components/ui/Video";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre: CodeBlock,
    CodeCell,
    AmmoniaConfigurations,
    AmmoniaInversion,
    DoubleWellStates,
    EigenstateViewer,
    WavepacketEvolution,
    BarrierScattering,
    FiniteWellGraphical,
    FiniteWellStates,
    InfiniteLeftWellStates,
    OrbitalViewer,
    DegeneracyLattice,
    EnsembleExplorer,
    PhaseCoexistence,
    IsingLattice,
    GasMonteCarlo,
    OperatorMeasurement,
    PositionBins,
    SeparableStateViewer,
    SpinMeasurement,
    SuperpositionPhases,
    FormulaBlock,
    Tex,
    Video,
  };
}
