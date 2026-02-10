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
  { body: '#dc2626', accent: '#f87171', glow: '#ff4444', eye: '#ff6666', name: 'red' },     // Red Mech
  { body: '#2563eb', accent: '#60a5fa', glow: '#4488ff', eye: '#66aaff', name: 'blue' },    // Blue Android
  { body: '#16a34a', accent: '#4ade80', glow: '#44ff66', eye: '#66ff88', name: 'green' },   // Green Bot
  { body: '#9333ea', accent: '#c084fc', glow: '#aa66ff', eye: '#cc88ff', name: 'purple' },  // Purple Droid
  { body: '#ea580c', accent: '#fb923c', glow: '#ff8833', eye: '#ffaa55', name: 'orange' },  // Orange Unit
  { body: '#0891b2', accent: '#22d3ee', glow: '#00ffff', eye: '#44ffff', name: 'cyan' },    // Cyan Classic
];

function getTheme(address: string) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  return ROBOT_THEMES[Math.abs(hash) % ROBOT_THEMES.length];
}

export function AICharacter({ address, name, targetPosition, activity, onClick }: AICharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [position, setPosition] = useState(new THREE.Vector3(targetPosition.x, 0, targetPosition.z));
  const [isMoving, setIsMoving] = useState(false);
  const theme = useMemo(() => getTheme(address), [address]);

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
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 12) * 0.1;
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, delta * 5);
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
      <Html position={[0, 3.5, 0]} center>
        <div className={`bg-purple-900/85 px-2.5 py-1 rounded text-xs whitespace-nowrap border border-purple-500/50 ${indicator.color}`}>
          {name} • {indicator.label}
        </div>
      </Html>

      {/* Torso — angular robot chest */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.0, 1.4, 0.7]} />
        <meshStandardMaterial color={theme.body} roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Chest plate accent */}
      <mesh position={[0, 1.3, 0.36]}>
        <boxGeometry args={[0.6, 0.8, 0.02]} />
        <meshStandardMaterial color={theme.accent} roughness={0.2} metalness={0.7} />
      </mesh>
      {/* Chest light */}
      <mesh position={[0, 1.4, 0.38]}>
        <circleGeometry args={[0.1, 8]} />
        <meshBasicMaterial color={theme.glow} />
      </mesh>

      {/* Head — angular android head */}
      <mesh position={[0, 2.35, 0]} castShadow>
        <boxGeometry args={[0.75, 0.7, 0.65]} />
        <meshStandardMaterial color={theme.accent} roughness={0.25} metalness={0.65} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 2.38, 0.33]}>
        <boxGeometry args={[0.55, 0.25, 0.02]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Eyes — glowing behind visor */}
      <mesh position={[0.15, 2.38, 0.35]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={theme.glow} />
      </mesh>
      <mesh position={[-0.15, 2.38, 0.35]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={theme.glow} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, 2.85, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 6]} />
        <meshStandardMaterial color={theme.body} metalness={0.5} />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color={theme.glow} />
      </mesh>

      {/* Shoulder pads */}
      <mesh position={[0.6, 1.85, 0]} castShadow>
        <boxGeometry args={[0.35, 0.2, 0.45]} />
        <meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[-0.6, 1.85, 0]} castShadow>
        <boxGeometry args={[0.35, 0.2, 0.45]} />
        <meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Arms — mechanical */}
      <mesh position={[0.75, 1.3, 0]} rotation={[0, 0, -0.3]} castShadow>
        <boxGeometry args={[0.22, 0.8, 0.22]} />
        <meshStandardMaterial color={theme.body} roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[-0.75, 1.3, 0]} rotation={[0, 0, 0.3]} castShadow>
        <boxGeometry args={[0.22, 0.8, 0.22]} />
        <meshStandardMaterial color={theme.body} roughness={0.35} metalness={0.5} />
      </mesh>

      {/* Legs — mechanical */}
      <mesh position={[0.25, 0.35, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.25]} />
        <meshStandardMaterial color={theme.body} roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[-0.25, 0.35, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.25]} />
        <meshStandardMaterial color={theme.body} roughness={0.35} metalness={0.5} />
      </mesh>
      {/* Feet */}
      <mesh position={[0.25, 0.05, 0.05]} castShadow>
        <boxGeometry args={[0.28, 0.1, 0.4]} />
        <meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[-0.25, 0.05, 0.05]} castShadow>
        <boxGeometry args={[0.28, 0.1, 0.4]} />
        <meshStandardMaterial color={theme.accent} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Glow ring at feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.5, 0.8, 32]} />
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
