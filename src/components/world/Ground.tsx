'use client';

import * as THREE from 'three';

interface GroundProps {
  size?: number;
  onClick?: (point: THREE.Vector3) => void;
}

export function Ground({ size = 40, onClick }: GroundProps) {
  const handleClick = (event: { point: THREE.Vector3; stopPropagation: () => void }) => {
    event.stopPropagation();
    if (onClick) {
      onClick(event.point);
    }
  };

  return (
    <group>
      {/* Main grass ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={handleClick}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#22543d" />
      </mesh>

      {/* Lighter grass patches */}
      {[
        [-8, 10], [5, -12], [12, 8], [-10, -8], [0, 15], [-15, 0]
      ].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
          <circleGeometry args={[3 + Math.random() * 2, 16]} />
          <meshStandardMaterial color="#276749" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Path/road from spawn to center */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 4]}>
        <planeGeometry args={[3, 10]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>

      {/* Path to arena */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -4]}>
        <planeGeometry args={[3, 8]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>

      {/* Path to home */}
      <mesh rotation={[-Math.PI / 2, Math.PI / 4, 0]} position={[-4, 0.02, 2]}>
        <planeGeometry args={[2.5, 8]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>

      {/* Path to bank */}
      <mesh rotation={[-Math.PI / 2, -Math.PI / 4, 0]} position={[4, 0.02, 2]}>
        <planeGeometry args={[2.5, 8]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>

      {/* Decorative trees */}
      {[
        [-15, -15], [15, -15], [-15, 12], [15, 12],
        [-12, 0], [12, -5], [0, -15], [-5, 12]
      ].map(([x, z], i) => (
        <group key={`tree-${i}`} position={[x, 0, z]}>
          {/* Trunk */}
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
            <meshStandardMaterial color="#5D4037" />
          </mesh>
          {/* Foliage */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <coneGeometry args={[1.5, 3, 8]} />
            <meshStandardMaterial color="#2E7D32" />
          </mesh>
          <mesh position={[0, 3.5, 0]} castShadow>
            <coneGeometry args={[1, 2, 8]} />
            <meshStandardMaterial color="#388E3C" />
          </mesh>
        </group>
      ))}

      {/* Decorative rocks */}
      {[
        [-6, -10, 0.5], [8, -8, 0.4], [-12, 5, 0.6], [10, 10, 0.3]
      ].map(([x, z, s], i) => (
        <mesh key={`rock-${i}`} position={[x, s * 0.5, z]} castShadow>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#6B7280" roughness={0.9} />
        </mesh>
      ))}

      {/* Border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[size / 2 - 1, size / 2, 64]} />
        <meshStandardMaterial color="#1a3a2a" />
      </mesh>
    </group>
  );
}
