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
      {/* Main cliff base */}
      <mesh position={[0, 0.15, -0.9]} castShadow scale={[1.45, 0.68, 1.06]}>
        <sphereGeometry args={[4.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3f3f48" roughness={0.96} flatShading />
      </mesh>

      {/* Secondary rocky shelves (kept attached to cave silhouette) */}
      <mesh position={[2.1, 1.15, -0.8]} castShadow rotation={[0.08, 0.3, -0.1]}>
        <dodecahedronGeometry args={[1.65, 0]} />
        <meshStandardMaterial color="#4b4b54" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[-2.2, 1.2, -0.85]} castShadow rotation={[-0.1, -0.35, 0.06]}>
        <dodecahedronGeometry args={[1.7, 0]} />
        <meshStandardMaterial color="#45454d" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.2, 2.0, -1.25]} castShadow rotation={[0.2, -0.15, 0.12]}>
        <dodecahedronGeometry args={[1.55, 0]} />
        <meshStandardMaterial color="#55555f" roughness={0.92} flatShading />
      </mesh>
      <mesh position={[1.3, 2.45, -1.55]} castShadow rotation={[0.05, 0.5, -0.08]}>
        <dodecahedronGeometry args={[1.05, 0]} />
        <meshStandardMaterial color="#5a5a63" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-1.45, 2.35, -1.55]} castShadow rotation={[-0.03, -0.4, 0.12]}>
        <dodecahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial color="#4f4f59" roughness={0.9} flatShading />
      </mesh>

      {/* Cave entrance frame */}
      <mesh position={[0, 1.05, 3.35]} castShadow>
        <boxGeometry args={[3.6, 2.8, 1.65]} />
        <meshStandardMaterial color="#34343c" roughness={0.98} flatShading />
      </mesh>
      <mesh position={[0, 1.05, 3.95]}>
        <boxGeometry args={[2.45, 2.05, 1.95]} />
        <meshStandardMaterial color="#06070a" roughness={1} />
      </mesh>
      {/* Inner tunnel depth */}
      <mesh position={[0, 0.95, 2.9]}>
        <boxGeometry args={[1.95, 1.65, 2.2]} />
        <meshStandardMaterial color="#020205" roughness={1} />
      </mesh>
      {/* Entrance lip */}
      <mesh position={[0, 2.25, 4.05]} castShadow>
        <boxGeometry args={[3.2, 0.42, 0.8]} />
        <meshStandardMaterial color="#50505a" roughness={0.94} flatShading />
      </mesh>
      <mesh position={[-1.6, 1.05, 4.0]} castShadow rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.52, 2.3, 0.82]} />
        <meshStandardMaterial color="#4a4a53" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[1.6, 1.05, 4.0]} castShadow rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.52, 2.3, 0.82]} />
        <meshStandardMaterial color="#4a4a53" roughness={0.95} flatShading />
      </mesh>

      {/* Cave entrance darkness disk for silhouette definition */}
      <mesh position={[0, 1.0, 4.85]} rotation={[-0.08, 0, 0]}>
        <circleGeometry args={[1.08, 12]} />
        <meshStandardMaterial color="#040406" side={THREE.DoubleSide} />
      </mesh>

      {/* Crystal clusters integrated into cave body */}
      {[
        { pos: [-2.45, 1.65, 1.15] as [number,number,number], h: 2.25, color: '#67e8f9', emissive: '#0891b2', rot: [0.08, 0.2, 0.2] },
        { pos: [2.5, 1.8, 1.0] as [number,number,number], h: 2.45, color: '#a78bfa', emissive: '#6d28d9', rot: [0.05, 0.55, -0.14] },
        { pos: [0.15, 2.85, 0.15] as [number,number,number], h: 2.05, color: '#22d3ee', emissive: '#0e7490', rot: [0.08, 0.3, 0.05] },
        { pos: [-1.25, 2.2, -1.25] as [number,number,number], h: 1.7, color: '#c084fc', emissive: '#7c3aed', rot: [0.03, 0.7, -0.18] },
        { pos: [1.45, 2.1, -1.3] as [number,number,number], h: 1.6, color: '#67e8f9', emissive: '#0891b2', rot: [-0.1, 1.05, 0.1] },
        { pos: [0.55, 1.15, 4.55] as [number,number,number], h: 0.95, color: '#c4b5fd', emissive: '#7c3aed', rot: [0.05, 0.2, 0.02] },
        { pos: [-0.55, 1.0, 4.6] as [number,number,number], h: 0.9, color: '#7dd3fc', emissive: '#0284c7', rot: [0, -0.25, -0.05] },
      ].map((cr, i) => (
        <mesh
          key={`crystal-${i}`}
          ref={(el) => { crystalRefs.current[i] = el; }}
          position={cr.pos}
          rotation={cr.rot as [number, number, number]}
          castShadow
        >
          <coneGeometry args={[0.32, cr.h, 5]} />
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

      {/* Soft ambient cave glows */}
      <pointLight position={[0, 1.6, 3.9]} color="#7c3aed" intensity={0.85} distance={4.8} />
      <pointLight position={[-2.2, 2.0, 0.8]} color="#67e8f9" intensity={1.2} distance={6.5} />
      <pointLight position={[2.1, 2.0, 0.7]} color="#a78bfa" intensity={1.1} distance={6.5} />
      <pointLight position={[0, 2.75, -0.25]} color="#22d3ee" intensity={0.95} distance={5.8} />
    </group>
  );
}
