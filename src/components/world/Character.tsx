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

    const bounds = 18;
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
      {/* Body */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <capsuleGeometry args={[0.6, 1.2, 8, 16]} />
        <meshStandardMaterial color="#a855f7" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#c084fc" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.18, 2.55, 0.38]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.18, 2.55, 0.38]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Pupils */}
      <mesh position={[0.18, 2.55, 0.48]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#1f2937" />
      </mesh>
      <mesh position={[-0.18, 2.55, 0.48]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#1f2937" />
      </mesh>

      {/* Ears/Horns */}
      <mesh position={[0.35, 2.9, 0]} castShadow>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshStandardMaterial color="#7c3aed" />
      </mesh>
      <mesh position={[-0.35, 2.9, 0]} castShadow>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshStandardMaterial color="#7c3aed" />
      </mesh>

      {/* Arms */}
      <mesh position={[0.7, 1.3, 0]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
        <meshStandardMaterial color="#a855f7" />
      </mesh>
      <mesh position={[-0.7, 1.3, 0]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
        <meshStandardMaterial color="#a855f7" />
      </mesh>

      {/* Glow ring at feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.5, 0.8, 32]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.7, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
