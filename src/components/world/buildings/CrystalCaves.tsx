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

  return (
    <group>
      {/* Rocky hillside base — large mound grounded at y=0 */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <sphereGeometry args={[4.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hovered ? '#4a4a52' : '#3a3a42'} roughness={0.95} flatShading />
      </mesh>

      {/* Secondary rocky bump */}
      <mesh position={[-1.5, 1.0, 1.5]} castShadow>
        <sphereGeometry args={[3, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#33333b" roughness={0.95} flatShading />
      </mesh>

      {/* Rear rock mass */}
      <mesh position={[1.5, 0.8, -1.5]} castShadow>
        <sphereGeometry args={[3.2, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2e2e36" roughness={0.95} flatShading />
      </mesh>

      {/* Cave mouth — dark opening */}
      <mesh position={[0, 1.5, 3.8]} rotation={[Math.PI / 6, 0, 0]}>
        <circleGeometry args={[1.8, 8]} />
        <meshStandardMaterial color="#0a0a0f" roughness={1} />
      </mesh>

      {/* Cave arch — rocky frame */}
      <mesh position={[0, 2.5, 3.5]} castShadow>
        <torusGeometry args={[1.8, 0.5, 6, 8, Math.PI]} />
        <meshStandardMaterial color="#3a3a42" roughness={0.92} flatShading />
      </mesh>

      {/* Scattered boulders */}
      {[
        [3.2, 0.3, 2.5, 0.6],
        [-3.5, 0.25, 1.0, 0.5],
        [2.5, 0.2, -3.0, 0.45],
        [-2.0, 0.35, -3.5, 0.55],
        [4.0, 0.2, -1.0, 0.4],
        [-4.0, 0.2, 3.0, 0.35],
      ].map((rock, i) => (
        <mesh key={`rock-${i}`} position={[rock[0], rock[1], rock[2]]} castShadow
          rotation={[0.2 * i, 0.7 * i, 0.1 * i]}>
          <dodecahedronGeometry args={[rock[3], 0]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#44444c' : '#3d3d45'} roughness={0.92} flatShading />
        </mesh>
      ))}

      {/* Main crystals emerging from rock — grounded */}
      {[
        { pos: [-1.8, 1.8, 0.5], size: [0.4, 1.8, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [0, 0, 0.15] },
        { pos: [2.0, 2.0, -0.5], size: [0.35, 2.2, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0, 0.5, -0.1] },
        { pos: [0.5, 2.5, -1.0], size: [0.45, 2.5, 5] as [number, number, number], color: '#22d3ee', emissive: '#0e7490', rot: [0.1, 0.3, 0.08] },
        { pos: [-0.5, 2.2, -2.0], size: [0.3, 1.6, 5] as [number, number, number], color: '#c084fc', emissive: '#7c3aed', rot: [0, 0.8, -0.2] },
        { pos: [1.2, 1.5, 1.8], size: [0.25, 1.3, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.2, 0.12] },
        { pos: [-2.5, 1.2, -1.0], size: [0.2, 1.0, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0.15, 0.2, 0.25] },
        { pos: [0, 1.8, 2.5], size: [0.3, 1.4, 5] as [number, number, number], color: '#22d3ee', emissive: '#0e7490', rot: [-0.08, 0, 0.05] },
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

      {/* Tiny crystal clusters on rocks */}
      {[
        [3.0, 0.7, 2.2], [-3.2, 0.6, 0.8], [2.2, 0.5, -2.7],
        [-1.8, 0.6, -3.2], [3.8, 0.4, -0.8],
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

      {/* Glowing point lights inside */}
      <pointLight position={[0, 2, 1]} color="#67e8f9" intensity={3} distance={8} />
      <pointLight position={[-1.5, 1.5, -1]} color="#a78bfa" intensity={2} distance={6} />
      <pointLight position={[1.5, 2, -0.5]} color="#22d3ee" intensity={2.5} distance={7} />

      {/* Faint glow from cave mouth */}
      <pointLight position={[0, 1.5, 3.5]} color="#c084fc" intensity={1.5} distance={5} />
    </group>
  );
}
