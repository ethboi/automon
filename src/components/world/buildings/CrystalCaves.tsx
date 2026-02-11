'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Creates a rocky, irregular sphere by displacing vertices with noise-like variation.
 * This gives an organic, natural rock look instead of geometric primitives.
 */
function createRockGeometry(
  radius: number,
  detail: number,
  seed: number,
  roughness = 0.3
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Simple pseudo-noise displacement
    const noise =
      Math.sin(x * 3.7 + seed) * 0.5 +
      Math.sin(y * 4.2 + seed * 1.3) * 0.3 +
      Math.sin(z * 3.1 + seed * 0.7) * 0.4 +
      Math.sin((x + z) * 2.8 + seed * 2.1) * 0.3;
    const displacement = 1 + noise * roughness;
    pos.setXYZ(i, x * displacement, y * displacement, z * displacement);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Flatten the bottom of a geometry (push all vertices below cutY up to cutY).
 */
function flattenBottom(geo: THREE.BufferGeometry, cutY: number) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < cutY) {
      pos.setY(i, cutY);
    }
  }
  geo.computeVertexNormals();
}

export default function CrystalCaves() {
  const crystalRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Create rocky formations
  const mainRock = useMemo(() => {
    const g = createRockGeometry(4.5, 2, 42, 0.25);
    // Squash vertically and flatten bottom
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.7); // squash
    }
    flattenBottom(g, -0.5);
    return g;
  }, []);

  const sideRock1 = useMemo(() => {
    const g = createRockGeometry(3, 2, 17, 0.3);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.65);
    }
    flattenBottom(g, -0.5);
    return g;
  }, []);

  const sideRock2 = useMemo(() => {
    const g = createRockGeometry(2.5, 2, 93, 0.28);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.6);
    }
    flattenBottom(g, -0.5);
    return g;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    crystalRefs.current.forEach((cr, i) => {
      if (!cr) return;
      const mat = cr.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(t * 1.2 + i * 1.5) * 0.3;
    });
  });

  return (
    <group>
      {/* Main rocky formation — organic displaced icosahedron */}
      <mesh position={[0, -0.5, -0.5]} geometry={mainRock} castShadow receiveShadow>
        <meshStandardMaterial color="#3a3a42" roughness={0.95} flatShading />
      </mesh>

      {/* Side rock mass — left */}
      <mesh position={[-3, -0.5, 1]} geometry={sideRock1} castShadow>
        <meshStandardMaterial color="#33333b" roughness={0.95} flatShading />
      </mesh>

      {/* Side rock mass — right back */}
      <mesh position={[2.5, -0.5, -2]} geometry={sideRock2} castShadow>
        <meshStandardMaterial color="#2e2e36" roughness={0.95} flatShading />
      </mesh>

      {/* Cave entrance — dark opening */}
      <mesh position={[0, 0.5, 3]}>
        <sphereGeometry args={[1.5, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#050508" roughness={1} side={THREE.BackSide} />
      </mesh>
      {/* Entrance depth illusion */}
      <mesh position={[0, 0, 3.5]}>
        <boxGeometry args={[2.5, 1.5, 1]} />
        <meshStandardMaterial color="#050508" roughness={1} />
      </mesh>

      {/* 5 large crystals */}
      {[
        { pos: [-2.5, 1.5, -0.5], size: [0.45, 2.2, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [0.05, 0, 0.2] },
        { pos: [2.2, 1.8, -1.5], size: [0.4, 2.8, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0, 0.5, -0.15] },
        { pos: [0.3, 2.5, -1], size: [0.5, 2.5, 5] as [number, number, number], color: '#22d3ee', emissive: '#0e7490', rot: [0.1, 0.3, 0.08] },
        { pos: [-1, 1.5, -2.5], size: [0.35, 1.8, 5] as [number, number, number], color: '#c084fc', emissive: '#7c3aed', rot: [0, 0.8, -0.25] },
        { pos: [1.5, 0.8, 1.5], size: [0.3, 1.5, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.2, 0.12] },
      ].map((cr, i) => (
        <mesh
          key={`crystal-${i}`}
          ref={(el) => { crystalRefs.current[i] = el; }}
          position={cr.pos as [number, number, number]}
          rotation={cr.rot as [number, number, number]}
          castShadow
        >
          <coneGeometry args={cr.size} />
          <meshStandardMaterial
            color={cr.color}
            emissive={cr.emissive}
            emissiveIntensity={0.6}
            roughness={0.15}
            metalness={0.3}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* Glow from cave + crystals */}
      <pointLight position={[0, 1, 2.5]} color="#c084fc" intensity={2} distance={6} />
      <pointLight position={[0, 2, -1]} color="#22d3ee" intensity={2.5} distance={8} />
    </group>
  );
}
