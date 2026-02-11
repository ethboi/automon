'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
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
    // Pulse ticker screen
    if (tickerRef.current) {
      const s = 1 + Math.sin(Date.now() * 0.003) * 0.015;
      tickerRef.current.scale.set(s, s, 1);
    }
    // Rotate coin slowly
    if (coinRef.current) {
      coinRef.current.rotation.y += delta * 0.4;
    }
    // Animate chart bars
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
      {/* Foundation — wide stone platform */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[10, 0.3, 8]} />
        <meshStandardMaterial color="#4b5563" roughness={0.9} />
      </mesh>
      {/* Steps */}
      <mesh position={[0, 0.05, 3.5]} receiveShadow>
        <boxGeometry args={[6, 0.1, 1.5]} />
        <meshStandardMaterial color="#6b7280" roughness={0.8} />
      </mesh>

      {/* Main building — tall exchange hall */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[9, 4.5, 6.5]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>

      {/* Pillars — 4 front columns */}
      {[-3.2, -1.1, 1.1, 3.2].map((x, i) => (
        <mesh key={`pillar-${i}`} position={[x, 2.5, 3.3]} castShadow>
          <cylinderGeometry args={[0.25, 0.3, 4.5, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} />
        </mesh>
      ))}

      {/* Roof / pediment */}
      <mesh position={[0, 5.0, 0]} castShadow>
        <boxGeometry args={[10, 0.4, 7.5]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      {/* Triangular pediment front */}
      <mesh position={[0, 5.6, 3.0]} castShadow rotation={[0, 0, 0]}>
        <coneGeometry args={[5.5, 1.5, 4]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>

      {/* === MAIN TICKER BOARD === */}
      {/* Ticker frame */}
      <mesh position={[0, 3.5, 3.35]}>
        <boxGeometry args={[7.5, 2.8, 0.1]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} />
      </mesh>
      {/* Ticker screen (green) */}
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

      {/* === nad.fun SIGN === */}
      {/* Sign board mounted above entrance */}
      <mesh position={[0, 5.1, 3.5]} castShadow>
        <boxGeometry args={[5, 1, 0.15]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.4} />
      </mesh>
      {/* Sign border */}
      <mesh position={[0, 5.1, 3.55]}>
        <boxGeometry args={[5.2, 1.2, 0.05]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* nad.fun text */}
      <Text
        position={[0, 5.1, 3.65]}
        fontSize={0.65}
        color="#fbbf24"
        font="/fonts/Inter-Bold.woff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        nad.fun
      </Text>

      {/* Side sign — "EXCHANGE" */}
      <mesh position={[4.55, 3, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[3, 0.8, 0.1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <Text
        position={[4.6, 3, 0]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.35}
        color="#10b981"
        anchorX="center"
        anchorY="middle"
      >
        EXCHANGE
      </Text>

      {/* === DECORATIVE ELEMENTS === */}

      {/* Large golden bull statue (stock exchange style) */}
      <group position={[3.5, 0.3, 4.5]}>
        {/* Bull body */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.2, 0.8, 0.6]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Bull head */}
        <mesh position={[0.6, 0.8, 0]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Horns */}
        <mesh position={[0.7, 1.1, -0.2]} rotation={[0, 0, 0.5]} castShadow>
          <coneGeometry args={[0.06, 0.4, 6]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0.7, 1.1, 0.2]} rotation={[0, 0, 0.5]} castShadow>
          <coneGeometry args={[0.06, 0.4, 6]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Legs */}
        {[[-0.4, 0, -0.2], [-0.4, 0, 0.2], [0.3, 0, -0.2], [0.3, 0, 0.2]].map((p, i) => (
          <mesh key={`leg-${i}`} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.12, 0.2, 0.12]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        {/* Pedestal */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[1.6, 0.1, 0.9]} />
          <meshStandardMaterial color="#374151" roughness={0.5} />
        </mesh>
      </group>

      {/* Floating rotating coin — large */}
      <group ref={coinRef} position={[-3.5, 5.5, 4]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.15, 24]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* $ emboss */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.02, 24]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Trading desks inside (visible through front) */}
      {[-2, 0, 2].map((x, i) => (
        <group key={`desk-${i}`} position={[x, 0.3, 1]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.5, 0.1, 1]} />
            <meshStandardMaterial color="#92400e" roughness={0.7} />
          </mesh>
          {/* Small screen on each desk */}
          <mesh position={[0, 0.8, -0.3]}>
            <boxGeometry args={[0.8, 0.5, 0.05]} />
            <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Lanterns flanking entrance */}
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
          <pointLight position={[x, 2, 3.8]} intensity={0.5} color="#fbbf24" distance={6} decay={2} />
        </group>
      ))}

      {/* Main green accent light */}
      <pointLight position={[0, 4, 5]} intensity={1.2} color="#10b981" distance={15} decay={2} />
      {/* Interior warm light */}
      <pointLight position={[0, 3, 0]} intensity={0.6} color="#fbbf24" distance={10} decay={2} />
    </group>
  );
}
