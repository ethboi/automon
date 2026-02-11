'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TradingPostProps {
  position: [number, number, number];
}

/* Build extruded 3D letter meshes from box primitives */
function Letter3D({ char, x, color, metalness = 0.8 }: { char: string; x: number; color: string; metalness?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.2 }), [color, metalness]);
  const h = 0.6; // letter height
  const d = 0.15; // depth
  const t = 0.12; // stroke thickness

  // Each letter built from boxes
  const boxes: [number, number, number, number, number, number][] = useMemo(() => {
    switch (char) {
      case 'n': return [
        [0, 0, t, h, d, 0], // left stroke
        [0.35, 0, t, h, d, 0], // right stroke
        [0.175, h / 2 - t / 2, 0.35, t, d, 0], // top bar
      ];
      case 'a': return [
        [0, 0, t, h, d, 0],
        [0.35, 0, t, h, d, 0],
        [0.175, h / 2 - t / 2, 0.35, t, d, 0], // top
        [0.175, 0, 0.35, t, d, 0], // middle
      ];
      case 'd': return [
        [0, 0, t, h, d, 0], // left
        [0.175, h / 2 - t / 2, 0.25, t, d, 0], // top
        [0.175, -(h / 2 - t / 2), 0.25, t, d, 0], // bottom
        [0.3, 0, t, h * 0.6, d, 0], // right curve approx
      ];
      case '.': return [
        [0, -(h / 2 - t / 2), t, t, d, 0],
      ];
      case 'f': return [
        [0, 0, t, h, d, 0],
        [0.15, h / 2 - t / 2, 0.3, t, d, 0], // top
        [0.1, 0, 0.2, t, d, 0], // middle
      ];
      case 'u': return [
        [0, 0, t, h, d, 0],
        [0.35, 0, t, h, d, 0],
        [0.175, -(h / 2 - t / 2), 0.35, t, d, 0], // bottom
      ];
      default: return [];
    }
  }, [char, h, d, t]);

  return (
    <group position={[x, 0, 0]}>
      {boxes.map(([bx, by, bw, bh, bd], i) => (
        <mesh key={i} position={[bx, by, 0]} castShadow material={mat}>
          <boxGeometry args={[bw, bh, bd]} />
        </mesh>
      ))}
    </group>
  );
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

      {/* === 3D "nad.fun" ON ROOFTOP — BIG === */}
      <group position={[-2.1, 6.2, 0]} rotation={[0, 0, 0]} scale={[1.8, 1.8, 1.8]}>
        {'nad.fun'.split('').map((char, i) => {
          const spacing = [0, 0.55, 1.1, 1.5, 1.75, 2.3, 2.85];
          return (
            <Letter3D
              key={i}
              char={char}
              x={spacing[i]}
              color="#fbbf24"
              metalness={0.9}
            />
          );
        })}
        <pointLight position={[1.4, 0, -0.5]} intensity={1.5} color="#fbbf24" distance={12} decay={2} />
      </group>

      {/* Sign backing board on roof */}
      <mesh position={[0, 6.3, 0]} castShadow>
        <boxGeometry args={[7, 2, 0.15]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.4} />
      </mesh>
      {/* Sign border - gold */}
      <mesh position={[0, 6.3, -0.03]}>
        <boxGeometry args={[7.3, 2.3, 0.05]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.3} />
      </mesh>

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

      {/* === GOLDEN BULL — BIG, AWAY FROM BUILDING === */}
      <group position={[6.5, 0.3, 7]} scale={[2.8, 2.8, 2.8]} rotation={[0, -0.4, 0]}>
        {/* Pedestal */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[2, 0.2, 1.2]} />
          <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Body */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[1.5, 1, 0.8]} />
          <meshStandardMaterial color="#ffd700" metalness={0.95} roughness={0.08} />
        </mesh>
        {/* Hump / shoulders */}
        <mesh position={[-0.3, 1.1, 0]} castShadow>
          <boxGeometry args={[0.7, 0.4, 0.7]} />
          <meshStandardMaterial color="#ffd700" metalness={0.95} roughness={0.08} />
        </mesh>
        {/* Head */}
        <mesh position={[0.8, 1.0, 0]} castShadow>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#ffd700" metalness={0.95} roughness={0.08} />
        </mesh>
        {/* Snout */}
        <mesh position={[1.15, 0.85, 0]} castShadow>
          <boxGeometry args={[0.3, 0.35, 0.45]} />
          <meshStandardMaterial color="#ffcc00" metalness={0.95} roughness={0.08} />
        </mesh>
        {/* Horns */}
        <mesh position={[0.85, 1.4, -0.3]} rotation={[-0.4, 0, 0.3]} castShadow>
          <coneGeometry args={[0.08, 0.5, 6]} />
          <meshStandardMaterial color="#ffcc00" metalness={0.95} roughness={0.05} />
        </mesh>
        <mesh position={[0.85, 1.4, 0.3]} rotation={[0.4, 0, 0.3]} castShadow>
          <coneGeometry args={[0.08, 0.5, 6]} />
          <meshStandardMaterial color="#ffcc00" metalness={0.95} roughness={0.05} />
        </mesh>
        {/* Legs — thick */}
        {[[-0.5, 0, -0.3], [-0.5, 0, 0.3], [0.4, 0, -0.3], [0.4, 0, 0.3]].map((p, i) => (
          <mesh key={`leg-${i}`} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.18, 0.4, 0.18]} />
            <meshStandardMaterial color="#ffcc00" metalness={0.95} roughness={0.08} />
          </mesh>
        ))}
        {/* Tail */}
        <mesh position={[-0.85, 0.9, 0]} rotation={[0, 0, -0.6]} castShadow>
          <cylinderGeometry args={[0.03, 0.05, 0.6, 6]} />
          <meshStandardMaterial color="#ffcc00" metalness={0.95} roughness={0.08} />
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
    </group>
  );
}
