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
  const rc2 = '#33333b';
  const rc3 = '#2e2e36';

  return (
    <group>
      {/* ═══ ROCK CLIFF WALL — stacked boxes forming a cliff face ═══ */}
      
      {/* Ground-level wide base */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[8, 0.8, 7]} />
        <meshStandardMaterial color={rc3} roughness={0.95} flatShading />
      </mesh>
      
      {/* Second tier */}
      <mesh position={[0, 1.2, -0.5]} castShadow>
        <boxGeometry args={[7, 0.8, 6]} />
        <meshStandardMaterial color={rc} roughness={0.95} flatShading />
      </mesh>
      
      {/* Third tier */}
      <mesh position={[0, 2.0, -1.0]} castShadow>
        <boxGeometry args={[6, 0.8, 5]} />
        <meshStandardMaterial color={rc2} roughness={0.95} flatShading />
      </mesh>
      
      {/* Top tier — peak */}
      <mesh position={[0, 2.7, -1.3]} castShadow>
        <boxGeometry args={[4.5, 0.6, 3.5]} />
        <meshStandardMaterial color={rc} roughness={0.95} flatShading />
      </mesh>

      {/* Extra rock chunks for irregular shape */}
      <mesh position={[-3, 0.8, 1]} castShadow rotation={[0, 0.3, 0]}>
        <boxGeometry args={[2.5, 1.6, 2.5]} />
        <meshStandardMaterial color={rc2} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[3.2, 0.7, 0.5]} castShadow rotation={[0, -0.2, 0]}>
        <boxGeometry args={[2, 1.4, 2.5]} />
        <meshStandardMaterial color={rc3} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[1.5, 1.5, -2]} castShadow rotation={[0, 0.15, 0]}>
        <boxGeometry args={[2, 1.5, 2]} />
        <meshStandardMaterial color={rc2} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[-1.8, 1.6, -1.8]} castShadow rotation={[0, -0.1, 0]}>
        <boxGeometry args={[2.2, 1.5, 2]} />
        <meshStandardMaterial color={rc} roughness={0.95} flatShading />
      </mesh>

      {/* ═══ CAVE ENTRANCE — hole in the front face ═══ */}
      
      {/* Dark cave interior */}
      <mesh position={[0, 1.0, 3.1]}>
        <boxGeometry args={[2.8, 2, 1]} />
        <meshStandardMaterial color="#050508" roughness={1} />
      </mesh>
      
      {/* Overhang above cave */}
      <mesh position={[0, 2.2, 3.0]} castShadow>
        <boxGeometry args={[4, 0.6, 1.5]} />
        <meshStandardMaterial color={rc} roughness={0.92} flatShading />
      </mesh>
      
      {/* Left pillar */}
      <mesh position={[-1.7, 1.0, 3.2]} castShadow>
        <boxGeometry args={[0.8, 2, 1]} />
        <meshStandardMaterial color={rc2} roughness={0.92} flatShading />
      </mesh>
      
      {/* Right pillar */}
      <mesh position={[1.7, 1.0, 3.2]} castShadow>
        <boxGeometry args={[0.8, 2, 1]} />
        <meshStandardMaterial color={rc2} roughness={0.92} flatShading />
      </mesh>

      {/* ═══ SCATTERED ROCKS on ground ═══ */}
      {[
        [4.5, 0.25, 2.5, 0.5],
        [-4.5, 0.2, 1.5, 0.45],
        [3.5, 0.2, -3, 0.4],
        [-3.5, 0.25, -2.5, 0.45],
        [5, 0.15, -0.5, 0.3],
        [-5, 0.15, 3, 0.3],
        [1.5, 0.15, 4.5, 0.3],
        [-1, 0.15, 4.8, 0.25],
      ].map((r, i) => (
        <mesh key={`rock-${i}`} position={[r[0], r[1], r[2]]} castShadow
          rotation={[0.2 * i, 0.7 * i, 0.1 * i]}>
          <dodecahedronGeometry args={[r[3], 0]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#44444c' : '#3d3d45'} roughness={0.92} flatShading />
        </mesh>
      ))}

      {/* Gravel/rubble near cave mouth */}
      {[
        [-0.8, 0.1, 3.8, 0.15], [0.5, 0.1, 4.0, 0.12], [1.0, 0.08, 3.6, 0.1],
        [-0.3, 0.08, 4.2, 0.1], [0.8, 0.06, 4.3, 0.08],
      ].map((r, i) => (
        <mesh key={`gravel-${i}`} position={[r[0], r[1], r[2]]}>
          <dodecahedronGeometry args={[r[3], 0]} />
          <meshStandardMaterial color="#44444c" roughness={0.95} flatShading />
        </mesh>
      ))}

      {/* ═══ CRYSTALS emerging from rock ═══ */}
      {[
        { pos: [-2.2, 2.3, -0.5], size: [0.35, 1.6, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [0, 0, 0.2] },
        { pos: [2.3, 2.5, -1], size: [0.3, 2.0, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0, 0.5, -0.15] },
        { pos: [0.3, 3.2, -1.5], size: [0.4, 2.2, 5] as [number, number, number], color: '#22d3ee', emissive: '#0e7490', rot: [0.1, 0.3, 0.08] },
        { pos: [-1, 2.5, -2], size: [0.25, 1.4, 5] as [number, number, number], color: '#c084fc', emissive: '#7c3aed', rot: [0, 0.8, -0.2] },
        { pos: [1.5, 1.8, 1.5], size: [0.2, 1.1, 5] as [number, number, number], color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.2, 0.12] },
        { pos: [-3, 1.2, 0.5], size: [0.2, 0.9, 5] as [number, number, number], color: '#a78bfa', emissive: '#6d28d9', rot: [0.15, 0.2, 0.3] },
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

      {/* Small crystal clusters on ground rocks */}
      {[
        [4.2, 0.6, 2.2], [-4.2, 0.5, 1.2], [3.2, 0.45, -2.7],
      ].map((pos, i) => (
        <group key={`cluster-${i}`} position={pos as [number, number, number]}>
          {[0, 0.12, -0.1].map((off, j) => (
            <mesh key={j} position={[off, 0.12 + j * 0.08, off * 0.5]}
              rotation={[0, j * 1.2, 0.1 * (j - 1)]} castShadow>
              <coneGeometry args={[0.06, 0.3 + j * 0.08, 4]} />
              <meshStandardMaterial
                color={j === 1 ? '#a78bfa' : '#67e8f9'}
                emissive={j === 1 ? '#6d28d9' : '#0891b2'}
                emissiveIntensity={0.4}
                roughness={0.2}
                transparent opacity={0.8}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* ═══ LIGHTS ═══ */}
      <pointLight position={[0, 1.5, 2.5]} color="#c084fc" intensity={2} distance={5} />
      <pointLight position={[-1.5, 2.5, -0.5]} color="#67e8f9" intensity={2.5} distance={7} />
      <pointLight position={[1.5, 2.5, -1]} color="#a78bfa" intensity={2} distance={6} />
      <pointLight position={[0, 3, -1.5]} color="#22d3ee" intensity={2} distance={6} />
    </group>
  );
}
