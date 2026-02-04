'use client';

import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BuildingProps {
  position: [number, number, number];
  size?: [number, number, number];
  color: string;
  hoverColor?: string;
  label: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function Building({
  position,
  size = [4, 3, 4],
  color,
  hoverColor,
  label,
  onClick,
  children,
}: BuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [scale, setScale] = useState(1);

  useFrame((_, delta) => {
    // Smooth scale animation on hover
    const targetScale = hovered ? 1.05 : 1;
    setScale((prev) => THREE.MathUtils.lerp(prev, targetScale, delta * 10));
  });

  const effectiveColor = hovered && hoverColor ? hoverColor : color;

  return (
    <group position={position}>
      {/* Main building body */}
      <mesh
        ref={meshRef}
        position={[0, size[1] / 2, 0]}
        scale={scale}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial color={effectiveColor} />
      </mesh>

      {/* Hover glow effect */}
      {hovered && (
        <mesh position={[0, size[1] / 2, 0]} scale={scale * 1.02}>
          <boxGeometry args={size} />
          <meshBasicMaterial color={effectiveColor} transparent opacity={0.3} />
        </mesh>
      )}

      {/* Floating label */}
      <Html
        position={[0, size[1] + 1.5, 0]}
        center
        distanceFactor={15}
        style={{
          pointerEvents: 'none',
        }}
      >
        <div
          className={`px-3 py-1 rounded-lg text-white text-sm font-bold whitespace-nowrap transition-all ${
            hovered ? 'bg-white/30 scale-110' : 'bg-black/50'
          }`}
        >
          {label}
        </div>
      </Html>

      {/* Custom children for building-specific decorations */}
      {children}
    </group>
  );
}
