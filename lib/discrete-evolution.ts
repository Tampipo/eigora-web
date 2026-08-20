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

// Answers already received, keyed by the request that produced them. A run is
// a pure function of its request, so a repeat is free: flipping back to a
// setting you have already looked at redraws without touching the network.
// Capped and evicted oldest-first, since dragging a slider mints a key per
// stop and the map would otherwise grow for the life of the page.
const CACHE = new Map<string, DiscreteEvolutionResponse>();
const CACHE_LIMIT = 64;

// Requests currently on the wire, so a prefetch and a live hook asking for the
// same run at the same time only send it once.
const INFLIGHT = new Map<string, Promise<DiscreteEvolutionResponse>>();

function remember(key: string, value: DiscreteEvolutionResponse) {
  CACHE.delete(key);
  CACHE.set(key, value);
  if (CACHE.size > CACHE_LIMIT) {
    const oldest = CACHE.keys().next();
    if (!oldest.done) CACHE.delete(oldest.value);
  }
}

function run(key: string): Promise<DiscreteEvolutionResponse> {
  const existing = INFLIGHT.get(key);
  if (existing) return existing;

  const promise = discreteEvolutionV1QmDiscreteEvolutionPost(
    JSON.parse(key) as DiscreteEvolutionRequest,
  )
    .then((res: discreteEvolutionV1QmDiscreteEvolutionPostResponse) => {
      if (res.status !== 200) {
        throw new Error(`API returned ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const data = res.data as DiscreteEvolutionResponse;
      remember(key, data);
      return data;
    })
    .finally(() => {
      INFLIGHT.delete(key);
    });

  INFLIGHT.set(key, promise);
  return promise;
}

/**
 * Fetch a run into the cache without rendering it.
 *
 * For settings the user has not asked for yet but plausibly will, so the
 * switch costs nothing when it comes. Failures are swallowed: a prefetch that
 * does not arrive simply leaves the real request to make it later.
 */
export function prefetchDiscreteEvolution(request: DiscreteEvolutionRequest) {
  const key = JSON.stringify(request);
  if (CACHE.has(key) || INFLIGHT.has(key)) return;
  void run(key).catch(() => {});
}

/**
 * Run an evolution on the API, keeping only the newest answer.
 *
 * A whole run comes back in one response, the coefficients being computed from
 * psi(0) directly rather than stepped, so playback is local and only a
 * parameter change costs a request. Pass `null` to hold off entirely, which is
 * what a state with no amplitude anywhere has to do: the API rejects a zero
 * vector, and rightly so.
 *
 * `dataKey` is the request `data` actually belongs to. It matters whenever a
 * figure combines two runs: both change together, they land in either order,
 * and a caller that assumes otherwise will pair a fresh response with a stale
 * one. Comparing `dataKey` against the request just sent is the only way to
 * know the two halves describe the same state.
 */
export function useDiscreteEvolution(request: DiscreteEvolutionRequest | null) {
  const [entry, setEntry] = useState<{
    key: string;
    data: DiscreteEvolutionResponse;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const key = request ? JSON.stringify(request) : null;

  // A cache hit resolves during render, so a repeat setting never blanks the
  // figure or shows a spinner on its way back to something already drawn.
  const cached = key !== null ? CACHE.get(key) : undefined;
  const resolved = cached ? { key: key as string, data: cached } : entry;

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
    if (CACHE.has(key)) {
      setLoading(false);
      setError(null);
      return;
    }
    const mine = ++generation.current;
    setLoading(true);
    setError(null);

    run(key)
      .then((data) => {
        if (!alive.current || generation.current !== mine) return;
        setEntry({ key, data });
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

  return {
    data: resolved?.data ?? null,
    dataKey: resolved?.key ?? null,
    error,
    loading,
  };
}
