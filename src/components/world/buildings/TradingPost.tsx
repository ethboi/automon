'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TradingPostProps {
  position: [number, number, number];
}

/** Trading Post — a market stall with a ticker board and coin stack */
export function TradingPost({ position }: TradingPostProps) {
  const tickerRef = useRef<THREE.Mesh>(null);
  const coinRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    // Slowly pulse the ticker screen
    if (tickerRef.current) {
      const s = 1 + Math.sin(Date.now() * 0.003) * 0.02;
      tickerRef.current.scale.set(s, s, 1);
    }
    // Rotate coins slowly
    if (coinRef.current) {
      coinRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* Base platform — stone slab */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[6, 0.2, 5]} />
        <meshStandardMaterial color="#6b7280" roughness={0.8} />
      </mesh>

      {/* Main booth — wooden frame */}
      <mesh position={[0, 1.5, -1]} castShadow>
        <boxGeometry args={[4.5, 2.5, 0.3]} />
        <meshStandardMaterial color="#92400e" roughness={0.7} />
      </mesh>

      {/* Counter / desk */}
      <mesh position={[0, 0.7, 0.5]} castShadow>
        <boxGeometry args={[4.5, 0.15, 2]} />
        <meshStandardMaterial color="#b45309" roughness={0.6} />
      </mesh>
      {/* Counter legs */}
      {[[-2, 0.35, 0.5], [2, 0.35, 0.5]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.2, 0.7, 0.2]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
      ))}

      {/* Ticker board (green screen) */}
      <mesh ref={tickerRef} position={[0, 2.2, -0.8]} castShadow>
        <boxGeometry args={[3.5, 1.2, 0.1]} />
        <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
      {/* Ticker frame */}
      <mesh position={[0, 2.2, -0.85]}>
        <boxGeometry args={[3.7, 1.4, 0.05]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} />
      </mesh>

      {/* Chart lines on ticker (3 small bars) */}
      {[
        { x: -0.8, h: 0.4, c: '#ef4444' },
        { x: -0.3, h: 0.6, c: '#10b981' },
        { x: 0.2, h: 0.35, c: '#10b981' },
        { x: 0.7, h: 0.8, c: '#10b981' },
      ].map((bar, i) => (
        <mesh key={i} position={[bar.x, 1.8 + bar.h / 2, -0.73]}>
          <boxGeometry args={[0.3, bar.h, 0.02]} />
          <meshStandardMaterial color={bar.c} emissive={bar.c} emissiveIntensity={0.6} />
        </mesh>
      ))}

      {/* Awning / canopy */}
      <mesh position={[0, 2.9, 0.2]} castShadow>
        <boxGeometry args={[5, 0.1, 3.5]} />
        <meshStandardMaterial color="#10b981" roughness={0.5} />
      </mesh>
      {/* Awning supports */}
      {[[-2.2, 1.5, 1.5], [2.2, 1.5, 1.5]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 2.8, 8]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
      ))}

      {/* Floating coin stack */}
      <group ref={coinRef} position={[2.5, 1.3, 0.5]}>
        {[0, 0.12, 0.24].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.1, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* Small "TRADE" sign on counter */}
      <mesh position={[-1.5, 1.1, 0.5]}>
        <boxGeometry args={[1.2, 0.4, 0.05]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Accent light — green glow */}
      <pointLight position={[0, 2.5, 0]} intensity={0.8} color="#10b981" distance={12} decay={2} />
    </group>
  );
}
