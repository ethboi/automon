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

  const rockColor = hovered ? '#4a4a52' : '#3a3a42';

  return (
    <group>
      {/* Main rock mass — flat-bottomed cone sitting on ground */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[5, 3, 8]} />
        <meshStandardMaterial color={rockColor} roughness={0.95} flatShading />
      </mesh>

      {/* Rear rock mass */}
      <mesh position={[1, 1.2, -2]} castShadow>
        <coneGeometry args={[3.5, 2.4, 7]} />
        <meshStandardMaterial color="#2e2e36" roughness={0.95} flatShading />
      </mesh>

      {/* Side rock mass */}
      <mesh position={[-2, 1.0, 1]} castShadow>
        <coneGeometry args={[3, 2, 7]} />
        <meshStandardMaterial color="#33333b" roughness={0.95} flatShading />
      </mesh>

      {/* Flat base disc to hide any ground gaps */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6, 12]} />
        <meshStandardMaterial color="#2a2a32" roughness={1} />
      </mesh>

      {/* Cave mouth — dark opening in front */}
      <mesh position={[0, 1.2, 4.2]} rotation={[Math.PI / 8, 0, 0]}>
        <circleGeometry args={[1.6, 8]} />
        <meshStandardMaterial color="#0a0a0f" roughness={1} />
      </mesh>

      {/* Cave arch — rocky overhang */}
      <mesh position={[0, 2.2, 3.8]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[3.8, 0.8, 1.5]} />
        <meshStandardMaterial color="#3a3a42" roughness={0.92} flatShading />
      </mesh>
      {/* Arch sides */}
      <mesh position={[-1.6, 1.2, 4]} castShadow>
        <boxGeometry args={[0.8, 2, 1]} />
        <meshStandardMaterial color="#33333b" roughness={0.92} flatShading />
      </mesh>
      <mesh position={[1.6, 1.2, 4]} castShadow>
        <boxGeometry args={[0.8, 2, 1]} />
        <meshStandardMaterial color="#33333b" roughness={0.92} flatShading />
      </mesh>

      {/* Scattered boulders — sitting on ground */}
      {[
        [3.5, 0.3, 2.5, 0.55],
        [-3.8, 0.25, 1.0, 0.5],
        [2.8, 0.2, -3.5, 0.45],
        [-2.5, 0.3, -3, 0.5],
        [4.5, 0.2, -0.5, 0.35],
        [-4.2, 0.2, 2.8, 0.35],
      ].map((rock, i) => (
        <mesh key={`rock-${i}`} position={[rock[0], rock[1], rock[2]]} castShadow
          rotation={[0.2 * i, 0.7 * i, 0.1 * i]}>
          <dodecahedronGeometry args={[rock[3], 0]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#44444c' : '#3d3d45'} roughness={0.92} flatShading />
        </mesh>
      ))}

      {/* Large crystals emerging from rock */}
      {[
        { pos: [-1.8, 2.0, 0.5], size: [0.4, 1.8, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [0, 0, 0.15] },
        { pos: [2.0, 2.2, -0.5], size: [0.35, 2.2, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0, 0.5, -0.1] },
        { pos: [0.5, 2.8, -1.0], size: [0.45, 2.5, 5] as [number, number, number], color: '#22d3ee', emissive: '#0e7490', rot: [0.1, 0.3, 0.08] },
        { pos: [-0.5, 2.0, -2.0], size: [0.3, 1.6, 5] as [number, number, number], color: '#c084fc', emissive: '#7c3aed', rot: [0, 0.8, -0.2] },
        { pos: [1.2, 1.5, 2.0], size: [0.25, 1.3, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.2, 0.12] },
        { pos: [-2.5, 1.5, -0.8], size: [0.2, 1.0, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0.15, 0.2, 0.25] },
        { pos: [0, 1.8, 2.8], size: [0.3, 1.4, 5] as [number, number, number], color: '#22d3ee', emissive: '#0e7490', rot: [-0.08, 0, 0.05] },
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

      {/* Tiny crystal clusters on boulders */}
      {[
        [3.3, 0.7, 2.2], [-3.5, 0.6, 0.8], [2.5, 0.5, -3.2],
        [-2.2, 0.6, -2.7], [4.2, 0.4, -0.3],
      ].map((pos, i) => (
        <group key={`cluster-${i}`} position={pos as [number, number, number]}>
          {[0, 0.15, -0.12].map((off, j) => (
            <mesh key={j} position={[off, 0.15 + j * 0.1, off * 0.5]}
              rotation={[0, j * 1.2, 0.1 * (j - 1)]} castShadow>
              <coneGeometry args={[0.08, 0.35 + j * 0.1, 4]} />
              <meshStandardMaterial
                color={j === 1 ? '#a78bfa' : '#67e8f9'}
                emissive={j === 1 ? '#6d28d9' : '#0891b2'}
                emissiveIntensity={0.4}
                roughness={0.2}
                transparent
                opacity={0.8}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Glowing point lights */}
      <pointLight position={[0, 2, 1]} color="#67e8f9" intensity={3} distance={8} />
      <pointLight position={[-1.5, 1.5, -1]} color="#a78bfa" intensity={2} distance={6} />
      <pointLight position={[1.5, 2, -0.5]} color="#22d3ee" intensity={2.5} distance={7} />
      <pointLight position={[0, 1.5, 3.5]} color="#c084fc" intensity={1.5} distance={5} />
    </group>
  );
}
