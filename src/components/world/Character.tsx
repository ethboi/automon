'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CharacterProps {
  initialPosition?: [number, number, number];
  onPositionChange?: (position: THREE.Vector3) => void;
  targetPosition?: THREE.Vector3 | null;
  buildings?: Array<{ position: [number, number, number]; radius: number }>;
}

const SPEED = 8;
const COLLISION_PADDING = 1;

export function Character({
  initialPosition = [0, 0, 8],
  onPositionChange,
  targetPosition,
  buildings = [],
}: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [position, setPosition] = useState(new THREE.Vector3(...initialPosition));
  const [targetPos, setTargetPos] = useState<THREE.Vector3 | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (targetPosition) {
      setTargetPos(targetPosition.clone());
    }
  }, [targetPosition]);

  const checkCollision = (newPos: THREE.Vector3): boolean => {
    for (const building of buildings) {
      const buildingPos = new THREE.Vector3(...building.position);
      const distance = new THREE.Vector2(
        newPos.x - buildingPos.x,
        newPos.z - buildingPos.z
      ).length();
      if (distance < building.radius + COLLISION_PADDING) {
        return true;
      }
    }
    return false;
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const newVelocity = new THREE.Vector3(0, 0, 0);
    let hasKeyboardInput = false;

    const cameraAngle = Math.PI / 4;

    if (keys.current['w'] || keys.current['arrowup']) {
      newVelocity.x -= Math.sin(cameraAngle);
      newVelocity.z -= Math.cos(cameraAngle);
      hasKeyboardInput = true;
    }
    if (keys.current['s'] || keys.current['arrowdown']) {
      newVelocity.x += Math.sin(cameraAngle);
      newVelocity.z += Math.cos(cameraAngle);
      hasKeyboardInput = true;
    }
    if (keys.current['a'] || keys.current['arrowleft']) {
      newVelocity.x -= Math.cos(cameraAngle);
      newVelocity.z += Math.sin(cameraAngle);
      hasKeyboardInput = true;
    }
    if (keys.current['d'] || keys.current['arrowright']) {
      newVelocity.x += Math.cos(cameraAngle);
      newVelocity.z -= Math.sin(cameraAngle);
      hasKeyboardInput = true;
    }

    if (hasKeyboardInput) {
      setTargetPos(null);
    }

    if (targetPos && !hasKeyboardInput) {
      const direction = new THREE.Vector3()
        .subVectors(targetPos, position)
        .setY(0);
      const distance = direction.length();

      if (distance > 0.3) {
        direction.normalize();
        newVelocity.copy(direction);
      } else {
        setTargetPos(null);
      }
    }

    if (newVelocity.length() > 0) {
      newVelocity.normalize().multiplyScalar(SPEED);
      setIsMoving(true);
    } else {
      setIsMoving(false);
    }

    const newPosition = position.clone().add(newVelocity.clone().multiplyScalar(delta));

    const bounds = 65;
    newPosition.x = Math.max(-bounds, Math.min(bounds, newPosition.x));
    newPosition.z = Math.max(-bounds, Math.min(bounds, newPosition.z));

    if (!checkCollision(newPosition)) {
      setPosition(newPosition);
      groupRef.current.position.copy(newPosition);
      onPositionChange?.(newPosition);
    }

    if (newVelocity.length() > 0.1) {
      const targetRotation = Math.atan2(newVelocity.x, newVelocity.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation,
        delta * 10
      );
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
      {/* === Ash-style Human Trainer === */}

      {/* Legs — dark jeans */}
      <mesh position={[0.2, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.6, 4, 8]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.8} />
      </mesh>
      <mesh position={[-0.2, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.6, 4, 8]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.8} />
      </mesh>

      {/* Shoes */}
      <mesh position={[0.2, 0.1, 0.05]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.32]} />
        <meshStandardMaterial color="#dc2626" roughness={0.6} />
      </mesh>
      <mesh position={[-0.2, 0.1, 0.05]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.32]} />
        <meshStandardMaterial color="#dc2626" roughness={0.6} />
      </mesh>

      {/* Torso — blue jacket */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <capsuleGeometry args={[0.38, 0.7, 8, 16]} />
        <meshStandardMaterial color="#2563eb" roughness={0.5} />
      </mesh>

      {/* Jacket collar / white T-shirt peek */}
      <mesh position={[0, 1.55, 0.2]}>
        <boxGeometry args={[0.35, 0.12, 0.12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>

      {/* Arms — blue jacket sleeves */}
      <mesh position={[0.55, 1.3, 0]} rotation={[0, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.12, 0.55, 4, 8]} />
        <meshStandardMaterial color="#2563eb" roughness={0.5} />
      </mesh>
      <mesh position={[-0.55, 1.3, 0]} rotation={[0, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.12, 0.55, 4, 8]} />
        <meshStandardMaterial color="#2563eb" roughness={0.5} />
      </mesh>

      {/* Hands — skin tone */}
      <mesh position={[0.65, 0.95, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#f5d0a9" roughness={0.6} />
      </mesh>
      <mesh position={[-0.65, 0.95, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#f5d0a9" roughness={0.6} />
      </mesh>

      {/* Head — skin */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshStandardMaterial color="#f5d0a9" roughness={0.5} />
      </mesh>

      {/* Hair — dark spiky (visible under cap at sides/back) */}
      <mesh position={[0, 2.05, -0.15]}>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>
      {/* Spiky hair tufts poking out */}
      <mesh position={[0.25, 2.0, -0.25]} rotation={[0.3, 0.5, 0.3]}>
        <coneGeometry args={[0.08, 0.25, 4]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>
      <mesh position={[-0.25, 2.0, -0.25]} rotation={[0.3, -0.5, -0.3]}>
        <coneGeometry args={[0.08, 0.25, 4]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.14, 2.12, 0.3]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.14, 2.12, 0.3]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Pupils */}
      <mesh position={[0.14, 2.12, 0.37]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color="#3b1a08" />
      </mesh>
      <mesh position={[-0.14, 2.12, 0.37]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color="#3b1a08" />
      </mesh>

      {/* Red Cap — brim */}
      <mesh position={[0, 2.35, 0.15]} rotation={[-0.15, 0, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 16]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>
      {/* Cap dome */}
      <mesh position={[0, 2.45, -0.02]} castShadow>
        <sphereGeometry args={[0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>
      {/* Cap front white logo patch */}
      <mesh position={[0, 2.42, 0.25]}>
        <circleGeometry args={[0.1, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      {/* Cap brim visor (extended forward) */}
      <mesh position={[0, 2.32, 0.35]} rotation={[-0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.03, 0.25]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.5} />
      </mesh>

      {/* Backpack */}
      <mesh position={[0, 1.3, -0.35]} castShadow>
        <boxGeometry args={[0.45, 0.5, 0.25]} />
        <meshStandardMaterial color="#16a34a" roughness={0.6} />
      </mesh>
      {/* Backpack strap hint */}
      <mesh position={[0.2, 1.5, -0.15]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color="#15803d" roughness={0.7} />
      </mesh>
      <mesh position={[-0.2, 1.5, -0.15]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color="#15803d" roughness={0.7} />
      </mesh>

      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
