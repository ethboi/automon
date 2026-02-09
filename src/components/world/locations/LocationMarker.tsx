'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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

export function LocationMarker({ position, label, icon, color, onClick, variant = 'nature' }: LocationMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      {/* Label */}
      <Html position={[0, 6, 0]} center>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          padding: '4px 10px',
          borderRadius: 8,
          border: `1px solid ${color}40`,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          cursor: onClick ? 'pointer' : 'default',
        }}>
          <div style={{ fontSize: 16 }}>{icon}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: '0.5px' }}>{label}</div>
        </div>
      </Html>

      {variant === 'building' && (
        <>
          {/* Main structure */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[3, 3, 3]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          {/* Roof */}
          <mesh position={[0, 3.5, 0]} castShadow>
            <coneGeometry args={[2.5, 1.5, 4]} />
            <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.7)} roughness={0.5} />
          </mesh>
          {/* Door */}
          <mesh position={[0, 0.8, 1.51]}>
            <planeGeometry args={[1, 1.6]} />
            <meshStandardMaterial color="#3a2a1a" />
          </mesh>
        </>
      )}

      {variant === 'nature' && (
        <>
          {/* Terrain mound */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <sphereGeometry args={[2.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* Vegetation */}
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
          {/* Water surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <circleGeometry args={[3, 32]} />
            <meshStandardMaterial color="#1e40af" transparent opacity={0.7} roughness={0.2} metalness={0.3} />
          </mesh>
          {/* Shore ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[2.8, 3.5, 32]} />
            <meshStandardMaterial color="#d4a574" roughness={0.9} />
          </mesh>
          {/* Reeds */}
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
          {/* Dead trees */}
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
          {/* Fog */}
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[3, 16, 16]} />
            <meshStandardMaterial color={color} transparent opacity={0.15} />
          </mesh>
        </>
      )}

      {/* Ground glow ring */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[3, 3.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
