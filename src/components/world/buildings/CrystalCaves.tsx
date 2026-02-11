'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function CrystalCaves() {
  const crystalRefs = useRef<(THREE.Mesh | null)[]>([]);

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
      {/* Single wide dome — the cave hill */}
      <mesh position={[0, 0, 0]} castShadow scale={[1.4, 0.6, 1]}>
        <sphereGeometry args={[4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3a3a42" roughness={0.95} flatShading />
      </mesh>

      {/* Cave entrance — dark arch */}
      <mesh position={[0, 0.6, 4.5]} rotation={[-0.2, 0, 0]}>
        <circleGeometry args={[1.4, 8]} />
        <meshStandardMaterial color="#050508" side={THREE.DoubleSide} />
      </mesh>

      {/* 5 crystals scattered on top */}
      {[
        { pos: [-1.5, 2, -0.5] as [number,number,number], h: 2, color: '#67e8f9', emissive: '#0891b2', rot: [0.1, 0, 0.2] },
        { pos: [1.5, 1.8, -1] as [number,number,number], h: 2.5, color: '#a78bfa', emissive: '#6d28d9', rot: [0, 0.5, -0.15] },
        { pos: [0, 2.2, -0.5] as [number,number,number], h: 2, color: '#22d3ee', emissive: '#0e7490', rot: [0.05, 0.3, 0.08] },
        { pos: [-2.5, 1, 1] as [number,number,number], h: 1.5, color: '#c084fc', emissive: '#7c3aed', rot: [0, 0.8, -0.2] },
        { pos: [2.5, 1, 0] as [number,number,number], h: 1.5, color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.2, 0.1] },
      ].map((cr, i) => (
        <mesh
          key={`crystal-${i}`}
          ref={(el) => { crystalRefs.current[i] = el; }}
          position={cr.pos}
          rotation={cr.rot as [number, number, number]}
          castShadow
        >
          <coneGeometry args={[0.35, cr.h, 5]} />
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

      {/* Glow lights */}
      <pointLight position={[0, 1.5, 2]} color="#c084fc" intensity={2} distance={6} />
      <pointLight position={[0, 2, -1]} color="#22d3ee" intensity={2} distance={7} />
    </group>
  );
}
