'use client';

import * as THREE from 'three';

interface GroundProps {
  size?: number;
  onClick?: (point: THREE.Vector3) => void;
}

export function Ground({ size = 80, onClick }: GroundProps) {
  const handleClick = (event: { point: THREE.Vector3; stopPropagation: () => void }) => {
    event.stopPropagation();
    if (onClick) onClick(event.point);
  };

  return (
    <group>
      {/* Main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onClick={handleClick}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#1a3a2a" />
      </mesh>

      {/* Grass patches — scattered across the expanded map */}
      {[
        [-8, 10], [5, -12], [12, 8], [-10, -8], [0, 15], [-15, 0],
        [25, -5], [-25, 8], [15, -20], [-20, -15], [28, 12], [-12, 22],
        [8, 25], [-28, -5], [20, -25], [-8, -28], [30, -18], [-30, 12],
      ].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
          <circleGeometry args={[2 + Math.random() * 3, 16]} />
          <meshStandardMaterial color="#276749" transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Water zone — near Old Pond & River Delta */}
      {[
        [-22, -22, 5], [24, -18, 4], [-20, -14, 3],
      ].map(([x, z, r], i) => (
        <mesh key={`water-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, z]}>
          <circleGeometry args={[r, 24]} />
          <meshStandardMaterial color="#1e3a5f" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Dark zone — near Dark Forest & Crystal Caves */}
      {[
        [-24, 14, 5], [20, 16, 4],
      ].map(([x, z, r], i) => (
        <mesh key={`dark-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, z]}>
          <circleGeometry args={[r, 24]} />
          <meshStandardMaterial color="#1a1025" transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Farm zone — lighter green near Community Farm */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-18, 0.013, 0]}>
        <circleGeometry args={[5, 24]} />
        <meshStandardMaterial color="#2d5a1e" transparent opacity={0.4} />
      </mesh>

      {/* Decorative trees — spread across the larger map */}
      {[
        [-10, -10], [10, -10], [-10, 10], [10, 10],
        [-30, -25], [30, -25], [-30, 25], [30, 25],
        [-20, -5], [25, 5], [-5, -25], [5, 25],
        [15, -30], [-15, 28], [32, 0], [-32, -10],
        [-6, -30], [28, 24], [-28, -20], [12, 30],
      ].map(([x, z], i) => (
        <group key={`tree-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.4, 2, 6]} />
            <meshStandardMaterial color="#5D4037" />
          </mesh>
          <mesh position={[0, 2.5, 0]} castShadow>
            <coneGeometry args={[1.2 + (i % 3) * 0.3, 2.5, 6]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#1B5E20' : i % 3 === 1 ? '#2E7D32' : '#388E3C'} />
          </mesh>
        </group>
      ))}

      {/* Rocks */}
      {[
        [-6, -15, 0.5], [8, -20, 0.4], [-16, 5, 0.6], [14, 12, 0.3],
        [26, -8, 0.5], [-26, -12, 0.7], [0, -30, 0.4], [-10, 28, 0.5],
      ].map(([x, z, s], i) => (
        <mesh key={`rock-${i}`} position={[x, s * 0.5, z]} castShadow>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#6B7280" roughness={0.9} />
        </mesh>
      ))}

      {/* Border glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[size / 2 - 2, size / 2, 64]} />
        <meshStandardMaterial color="#0f2a1a" />
      </mesh>
    </group>
  );
}
