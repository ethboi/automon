'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Displaced icosahedron for organic rock shapes */
function createRockGeo(radius: number, seed: number, roughness = 0.25): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 3.7 + seed) * 0.4 + Math.sin(y * 4 + seed * 1.3) * 0.3 + Math.sin(z * 3 + seed * 0.7) * 0.3;
    const d = 1 + n * roughness;
    pos.setXYZ(i, x * d, Math.max(y * d, -0.1), z * d);
  }
  geo.computeVertexNormals();
  return geo;
}

export default function DarkForest() {
  const orbRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fogRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    orbRefs.current.forEach((orb, i) => {
      if (!orb) return;
      orb.position.y = 1.5 + Math.sin(t * 0.8 + i * 2) * 0.4;
      const mat = orb.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.5 + Math.sin(t * 1.5 + i) * 0.3;
    });
    if (fogRef.current) {
      fogRef.current.intensity = 1.5 + Math.sin(t * 0.5) * 0.5;
    }
  });

  const rock1 = useMemo(() => createRockGeo(1.2, 55), []);
  const rock2 = useMemo(() => createRockGeo(0.8, 77), []);

  // Tree positions — dense cluster
  const trees = useMemo(() => [
    { x: 0, z: 0, h: 5, r: 0.2, cr: 1.5 },
    { x: -2.5, z: -1, h: 6, r: 0.22, cr: 1.8 },
    { x: 2, z: -1.5, h: 5.5, r: 0.18, cr: 1.4 },
    { x: -1, z: 2.5, h: 4.5, r: 0.16, cr: 1.3 },
    { x: 1.5, z: 2, h: 5, r: 0.2, cr: 1.5 },
    { x: -3, z: 2, h: 4, r: 0.15, cr: 1.2 },
    { x: 3, z: 0.5, h: 4.5, r: 0.17, cr: 1.3 },
    { x: 0, z: -3, h: 5.5, r: 0.19, cr: 1.6 },
    { x: -2, z: -3, h: 4, r: 0.15, cr: 1.1 },
    { x: 3.5, z: -2.5, h: 3.5, r: 0.14, cr: 1.0 },
    { x: -4, z: 0, h: 3.5, r: 0.13, cr: 1.0 },
    { x: 1, z: -4, h: 4, r: 0.15, cr: 1.2 },
  ], []);

  return (
    <group>
      {/* Dark ground patch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[6.5, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={1} />
      </mesh>

      {/* Dense dark trees */}
      {trees.map((tree, i) => (
        <group key={`tree-${i}`} position={[tree.x, 0, tree.z]}>
          {/* Trunk — dark twisted */}
          <mesh position={[0, tree.h / 2, 0]} castShadow>
            <cylinderGeometry args={[tree.r * 0.7, tree.r, tree.h, 6]} />
            <meshStandardMaterial color="#1a1210" roughness={0.95} />
          </mesh>
          {/* Branch stubs */}
          <mesh position={[tree.r * 2, tree.h * 0.6, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <cylinderGeometry args={[tree.r * 0.3, tree.r * 0.5, tree.h * 0.3, 5]} />
            <meshStandardMaterial color="#1a1210" roughness={0.95} />
          </mesh>
          <mesh position={[-tree.r * 1.5, tree.h * 0.75, tree.r]} rotation={[0.3, 0, -Math.PI / 3.5]} castShadow>
            <cylinderGeometry args={[tree.r * 0.25, tree.r * 0.4, tree.h * 0.25, 5]} />
            <meshStandardMaterial color="#1a1210" roughness={0.95} />
          </mesh>
          {/* Canopy — dark purple/black foliage */}
          <mesh position={[0, tree.h - tree.cr * 0.3, 0]} castShadow>
            <sphereGeometry args={[tree.cr, 6, 5]} />
            <meshStandardMaterial color="#1a0a2e" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[tree.cr * 0.4, tree.h - tree.cr * 0.6, -tree.cr * 0.3]} castShadow>
            <sphereGeometry args={[tree.cr * 0.7, 5, 4]} />
            <meshStandardMaterial color="#120822" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}

      {/* Mossy rocks */}
      <mesh position={[-2.5, 0.4, 3.5]} geometry={rock1} castShadow>
        <meshStandardMaterial color="#2a2a2a" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[3, 0.3, 3]} geometry={rock2} castShadow>
        <meshStandardMaterial color="#252525" roughness={0.95} flatShading />
      </mesh>

      {/* Glowing mushrooms scattered on ground */}
      {[
        [-1.5, 0, 1.5, '#a78bfa'], [2, 0, -0.5, '#c084fc'], [-0.5, 0, -2, '#818cf8'],
        [1, 0, 3, '#a78bfa'], [-3, 0, -1, '#c084fc'], [3.5, 0, 1.5, '#818cf8'],
      ].map(([x, y, z, c], i) => (
        <group key={`mush-${i}`} position={[x as number, y as number, z as number]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 0.3, 5]} />
            <meshStandardMaterial color="#d4d4d8" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <coneGeometry args={[0.15, 0.14, 6]} />
            <meshStandardMaterial
              color={c as string}
              emissive={c as string}
              emissiveIntensity={0.8}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}

      {/* Floating spirit orbs */}
      {[
        [-1, 1.5, 0.5], [1.5, 1.8, -1], [0, 1.3, -2.5], [-2, 1.6, -2],
      ].map((pos, i) => (
        <mesh
          key={`orb-${i}`}
          ref={(el) => { orbRefs.current[i] = el; }}
          position={pos as [number, number, number]}
        >
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial
            color="#c4b5fd"
            emissive="#7c3aed"
            emissiveIntensity={1}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}

      {/* Spiderweb between two trees */}
      <group position={[-0.5, 3, 1.2]} rotation={[0, 0.5, 0]}>
        {[-0.3, -0.15, 0, 0.15, 0.3].map((off, i) => (
          <mesh key={`wh-${i}`} position={[0, off, 0]}>
            <boxGeometry args={[2, 0.008, 0.008]} />
            <meshStandardMaterial color="#e2e8f0" transparent opacity={0.2} />
          </mesh>
        ))}
        {[-0.7, -0.35, 0, 0.35, 0.7].map((off, i) => (
          <mesh key={`wv-${i}`} position={[off, 0, 0]}>
            <boxGeometry args={[0.008, 0.65, 0.008]} />
            <meshStandardMaterial color="#e2e8f0" transparent opacity={0.15} />
          </mesh>
        ))}
      </group>

      {/* Eerie ambient lights */}
      <pointLight ref={fogRef} position={[0, 1, 0]} color="#7c3aed" intensity={1.5} distance={8} />
      <pointLight position={[-2, 2, -1]} color="#4c1d95" intensity={1} distance={5} />
      <pointLight position={[2, 0.5, 2]} color="#a78bfa" intensity={0.8} distance={4} />
    </group>
  );
}
