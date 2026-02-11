'use client';

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface HomeProps {
  position: [number, number, number];
  onClick?: () => void;
}

export function Home({ position, onClick }: HomeProps) {
  const smokeRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const smokeParticles = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      offset: i * 0.5,
      speed: 0.3 + Math.random() * 0.2,
    }));
  }, []);

  useFrame((state) => {
    if (smokeRef.current) {
      smokeRef.current.children.forEach((child, i) => {
        const particle = smokeParticles[i];
        const t = (state.clock.elapsedTime * particle.speed + particle.offset) % 2;
        child.position.y = t * 1.5;
        (child as THREE.Mesh).scale.setScalar(0.1 + t * 0.15);
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - t * 0.3);
      });
    }
  });

  return (
    <group position={position}>
      {/* Foundation */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[5.5, 0.3, 5.5]} />
        <meshStandardMaterial color="#4B5563" />
      </mesh>

      {/* Main house body */}
      <mesh
        position={[0, 2, 0]}
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
        <boxGeometry args={[5, 3.5, 5]} />
        <meshStandardMaterial color={hovered ? '#3b82f6' : '#2563eb'} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, 4.5, 0]} castShadow rotation={[0, 0, 0]}>
        <coneGeometry args={[4.2, 2.5, 4]} />
        <meshStandardMaterial color={hovered ? '#1e40af' : '#1d4ed8'} />
      </mesh>

      {/* Chimney */}
      <mesh position={[1.5, 5, 1.5]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
      <mesh position={[1.5, 6, 1.5]}>
        <boxGeometry args={[1, 0.2, 1]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>

      {/* Smoke particles */}
      <group ref={smokeRef} position={[1.5, 6.2, 1.5]}>
        {smokeParticles.map((particle) => (
          <mesh key={particle.id}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color="#9ca3af" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>

      {/* Door */}
      <mesh position={[0, 1.2, 2.51]}>
        <boxGeometry args={[1.2, 2, 0.1]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <mesh position={[0.4, 1.2, 2.6]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#fcd34d" metalness={0.8} />
      </mesh>

      {/* Windows */}
      {[
        [-1.5, 2.5, 2.51], [1.5, 2.5, 2.51],
        [2.51, 2.5, 0], [-2.51, 2.5, 0],
        [0, 2.5, -2.51]
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, z === 0 ? (x > 0 ? Math.PI / 2 : -Math.PI / 2) : (z < 0 ? Math.PI : 0), 0]}>
          <mesh>
            <boxGeometry args={[1, 1, 0.1]} />
            <meshStandardMaterial color="#7dd3fc" emissive="#7dd3fc" emissiveIntensity={0.3} />
          </mesh>
          {/* Window frame */}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[1.1, 0.08, 0.05]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.08, 1.1, 0.05]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
        </group>
      ))}

      {/* Porch */}
      <mesh position={[0, 0.4, 3]} receiveShadow>
        <boxGeometry args={[2.5, 0.2, 1.5]} />
        <meshStandardMaterial color="#5D4037" />
      </mesh>

      {/* Porch pillars */}
      {[-0.9, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 1.2, 3.5]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 1.6, 8]} />
          <meshStandardMaterial color="#f5f5f4" />
        </mesh>
      ))}

      {/* Porch roof */}
      <mesh position={[0, 2.1, 3.2]} castShadow>
        <boxGeometry args={[2.8, 0.15, 1.8]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>

      {/* Hover glow */}
      {hovered && (
        <mesh position={[0, 2, 0]} scale={1.02}>
          <boxGeometry args={[5, 3.5, 5]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} />
        </mesh>
      )}

      {/* Floating label */}
      <Html position={[0, 7, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
        <div
          className={`px-4 py-2 rounded-lg text-white font-bold whitespace-nowrap transition-all ${
            hovered ? 'bg-blue-500 scale-110' : 'bg-blue-700/80'
          }`}
        >
          Collection
        </div>
      </Html>
    </group>
  );
}
