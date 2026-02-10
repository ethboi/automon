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
      {/* === Ash-style Trainer – polished low-poly === */}

      {/* ── Feet / Shoes ── */}
      {/* Red high-top sneakers with white sole */}
      {[0.18, -0.18].map((x, i) => (
        <group key={`shoe-${i}`} position={[x, 0.12, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.16, 0.34]} />
            <meshStandardMaterial color="#dc2626" roughness={0.5} metalness={0.05} />
          </mesh>
          {/* sole */}
          <mesh position={[0, -0.07, 0]}>
            <boxGeometry args={[0.22, 0.04, 0.36]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
          </mesh>
          {/* lace accent */}
          <mesh position={[0, 0.06, 0.12]}>
            <boxGeometry args={[0.12, 0.04, 0.06]} />
            <meshStandardMaterial color="#fefefe" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* ── Legs ── */}
      {[0.18, -0.18].map((x, i) => (
        <group key={`leg-${i}`}>
          {/* Upper leg – dark denim */}
          <mesh position={[x, 0.6, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.45, 6, 10]} />
            <meshStandardMaterial color="#1e3a5f" roughness={0.85} />
          </mesh>
          {/* Knee seam */}
          <mesh position={[x, 0.42, 0.1]}>
            <boxGeometry args={[0.18, 0.03, 0.04]} />
            <meshStandardMaterial color="#162d4a" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Belt */}
      <mesh position={[0, 0.88, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.07, 12]} />
        <meshStandardMaterial color="#78350f" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Belt buckle */}
      <mesh position={[0, 0.88, 0.3]}>
        <boxGeometry args={[0.1, 0.08, 0.03]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* ── Torso ── */}
      {/* Blue jacket body */}
      <mesh position={[0, 1.22, 0]} castShadow>
        <capsuleGeometry args={[0.34, 0.55, 8, 16]} />
        <meshStandardMaterial color="#2563eb" roughness={0.45} />
      </mesh>
      {/* Jacket front zipper line */}
      <mesh position={[0, 1.22, 0.32]}>
        <boxGeometry args={[0.03, 0.55, 0.02]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.5} />
      </mesh>
      {/* White collar / T-shirt */}
      <mesh position={[0, 1.52, 0.18]}>
        <boxGeometry args={[0.28, 0.1, 0.14]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      {/* Jacket bottom hem */}
      <mesh position={[0, 0.92, 0]}>
        <cylinderGeometry args={[0.36, 0.34, 0.06, 12]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.5} />
      </mesh>

      {/* ── Arms ── */}
      {[
        { x: 0.52, rz: -0.2 },
        { x: -0.52, rz: 0.2 },
      ].map((arm, i) => (
        <group key={`arm-${i}`}>
          {/* Upper arm – jacket */}
          <mesh position={[arm.x, 1.3, 0]} rotation={[0, 0, arm.rz]} castShadow>
            <capsuleGeometry args={[0.11, 0.35, 6, 10]} />
            <meshStandardMaterial color="#2563eb" roughness={0.45} />
          </mesh>
          {/* Forearm – rolled sleeve showing skin */}
          <mesh position={[arm.x * 1.15, 1.0, 0]} rotation={[0, 0, arm.rz * 1.2]}>
            <capsuleGeometry args={[0.09, 0.25, 6, 10]} />
            <meshStandardMaterial color="#f0c28a" roughness={0.55} />
          </mesh>
          {/* Hand */}
          <mesh position={[arm.x * 1.2, 0.82, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color="#f0c28a" roughness={0.55} />
          </mesh>
        </group>
      ))}

      {/* ── Neck ── */}
      <mesh position={[0, 1.65, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.15, 8]} />
        <meshStandardMaterial color="#f0c28a" roughness={0.5} />
      </mesh>

      {/* ── Head ── */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshStandardMaterial color="#f0c28a" roughness={0.45} />
      </mesh>

      {/* ── Hair ── */}
      {/* Back hair mass */}
      <mesh position={[0, 1.92, -0.12]}>
        <sphereGeometry args={[0.36, 12, 12]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.95} />
      </mesh>
      {/* Side hair tufts */}
      {[
        { pos: [0.28, 1.85, -0.15], rot: [0.2, 0.6, 0.4] },
        { pos: [-0.28, 1.85, -0.15], rot: [0.2, -0.6, -0.4] },
        { pos: [0.15, 1.82, -0.28], rot: [0.5, 0.3, 0.2] },
        { pos: [-0.15, 1.82, -0.28], rot: [0.5, -0.3, -0.2] },
        { pos: [0, 1.8, -0.3], rot: [0.6, 0, 0] },
      ].map((tuft, i) => (
        <mesh key={`hair-${i}`} position={tuft.pos as [number, number, number]} rotation={tuft.rot as [number, number, number]}>
          <coneGeometry args={[0.07, 0.22, 4]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.95} />
        </mesh>
      ))}

      {/* ── Face ── */}
      {/* Eyes – big anime style */}
      {[0.12, -0.12].map((x, i) => (
        <group key={`eye-${i}`}>
          {/* White */}
          <mesh position={[x, 1.98, 0.27]}>
            <sphereGeometry args={[0.075, 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Iris */}
          <mesh position={[x, 1.98, 0.34]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshBasicMaterial color="#6b3410" />
          </mesh>
          {/* Pupil */}
          <mesh position={[x, 1.98, 0.37]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#0a0a0a" />
          </mesh>
          {/* Eye shine */}
          <mesh position={[x + 0.025, 2.0, 0.38]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}

      {/* Eyebrows */}
      {[0.12, -0.12].map((x, i) => (
        <mesh key={`brow-${i}`} position={[x, 2.07, 0.3]} rotation={[0, 0, i === 0 ? -0.1 : 0.1]}>
          <boxGeometry args={[0.1, 0.025, 0.02]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
        </mesh>
      ))}

      {/* Mouth – small confident smile */}
      <mesh position={[0, 1.88, 0.32]} rotation={[0.1, 0, 0]}>
        <torusGeometry args={[0.05, 0.012, 8, 12, Math.PI]} />
        <meshStandardMaterial color="#c2705a" roughness={0.7} />
      </mesh>

      {/* Nose hint */}
      <mesh position={[0, 1.93, 0.33]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#e6b07a" roughness={0.6} />
      </mesh>

      {/* ── Red Cap ── */}
      {/* Cap dome */}
      <mesh position={[0, 2.2, -0.02]} castShadow>
        <sphereGeometry args={[0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
        <meshStandardMaterial color="#dc2626" roughness={0.35} />
      </mesh>
      {/* Cap band */}
      <mesh position={[0, 2.15, 0]}>
        <cylinderGeometry args={[0.37, 0.37, 0.05, 16]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.4} />
      </mesh>
      {/* Visor brim */}
      <mesh position={[0, 2.14, 0.32]} rotation={[-0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.32, 0.025, 0.28]} />
        <meshStandardMaterial color="#991b1b" roughness={0.45} />
      </mesh>
      {/* White Pokéball-style logo on front */}
      <mesh position={[0, 2.25, 0.3]} rotation={[0.15, 0, 0]}>
        <circleGeometry args={[0.09, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.25, 0.305]} rotation={[0.15, 0, 0]}>
        <circleGeometry args={[0.045, 10]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>
      {/* Cap button on top */}
      <mesh position={[0, 2.38, -0.02]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#fefefe" roughness={0.5} />
      </mesh>

      {/* ── Backpack ── */}
      <mesh position={[0, 1.25, -0.38]} castShadow>
        <boxGeometry args={[0.42, 0.48, 0.22]} />
        <meshStandardMaterial color="#16a34a" roughness={0.55} />
      </mesh>
      {/* Backpack pocket */}
      <mesh position={[0, 1.12, -0.49]}>
        <boxGeometry args={[0.28, 0.2, 0.04]} />
        <meshStandardMaterial color="#15803d" roughness={0.6} />
      </mesh>
      {/* Backpack flap */}
      <mesh position={[0, 1.48, -0.42]}>
        <boxGeometry args={[0.38, 0.06, 0.2]} />
        <meshStandardMaterial color="#14532d" roughness={0.6} />
      </mesh>
      {/* Straps */}
      {[0.18, -0.18].map((x, i) => (
        <mesh key={`strap-${i}`} position={[x, 1.4, -0.2]} rotation={[0.15, 0, i === 0 ? -0.08 : 0.08]}>
          <boxGeometry args={[0.05, 0.4, 0.04]} />
          <meshStandardMaterial color="#15803d" roughness={0.65} />
        </mesh>
      ))}

      {/* ── Pokéball on belt ── */}
      <mesh position={[0.28, 0.88, 0.18]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0.28, 0.88, 0.24]}>
        <ringGeometry args={[0.02, 0.035, 8]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.5} />
      </mesh>

      {/* ── Shadow ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
