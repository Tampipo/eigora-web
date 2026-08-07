// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useRef, useState } from "react";

import type { GridSchema, PotentialSchema } from "@/lib/api/schemas";
import {
  evolveWs,
  type EvolveFrameMessage,
  type EvolveMetadataMessage,
  type Wavepacket,
} from "@/lib/ws";

export interface UseEvolveRunArgs {
  potential: PotentialSchema;
  wavepacket?: Wavepacket;
  tMax: number;
  dt: number;
  nFrames: number;
  grid?: GridSchema;
}

export type RunStatus = "idle" | "connecting" | "streaming" | "ready" | "error";

export function useEvolveRun(args: UseEvolveRunArgs) {
  // Frames live in a ref to avoid per-frame re-renders; bufferedCount in state
  // triggers minimal re-renders (one per arriving frame) so the UI can react.
  const framesRef = useRef<EvolveFrameMessage[]>([]);
  const [metadata, setMetadata] = useState<EvolveMetadataMessage | null>(null);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const requestKey = JSON.stringify({
    potential: args.potential,
    ...(args.wavepacket ? { wavepacket: args.wavepacket } : {}),
    t_max: args.tMax,
    dt: args.dt,
    n_frames: args.nFrames,
    ...(args.grid ? { grid: args.grid } : {}),
  });

  useEffect(() => {
    setStatus("connecting");
    setError(null);
    setMetadata(null);
    setBufferedCount(0);
    framesRef.current = [];

    const session = evolveWs(JSON.parse(requestKey), {
      onMetadata: (m) => {
        setMetadata(m);
        setStatus("streaming");
      },
      onFrame: (f) => {
        framesRef.current.push(f);
        setBufferedCount(framesRef.current.length);
      },
      onDone: () => {
        setStatus("ready");
      },
      onError: (e) => {
        setError(e);
        setStatus("error");
      },
    });

    return () => session.close();
  }, [requestKey]);

  return {
    metadata,
    framesRef,
    bufferedCount,
    totalFrames: metadata?.n_frames ?? 0,
    status,
    error,
  };
}
