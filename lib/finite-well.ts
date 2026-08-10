// Copyright (C) 2026 Tanguy Marsault - Eigora
// SPDX-License-Identifier: AGPL-3.0-or-later

// The graphical construction for the 1D finite square well, and the mapping
// between it and the API's numerical eigenstates.
//
// With V = -V0 on |x| < a and 0 outside, a bound state (-V0 < E < 0) oscillates
// inside with wavenumber k and decays outside with rate B:
//
//     k = sqrt(2m(E + V0))/hbar,    B = sqrt(-2mE)/hbar
//
// Writing X = ka and Y = Ba, those two definitions alone give
//
//     X^2 + Y^2 = R^2,    R^2 = 2 m V0 a^2 / hbar^2
//
// so every state of a given well sits on one circle whose radius encodes the
// whole well. Matching psi'/psi across x = a then splits by parity:
//
//     even (cos inside):  Y =  X tan X
//     odd  (sin inside):  Y = -X cot X
//
// Each branch of those curves leaves the X axis at X = n*pi/2 and climbs to
// infinity, so branch n should meet the circle once iff R > n*pi/2.
//
// Only the curves and the circle are computed here — they are the prediction.
// The states plotted against them come from the API's eigensolver, so the
// figure is a comparison rather than a restatement.

/** The site solves in units where hbar = m = 1. */
const HBAR = 1;
const MASS = 1;

export type Parity = "even" | "odd";

export interface WellState {
  /** 0-indexed, so n = 0 is the ground state. */
  n: number;
  parity: Parity;
  /** X = ka, the interior wavenumber in units of 1/a. */
  X: number;
  /** Y = Ba, the exterior decay rate in units of 1/a. */
  Y: number;
  /** Energy in units of V0, measured from the top of the well (so negative). */
  energy: number;
  /** Probability of finding the particle outside |x| < a. */
  outsideFraction: number;
  /** The state's wavefunction on the solver grid, scaled to unit peak. */
  psi: number[];
}

/** Branches alternate, starting from the even ground state. */
export function branchParity(n: number): Parity {
  return n % 2 === 0 ? "even" : "odd";
}

/** The matching curve Y(X) of branch n, valid on (n*pi/2, (n+1)*pi/2). */
export function branchY(n: number, X: number): number {
  return branchParity(n) === "even" ? X * Math.tan(X) : -X / Math.tan(X);
}

/** The R at which branch n first appears. */
export function threshold(n: number): number {
  return (n * Math.PI) / 2;
}

/** How many states the construction predicts for radius R — never zero. */
export function predictedCount(R: number): number {
  return Math.floor((2 * R) / Math.PI) + 1;
}

export const HALF_WIDTH = 1;

/**
 * The well a given R corresponds to, with the half-width pinned to a = 1 so
 * that R is the only control: R^2 = 2 m V0 a^2 / hbar^2 gives V0 = R^2/2.
 */
export function wellForRadius(R: number): { depth: number; width: number } {
  return {
    depth: (R * R * HBAR * HBAR) / (2 * MASS * HALF_WIDTH ** 2),
    width: 2 * HALF_WIDTH,
  };
}

/**
 * Turn an eigensolver response into bound states expressed in the variables of
 * the graphical construction. Positive-energy solutions are the finite solver
 * box's own modes, not states of the well, and are dropped.
 */
export function statesFromEigenstates(
  x: number[],
  energies: number[],
  wavefunctions: number[][],
  depth: number,
  a: number = HALF_WIDTH,
): WellState[] {
  const states: WellState[] = [];

  energies.forEach((E, i) => {
    if (E >= 0) return;
    const psi = wavefunctions[i];
    if (!psi) return;

    // Straight from the definitions of k and B, using the solved energy.
    const X = (Math.sqrt(2 * MASS * (E + depth)) / HBAR) * a;
    const Y = (Math.sqrt(-2 * MASS * E) / HBAR) * a;

    states.push({
      n: states.length,
      parity: parityOf(x, psi),
      X,
      Y,
      energy: E / depth,
      outsideFraction: fractionOutside(x, psi, -a, a),
      psi: toUnitPeak(x, psi),
    });
  });

  return states;
}

// The solver returns whichever sign convention the diagonalisation produced, so
// parity is read off the shape: an even state matches its own mirror image, an
// odd one matches minus it. Sampling by nearest mirrored grid point keeps this
// independent of how the grid is laid out.
function parityOf(x: number[], psi: number[]): Parity {
  let overlap = 0;
  for (let i = 0; i < x.length; i++) {
    const mirrored = nearestIndex(x, -x[i]);
    overlap += psi[i] * psi[mirrored];
  }
  return overlap >= 0 ? "even" : "odd";
}

function nearestIndex(x: number[], target: number): number {
  const lo = x[0];
  const hi = x[x.length - 1];
  const frac = (target - lo) / (hi - lo);
  const idx = Math.round(frac * (x.length - 1));
  return Math.min(x.length - 1, Math.max(0, idx));
}

