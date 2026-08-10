// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useRef, useState } from "react";

import {
  trajectoryQmTrajectoryPost,
  type trajectoryQmTrajectoryPostResponse,
} from "@/lib/api/quantum-mechanics/quantum-mechanics";
import type {
  GridSchema,
  PotentialSchema,
  TrajectoryResponse,
  WavepacketSchema,
} from "@/lib/api/schemas";

export interface UseTrajectoryArgs {
  potential: PotentialSchema;
  wavepacket: WavepacketSchema;
  tMax: number;
  dt: number;
  nFrames: number;
  grid?: GridSchema;
  /**
   * Also fetch the classical point-particle path, for comparison against the
   * quantum means. The API rejects this for potentials with a step in them.
   */
  includeClassical?: boolean;
}

/**
 * Ask the API where the packet is over time.
 *
 * Everything this returns -- <x>(t), the spreads, the energy, the classical
 * path, the turning points -- is computed server-side by `eigora`. Nothing
 * here recomputes physics; the component only draws what arrives.
 *
 * Latest-wins with an in-flight guard, matching `useEigenstates`, so dragging
 * a slider chases the server rather than queueing a request per pixel.
 */
export function useTrajectory(args: UseTrajectoryArgs) {
  const [data, setData] = useState<TrajectoryResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const requestKey = JSON.stringify({
    potential: args.potential,
    wavepacket: args.wavepacket,
    t_max: args.tMax,
    dt: args.dt,
    n_frames: args.nFrames,
    ...(args.grid ? { grid: args.grid } : {}),
    ...(args.includeClassical ? { include_classical: true } : {}),
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

      trajectoryQmTrajectoryPost(JSON.parse(key))
        .then((res: trajectoryQmTrajectoryPostResponse) => {
          if (!alive.current) return;
          if (res.status === 200) {
            setData(res.data as TrajectoryResponse);
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

  return { data, error, loading };
}
