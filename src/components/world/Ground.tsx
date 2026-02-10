'use client';

import * as THREE from 'three';
import { useMemo } from 'react';

interface GroundProps {
  size?: number;
  onClick?: (point: THREE.Vector3) => void;
}

export function Ground({ size = 80, onClick }: GroundProps) {
  const handleContextMenu = (event: { point: THREE.Vector3; stopPropagation: () => void; nativeEvent?: { preventDefault?: () => void } }) => {
    event.stopPropagation();
    event.nativeEvent?.preventDefault?.();
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
      {/* Main ground — vibrant grass green */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onContextMenu={handleContextMenu}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#3d8b37" roughness={0.85} />
      </mesh>

      {/* Grass variation patches — lighter/darker areas for natural look */}
      {[
        [-8, 10, 5, '#4a9e42'], [5, -12, 4, '#358030'], [12, 8, 6, '#4a9e42'],
        [-10, -8, 4, '#2d7528'], [0, 15, 5, '#4a9e42'], [-15, 0, 4, '#358030'],
        [25, -5, 5, '#4a9e42'], [-25, 8, 4.5, '#358030'], [15, -20, 4, '#2d7528'],
        [-20, -15, 5, '#358030'], [28, 12, 4, '#4a9e42'], [-12, 22, 4.5, '#2d7528'],
        [8, 25, 4, '#358030'], [-28, -5, 5, '#4a9e42'], [20, -25, 4, '#2d7528'],
        [-35, 10, 6, '#358030'], [35, -15, 5, '#4a9e42'], [0, -35, 6, '#2d7528'],
        [40, 5, 5, '#358030'], [-40, -20, 6, '#4a9e42'],
      ].map(([x, z, r, color], i) => (
        <mesh key={`g-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x as number, 0.005, z as number]}>
          <circleGeometry args={[r as number, 16]} />
          <meshStandardMaterial color={color as string} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Biome zones */}
      {/* Water areas — blue ponds */}
      {[[-36, -14, 6], [34, -24, 5.5]].map(([x, z, r], i) => (
        <group key={`water-${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, z]}>
            <circleGeometry args={[r, 32]} />
            <meshStandardMaterial color="#3b7dd8" transparent opacity={0.75} roughness={0.1} metalness={0.3} />
          </mesh>
          {/* Shore ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
            <ringGeometry args={[r - 0.3, r + 1, 32]} />
            <meshStandardMaterial color="#c4a265" transparent opacity={0.4} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Dark Forest zone — darker ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-36, 0.008, 22]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#1e3a1e" transparent opacity={0.6} />
      </mesh>
      {/* Crystal Caves zone — slight purple tint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[32, 0.008, 24]}>
        <circleGeometry args={[6, 24]} />
        <meshStandardMaterial color="#2a1e3a" transparent opacity={0.4} />
      </mesh>
      {/* Farm zone — golden-green tilled soil */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-28, 0.008, 0]}>
        <circleGeometry args={[6, 24]} />
        <meshStandardMaterial color="#5a7a30" transparent opacity={0.5} />
      </mesh>
      {/* Green Meadows — bright green */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, 0.008, -30]}>
        <circleGeometry args={[5, 24]} />
        <meshStandardMaterial color="#50b848" transparent opacity={0.4} />
      </mesh>

      {/* Trees — lush and bright */}
      {trees.map(([x, z], i) => {
        const h = 2.0 + (i % 4) * 0.6;
        const crownSize = 1.0 + (i % 3) * 0.3;
        return (
          <group key={`t-${i}`} position={[x, 0, z]}>
            {/* Trunk */}
            <mesh position={[0, h * 0.35, 0]} castShadow>
              <cylinderGeometry args={[0.18, 0.28, h * 0.7, 6]} />
              <meshStandardMaterial color="#6b4226" roughness={0.9} />
            </mesh>
            {/* Main foliage */}
            <mesh position={[0, h * 0.85, 0]} castShadow>
              <coneGeometry args={[crownSize, h * 0.7, 8]} />
              <meshStandardMaterial color={['#2d8a3e', '#38a349', '#258b35'][i % 3]} roughness={0.8} />
            </mesh>
            {/* Top tuft */}
            <mesh position={[0, h * 1.15, 0]} castShadow>
              <coneGeometry args={[crownSize * 0.6, h * 0.4, 6]} />
              <meshStandardMaterial color={['#3da850', '#45b555', '#35a045'][i % 3]} roughness={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* Rocks — scattered boulders */}
      {[
        [-6, -15, 0.6], [8, -20, 0.5], [-16, 5, 0.7], [14, 12, 0.4],
        [26, -8, 0.6], [-26, -12, 0.8], [0, -35, 0.5], [-10, 28, 0.6],
        [38, -3, 0.4], [-38, 18, 0.5], [45, 15, 0.5], [-45, -10, 0.6],
        [15, 40, 0.4], [-20, -40, 0.5],
      ].map(([x, z, s], i) => (
        <mesh key={`r-${i}`} position={[x, s * 0.4, z]} castShadow>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color={['#8a8e95', '#7a7e85', '#6a6e75'][i % 3]} roughness={0.85} />
        </mesh>
      ))}

      {/* Flowers / grass tufts for detail */}
      {[
        [-5, 5, '#e8c840'], [3, -8, '#e85040'], [-18, -10, '#d860d0'],
        [10, 15, '#e8c840'], [-8, 20, '#5080e8'], [22, 8, '#e85040'],
        [-30, -5, '#e8c840'], [15, -15, '#d860d0'], [-15, 15, '#5080e8'],
        [30, -10, '#e8c840'], [-10, -25, '#e85040'], [5, 30, '#d860d0'],
      ].map(([x, z, color], i) => (
        <mesh key={`f-${i}`} position={[x as number, 0.15, z as number]}>
          <sphereGeometry args={[0.2, 6, 6]} />
          <meshStandardMaterial color={color as string} roughness={0.7} />
        </mesh>
      ))}

      {/* Soft edge fade to match sky */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[size / 2 - 6, size / 2 + 2, 64]} />
        <meshStandardMaterial color="#90c090" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
