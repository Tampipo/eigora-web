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
