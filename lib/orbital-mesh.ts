// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  LobeMeshSchema,
  SingleAtomStateResponse,
} from "@/lib/api/schemas";

// A single lobe of the orbital, as flat buffers ready to hand straight to a
// THREE.BufferGeometry. The isosurface is now extracted server-side (marching
// cubes) and shipped as base64-packed typed arrays, so all the client does is
// decode — no field grid, no CPU meshing, no per-change freeze.
export interface LobeMesh {
  positions: Float32Array;
  normals: Float32Array;
  index: Uint32Array;
}

export interface OrbitalMesh {
  positive: LobeMesh | null;
  negative: LobeMesh | null;
  // Half-size of the shape's bounding cube, in world (Bohr-radius) units — the
  // scene frames on this so every orbital fills the view identically.
  boundRadius: number;
}

// Browsers are little-endian, and the server packs little-endian bytes, so a
// typed-array view over the decoded buffer needs no byte-swapping.
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeLobe(lobe: LobeMeshSchema | null): LobeMesh | null {
  if (!lobe) return null;
  // .slice() copies out of the (possibly offset) decode buffer so each typed
  // array owns a tight, aligned ArrayBuffer.
  const positions = new Float32Array(
    base64ToBytes(lobe.positions).buffer,
  ).slice();
  const normals = new Float32Array(base64ToBytes(lobe.normals).buffer).slice();
  const index = new Uint32Array(base64ToBytes(lobe.indices).buffer).slice();
  return { positions, normals, index };
}

export function decodeOrbitalMesh(data: SingleAtomStateResponse): OrbitalMesh {
  return {
    positive: decodeLobe(data.positive),
    negative: decodeLobe(data.negative),
    boundRadius: data.bound_radius || 8,
  };
}
