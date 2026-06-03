// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MDXComponents } from "mdx/types";
import { EigenstateViewer } from "@/components/simulations/EigenstateViewer";
import { WavepacketEvolution } from "@/components/simulations/WavepacketEvolution";
import { FormulaBlock } from "@/components/ui/FormulaBlock";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    EigenstateViewer,
    WavepacketEvolution,
    FormulaBlock,
  };
}
