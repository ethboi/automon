'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface LocationMarkerProps {
  position: [number, number, number];
  label: string;
  icon: string;
  color: string;
  onClick?: () => void;
  variant?: 'building' | 'nature' | 'water' | 'dark';
}

export function LocationLabel({ icon, label, color }: { icon: string; label: string; color: string }) {
  const { size } = useThree();
  const isMobile = size.width < 768;

  return (
    <Html
      position={[0, isMobile ? 4.5 : 5.5, 0]}
      center
      distanceFactor={isMobile ? 12 : 18}
      style={{ pointerEvents: 'none' }}
    >
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        gap: isMobile ? 1 : 5,
        background: 'rgba(8, 12, 24, 0.9)',
        backdropFilter: 'blur(8px)',
        padding: isMobile ? '4px 8px' : '5px 12px',
        borderRadius: isMobile ? 8 : 10,
        border: `1px solid ${color}40`,
        boxShadow: `0 0 16px ${color}20, 0 2px 8px rgba(0,0,0,0.5)`,
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: isMobile ? 16 : 13 }}>{icon}</span>
        <span style={{
          fontSize: isMobile ? 9 : 11,
          fontWeight: 700,
          color: '#e2e8f0',
          letterSpacing: '0.3px',
          textShadow: `0 0 8px ${color}40`,
        }}>{label}</span>
      </div>
    </Html>
  );
}

export function LocationMarker({ position, label, icon, color, onClick, variant = 'nature' }: LocationMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.08);
    }
  });

  return (
    <group ref={groupRef} position={position} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      <LocationLabel icon={icon} label={label} color={color} />

      {variant === 'building' && (
        <>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[3, 3, 3]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0, 3.5, 0]} castShadow>
            <coneGeometry args={[2.5, 1.5, 4]} />
            <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.7)} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.8, 1.51]}>
            <planeGeometry args={[1, 1.6]} />
            <meshStandardMaterial color="#3a2a1a" />
          </mesh>
        </>
      )}

      {variant === 'nature' && (
        <>
          <mesh position={[0, 0.5, 0]} castShadow>
            <sphereGeometry args={[2.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {[-1, 0.5, 1.2].map((x, i) => (
            <group key={i} position={[x, 0, (i - 1) * 0.8]}>
              <mesh position={[0, 1.2, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.2, 1.5, 6]} />
                <meshStandardMaterial color="#5D4037" />
              </mesh>
              <mesh position={[0, 2.2, 0]} castShadow>
                <sphereGeometry args={[0.8, 8, 8]} />
                <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(1.2)} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {variant === 'water' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <circleGeometry args={[3, 32]} />
            <meshStandardMaterial color="#1e40af" transparent opacity={0.7} roughness={0.2} metalness={0.3} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[2.8, 3.5, 32]} />
            <meshStandardMaterial color="#d4a574" roughness={0.9} />
          </mesh>
          {[0, 1.5, -1.2].map((a, i) => (
            <mesh key={i} position={[Math.cos(a) * 2.5, 0.8, Math.sin(a) * 2.5]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 1.6, 4]} />
              <meshStandardMaterial color="#4a7c59" />
            </mesh>
          ))}
        </>
      )}

      {variant === 'dark' && (
        <>
          {[-1, 0.8, 0].map((x, i) => (
            <group key={i} position={[x, 0, (i - 1) * 1.2]}>
              <mesh position={[0, 1.5, 0]} castShadow>
                <cylinderGeometry args={[0.2, 0.3, 3, 6]} />
                <meshStandardMaterial color="#2d1f1f" />
              </mesh>
              <mesh position={[0.5, 2.5, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
                <cylinderGeometry args={[0.08, 0.12, 1.2, 4]} />
                <meshStandardMaterial color="#3d2b2b" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[3, 16, 16]} />
            <meshStandardMaterial color={color} transparent opacity={0.15} />
          </mesh>
        </>
      )}

      {/* Ground glow */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[3, 3.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