// Trapezoidal |psi|^2 outside [left, right], over the returned grid. The solver
// normalises psi, but renormalising here makes the ratio independent of that.
function fractionOutside(
  x: number[],
  psi: number[],
  left: number,
  right: number,
): number {
  let total = 0;
  let outside = 0;
  for (let i = 0; i < x.length - 1; i++) {
    const dx = x[i + 1] - x[i];
    const density = (psi[i] ** 2 + psi[i + 1] ** 2) / 2;
    const midpoint = (x[i] + x[i + 1]) / 2;
    total += density * dx;
    if (midpoint < left || midpoint > right) outside += density * dx;
  }
  return total > 0 ? outside / total : 0;
}

// Scale to unit peak, and fix the arbitrary sign the diagonalisation returned
// by requiring the largest lobe on the x > 0 side to point up. Anchoring on one
// side rather than on the global peak keeps odd states from flipping over as R
// moves and their two equal lobes trade places.
function toUnitPeak(x: number[], psi: number[]): number[] {
  let peak = 0;
  let rightPeak = 0;
  let rightSign = 1;
  for (let i = 0; i < psi.length; i++) {
    const mag = Math.abs(psi[i]);
    if (mag > peak) peak = mag;
    if (x[i] > 0 && mag > rightPeak) {
      rightPeak = mag;
      rightSign = psi[i] >= 0 ? 1 : -1;
    }
  }
  if (peak === 0) return psi;
  return psi.map((v) => (v * rightSign) / peak);
}

// ── The same well against an infinite wall ───────────────────────────────────
//
// Stand an infinite wall at x = 0 in the well above and keep only x > 0. The
// wall demands psi(0) = 0, which is what the odd states already do — they pass
// through the origin — while every even state is nonzero there and cannot
// survive. So the well 0 < x < a against a wall has exactly the odd states of
// the symmetric well of half-width a, at the same energies, and the one R
// describes both.
//
// The visible consequence is that the ground state stops being free. The odd
// branches start at R = pi/2, so a well shallower than that binds nothing at
// all, where the symmetric well always holds at least one state.

export interface HalfWellState {
  /** 0-indexed, so n = 0 is the ground state of the walled well. */
  n: number;
  /** Which branch of the symmetric well this state is: 1, 3, 5, ... */
  branch: number;
  /** X = ka, the interior wavenumber in units of 1/a. */
  X: number;
  /** Y = Ba, the exterior decay rate in units of 1/a. */
  Y: number;
  /** Energy in units of V0, measured from the top of the well (so negative). */
  energy: number;
  /** Probability of finding the particle beyond the well, at x > a. */
  outsideFraction: number;
  /** The state's wavefunction on the solver grid, scaled to unit peak. */
  psi: number[];
}

/** How many states the construction predicts against a wall — zero below pi/2. */
export function halfPredictedCount(R: number): number {
  return Math.floor(R / Math.PI + 0.5);
}

/**
 * The walled well a given R corresponds to: the depth of the symmetric well of
 * the same R, occupying 0 < x < a instead of |x| < a. The solver takes a centre
 * and a width, so the segment is given that way.
 */
export function halfWellForRadius(R: number): {
  depth: number;
  width: number;
  x0: number;
} {
  return {
    depth: wellForRadius(R).depth,
    width: HALF_WIDTH,
    x0: HALF_WIDTH / 2,
  };
}

/**
 * Turn an eigensolver response into the bound states of the walled well. The
 * grid must start at the wall, so parity is meaningless here — every state is
 * an odd state of the symmetric well, and `branch` says which.
 */
export function halfWellStatesFromEigenstates(
  x: number[],
  energies: number[],
  wavefunctions: number[][],
  depth: number,
  a: number = HALF_WIDTH,
): HalfWellState[] {
  const states: HalfWellState[] = [];

  energies.forEach((E, i) => {
    if (E >= 0) return;
    const psi = wavefunctions[i];
    if (!psi) return;

    const n = states.length;
    states.push({
      n,
      branch: 2 * n + 1,
      X: (Math.sqrt(2 * MASS * (E + depth)) / HBAR) * a,
      Y: (Math.sqrt(-2 * MASS * E) / HBAR) * a,
      energy: E / depth,
      outsideFraction: fractionOutside(x, psi, 0, a),
      psi: toUnitPeakFromWall(psi),
    });
  });

  return states;
}

// Scale to unit peak, with the sign taken from the lobe against the wall rather
// than from the tallest one. psi climbs from zero at the origin, so that first
// lobe is always the same lobe; which one is tallest changes with R, and keying
// off it flips excited states over mid-drag.
function toUnitPeakFromWall(psi: number[]): number[] {
  let peak = 0;
  for (const v of psi) peak = Math.max(peak, Math.abs(v));
  if (peak === 0) return psi;
  const firstLobe = psi.find((v) => Math.abs(v) >= 0.05 * peak) ?? 1;
  const sign = firstLobe >= 0 ? 1 : -1;
  return psi.map((v) => (v * sign) / peak);
}
