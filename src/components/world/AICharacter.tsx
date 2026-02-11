'use client';

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface AICharacterProps {
  address: string;
  name: string;
  targetPosition: { x: number; y: number; z: number };
  activity?: string | null;
  onClick?: (address: string) => void;
}

const SPEED = 6;
type AccessoryType = 'halo' | 'cape' | 'packs' | 'antenna' | 'orbs' | 'none';

function getActivityIndicator(activity?: string | null): { label: string; color: string } {
  const raw = (activity || '').toLowerCase();
  if (raw === 'came online') return { label: 'wandering', color: 'text-cyan-300 border-cyan-500/60' };
  if (!raw) return { label: 'idle', color: 'text-gray-300 border-gray-500/60' };
  // Strip " at <Location>" to avoid location names triggering wrong keywords
  const value = raw.replace(/\s+at\s+.+$/, '');
  if (value.includes('battle') || value.includes('arena') || value.includes('duel')) {
    return { label: 'battling', color: 'text-red-300 border-red-500/60' };
  }
  if (value.includes('fish') || value.includes('catch')) {
    return { label: 'fishing', color: 'text-sky-300 border-sky-500/60' };
  }
  if (value.includes('train')) {
    return { label: 'training', color: 'text-orange-300 border-orange-500/60' };
  }
  if (value.includes('trade') || value.includes('shop') || value.includes('market') || value.includes('buy') || value.includes('sell')) {
    return { label: 'trading', color: 'text-yellow-300 border-yellow-500/60' };
  }
  if (value.includes('rest') || value.includes('heal') || value.includes('sleep')) {
    return { label: 'resting', color: 'text-lime-300 border-lime-500/60' };
  }
  if (value.includes('explor')) {
    return { label: 'exploring', color: 'text-emerald-300 border-emerald-500/60' };
  }
  if (value.includes('heading') || value.includes('walking') || value.includes('wander') || value.includes('move')) {
    return { label: 'walking', color: 'text-cyan-300 border-cyan-500/60' };
  }
  // Show the raw activity (truncated) as-is
  return { label: raw.split(' at ')[0] || 'active', color: 'text-purple-200 border-purple-500/60' };
}

// Distinct robot color schemes per agent (deterministic from address)
const ROBOT_THEMES = [
  { body: '#dc2626', accent: '#f87171', glow: '#ff4444', eye: '#ff6666', name: 'red',    headShape: 'angular' as const },
  { body: '#2563eb', accent: '#60a5fa', glow: '#4488ff', eye: '#66aaff', name: 'blue',   headShape: 'round' as const },
  { body: '#16a34a', accent: '#4ade80', glow: '#44ff66', eye: '#66ff88', name: 'green',  headShape: 'flat' as const },
  { body: '#9333ea', accent: '#c084fc', glow: '#aa66ff', eye: '#cc88ff', name: 'purple', headShape: 'angular' as const },
  { body: '#ea580c', accent: '#fb923c', glow: '#ff8833', eye: '#ffaa55', name: 'orange', headShape: 'round' as const },
  { body: '#f5f5f5', accent: '#a3a3a3', glow: '#ffffff', eye: '#00ff88', name: 'white',  headShape: 'flat' as const },
];

