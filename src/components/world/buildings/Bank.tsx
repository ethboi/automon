'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface BankProps {
  position: [number, number, number];
  onClick?: () => void;
}

export function Bank({ position, onClick }: BankProps) {
  const coinRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (coinRef.current) {
      coinRef.current.rotation.y = state.clock.elapsedTime * 2;
      coinRef.current.position.y = 6 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Base platform with steps */}
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[7, 0.4, 6]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {/* Steps */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.4 + i * 0.15, 3 - i * 0.4]} receiveShadow>
          <boxGeometry args={[5.5 - i * 0.3, 0.15, 0.6]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
      ))}

      {/* Main building body */}
      <mesh
        position={[0, 2.5, 0]}
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
        <boxGeometry args={[6, 4, 5]} />
        <meshStandardMaterial color={hovered ? '#eab308' : '#ca8a04'} />
      </mesh>

      {/* Roof trim */}
      <mesh position={[0, 4.7, 0]} castShadow>
        <boxGeometry args={[6.5, 0.4, 5.5]} />
        <meshStandardMaterial color={hovered ? '#a16207' : '#854d0e'} />
      </mesh>

      {/* Roof top */}
      <mesh position={[0, 5.1, 0]} castShadow>
        <boxGeometry args={[5.5, 0.3, 4.5]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>

      {/* Columns */}
      {[-2, -0.7, 0.7, 2].map((x, i) => (
        <group key={i} position={[x, 2.5, 2.6]}>
          {/* Column shaft */}
          <mesh castShadow>
            <cylinderGeometry args={[0.25, 0.3, 4, 12]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          {/* Column capital */}
          <mesh position={[0, 2.2, 0]} castShadow>
            <boxGeometry args={[0.7, 0.3, 0.7]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          {/* Column base */}
          <mesh position={[0, -2.1, 0]} castShadow>
            <boxGeometry args={[0.7, 0.2, 0.7]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
        </group>
      ))}

      {/* Door frame */}
      <mesh position={[0, 1.8, 2.51]}>
        <boxGeometry args={[1.6, 3, 0.1]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1.7, 2.55]}>
        <boxGeometry args={[1.4, 2.6, 0.1]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>

      {/* Door bars */}
      {[-0.35, 0, 0.35].map((x, i) => (
        <mesh key={i} position={[x, 1.7, 2.62]}>
          <boxGeometry args={[0.05, 2.4, 0.05]} />
          <meshStandardMaterial color="#fcd34d" metalness={0.8} />
        </mesh>
      ))}

      {/* Vault symbol */}
      <mesh position={[0, 3.8, 2.51]}>
        <cylinderGeometry args={[0.6, 0.6, 0.1, 32]} />
        <meshStandardMaterial color="#fcd34d" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Windows */}
      {[[-2, 3.2, 2.51], [2, 3.2, 2.51]].map(([x, y, z], i) => (
        <group key={i}>
          <mesh position={[x, y, z]}>
            <boxGeometry args={[0.9, 1.2, 0.1]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fef9c3" emissiveIntensity={0.2} />
          </mesh>
          {/* Window bars */}
          <mesh position={[x, y, z + 0.05]}>
            <boxGeometry args={[0.05, 1.2, 0.05]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[x, y, z + 0.05]}>
            <boxGeometry args={[0.9, 0.05, 0.05]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        </group>
      ))}

      {/* Rotating coin on top */}
      <group ref={coinRef} position={[0, 6, 0]}>
        <mesh>
          <cylinderGeometry args={[0.7, 0.7, 0.2, 32]} />
          <meshStandardMaterial
            color="#fcd34d"
            emissive="#fcd34d"
            emissiveIntensity={0.4}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        {/* Coin emblem */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.25, 6]} />
          <meshStandardMaterial color="#eab308" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>

      {/* Hover glow */}
      {hovered && (
        <mesh position={[0, 2.5, 0]} scale={1.02}>
          <boxGeometry args={[6, 4, 5]} />
          <meshBasicMaterial color="#fcd34d" transparent opacity={0.2} />
        </mesh>
      )}

      {/* Floating label */}
      <Html position={[0, 7.5, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
        <div
          className={`px-4 py-2 rounded-lg text-white font-bold whitespace-nowrap transition-all ${
            hovered ? 'bg-yellow-500 scale-110' : 'bg-yellow-600/80'
          }`}
        >
          Shop
        </div>
      </Html>
    </group>
  );
}
