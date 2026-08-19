// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";

import {
  discreteMeasurementV1QmDiscreteMeasurementPost,
  type discreteMeasurementV1QmDiscreteMeasurementPostResponse,
} from "@/lib/api/quantum-mechanics/quantum-mechanics";
import type { MeasurementRequest, MeasurementResponse } from "@/lib/api/schemas";

/**
 * Run a projective measurement on the API, keeping only the newest answer.
 *
 * Pass `null` to hold off — which is what a zero state, or an operator the
 * caller has already flagged as non-Hermitian, has to do: the API requires a
 * Hermitian operator (422 otherwise) and rejects a zero-norm state, so there
 * is nothing to gain from asking either.
 */
export function useMeasurement(request: MeasurementRequest | null) {
  const [data, setData] = useState<MeasurementResponse | null>(null);
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

  // A response that lands after its parameters have moved on belongs to a
  // matrix nobody is looking at any more.
  const generation = useRef(0);

  useEffect(() => {
    if (key === null) {
      setData(null);
      setError(null);
      return;
    }
    const mine = ++generation.current;
    setLoading(true);
    setError(null);

    discreteMeasurementV1QmDiscreteMeasurementPost(
      JSON.parse(key) as MeasurementRequest,
    )
      .then((res: discreteMeasurementV1QmDiscreteMeasurementPostResponse) => {
        if (!alive.current || generation.current !== mine) return;
        if (res.status !== 200) {
          throw new Error(
            `API returned ${res.status}: ${JSON.stringify(res.data)}`,
          );
        }
        setData(res.data as MeasurementResponse);
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
