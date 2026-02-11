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

  // Use ExtrudeGeometry for a proper gable roof
  const roofGeo = useMemo(() => {
    const w = 2.7; // half-width
    const h = 1.8; // peak height
    const shape = new THREE.Shape();
    shape.moveTo(-w, 0);
    shape.lineTo(0, h);
    shape.lineTo(w, 0);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 5.2,
      bevelEnabled: false,
    });
    // Center the extrusion
    geo.translate(0, 0, -2.6);
    return geo;
  }, []);

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

  const wallColor = hovered ? '#d4a574' : '#c9956b';
  const roofColor = hovered ? '#8b4513' : '#7a3b10';

  return (
    <group position={position}>
      {/* Foundation */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[5.6, 0.2, 5.6]} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} />
      </mesh>

      {/* Main house walls */}
      <mesh
        position={[0, 1.85, 0]}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <boxGeometry args={[5, 3.5, 5]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} />
      </mesh>

      {/* Roof — extruded triangle, sits on wall top */}
      <mesh position={[0, 3.6, 0]} castShadow geometry={roofGeo}>
        <meshStandardMaterial color={roofColor} roughness={0.75} />
      </mesh>

      {/* Chimney */}
      <mesh position={[1.5, 5, 1.5]} castShadow>
        <boxGeometry args={[0.7, 1.8, 0.7]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.85} />
      </mesh>
      <mesh position={[1.5, 6, 1.5]}>
        <boxGeometry args={[0.9, 0.15, 0.9]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>

      {/* Smoke */}
      <group ref={smokeRef} position={[1.5, 6.2, 1.5]}>
        {smokeParticles.map((particle) => (
          <mesh key={particle.id}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#9ca3af" transparent opacity={0.5} />
          </mesh>
        ))}
      </group>

      {/* Door */}
      <mesh position={[0, 1.1, 2.51]}>
        <boxGeometry args={[1.1, 2, 0.1]} />
        <meshStandardMaterial color="#5c3317" roughness={0.8} />
      </mesh>
      <mesh position={[0.35, 1.1, 2.6]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} />
      </mesh>

      {/* Windows */}
      {[
        { p: [-1.5, 2.5, 2.51], r: 0 },
        { p: [1.5, 2.5, 2.51], r: 0 },
        { p: [2.51, 2.5, 0], r: Math.PI / 2 },
        { p: [-2.51, 2.5, 0], r: -Math.PI / 2 },
        { p: [0, 2.5, -2.51], r: Math.PI },
      ].map((w, i) => (
        <group key={i} position={w.p as [number, number, number]} rotation={[0, w.r, 0]}>
          <mesh>
            <boxGeometry args={[0.9, 0.9, 0.1]} />
            <meshStandardMaterial color="#bfdbfe" emissive="#93c5fd" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[1, 0.06, 0.04]} />
            <meshStandardMaterial color="#4a3520" />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.06, 1, 0.04]} />
            <meshStandardMaterial color="#4a3520" />
          </mesh>
        </group>
      ))}

      {/* Porch */}
      <mesh position={[0, 0.35, 3]} receiveShadow>
        <boxGeometry args={[2.5, 0.15, 1.2]} />
        <meshStandardMaterial color="#5D4037" roughness={0.85} />
      </mesh>
      {[-0.9, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 1.1, 3.4]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
          <meshStandardMaterial color="#e8e0d8" />
        </mesh>
      ))}
      <mesh position={[0, 1.9, 3.2]} castShadow>
        <boxGeometry args={[2.6, 0.12, 1.5]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>

      {/* Hover glow */}
      {hovered && (
        <mesh position={[0, 1.85, 0]} scale={1.02}>
          <boxGeometry args={[5, 3.5, 5]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.15} />
        </mesh>
      )}

      {/* Label */}
      <Html position={[0, 7, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
        <div className={`px-4 py-2 rounded-lg text-white font-bold whitespace-nowrap transition-all ${hovered ? 'bg-amber-500 scale-110' : 'bg-amber-700/80'}`}>
          Home
        </div>
      </Html>
    </group>
  );
}
