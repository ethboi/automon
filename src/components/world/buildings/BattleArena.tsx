'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useState } from 'react';
import { LocationLabel } from '../locations/LocationMarker';

interface BattleArenaProps {
  position: [number, number, number];
  onClick?: () => void;
}

export function BattleArena({ position, onClick }: BattleArenaProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const orbsRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (ringRef.current) ringRef.current.rotation.y += delta * 0.4;
    if (innerRingRef.current) innerRingRef.current.rotation.y -= delta * 0.25;
    if (orbsRef.current) orbsRef.current.rotation.y += delta * 0.15;
  });

  const pillarCount = 12;
  const baseRadius = 10;
  const floorRadius = 9;

  return (
    <group position={position}>
      {/* Invisible hitbox for clicking */}
      <mesh visible={false} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <boxGeometry args={[24, 14, 24]} />
        <meshBasicMaterial />
      </mesh>

      {/* Outer stepped base */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <cylinderGeometry args={[baseRadius + 2, baseRadius + 2.5, 0.4, 12]} />
        <meshStandardMaterial color="#4a1010" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[baseRadius + 0.5, baseRadius + 1, 0.4, 12]} />
        <meshStandardMaterial color="#5c1515" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[baseRadius, baseRadius + 0.3, 0.3, 12]} />
        <meshStandardMaterial color={hovered ? '#ef4444' : '#7f1d1d'} roughness={0.8} />
      </mesh>

      {/* Arena floor */}
      <mesh position={[0, 0.96, 0]} receiveShadow>
        <cylinderGeometry args={[floorRadius, floorRadius, 0.05, 32]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.7} />
      </mesh>

      {/* Battle markings */}
      <mesh position={[0, 0.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.5, 6, 48]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3, 3.4, 48]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.7} />
      </mesh>
      {/* Center diamond */}
      <mesh position={[0, 0.99, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[1.2, 1.8, 4]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
      </mesh>
      {/* Cross lines */}
      {[0, Math.PI / 2].map((rot, i) => (
        <mesh key={`cross-${i}`} position={[0, 0.99, 0]} rotation={[-Math.PI / 2, 0, rot]}>
          <planeGeometry args={[0.15, floorRadius * 2]} />
          <meshBasicMaterial color="#dc2626" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Center glow platform */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.08, 16]} />
        <meshBasicMaterial color={hovered ? '#fbbf24' : '#f97316'} transparent opacity={0.9} />
      </mesh>

      {/* Pillars with torches */}
      {Array.from({ length: pillarCount }).map((_, i) => {
        const angle = (i * Math.PI * 2) / pillarCount;
        const x = Math.cos(angle) * (baseRadius - 0.5);
        const z = Math.sin(angle) * (baseRadius - 0.5);
        const pillarHeight = i % 2 === 0 ? 7 : 5.5;
        return (
          <group key={i}>
            {/* Pillar base */}
            <mesh position={[x, 0.9, z]} castShadow>
              <boxGeometry args={[1, 0.3, 1]} />
              <meshStandardMaterial color="#4a1010" roughness={0.9} />
            </mesh>
            {/* Pillar shaft */}
            <mesh position={[x, 0.9 + pillarHeight / 2, z]} castShadow>
              <boxGeometry args={[0.7, pillarHeight, 0.7]} />
              <meshStandardMaterial color="#7f1d1d" roughness={0.8} />
            </mesh>
            {/* Pillar capital */}
            <mesh position={[x, 0.9 + pillarHeight + 0.15, z]}>
              <boxGeometry args={[1, 0.3, 1]} />
              <meshStandardMaterial color="#991b1b" roughness={0.7} />
            </mesh>
            {/* Torch flame */}
            <mesh position={[x, 0.9 + pillarHeight + 0.6, z]}>
              <sphereGeometry args={[0.3, 12, 12]} />
              <meshBasicMaterial color="#f97316" />
            </mesh>
            {/* Flame glow */}
            <pointLight
              position={[x, 0.9 + pillarHeight + 0.6, z]}
              color="#f97316"
              intensity={0.8}
              distance={8}
            />
          </group>
        );
      })}

      {/* Archway gate (front, facing south) */}
      {[-1, 1].map((side) => (
        <mesh key={`gate-${side}`} position={[side * 3, 4.5, baseRadius - 0.5]} castShadow>
          <boxGeometry args={[1.2, 9, 1.2]} />
          <meshStandardMaterial color="#991b1b" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 8.8, baseRadius - 0.5]}>
        <boxGeometry args={[7.5, 1, 1.2]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.7} />
      </mesh>
      {/* Gate sign */}
      <mesh position={[0, 9.5, baseRadius - 0.3]}>
        <boxGeometry args={[5, 0.8, 0.3]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
      {/* 3D sign text */}
      <Text
        position={[0, 9.46, baseRadius - 0.12]}
        font="/fonts/GeistMonoVF.woff"
        fontSize={0.44}
        letterSpacing={0.04}
        anchorX="center"
        anchorY="middle"
        color="#2b1205"
        outlineWidth={0.015}
        outlineColor="#140700"
      >
        AUTOMON ARENA
      </Text>
      <Text
        position={[0, 9.58, baseRadius - 0.05]}
        font="/fonts/GeistMonoVF.woff"
        fontSize={0.44}
        letterSpacing={0.04}
        anchorX="center"
        anchorY="middle"
        color="#fde68a"
        outlineWidth={0.02}
        outlineColor="#7c2d12"
      >
        AUTOMON ARENA
      </Text>

      {/* Rotating outer ring */}
      <mesh ref={ringRef} position={[0, 5, 0]}>
        <torusGeometry args={[baseRadius + 1, 0.25, 8, 48]} />
        <meshStandardMaterial color="#ea580c" emissive="#ea580c" emissiveIntensity={0.4} />
      </mesh>

      {/* Rotating inner ring */}
      <mesh ref={innerRingRef} position={[0, 6, 0]}>
        <torusGeometry args={[7, 0.18, 8, 48]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} />
      </mesh>

      {/* Floating orbs */}
      <group ref={orbsRef}>
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
          <mesh key={`orb-${i}`} position={[Math.cos(angle) * 5, 7.5, Math.sin(angle) * 5]}>
            <sphereGeometry args={[0.45, 16, 16]} />
            <meshBasicMaterial color={['#ef4444', '#f97316', '#fbbf24', '#dc2626'][i]} />
          </mesh>
        ))}
      </group>

      {/* Hover glow */}
      {hovered && (
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[baseRadius + 2.5, baseRadius + 3, 1, 12]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.15} />
        </mesh>
      )}

      <LocationLabel
        icon="⚔️"
        label="Town Arena"
        color="#ef4444"
        clickable={!!onClick}
        hovered={hovered}
        hint="Click to enter"
      />
    </group>
  );
}
