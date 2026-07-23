"use client";

// Copyright (C) 2026 Tanguy Marsault - PhySense
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Canvas } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import type { LobeMesh, OrbitalMesh } from "@/lib/orbital-mesh";

// World half-size the shape is scaled to fill, regardless of n. The group is
// scaled by FRAME/boundRadius so a compact 1s orbital and a sprawling 5f one
// both frame identically and the camera never has to move — the same job
// Plotly did by pinning the scene axis ranges to the bounding box.
const FRAME = 1;

// Fixed camera, matching the old Plotly eye direction (1.35, 1.35, 1.05),
// pushed out to a distance that frames a radius-FRAME shape at fov 35°.
const CAMERA_POSITION: [number, number, number] = [2.0, 2.0, 1.55];

interface OrbitalSceneProps {
  mesh: OrbitalMesh;
  positiveColor: string;
  negativeColor: string;
  // Scroll-to-zoom / drag-to-rotate is gated behind a deliberate click so the
  // scene doesn't hijack page scrolling as the cursor passes over it.
  armed: boolean;
}

// Builds a BufferGeometry from a lobe's buffers and disposes it when the lobe
// changes or unmounts — attached geometries aren't auto-disposed by r3f, so a
// dragged slider would otherwise leak a mesh per tick.
function Lobe({ lobe, color }: { lobe: LobeMesh | null; color: string }) {
  const geometry = useMemo(() => {
    if (!lobe) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(lobe.positions, 3),
    );
    // Smooth normals from the field gradient (computed in the mesher), not
    // from face averaging — keeps a coarse grid looking smooth.
    geo.setAttribute("normal", new THREE.BufferAttribute(lobe.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(lobe.index, 1));
    return geo;
  }, [lobe]);

  useEffect(() => {
    return () => geometry?.dispose();
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      {/* DoubleSide: surfaceNets winding isn't guaranteed outward-consistent,
          so single-sided rendering would punch holes in the shell. */}
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function OrbitalScene({
  mesh,
  positiveColor,
  negativeColor,
  armed,
}: OrbitalSceneProps) {
  const scale = FRAME / (mesh.boundRadius || FRAME);

  return (
    <Canvas
      camera={{ position: CAMERA_POSITION, fov: 35, near: 0.01, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 1.5, 3]} intensity={1.15} />
      <directionalLight position={[-2, -1, -1.5]} intensity={0.35} />
      <group scale={scale}>
        <Lobe lobe={mesh.positive} color={positiveColor} />
        <Lobe lobe={mesh.negative} color={negativeColor} />
        <Axes radius={mesh.boundRadius} />
      </group>
      {/* Corner triad, labelled X/Y/Z, that turns with the camera — the
          orientation reference for reading θ (from +z) and φ (in the xy-plane). */}
      <GizmoHelper alignment="bottom-right" margin={[56, 56]}>
        <GizmoViewport
          axisColors={["#e26d6d", "#7ac77a", "#6b9fe2"]}
          labelColor="#0b0e14"
        />
      </GizmoHelper>
      <OrbitControls
        enabled={armed}
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.9}
        minDistance={1.2}
        maxDistance={8}
        makeDefault
      />
    </Canvas>
  );
}

// Faint x/y/z axes through the orbital's centre so the shape's orientation is
// legible on the object itself, not just in the corner gizmo. z (the
// quantization / polar axis that m is defined about) is drawn brighter and
// thicker since θ and φ are measured relative to it.
function Axes({ radius }: { radius: number }) {
  const L = radius * 1.3;
  return (
    <>
      <Line
        points={[
          [-L, 0, 0],
          [L, 0, 0],
        ]}
        color="#6b7280"
        lineWidth={1}
        transparent
        opacity={0.35}
      />
      <Line
        points={[
          [0, -L, 0],
          [0, L, 0],
        ]}
        color="#6b7280"
        lineWidth={1}
        transparent
        opacity={0.35}
      />
      <Line
        points={[
          [0, 0, -L],
          [0, 0, L],
        ]}
        color="#cbd5e1"
        lineWidth={1.6}
        transparent
        opacity={0.7}
      />
    </>
  );
}
