'use client';

import * as THREE from 'three';
import { useMemo } from 'react';

interface GroundProps {
  size?: number;
  onClick?: (point: THREE.Vector3) => void;
}

export function Ground({ size = 80, onClick }: GroundProps) {
  const handleClick = (event: { point: THREE.Vector3; stopPropagation: () => void }) => {
    event.stopPropagation();
    if (onClick) onClick(event.point);
  };

  // Deterministic scatter positions
  const trees = useMemo(() => [
    [-10, -10], [10, -10], [-10, 10], [10, 10],
    [-30, -25], [30, -25], [-30, 25], [30, 25],
    [-20, -5], [25, 5], [-5, -25], [5, 25],
    [15, -30], [-15, 28], [32, 0], [-32, -10],
    [-6, -30], [28, 24], [-28, -20], [12, 30],
    [-35, -15], [35, 10], [-8, 35], [8, -35],
  ], []);

  return (
    <group>
      {/* Main ground — dark rich green */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onClick={handleClick}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#152218" roughness={1} />
      </mesh>

      {/* Subtle grass variation patches */}
      {[
        [-8, 10, 4], [5, -12, 3], [12, 8, 5], [-10, -8, 3.5], [0, 15, 4],
        [-15, 0, 3], [25, -5, 4], [-25, 8, 3.5], [15, -20, 3], [-20, -15, 4],
        [28, 12, 3], [-12, 22, 3.5], [8, 25, 3], [-28, -5, 4], [20, -25, 3],
      ].map(([x, z, r], i) => (
        <mesh key={`g-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, z]}>
          <circleGeometry args={[r, 16]} />
          <meshStandardMaterial color="#264032" transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Biome zones */}
      {/* Water areas */}
      {[[-22, -18, 5], [22, -16, 4.5]].map(([x, z, r], i) => (
        <mesh key={`w-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
          <circleGeometry args={[r, 24]} />
          <meshStandardMaterial color="#0c1f3a" transparent opacity={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Dark zones */}
      {[[-24, 14, 5.5], [20, 16, 5]].map(([x, z, r], i) => (
        <mesh key={`d-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, z]}>
          <circleGeometry args={[r, 24]} />
          <meshStandardMaterial color="#0d0a15" transparent opacity={0.5} />
        </mesh>
      ))}
      {/* Farm zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-18, 0.008, 0]}>
        <circleGeometry args={[5.5, 24]} />
        <meshStandardMaterial color="#1e3314" transparent opacity={0.4} />
      </mesh>

      {/* Trees */}
      {trees.map(([x, z], i) => {
        const h = 1.5 + (i % 4) * 0.5;
        return (
          <group key={`t-${i}`} position={[x, 0, z]}>
            <mesh position={[0, h * 0.4, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.3, h * 0.8, 6]} />
              <meshStandardMaterial color="#3d2b1a" />
            </mesh>
            <mesh position={[0, h, 0]} castShadow>
              <coneGeometry args={[0.8 + (i % 3) * 0.3, h * 0.9, 6]} />
              <meshStandardMaterial color={['#1e4d26', '#24582e', '#2a6335'][i % 3]} />
            </mesh>
          </group>
        );
      })}

      {/* Rocks */}
      {[
        [-6, -15, 0.5], [8, -20, 0.4], [-16, 5, 0.6], [14, 12, 0.3],
        [26, -8, 0.5], [-26, -12, 0.7], [0, -30, 0.4], [-10, 28, 0.5],
        [33, -3, 0.3], [-33, 18, 0.4],
      ].map(([x, z, s], i) => (
        <mesh key={`r-${i}`} position={[x, s * 0.4, z]} castShadow>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#3a3f47" roughness={0.95} />
        </mesh>
      ))}

      {/* Soft edge fade */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[size / 2 - 4, size / 2, 64]} />
        <meshStandardMaterial color="#0f1525" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
