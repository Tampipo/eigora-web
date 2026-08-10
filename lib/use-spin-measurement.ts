// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";

import {
  discreteMeasurementQmDiscreteMeasurementPost,
  type discreteMeasurementQmDiscreteMeasurementPostResponse,
} from "@/lib/api/quantum-mechanics/quantum-mechanics";
import type {
  ComplexMatrixSchema,
  ComplexVectorSchema,
  MeasurementRequest,
  MeasurementResponse,
} from "@/lib/api/schemas";

// The apparatus is fixed along z; the state is what turns. sigma_z is already
// diagonal in the computational basis, so |u> and |d> are its +1 and -1
// eigenvectors and the API's outcomes come back in that order.
const SIGMA_Z: ComplexMatrixSchema = {
  re: [
    [1, 0],
    [0, -1],
  ],
};

/**
 * The x–z great circle of the Bloch sphere, as a state vector.
 *
 * |psi> = cos(theta/2)|u> + sin(theta/2)|d>, with theta measured from +z. The
 * amplitudes stay real all the way round: past 180° the cosine simply goes
 * negative, which is the far half of the circle (phi = 180°), so no imaginary
 * part is ever needed here.
 */
function stateForTheta(thetaDeg: number): ComplexVectorSchema {
  const half = (thetaDeg * Math.PI) / 360;
  return { re: [Math.cos(half), Math.sin(half)] };
}

function measure(body: MeasurementRequest) {
  return discreteMeasurementQmDiscreteMeasurementPost(body).then(
    (res: discreteMeasurementQmDiscreteMeasurementPostResponse) => {
      if (res.status !== 200) {
        throw new Error(
          `API returned ${res.status}: ${JSON.stringify(res.data)}`,
        );
      }
      return res.data as MeasurementResponse;
    },
  );
}

/** Running totals over every pack drawn since the arrow last moved. */
export interface SpinTally {
  plus: number;
  minus: number;
}

const NO_SHOTS: SpinTally = { plus: 0, minus: 0 };

/** Born probability of reading +1, i.e. cos²(θ/2) — straight from the API. */
export interface SpinProbabilities {
  plus: number;
  minus: number;
}

/**
 * Measure sigma_z on a spin pointing at theta, through the API.
 *
 * Two different calls to the same endpoint. Moving the arrow asks for the
 * outcomes alone — exact Born probabilities, no sampling — and clears the
 * tally, since counts gathered at one angle say nothing about another. Drawing
 * a pack asks the same question with `n_draws` set and adds the counts it
 * returns to the running totals.
 *
 * The probability request is latest-wins, at most one in flight: dragging the
 * arrow fires a request per degree, and this keeps the readout tracking the
 * drag without a debounce delay.
 */
export function useSpinMeasurement(thetaDeg: number, shotsPerPack: number) {
  const [probabilities, setProbabilities] = useState<SpinProbabilities | null>(
    null,
  );
  const [tally, setTally] = useState<SpinTally>(NO_SHOTS);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Guards the tally as much as the readout: a pack in flight when the arrow
  // moves belongs to the old angle, and must not land in the new angle's
  // totals.
  const generation = useRef(0);

  useEffect(() => {
    const mine = ++generation.current;
    setTally(NO_SHOTS);
    setError(null);

    measure({ state: stateForTheta(thetaDeg), operator: SIGMA_Z })
      .then((data) => {
        if (!alive.current || generation.current !== mine) return;
        setProbabilities(splitOutcomes(data, (o) => o.probability));
      })
      .catch((e: unknown) => {
        if (!alive.current || generation.current !== mine) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      });
  }, [thetaDeg]);

  const draw = useCallback(() => {
    const mine = generation.current;
    setDrawing(true);
    setError(null);

    measure({
      state: stateForTheta(thetaDeg),
      operator: SIGMA_Z,
      n_draws: shotsPerPack,
    })
      .then((data) => {
        if (!alive.current || generation.current !== mine) return;
        const pack = splitOutcomes(data, (o) => o.count ?? 0);
        setTally((t) => ({
          plus: t.plus + pack.plus,
          minus: t.minus + pack.minus,
        }));
      })
      .catch((e: unknown) => {
        if (!alive.current || generation.current !== mine) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (alive.current) setDrawing(false);
      });
  }, [thetaDeg, shotsPerPack]);

  const reset = useCallback(() => setTally(NO_SHOTS), []);

  return { probabilities, tally, draw, drawing, reset, error };
}

/**
 * Pull the +1 and -1 entries out of a response by eigenvalue.
 *
 * Indexing the array positionally would be a bug waiting for a degenerate
 * spectrum: the API returns one entry per *distinct* eigenvalue, so the list
 * is only two long because sigma_z happens to be non-degenerate.
 */
function splitOutcomes(
  data: MeasurementResponse,
  pick: (outcome: MeasurementResponse["outcomes"][number]) => number,
): { plus: number; minus: number } {
  const find = (value: number) =>
    data.outcomes.find((o) => Math.abs(o.value - value) < 1e-9);
  const plus = find(1);
  const minus = find(-1);
  return { plus: plus ? pick(plus) : 0, minus: minus ? pick(minus) : 0 };
}
