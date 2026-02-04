'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useState } from 'react';

interface BattleArenaProps {
  position: [number, number, number];
  onClick?: () => void;
}

export function BattleArena({ position, onClick }: BattleArenaProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.5;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.y -= delta * 0.3;
    }
  });

  return (
    <group position={position}>
      {/* Base platform */}
      <mesh
        position={[0, 0.3, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <cylinderGeometry args={[6, 6.5, 0.6, 8]} />
        <meshStandardMaterial color={hovered ? '#ef4444' : '#b91c1c'} />
      </mesh>

      {/* Arena floor */}
      <mesh position={[0, 0.62, 0]} receiveShadow>
        <cylinderGeometry args={[5.5, 5.5, 0.1, 8]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Battle circle markings */}
      <mesh position={[0, 0.68, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3, 3.5, 32]} />
        <meshBasicMaterial color="#ea580c" />
      </mesh>
      <mesh position={[0, 0.68, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2, 32]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.8} />
      </mesh>

      {/* Center glow */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.05, 16]} />
        <meshBasicMaterial color={hovered ? '#fbbf24' : '#f97316'} />
      </mesh>

      {/* Rotating outer ring */}
      <mesh ref={ringRef} position={[0, 2, 0]}>
        <torusGeometry args={[6, 0.2, 8, 32]} />
        <meshStandardMaterial color="#ea580c" emissive="#ea580c" emissiveIntensity={0.5} />
      </mesh>

      {/* Rotating inner ring */}
      <mesh ref={innerRingRef} position={[0, 2.5, 0]}>
        <torusGeometry args={[4.5, 0.15, 8, 32]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} />
      </mesh>

      {/* Corner pillars */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI) / 4;
        const x = Math.cos(angle) * 5.5;
        const z = Math.sin(angle) * 5.5;
        return (
          <group key={i}>
            <mesh position={[x, 2, z]} castShadow>
              <boxGeometry args={[0.6, 4, 0.6]} />
              <meshStandardMaterial color="#7f1d1d" />
            </mesh>
            {/* Pillar top */}
            <mesh position={[x, 4.2, z]}>
              <boxGeometry args={[0.8, 0.3, 0.8]} />
              <meshStandardMaterial color="#991b1b" />
            </mesh>
            {/* Flame orbs */}
            <mesh position={[x, 4.5, z]}>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshBasicMaterial color="#f97316" />
            </mesh>
          </group>
        );
      })}

      {/* Hover glow */}
      {hovered && (
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[6.2, 6.7, 0.7, 8]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.2} />
        </mesh>
      )}

      {/* Floating label */}
      <Html position={[0, 6, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
        <div
          className={`px-4 py-2 rounded-lg text-white font-bold whitespace-nowrap transition-all ${
            hovered ? 'bg-red-500 scale-110' : 'bg-red-700/80'
          }`}
        >
          Battle Arena
        </div>
      </Html>
    </group>
  );
}
