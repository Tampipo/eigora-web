// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";

import {
  discreteEvolutionV1QmDiscreteEvolutionPost,
  type discreteEvolutionV1QmDiscreteEvolutionPostResponse,
} from "@/lib/api/quantum-mechanics/quantum-mechanics";
import type {
  DiscreteEvolutionRequest,
  DiscreteEvolutionResponse,
} from "@/lib/api/schemas";

/**
 * Run an evolution on the API, keeping only the newest answer.
 *
 * A whole run comes back in one response — the coefficients are computed from
 * psi(0) directly, not stepped — so playback is local and only a parameter
 * change costs a request. Pass `null` to hold off entirely, which is what a
 * state with no amplitude anywhere has to do: the API rejects a zero vector,
 * and rightly so.
 */
export function useDiscreteEvolution(request: DiscreteEvolutionRequest | null) {
  const [data, setData] = useState<DiscreteEvolutionResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const key = request ? JSON.stringify(request) : null;

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // A run that lands after its parameters have moved on belongs to a figure
  // nobody is looking at any more.
  const generation = useRef(0);

  useEffect(() => {
    if (key === null) return;
    const mine = ++generation.current;
    setLoading(true);
    setError(null);

    discreteEvolutionV1QmDiscreteEvolutionPost(
      JSON.parse(key) as DiscreteEvolutionRequest,
    )
      .then((res: discreteEvolutionV1QmDiscreteEvolutionPostResponse) => {
        if (!alive.current || generation.current !== mine) return;
        if (res.status !== 200) {
          throw new Error(
            `API returned ${res.status}: ${JSON.stringify(res.data)}`,
          );
        }
        setData(res.data as DiscreteEvolutionResponse);
      })
      .catch((e: unknown) => {
        if (!alive.current || generation.current !== mine) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!alive.current || generation.current !== mine) return;
        setLoading(false);
      });
  }, [key]);

  return { data, error, loading };
}
