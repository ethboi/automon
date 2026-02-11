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
      {/* Big dome — main rock */}
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3a3a42" roughness={0.95} flatShading />
      </mesh>

      {/* Medium dome — left */}
      <mesh position={[-3.5, 0, 2]} castShadow>
        <sphereGeometry args={[2.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#33333b" roughness={0.95} flatShading />
      </mesh>

      {/* Small dome — right back */}
      <mesh position={[3, 0, -1.5]} castShadow>
        <sphereGeometry args={[2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2e2e36" roughness={0.95} flatShading />
      </mesh>

      {/* Tiny dome — front right */}
      <mesh position={[2, 0, 3]} castShadow>
        <sphereGeometry args={[1.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#35353d" roughness={0.95} flatShading />
      </mesh>

      {/* Cave entrance — dark hole in the big dome */}
      <mesh position={[0, 0.8, 3.2]} rotation={[-0.3, 0, 0]}>
        <circleGeometry args={[1.2, 8]} />
        <meshStandardMaterial color="#050508" side={THREE.DoubleSide} />
      </mesh>

      {/* 5 crystals poking out of the domes */}
      {[
        { pos: [-1.5, 3, -0.5] as [number,number,number], h: 2, color: '#67e8f9', emissive: '#0891b2', rot: [0.1, 0, 0.2] },
        { pos: [1.5, 2.5, -1] as [number,number,number], h: 2.5, color: '#a78bfa', emissive: '#6d28d9', rot: [0, 0.5, -0.15] },
        { pos: [0, 3.5, -0.5] as [number,number,number], h: 2, color: '#22d3ee', emissive: '#0e7490', rot: [0.05, 0.3, 0.08] },
        { pos: [-3, 1.5, 1.5] as [number,number,number], h: 1.5, color: '#c084fc', emissive: '#7c3aed', rot: [0, 0.8, -0.2] },
        { pos: [3, 1.2, -0.5] as [number,number,number], h: 1.5, color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.2, 0.1] },
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
      <pointLight position={[0, 2, 2]} color="#c084fc" intensity={2} distance={6} />
      <pointLight position={[0, 3, -1]} color="#22d3ee" intensity={2} distance={7} />
    </group>
  );
}
