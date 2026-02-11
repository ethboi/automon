'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function CrystalCaves({ hovered }: { hovered: boolean }) {
  const crystalRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    crystalRefs.current.forEach((cr, i) => {
      if (!cr) return;
      const mat = cr.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(t * 1.2 + i * 1.5) * 0.3;
    });
  });

  const rc = hovered ? '#4a4a52' : '#3a3a42';

  return (
    <group>
      {/* Rock cliff — tapered cylinders for natural rocky shape */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[4, 5, 2, 8]} />
        <meshStandardMaterial color={rc} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 2.2, -0.5]} castShadow>
        <cylinderGeometry args={[3, 4, 1, 7]} />
        <meshStandardMaterial color="#33333b" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 3, -1]} castShadow>
        <cylinderGeometry args={[2, 3, 0.8, 6]} />
        <meshStandardMaterial color="#2e2e36" roughness={0.95} flatShading />
      </mesh>

      {/* Cave mouth — dark recessed box */}
      <mesh position={[0, 1.5, 3.5]}>
        <boxGeometry args={[3.5, 2.5, 1.5]} />
        <meshStandardMaterial color="#050508" roughness={1} />
      </mesh>

      {/* Cave arch overhang */}
      <mesh position={[0, 3, 3.5]} castShadow>
        <boxGeometry args={[4.5, 0.8, 2]} />
        <meshStandardMaterial color={rc} roughness={0.92} flatShading />
      </mesh>

      {/* 5 large crystals */}
      {[
        { pos: [-3, 2.5, 0], size: [0.5, 2.5, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [0, 0, 0.2] },
        { pos: [3, 2.8, -1], size: [0.45, 3, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0, 0.5, -0.15] },
        { pos: [0, 4, -1.5], size: [0.55, 3, 5] as [number, number, number], color: '#22d3ee', emissive: '#0e7490', rot: [0.1, 0.3, 0.08] },
        { pos: [-1.5, 3, -2], size: [0.4, 2, 5] as [number, number, number], color: '#c084fc', emissive: '#7c3aed', rot: [0, 0.8, -0.2] },
        { pos: [1.5, 2.2, 1.5], size: [0.35, 1.8, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.2, 0.12] },
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

      {/* Lights */}
      <pointLight position={[0, 2, 3]} color="#c084fc" intensity={2} distance={6} />
      <pointLight position={[0, 3, -1]} color="#22d3ee" intensity={2.5} distance={8} />
    </group>
  );
}