function getTheme(address: string) {
  const a = address.toLowerCase();
  const v = parseInt(a[2], 16) * 256 + parseInt(a[5], 16) * 16 + parseInt(a[10], 16);
  return ROBOT_THEMES[v % ROBOT_THEMES.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const value = parseInt(cleaned, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getVisualProfile(address: string) {
  const a = address.toLowerCase();
  const hash = (
    parseInt(a[2], 16) * 17 +
    parseInt(a[6], 16) * 31 +
    parseInt(a[10], 16) * 13 +
    parseInt(a[14], 16) * 19
  );

  const accessories: AccessoryType[] = ['halo', 'cape', 'packs', 'antenna', 'orbs', 'none'];
  const scales: Array<[number, number, number]> = [
    [0.95, 0.95, 0.95],
    [1.05, 1.0, 1.05],
    [1.1, 0.95, 1.1],
    [0.9, 1.1, 0.9],
    [1.0, 1.08, 1.0],
    [1.15, 0.9, 1.15],
  ];

  return {
    theme: getTheme(address),
    accessory: accessories[hash % accessories.length],
    scale: scales[hash % scales.length],
    bob: 0.08 + (hash % 4) * 0.015,
    ringInner: 0.45 + (hash % 3) * 0.08,
    ringOuter: 0.72 + (hash % 3) * 0.1,
  };
}

export function AICharacter({ address, name, targetPosition, activity, onClick }: AICharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const [position, setPosition] = useState(new THREE.Vector3(targetPosition.x, 0, targetPosition.z));
  const [isMoving, setIsMoving] = useState(false);
  const profile = useMemo(() => getVisualProfile(address), [address]);
  const { theme } = profile;

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const target = new THREE.Vector3(targetPosition.x, 0, targetPosition.z);
    const direction = new THREE.Vector3().subVectors(target, position);
    const distance = direction.length();

    if (distance > 0.3) {
      direction.normalize();
      const newPosition = position.clone().add(direction.multiplyScalar(SPEED * delta));
      setPosition(newPosition);
      groupRef.current.position.copy(newPosition);
      setIsMoving(true);

      // Rotate towards movement direction
      const targetRotation = Math.atan2(direction.x, direction.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation,
        delta * 10
      );
    } else {
      setIsMoving(false);
    }

    // Bobbing animation when moving
    if (isMoving) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 12) * profile.bob;
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, delta * 5);
    }

    if (orbitRef.current) {
      orbitRef.current.rotation.y += delta * 1.8;
    }
  });

  const indicator = getActivityIndicator(activity);

  return (
    <group
      ref={groupRef}
      position={position.toArray()}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick?.(address);
      }}
    >
      {/* Name tag */}
      <Html position={[0, 3.5, 0]} center zIndexRange={[1, 0]}>
        <div
          className={`px-2.5 py-1 rounded text-xs whitespace-nowrap border ${indicator.color}`}
          style={{
            backgroundColor: hexToRgba(theme.body, 0.82),
            borderColor: hexToRgba(theme.glow, 0.5),
            boxShadow: `0 0 18px ${hexToRgba(theme.glow, 0.25)}`,
          }}
        >
          {name} • {indicator.label}
        </div>
      </Html>

      {/* === BODY — varies by headShape === */}
      <group scale={profile.scale}>
        {theme.headShape === 'angular' && (
          <group>
          {/* Bulky armored torso */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[1.2, 1.5, 0.8]} />
            <meshStandardMaterial color={theme.body} roughness={0.25} metalness={0.7} />
          </mesh>
          <mesh position={[0, 1.3, 0.41]}><boxGeometry args={[0.7, 0.9, 0.02]} /><meshStandardMaterial color={theme.accent} roughness={0.2} metalness={0.7} /></mesh>
          <mesh position={[0, 1.5, 0.43]}><boxGeometry args={[0.15, 0.15, 0.02]} /><meshBasicMaterial color={theme.glow} /></mesh>
          <mesh position={[0.2, 1.2, 0.43]}><boxGeometry args={[0.15, 0.15, 0.02]} /><meshBasicMaterial color={theme.glow} /></mesh>
          <mesh position={[-0.2, 1.2, 0.43]}><boxGeometry args={[0.15, 0.15, 0.02]} /><meshBasicMaterial color={theme.glow} /></mesh>
          {/* Angular head with horn crests */}
          <mesh position={[0, 2.4, 0]} castShadow><boxGeometry args={[0.85, 0.75, 0.7]} /><meshStandardMaterial color={theme.accent} roughness={0.2} metalness={0.7} /></mesh>
          <mesh position={[0.3, 2.9, -0.1]} rotation={[0.3, 0, 0.4]} castShadow><boxGeometry args={[0.12, 0.5, 0.12]} /><meshStandardMaterial color={theme.body} metalness={0.6} /></mesh>
          <mesh position={[-0.3, 2.9, -0.1]} rotation={[0.3, 0, -0.4]} castShadow><boxGeometry args={[0.12, 0.5, 0.12]} /><meshStandardMaterial color={theme.body} metalness={0.6} /></mesh>
          <mesh position={[0, 2.43, 0.36]}><boxGeometry args={[0.65, 0.22, 0.02]} /><meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} /></mesh>
          <mesh position={[0.18, 2.43, 0.38]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
          <mesh position={[-0.18, 2.43, 0.38]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
          {/* Heavy shoulder armor */}
          <mesh position={[0.7, 1.9, 0]} castShadow><boxGeometry args={[0.45, 0.3, 0.5]} /><meshStandardMaterial color={theme.accent} roughness={0.25} metalness={0.65} /></mesh>
          <mesh position={[-0.7, 1.9, 0]} castShadow><boxGeometry args={[0.45, 0.3, 0.5]} /><meshStandardMaterial color={theme.accent} roughness={0.25} metalness={0.65} /></mesh>
          {/* Thick arms */}
          <mesh position={[0.85, 1.25, 0]} rotation={[0, 0, -0.25]} castShadow><boxGeometry args={[0.28, 0.9, 0.28]} /><meshStandardMaterial color={theme.body} roughness={0.3} metalness={0.5} /></mesh>
          <mesh position={[-0.85, 1.25, 0]} rotation={[0, 0, 0.25]} castShadow><boxGeometry args={[0.28, 0.9, 0.28]} /><meshStandardMaterial color={theme.body} roughness={0.3} metalness={0.5} /></mesh>
          {/* Stompy legs */}
          <mesh position={[0.3, 0.35, 0]} castShadow><boxGeometry args={[0.32, 0.7, 0.32]} /><meshStandardMaterial color={theme.body} roughness={0.3} metalness={0.5} /></mesh>
          <mesh position={[-0.3, 0.35, 0]} castShadow><boxGeometry args={[0.32, 0.7, 0.32]} /><meshStandardMaterial color={theme.body} roughness={0.3} metalness={0.5} /></mesh>
          <mesh position={[0.3, 0.05, 0.05]} castShadow><boxGeometry args={[0.35, 0.1, 0.45]} /><meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} /></mesh>
          <mesh position={[-0.3, 0.05, 0.05]} castShadow><boxGeometry args={[0.35, 0.1, 0.45]} /><meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} /></mesh>
          </group>
        )}

        {theme.headShape === 'round' && (
          <group>
          {/* Sleek rounded torso */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <capsuleGeometry args={[0.45, 0.8, 4, 12]} />
            <meshStandardMaterial color={theme.body} roughness={0.2} metalness={0.65} />
          </mesh>
          <mesh position={[0, 1.45, 0.46]}><circleGeometry args={[0.12, 16]} /><meshBasicMaterial color={theme.glow} /></mesh>
          {/* Round dome head */}
          <mesh position={[0, 2.3, 0]} castShadow><sphereGeometry args={[0.5, 16, 12]} /><meshStandardMaterial color={theme.accent} roughness={0.15} metalness={0.7} /></mesh>
          {/* Single wide visor */}
          <mesh position={[0, 2.33, 0.42]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.25, 0.06, 8, 24, Math.PI]} />
            <meshStandardMaterial color="#111" roughness={0.05} metalness={0.95} />
          </mesh>
          <mesh position={[0, 2.33, 0.48]}><sphereGeometry args={[0.18, 12, 8]} /><meshBasicMaterial color={theme.eye} transparent opacity={0.8} /></mesh>
          {/* Antenna — single thin spike */}
          <mesh position={[0, 2.95, 0]}><cylinderGeometry args={[0.02, 0.02, 0.4, 6]} /><meshStandardMaterial color={theme.body} metalness={0.6} /></mesh>
          <mesh position={[0, 3.18, 0]}><sphereGeometry args={[0.06, 8, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
          {/* Slim arms */}
          <mesh position={[0.6, 1.3, 0]} rotation={[0, 0, -0.2]} castShadow><capsuleGeometry args={[0.1, 0.7, 4, 8]} /><meshStandardMaterial color={theme.body} roughness={0.25} metalness={0.5} /></mesh>
          <mesh position={[-0.6, 1.3, 0]} rotation={[0, 0, 0.2]} castShadow><capsuleGeometry args={[0.1, 0.7, 4, 8]} /><meshStandardMaterial color={theme.body} roughness={0.25} metalness={0.5} /></mesh>
          {/* Round knee joints visible */}
          <mesh position={[0.2, 0.55, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color={theme.accent} metalness={0.6} /></mesh>
          <mesh position={[-0.2, 0.55, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color={theme.accent} metalness={0.6} /></mesh>
          <mesh position={[0.2, 0.3, 0]} castShadow><capsuleGeometry args={[0.09, 0.4, 4, 8]} /><meshStandardMaterial color={theme.body} roughness={0.3} metalness={0.5} /></mesh>
          <mesh position={[-0.2, 0.3, 0]} castShadow><capsuleGeometry args={[0.09, 0.4, 4, 8]} /><meshStandardMaterial color={theme.body} roughness={0.3} metalness={0.5} /></mesh>
          <mesh position={[0.2, 0.05, 0.03]} castShadow><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} /></mesh>
          <mesh position={[-0.2, 0.05, 0.03]} castShadow><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} /></mesh>
          </group>
        )}

        {theme.headShape === 'flat' && (
          <group>
          {/* Wide flat industrial torso */}
          <mesh position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[1.1, 1.2, 0.65]} />
            <meshStandardMaterial color={theme.body} roughness={0.35} metalness={0.55} />
          </mesh>
          {/* Exposed chest vent */}
          <mesh position={[0, 1.35, 0.34]}><boxGeometry args={[0.5, 0.05, 0.02]} /><meshStandardMaterial color={theme.accent} metalness={0.7} /></mesh>
          <mesh position={[0, 1.25, 0.34]}><boxGeometry args={[0.5, 0.05, 0.02]} /><meshStandardMaterial color={theme.accent} metalness={0.7} /></mesh>
          <mesh position={[0, 1.15, 0.34]}><boxGeometry args={[0.5, 0.05, 0.02]} /><meshStandardMaterial color={theme.accent} metalness={0.7} /></mesh>
          <mesh position={[0, 1.45, 0.34]}><circleGeometry args={[0.08, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
          {/* Flat wide head — monitor style */}
          <mesh position={[0, 2.25, 0]} castShadow><boxGeometry args={[0.9, 0.55, 0.5]} /><meshStandardMaterial color={theme.accent} roughness={0.2} metalness={0.65} /></mesh>
          {/* Screen face */}
          <mesh position={[0, 2.28, 0.26]}><boxGeometry args={[0.7, 0.35, 0.02]} /><meshStandardMaterial color="#0a0a0a" roughness={0.05} metalness={0.9} /></mesh>
          {/* Two small rectangular eyes on screen */}
          <mesh position={[0.18, 2.3, 0.28]}><boxGeometry args={[0.15, 0.1, 0.01]} /><meshBasicMaterial color={theme.eye} /></mesh>
          <mesh position={[-0.18, 2.3, 0.28]}><boxGeometry args={[0.15, 0.1, 0.01]} /><meshBasicMaterial color={theme.eye} /></mesh>
          {/* Two antennae — rabbit ears */}
          <mesh position={[0.2, 2.72, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.4, 6]} /><meshStandardMaterial color={theme.body} metalness={0.5} /></mesh>
          <mesh position={[-0.2, 2.72, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.4, 6]} /><meshStandardMaterial color={theme.body} metalness={0.5} /></mesh>
          <mesh position={[0.2, 2.95, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
          <mesh position={[-0.2, 2.95, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
          {/* Boxy arms with claw hands */}
          <mesh position={[0.7, 1.3, 0]} rotation={[0, 0, -0.15]} castShadow><boxGeometry args={[0.2, 0.75, 0.2]} /><meshStandardMaterial color={theme.body} roughness={0.35} metalness={0.5} /></mesh>
          <mesh position={[-0.7, 1.3, 0]} rotation={[0, 0, 0.15]} castShadow><boxGeometry args={[0.2, 0.75, 0.2]} /><meshStandardMaterial color={theme.body} roughness={0.35} metalness={0.5} /></mesh>
          {/* Claw tips */}
          <mesh position={[0.7, 0.82, 0.08]}><boxGeometry args={[0.06, 0.15, 0.06]} /><meshStandardMaterial color={theme.accent} metalness={0.7} /></mesh>
          <mesh position={[0.7, 0.82, -0.08]}><boxGeometry args={[0.06, 0.15, 0.06]} /><meshStandardMaterial color={theme.accent} metalness={0.7} /></mesh>
          <mesh position={[-0.7, 0.82, 0.08]}><boxGeometry args={[0.06, 0.15, 0.06]} /><meshStandardMaterial color={theme.accent} metalness={0.7} /></mesh>
          <mesh position={[-0.7, 0.82, -0.08]}><boxGeometry args={[0.06, 0.15, 0.06]} /><meshStandardMaterial color={theme.accent} metalness={0.7} /></mesh>
          {/* Treaded legs */}
          <mesh position={[0.3, 0.3, 0]} castShadow><boxGeometry args={[0.25, 0.6, 0.3]} /><meshStandardMaterial color={theme.body} roughness={0.4} metalness={0.45} /></mesh>
          <mesh position={[-0.3, 0.3, 0]} castShadow><boxGeometry args={[0.25, 0.6, 0.3]} /><meshStandardMaterial color={theme.body} roughness={0.4} metalness={0.45} /></mesh>
          <mesh position={[0.3, 0.05, 0]} castShadow><boxGeometry args={[0.3, 0.1, 0.45]} /><meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} /></mesh>
          <mesh position={[-0.3, 0.05, 0]} castShadow><boxGeometry args={[0.3, 0.1, 0.45]} /><meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} /></mesh>
          </group>
        )}
      </group>

      {/* Distinct per-agent accessories */}
      {profile.accessory === 'halo' && (
        <mesh position={[0, 3.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.05, 10, 24]} />
          <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={0.55} metalness={0.7} roughness={0.25} />
        </mesh>
      )}
      {profile.accessory === 'cape' && (
        <mesh position={[0, 1.45, -0.42]} rotation={[0.15, 0, 0]}>
          <planeGeometry args={[0.9, 1.2]} />
          <meshStandardMaterial color={theme.accent} roughness={0.8} metalness={0.1} side={THREE.DoubleSide} />
        </mesh>
      )}
      {profile.accessory === 'packs' && (
        <>
          <mesh position={[0.45, 1.25, -0.1]} castShadow>
            <boxGeometry args={[0.22, 0.5, 0.22]} />
            <meshStandardMaterial color={theme.accent} roughness={0.35} metalness={0.45} />
          </mesh>
          <mesh position={[-0.45, 1.25, -0.1]} castShadow>
            <boxGeometry args={[0.22, 0.5, 0.22]} />
            <meshStandardMaterial color={theme.accent} roughness={0.35} metalness={0.45} />
          </mesh>
        </>
      )}
      {profile.accessory === 'antenna' && (
        <>
          <mesh position={[0.28, 3.15, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.42, 6]} />
            <meshStandardMaterial color={theme.body} metalness={0.55} />
          </mesh>
          <mesh position={[-0.28, 3.15, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.42, 6]} />
            <meshStandardMaterial color={theme.body} metalness={0.55} />
          </mesh>
          <mesh position={[0.28, 3.41, 0]}><sphereGeometry args={[0.055, 8, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
          <mesh position={[-0.28, 3.41, 0]}><sphereGeometry args={[0.055, 8, 8]} /><meshBasicMaterial color={theme.glow} /></mesh>
        </>
      )}
      {profile.accessory === 'orbs' && (
        <group ref={orbitRef} position={[0, 1.9, 0]}>
          {[0, 1, 2].map((i) => {
            const angle = (Math.PI * 2 * i) / 3;
            return (
              <mesh key={`orb-${i}`} position={[Math.cos(angle) * 0.75, 0.12 * (i % 2), Math.sin(angle) * 0.75]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color={theme.glow} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Glow ring at feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[profile.ringInner, profile.ringOuter, 32]} />
        <meshBasicMaterial color={theme.glow} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.7, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
