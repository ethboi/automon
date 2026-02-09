'use client';

import { useRef, useState } from 'react';
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

function getActivityIndicator(activity?: string | null): { icon: string; label: string; color: string } {
  const value = (activity || '').toLowerCase();
  if (value === 'came online') return { icon: '🚶', label: 'wandering', color: 'text-cyan-300 border-cyan-500/60' };
  if (!value) return { icon: '💤', label: 'idle', color: 'text-gray-300 border-gray-500/60' };
  if (value.includes('battle') || value.includes('arena') || value.includes('duel')) {
    return { icon: '⚔️', label: 'battling', color: 'text-red-300 border-red-500/60' };
  }
  if (value.includes('fish') || value.includes('catch')) {
    return { icon: '🎣', label: 'fishing', color: 'text-sky-300 border-sky-500/60' };
  }
  if (value.includes('train')) {
    return { icon: '🥊', label: 'training', color: 'text-orange-300 border-orange-500/60' };
  }
  if (value.includes('trade') || value.includes('shop') || value.includes('market')) {
    return { icon: '🛒', label: 'trading', color: 'text-yellow-300 border-yellow-500/60' };
  }
  if (value.includes('rest') || value.includes('heal') || value.includes('sleep')) {
    return { icon: '🛌', label: 'resting', color: 'text-lime-300 border-lime-500/60' };
  }
  if (value.includes('move') || value.includes('wander') || value.includes('explor') || value.includes('walk')) {
    return { icon: '🚶', label: 'wandering', color: 'text-cyan-300 border-cyan-500/60' };
  }
  return { icon: '🤖', label: activity || 'active', color: 'text-purple-200 border-purple-500/60' };
}

export function AICharacter({ address, name, targetPosition, activity, onClick }: AICharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [position, setPosition] = useState(new THREE.Vector3(targetPosition.x, 0, targetPosition.z));
  const [isMoving, setIsMoving] = useState(false);

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
          🤖 {name} • {indicator.icon} {indicator.label}
        </div>
      </Html>

      {/* Body - different color for AI */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <capsuleGeometry args={[0.6, 1.2, 8, 16]} />
        <meshStandardMaterial color="#06b6d4" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Eyes - glowing */}
      <mesh position={[0.18, 2.55, 0.38]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>
      <mesh position={[-0.18, 2.55, 0.38]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>

      {/* Pupils */}
      <mesh position={[0.18, 2.55, 0.48]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#0891b2" />
      </mesh>
      <mesh position={[-0.18, 2.55, 0.48]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#0891b2" />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, 3.1, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
        <meshStandardMaterial color="#06b6d4" />
      </mesh>
      <mesh position={[0, 3.35, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>

      {/* Arms */}
      <mesh position={[0.7, 1.3, 0]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
        <meshStandardMaterial color="#06b6d4" />
      </mesh>
      <mesh position={[-0.7, 1.3, 0]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
        <meshStandardMaterial color="#06b6d4" />
      </mesh>

      {/* Glow ring at feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.5, 0.8, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.7, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
