// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";

import {
  eigenstatesQmEigenstatesPost,
  type eigenstatesQmEigenstatesPostResponse,
} from "@/lib/api/quantum-mechanics/quantum-mechanics";
import type {
  EigenstatesResponse,
  GridSchema,
  PotentialSchema,
  PotentialSchemaParams,
} from "@/lib/api/schemas";

/**
 * Solve for eigenstates on the API, tracking a live control without flooding it.
 *
 * Latest-wins scheduler: at most one request in flight. New parameter values
 * that arrive while a solve is running are stored as "pending" (only the most
 * recent is kept) and fired the instant the current one resolves. This lets a
 * plot track a dragging slider smoothly, with no debounce delay.
 */
export function useEigenstates(
  potential: PotentialSchema,
  nStates: number,
  grid: GridSchema | undefined,
) {
  const [data, setData] = useState<EigenstatesResponse | null>(null);
  const [fetchedParams, setFetchedParams] = useState<PotentialSchemaParams>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const requestKey = JSON.stringify({
    potential,
    n_states: nStates,
    ...(grid ? { grid } : {}),
  });

  const inFlight = useRef(false);
  const pending = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const fire = (key: string) => {
      inFlight.current = true;
      setLoading(true);
      setError(null);
      const body = JSON.parse(key);

      eigenstatesQmEigenstatesPost(body)
        .then((res: eigenstatesQmEigenstatesPostResponse) => {
          if (!alive.current) return;
          if (res.status === 200) {
            setData(res.data as EigenstatesResponse);
            setFetchedParams(
              (body.potential?.params ?? null) as PotentialSchemaParams,
            );
          } else {
            setError(
              new Error(`API returned ${res.status}: ${JSON.stringify(res.data)}`),
            );
          }
        })
        .catch((e: unknown) => {
          if (!alive.current) return;
          setError(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          inFlight.current = false;
          if (!alive.current) return;
          const next = pending.current;
          if (next && next !== key) {
            pending.current = null;
            fire(next);
          } else {
            pending.current = null;
            setLoading(false);
          }
        });
    };

    if (inFlight.current) {
      pending.current = requestKey;
    } else {
      fire(requestKey);
    }
  }, [requestKey]);

  return { data, fetchedParams, error, loading };
}
