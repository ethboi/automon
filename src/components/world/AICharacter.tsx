'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface AICharacterProps {
  address: string;
  name: string;
  targetPosition: { x: number; y: number; z: number };
}

const SPEED = 6;

export function AICharacter({ address, name, targetPosition }: AICharacterProps) {
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

  return (
    <group ref={groupRef} position={position.toArray()}>
      {/* Name tag */}
      <Html position={[0, 3.5, 0]} center>
        <div className="bg-purple-900/80 px-2 py-1 rounded text-xs text-purple-200 whitespace-nowrap border border-purple-500/50">
          🤖 {name}
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
