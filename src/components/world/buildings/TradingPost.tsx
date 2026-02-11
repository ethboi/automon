'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TradingPostProps {
  position: [number, number, number];
}

/** Trading Post — a stock exchange building with nad.fun branding */
export function TradingPost({ position }: TradingPostProps) {
  const tickerRef = useRef<THREE.Mesh>(null);
  const coinRef = useRef<THREE.Group>(null);
  const barRefs = useRef<THREE.Mesh[]>([]);
  const scrollRef = useRef(0);

  useFrame((_, delta) => {
    if (tickerRef.current) {
      const s = 1 + Math.sin(Date.now() * 0.003) * 0.015;
      tickerRef.current.scale.set(s, s, 1);
    }
    if (coinRef.current) {
      coinRef.current.rotation.y += delta * 0.4;
    }
    scrollRef.current += delta;
    barRefs.current.forEach((bar, i) => {
      if (bar) {
        const h = 0.3 + Math.abs(Math.sin(scrollRef.current * 0.8 + i * 1.2)) * 0.9;
        bar.scale.y = h;
        bar.position.y = 3.0 + h * 0.5;
      }
    });
  });

  return (
    <group position={position}>
      {/* Foundation */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[10, 0.3, 8]} />
        <meshStandardMaterial color="#4b5563" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.05, 3.5]} receiveShadow>
        <boxGeometry args={[6, 0.1, 1.5]} />
        <meshStandardMaterial color="#6b7280" roughness={0.8} />
      </mesh>

      {/* Main building */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[9, 4.5, 6.5]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>

      {/* Front pillars */}
      {[-3.2, -1.1, 1.1, 3.2].map((x, i) => (
        <mesh key={`pillar-${i}`} position={[x, 2.5, 3.3]} castShadow>
          <cylinderGeometry args={[0.25, 0.3, 4.5, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} />
        </mesh>
      ))}

      {/* Roof */}
      <mesh position={[0, 5.0, 0]} castShadow>
        <boxGeometry args={[10, 0.4, 7.5]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      <mesh position={[0, 5.6, 3.0]} castShadow>
        <coneGeometry args={[5.5, 1.5, 4]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>

      {/* === TICKER BOARD === */}
      <mesh position={[0, 3.5, 3.35]}>
        <boxGeometry args={[7.5, 2.8, 0.1]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} />
      </mesh>
      <mesh ref={tickerRef} position={[0, 3.5, 3.4]}>
        <boxGeometry args={[7, 2.4, 0.05]} />
        <meshStandardMaterial color="#052e16" emissive="#10b981" emissiveIntensity={0.4} roughness={0.2} />
      </mesh>

      {/* Animated chart bars */}
      {[-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4].map((x, i) => (
        <mesh
          key={`bar-${i}`}
          ref={(el) => { if (el) barRefs.current[i] = el; }}
          position={[x, 3.0, 3.45]}
        >
          <boxGeometry args={[0.5, 1, 0.02]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? '#ef4444' : '#10b981'}
            emissive={i % 3 === 0 ? '#ef4444' : '#10b981'}
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}

      {/* === "nad.fun" ROOFTOP SIGN — neon style === */}
      {/* Sign backing — dark with gold trim */}
      <mesh position={[0, 6.5, 0.1]} castShadow>
        <boxGeometry args={[8, 2.5, 0.2]} />
        <meshStandardMaterial color="#0f0520" roughness={0.3} />
      </mesh>
      <mesh position={[0, 6.5, 0.22]}>
        <boxGeometry args={[8.3, 2.8, 0.05]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Inner glow panel */}
      <mesh position={[0, 6.5, 0.25]}>
        <boxGeometry args={[7.5, 2, 0.05]} />
        <meshStandardMaterial color="#1a0533" emissive="#7c3aed" emissiveIntensity={0.3} roughness={0.2} />
      </mesh>
      {/* Neon letters — thick extruded blocks spelling "nad.fun" */}
      {[
        // n
        { x: -3.0, w: 0.25, h: 1.2 }, { x: -2.3, w: 0.25, h: 1.2 }, { x: -2.65, w: 0.7, h: 0.25, y: 0.48 },
        // a
        { x: -1.7, w: 0.25, h: 1.2 }, { x: -1.0, w: 0.25, h: 1.2 }, { x: -1.35, w: 0.7, h: 0.25, y: 0.48 }, { x: -1.35, w: 0.7, h: 0.25, y: 0 },
        // d
        { x: -0.4, w: 0.25, h: 1.2 }, { x: 0.2, w: 0.25, h: 0.8 }, { x: -0.1, w: 0.5, h: 0.25, y: 0.48 }, { x: -0.1, w: 0.5, h: 0.25, y: -0.48 },
        // .
        { x: 0.6, w: 0.2, h: 0.2, y: -0.5 },
        // f
        { x: 1.0, w: 0.25, h: 1.2 }, { x: 1.3, w: 0.55, h: 0.25, y: 0.48 }, { x: 1.2, w: 0.4, h: 0.25, y: 0 },
        // u
        { x: 1.8, w: 0.25, h: 1.2 }, { x: 2.5, w: 0.25, h: 1.2 }, { x: 2.15, w: 0.7, h: 0.25, y: -0.48 },
        // n
        { x: 2.9, w: 0.25, h: 1.2 }, { x: 3.6, w: 0.25, h: 1.2 }, { x: 3.25, w: 0.7, h: 0.25, y: 0.48 },
      ].map((l, i) => (
        <mesh key={`letter-${i}`} position={[l.x, 6.5 + (l.y || 0), 0.35]} castShadow>
          <boxGeometry args={[l.w, l.h, 0.2]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.9} metalness={0.6} roughness={0.2} />
        </mesh>
      ))}
      {/* Glow lights behind sign */}
      <pointLight position={[0, 6.5, 1.5]} intensity={2} color="#fbbf24" distance={15} decay={2} />
      <pointLight position={[-2, 6.5, 1]} intensity={1} color="#7c3aed" distance={10} decay={2} />
      <pointLight position={[2, 6.5, 1]} intensity={1} color="#7c3aed" distance={10} decay={2} />

      {/* Side sign EXCHANGE */}
      <mesh position={[4.55, 3, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[3, 0.8, 0.1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* 3D "EXCHANGE" on side — simplified as a glowing plaque */}
      <mesh position={[4.58, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[2.6, 0.5, 0.08]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} roughness={0.3} />
      </mesh>

      {/* === GOLDEN BULL — BIG, AWAY FROM BUILDING, FACING FORWARD === */}
      <group position={[6.5, 0.3, 7]} scale={[2.8, 2.8, 2.8]} rotation={[0, Math.PI, 0]}>
        {/* Pedestal */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[2, 0.2, 1.2]} />
          <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Body */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[1.5, 1, 0.8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.3} />
        </mesh>
        {/* Hump / shoulders */}
        <mesh position={[-0.3, 1.1, 0]} castShadow>
          <boxGeometry args={[0.7, 0.4, 0.7]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.3} />
        </mesh>
        {/* Head */}
        <mesh position={[0.8, 1.0, 0]} castShadow>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.3} />
        </mesh>
        {/* Snout */}
        <mesh position={[1.15, 0.85, 0]} castShadow>
          <boxGeometry args={[0.3, 0.35, 0.45]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.25} />
        </mesh>
        {/* Horns */}
        <mesh position={[0.85, 1.4, -0.3]} rotation={[-0.4, 0, 0.3]} castShadow>
          <coneGeometry args={[0.08, 0.5, 6]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.85, 1.4, 0.3]} rotation={[0.4, 0, 0.3]} castShadow>
          <coneGeometry args={[0.08, 0.5, 6]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.25} />
        </mesh>
        {/* Legs — thick */}
        {[[-0.5, 0, -0.3], [-0.5, 0, 0.3], [0.4, 0, -0.3], [0.4, 0, 0.3]].map((p, i) => (
          <mesh key={`leg-${i}`} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.18, 0.4, 0.18]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.25} />
          </mesh>
        ))}
        {/* Tail */}
        <mesh position={[-0.85, 0.9, 0]} rotation={[0, 0, -0.6]} castShadow>
          <cylinderGeometry args={[0.03, 0.05, 0.6, 6]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.25} />
        </mesh>
      </group>

      {/* Floating rotating coin */}
      <group ref={coinRef} position={[-3.5, 6.5, 4]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.8, 0.8, 0.2, 24]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.02, 24]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Trading desks */}
      {[-2, 0, 2].map((x, i) => (
        <group key={`desk-${i}`} position={[x, 0.3, 1]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.5, 0.1, 1]} />
            <meshStandardMaterial color="#92400e" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.8, -0.3]}>
            <boxGeometry args={[0.8, 0.5, 0.05]} />
            <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Lanterns */}
      {[-4, 4].map((x, i) => (
        <group key={`lantern-${i}`} position={[x, 0.3, 3.8]}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 1.6, 8]} />
            <meshStandardMaterial color="#374151" metalness={0.5} />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1} />
          </mesh>
          <pointLight position={[0, 1.8, 0]} intensity={0.5} color="#fbbf24" distance={6} decay={2} />
        </group>
      ))}

      {/* Lights */}
      <pointLight position={[0, 4, 5]} intensity={1.2} color="#10b981" distance={15} decay={2} />
      <pointLight position={[0, 3, 0]} intensity={0.6} color="#fbbf24" distance={10} decay={2} />
      {/* Spotlight on bull */}
      <pointLight position={[6.5, 5, 8]} intensity={2} color="#fff8dc" distance={12} decay={2} />
    </group>
  );
}
