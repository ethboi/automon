'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface LocationMarkerProps {
  position: [number, number, number];
  label: string;
  icon: string;
  color: string;
  onClick?: () => void;
  variant?: 'building' | 'nature' | 'water' | 'dark' | 'farm';
}

export function LocationLabel({
  icon,
  label,
  color,
  clickable = false,
  hovered = false,
  hint = 'Click to interact',
}: {
  icon: string;
  label: string;
  color: string;
  clickable?: boolean;
  hovered?: boolean;
  hint?: string;
}) {
  const { size } = useThree();
  const isMobile = size.width < 768;

  return (
    <Html
      position={[0, isMobile ? 5 : 6, 0]}
      center
      distanceFactor={isMobile ? 10 : 14}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          background: hovered ? 'rgba(12, 18, 36, 0.98)' : 'rgba(8, 12, 24, 0.95)',
          backdropFilter: 'blur(12px)',
          padding: isMobile ? '6px 12px' : '7px 14px',
          borderRadius: 12,
          border: `1.5px solid ${hovered ? `${color}cc` : `${color}60`}`,
          boxShadow: hovered
            ? `0 0 28px ${color}66, 0 8px 20px rgba(0,0,0,0.65)`
            : `0 0 20px ${color}30, 0 4px 12px rgba(0,0,0,0.6)`,
          whiteSpace: 'nowrap',
          transform: hovered ? 'translateY(-1px) scale(1.03)' : 'translateY(0) scale(1)',
          transition: 'all 150ms ease',
        }}
      >
        <span style={{ fontSize: isMobile ? 18 : 16 }}>{icon}</span>
        <span
          style={{
            fontSize: isMobile ? 12 : 13,
            fontWeight: 700,
            color: '#f1f5f9',
            letterSpacing: '0.4px',
            textShadow: `0 0 10px ${color}50, 0 1px 3px rgba(0,0,0,0.8)`,
          }}
        >
          {label}
        </span>
        {clickable && (
          <span
            style={{
              fontSize: isMobile ? 10 : 11,
              fontWeight: 700,
              color: hovered ? '#ffffff' : '#cbd5e1',
              border: `1px solid ${hovered ? '#ffffff99' : '#94a3b855'}`,
              background: hovered ? '#ffffff22' : '#00000020',
              borderRadius: 999,
              padding: isMobile ? '2px 6px' : '2px 7px',
              letterSpacing: '0.2px',
              textTransform: 'uppercase',
            }}
          >
            {hovered ? hint : 'Clickable'}
          </span>
        )}
      </div>
    </Html>
  );
}

export function LocationMarker({ position, label, icon, color, onClick, variant = 'nature' }: LocationMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  // glowRef removed
  const waterRef = useRef<THREE.Mesh>(null);
  const orbRefs = useRef<(THREE.Mesh | null)[]>([]);
  const smokeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [hovered, setHovered] = useState(false);

  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < label.length; i += 1) {
      h = (h * 31 + label.charCodeAt(i)) >>> 0;
    }
    return h || 1;
  }, [label]);

  const rand = (n: number) => {
    const x = Math.sin(seed * 0.001 + n * 97.123) * 43758.5453;
    return x - Math.floor(x);
  };

  const isCrystalCave = /crystal/i.test(label);

  const buildingWidth = 2.4 + rand(1) * 0.8;
  const buildingDepth = 2.2 + rand(2) * 0.9;
  const foundationHeight = 0.55 + rand(3) * 0.2;
  const floorOneHeight = 1.7 + rand(4) * 0.5;
  const floorTwoHeight = 1.1 + rand(5) * 0.55;
  const roofHeight = 0.9 + rand(6) * 0.4;

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const buildingPrimary = useMemo(() => baseColor.clone().offsetHSL(0, -0.08, -0.04), [baseColor]);
  const buildingSecondary = useMemo(() => baseColor.clone().offsetHSL(0.02, -0.02, 0.12), [baseColor]);
  const roofColor = useMemo(() => baseColor.clone().offsetHSL(0.01, -0.12, -0.2), [baseColor]);

  useFrame((state) => {
    // glow pulse removed
    if (waterRef.current) {
      waterRef.current.position.y = 0.08 + Math.sin(state.clock.elapsedTime * 1.8) * 0.03;
      const mat = waterRef.current.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.opacity = 0.64 + Math.sin(state.clock.elapsedTime * 2.3) * 0.12;
      }
    }
    orbRefs.current.forEach((orb, i) => {
      if (!orb) return;
      orb.position.y = 0.9 + i * 0.25 + Math.sin(state.clock.elapsedTime * (1.2 + i * 0.3)) * 0.2;
      orb.scale.setScalar(0.85 + Math.sin(state.clock.elapsedTime * (2 + i * 0.8)) * 0.15);
    });
    smokeRefs.current.forEach((smoke, i) => {
      if (!smoke) return;
      const t = state.clock.elapsedTime * 0.75 + i * 0.9;
      smoke.position.y = 3.9 + i * 0.45 + Math.sin(t) * 0.25 + (t % 2.6) * 0.22;
      smoke.position.x = buildingWidth * 0.2 + Math.sin(t * 0.8) * 0.12;
      smoke.position.z = -buildingDepth * 0.12 + Math.cos(t * 0.7) * 0.1;
      smoke.scale.setScalar(0.7 + (i + 1) * 0.2 + Math.sin(t * 0.6) * 0.08);
      const mat = smoke.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.opacity = 0.26 + Math.sin(t * 0.9) * 0.05;
      }
    });
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (onClick) document.body.style.cursor = 'pointer';
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <LocationLabel
        icon={icon}
        label={label}
        color={color}
        clickable={!!onClick}
        hovered={hovered}
        hint={variant === 'building' ? 'Click to enter' : 'Click to inspect'}
      />

      {/* Invisible hitbox for reliable click detection */}
      <mesh visible={false}>
        <boxGeometry args={[10, 12, 10]} />
        <meshBasicMaterial />
      </mesh>

      {/* Interaction ring */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.2, hovered ? 4.15 : 3.9, 40]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.45 : 0.2} />
      </mesh>

      {variant === 'building' && (
        <>
          <mesh position={[0, foundationHeight / 2, 0]} castShadow>
            <boxGeometry args={[buildingWidth + 0.4, foundationHeight, buildingDepth + 0.4]} />
            <meshStandardMaterial color="#4b5563" roughness={0.95} />
          </mesh>

          <mesh position={[0, foundationHeight + floorOneHeight / 2, 0]} castShadow>
            <boxGeometry args={[buildingWidth, floorOneHeight, buildingDepth]} />
            <meshStandardMaterial color={buildingPrimary} roughness={0.62} />
          </mesh>
          <mesh position={[0, foundationHeight + floorOneHeight + floorTwoHeight / 2, 0]} castShadow>
            <boxGeometry args={[buildingWidth * 0.82, floorTwoHeight, buildingDepth * 0.82]} />
            <meshStandardMaterial color={buildingSecondary} roughness={0.58} />
          </mesh>

          <mesh
            position={[0, foundationHeight + floorOneHeight + floorTwoHeight + roofHeight / 2, 0]}
            castShadow
            rotation={[0, Math.PI / 4, 0]}
          >
            <coneGeometry args={[Math.max(buildingWidth, buildingDepth) * 0.46, roofHeight, 4]} />
            <meshStandardMaterial color={roofColor} roughness={0.55} />
          </mesh>
          <mesh
            position={[
              buildingWidth * 0.2,
              foundationHeight + floorOneHeight + floorTwoHeight + roofHeight * 0.9,
              -buildingDepth * 0.1,
            ]}
            castShadow
          >
            <boxGeometry args={[0.26, 0.6, 0.26]} />
            <meshStandardMaterial color="#6b7280" roughness={0.8} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh
              key={`smoke-${i}`}
              ref={(el) => {
                smokeRefs.current[i] = el;
              }}
              position={[buildingWidth * 0.2, 3.9 + i * 0.45, -buildingDepth * 0.12]}
            >
              <sphereGeometry args={[0.2 + i * 0.05, 8, 8]} />
              <meshStandardMaterial color="#d1d5db" transparent opacity={0.22} roughness={1} />
            </mesh>
          ))}

          <mesh position={[0, foundationHeight + 0.55, buildingDepth / 2 + 0.02]} castShadow>
            <boxGeometry args={[0.72, 1.1, 0.08]} />
            <meshStandardMaterial color="#3f2a1f" roughness={0.8} />
          </mesh>
          <mesh position={[0, foundationHeight + 0.62, buildingDepth / 2 - 0.02]} castShadow>
            <boxGeometry args={[0.9, 1.28, 0.06]} />
            <meshStandardMaterial color="#8b5e34" roughness={0.84} />
          </mesh>
          <mesh position={[0, foundationHeight + 1.28, buildingDepth / 2 + 0.26]} castShadow rotation={[0.08, 0, 0]}>
            <boxGeometry args={[1.14, 0.18, 0.52]} />
            <meshStandardMaterial color="#7c3f2c" roughness={0.76} />
          </mesh>

          {[-0.7, 0.7].map((x, i) => (
            <group key={`window-front-${i}`}>
              <mesh position={[x, foundationHeight + floorOneHeight * 0.66, buildingDepth / 2 - 0.06]} castShadow>
                <boxGeometry args={[0.38, 0.34, 0.1]} />
                <meshStandardMaterial color="#111827" roughness={0.3} metalness={0.05} />
              </mesh>
              <mesh position={[x, foundationHeight + floorOneHeight * 0.66, buildingDepth / 2 - 0.12]}>
                <boxGeometry args={[0.28, 0.24, 0.03]} />
                <meshStandardMaterial color={i === 0 ? '#60a5fa' : '#93c5fd'} roughness={0.25} metalness={0.08} />
              </mesh>
              <mesh position={[x, foundationHeight + floorOneHeight * 0.46, buildingDepth / 2 + 0.08]} castShadow>
                <boxGeometry args={[0.48, 0.12, 0.24]} />
                <meshStandardMaterial color="#7c3f2c" roughness={0.8} />
              </mesh>
              {[[-0.12, '#f472b6'], [0.03, '#22c55e'], [0.14, '#facc15']].map((f, j) => (
                <mesh key={`flower-box-${i}-${j}`} position={[x + (f[0] as number), foundationHeight + floorOneHeight * 0.55, buildingDepth / 2 + 0.18]}>
                  <sphereGeometry args={[0.05, 6, 6]} />
                  <meshStandardMaterial color={f[1] as string} roughness={0.55} />
                </mesh>
              ))}
            </group>
          ))}
          {[-0.45, 0.45].map((x, i) => (
            <group key={`window-top-${i}`}>
              <mesh
                position={[x, foundationHeight + floorOneHeight + floorTwoHeight * 0.55, (buildingDepth * 0.82) / 2 - 0.05]}
                castShadow
              >
                <boxGeometry args={[0.3, 0.28, 0.08]} />
                <meshStandardMaterial color="#0f172a" roughness={0.25} />
              </mesh>
              <mesh position={[x, foundationHeight + floorOneHeight + floorTwoHeight * 0.55, (buildingDepth * 0.82) / 2 - 0.1]}>
                <boxGeometry args={[0.22, 0.18, 0.02]} />
                <meshStandardMaterial color={i === 0 ? '#bfdbfe' : '#a5f3fc'} roughness={0.2} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((side, i) => (
            <mesh
              key={`window-side-${i}`}
              position={[side * (buildingWidth / 2 - 0.05), foundationHeight + floorOneHeight * 0.58, 0]}
              castShadow
            >
              <boxGeometry args={[0.08, 0.34, 0.38]} />
              <meshStandardMaterial color="#0b1120" roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.03, buildingDepth / 2 + 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.2, 0.5]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.92} />
          </mesh>
        </>
      )}

      {variant === 'nature' && (
        <>
          {[
            { p: [0, 0.5, 0], s: [1.2, 1, 1] },
            { p: [-1.4, 0.38, -0.8], s: [0.82, 0.72, 0.82] },
            { p: [1.2, 0.34, 1], s: [0.9, 0.68, 0.86] },
            { p: [0.9, 0.28, -1.3], s: [0.62, 0.56, 0.7] },
          ].map((hill, i) => (
            <mesh
              key={`hill-${i}`}
              position={hill.p as [number, number, number]}
              scale={hill.s as [number, number, number]}
              castShadow
            >
              <sphereGeometry args={[2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0.02 * i, -0.06, 0.08 - i * 0.04)} roughness={0.85} />
            </mesh>
          ))}

          {[[-0.9, -1.2], [0.05, -0.3], [0.85, 0.6], [1.45, 1.45]].map((segment, i) => (
            <mesh
              key={`path-${i}`}
              position={[segment[0], 0.08, segment[1]]}
              rotation={[-Math.PI / 2, 0.25 - i * 0.16, 0]}
            >
              <planeGeometry args={[1.35, 0.42]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#8b5e34' : '#9a6a3d'} roughness={0.97} />
            </mesh>
          ))}

          {[
            { p: [-1.3, 0.18, 0.8], c: '#f87171' },
            { p: [-0.2, 0.18, 1.35], c: '#fbbf24' },
            { p: [1.2, 0.18, -0.35], c: '#a78bfa' },
            { p: [0.35, 0.18, -1.2], c: '#f472b6' },
            { p: [1.45, 0.18, 1.1], c: '#34d399' },
          ].map((flower, i) => (
            <group key={`flower-${i}`} position={flower.p as [number, number, number]}>
              <mesh position={[0, 0.2, 0]} castShadow>
                <cylinderGeometry args={[0.03, 0.04, 0.4, 5]} />
                <meshStandardMaterial color="#3f7c3b" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.45, 0]} castShadow>
                <sphereGeometry args={[0.08, 7, 7]} />
                <meshStandardMaterial color={flower.c} roughness={0.45} />
              </mesh>
            </group>
          ))}

          <group position={[-1.7, 0.15, -1.05]}>
            <mesh position={[0, 0.2, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.05, 0.4, 6]} />
              <meshStandardMaterial color="#d6cdbf" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.44, 0]} castShadow>
              <coneGeometry args={[0.16, 0.16, 8]} />
              <meshStandardMaterial color="#ef4444" roughness={0.6} />
            </mesh>
          </group>
          <group position={[1.65, 1.15, -0.8]}>
            <mesh position={[-0.08, 0, 0]} rotation={[0.25, 0.4, 0]} castShadow>
              <sphereGeometry args={[0.08, 7, 7]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.5} />
            </mesh>
            <mesh position={[0.08, 0, 0]} rotation={[-0.25, -0.4, 0]} castShadow>
              <sphereGeometry args={[0.08, 7, 7]} />
              <meshStandardMaterial color="#60a5fa" roughness={0.5} />
            </mesh>
            <mesh castShadow>
              <cylinderGeometry args={[0.015, 0.02, 0.16, 4]} />
              <meshStandardMaterial color="#4338ca" roughness={0.7} />
            </mesh>
          </group>
        </>
      )}

      {variant === 'farm' && (
        <>
          {[-1.6, -0.8, 0, 0.8, 1.6].map((z, row) => (
            <group key={`row-${row}`} position={[0, 0, z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
                <planeGeometry args={[5.4, 0.6]} />
                <meshStandardMaterial color={row % 2 === 0 ? '#6b4b2a' : '#5a3f23'} roughness={0.95} />
              </mesh>
              {[-2, -1.3, -0.6, 0.15, 0.9, 1.55, 2.2].map((x, i) => (
                <group key={`sprout-${row}-${i}`} position={[x, 0.13, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.045, 0.06, 0.16, 6]} />
                    <meshStandardMaterial color={i % 2 === 0 ? '#4ade80' : '#22c55e'} roughness={0.75} />
                  </mesh>
                  <mesh position={[0, 0.1, 0]} castShadow>
                    <sphereGeometry args={[0.04, 6, 6]} />
                    <meshStandardMaterial color={i % 2 === 0 ? '#86efac' : '#4ade80'} roughness={0.65} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}

          <mesh position={[0.65, 1.25, -0.15]} castShadow>
            <boxGeometry args={[2.4, 2.3, 2]} />
            <meshStandardMaterial color="#b45309" roughness={0.76} />
          </mesh>
          <mesh position={[0.65, 2.65, -0.15]} castShadow rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[1.62, 1.3, 4]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.69} />
          </mesh>
          <mesh position={[0.65, 0.96, 0.88]} castShadow>
            <boxGeometry args={[0.84, 1.02, 0.08]} />
            <meshStandardMaterial color="#3f2a1f" roughness={0.8} />
          </mesh>

          <mesh position={[-1.5, 0.95, 0.8]} castShadow>
            <boxGeometry args={[1.6, 1.5, 1.4]} />
            <meshStandardMaterial color="#f1d6a0" roughness={0.7} />
          </mesh>
          <mesh position={[-1.5, 1.95, 0.8]} castShadow rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[1.15, 0.85, 4]} />
            <meshStandardMaterial color="#92400e" roughness={0.72} />
          </mesh>
          <mesh position={[-1.5, 0.7, 1.52]} castShadow>
            <boxGeometry args={[0.5, 0.76, 0.08]} />
            <meshStandardMaterial color="#6b4f36" roughness={0.78} />
          </mesh>

          <mesh position={[2.25, 0.52, 1.35]} castShadow>
            <boxGeometry args={[0.9, 0.72, 0.82]} />
            <meshStandardMaterial color="#d1a26e" roughness={0.82} />
          </mesh>
          <mesh position={[2.25, 1.0, 1.35]} castShadow rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.7, 0.45, 4]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.72} />
          </mesh>

          <mesh position={[1.8, 0.24, -1.35]} castShadow>
            <boxGeometry args={[1.0, 0.34, 0.44]} />
            <meshStandardMaterial color="#64748b" roughness={0.85} />
          </mesh>
          <mesh position={[1.8, 0.35, -1.35]}>
            <boxGeometry args={[0.84, 0.08, 0.3]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.75} roughness={0.2} />
          </mesh>

          <group position={[-0.2, 0, -1.8]}>
            <mesh position={[0, 0.68, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, 1.36, 6]} />
              <meshStandardMaterial color="#7a5732" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.05, 0]} castShadow rotation={[0, 0, 0.15]}>
              <boxGeometry args={[0.85, 0.08, 0.08]} />
              <meshStandardMaterial color="#7a5732" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.36, 0]} castShadow>
              <sphereGeometry args={[0.16, 8, 8]} />
              <meshStandardMaterial color="#f3d3a1" roughness={0.7} />
            </mesh>
            <mesh position={[0, 1.53, 0]} castShadow>
              <coneGeometry args={[0.24, 0.2, 7]} />
              <meshStandardMaterial color="#6b3b1f" roughness={0.82} />
            </mesh>
          </group>

          {[
            [0, 0.55, -2.55, 5.6, 0],
            [0, 0.32, -2.55, 5.6, 0],
            [0, 0.55, 2.55, 5.6, 0],
            [0, 0.32, 2.55, 5.6, 0],
            [-2.8, 0.55, 0, 5.1, Math.PI / 2],
            [-2.8, 0.32, 0, 5.1, Math.PI / 2],
            [2.8, 0.55, 0, 5.1, Math.PI / 2],
            [2.8, 0.32, 0, 5.1, Math.PI / 2],
          ].map((rail, i) => (
            <mesh key={`farm-rail-${i}`} position={[rail[0], rail[1], rail[2]]} rotation={[0, rail[4], 0]}>
              <boxGeometry args={[rail[3], 0.08, 0.08]} />
              <meshStandardMaterial color="#7a4a24" roughness={0.9} />
            </mesh>
          ))}
          {[
            [-2.8, -2.55], [-1.4, -2.55], [0, -2.55], [1.4, -2.55], [2.8, -2.55],
            [-2.8, 2.55], [-1.4, 2.55], [0, 2.55], [1.4, 2.55], [2.8, 2.55],
            [-2.8, -1.25], [-2.8, 0], [-2.8, 1.25], [2.8, -1.25], [2.8, 0], [2.8, 1.25],
          ].map((post, i) => (
            <mesh key={`farm-post-${i}`} position={[post[0], 0.42, post[1]]} castShadow>
              <cylinderGeometry args={[0.08, 0.09, 0.86, 6]} />
              <meshStandardMaterial color="#8b5a2b" roughness={0.92} />
            </mesh>
          ))}

          <mesh position={[-2.45, 1.7, -1.55]} castShadow>
            <cylinderGeometry args={[0.12, 0.18, 3.4, 8]} />
            <meshStandardMaterial color="#d1d5db" roughness={0.65} />
          </mesh>
          <mesh position={[-2.45, 3.45, -1.55]} castShadow>
            <coneGeometry args={[0.34, 0.5, 6]} />
            <meshStandardMaterial color="#9ca3af" roughness={0.65} />
          </mesh>
          {[0, Math.PI / 2].map((r, i) => (
            <mesh key={`blade-${i}`} position={[-2.45, 2.92, -1.55]} rotation={[0, 0, r]} castShadow>
              <boxGeometry args={[1.38, 0.16, 0.07]} />
              <meshStandardMaterial color="#f3f4f6" roughness={0.58} />
            </mesh>
          ))}
        </>
      )}

      {variant === 'water' && (
        <>
          {/* Large pond water surface */}
          <mesh ref={waterRef} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[5.5, 6, 0.12, 32]} />
            <meshStandardMaterial color="#1d4ed8" transparent opacity={0.75} roughness={0.1} metalness={0.4} />
          </mesh>
          {/* Deeper center */}
          <mesh position={[0.5, 0.03, -0.3]}>
            <cylinderGeometry args={[3, 3.5, 0.06, 24]} />
            <meshStandardMaterial color="#1e3a8a" transparent opacity={0.5} roughness={0.1} />
          </mesh>
          {/* Sandy/muddy bank */}
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[6.2, 6.5, 0.04, 32]} />
            <meshStandardMaterial color="#d4a574" roughness={0.95} />
          </mesh>
          {/* Grassy edge */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[6.8, 7, 0.03, 32]} />
            <meshStandardMaterial color="#4d7c3a" roughness={0.9} />
          </mesh>

          {/* Lily pads */}
          {[
            [-1.5, 0.13, 1.2], [0.8, 0.13, -1.0], [2.0, 0.13, 1.5],
            [-0.5, 0.13, -2.0], [-2.5, 0.13, -0.5], [1.2, 0.13, 2.8],
          ].map((pad, i) => (
            <group key={`pad-${i}`}>
              <mesh position={pad as [number, number, number]} rotation={[-Math.PI / 2, rand(i + 10), 0]}>
                <cylinderGeometry args={[0.35 + i * 0.05, 0.35 + i * 0.05, 0.02, 12]} />
                <meshStandardMaterial color={i % 3 === 0 ? '#2d8a4e' : i % 3 === 1 ? '#3f9f5f' : '#4ab06a'} roughness={0.8} />
              </mesh>
              {i % 2 === 0 && (
                <mesh position={[pad[0] + 0.1, pad[1] + 0.06, pad[2]]} rotation={[-0.2, rand(i) * 3, 0]}>
                  <coneGeometry args={[0.12, 0.2, 6]} />
                  <meshStandardMaterial color={i === 0 ? '#f472b6' : '#fbbf24'} />
                </mesh>
              )}
            </group>
          ))}

          {/* Wooden dock / pier */}
          {[0, 0.55, 1.1, 1.65, 2.2, 2.75, 3.3].map((z, i) => (
            <mesh key={`dock-${i}`} position={[4.5, 0.28, -1.8 + z]} castShadow>
              <boxGeometry args={[1.8, 0.1, 0.42]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#8b5a32' : '#7a4c28'} roughness={0.94} />
            </mesh>
          ))}
          {/* Dock support posts */}
          {[-1.8, -0.5, 0.8, 2.1, 3.3].map((z, i) => (
            <mesh key={`dock-post-${i}`} position={[4.0, -0.05, z]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 0.8, 6]} />
              <meshStandardMaterial color="#5f3d22" roughness={0.95} />
            </mesh>
          ))}
          {[-1.8, -0.5, 0.8, 2.1, 3.3].map((z, i) => (
            <mesh key={`dock-post-r-${i}`} position={[5.0, -0.05, z]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 0.8, 6]} />
              <meshStandardMaterial color="#5f3d22" roughness={0.95} />
            </mesh>
          ))}
          {/* Dock railing */}
          <mesh position={[5.2, 0.55, 0.75]} castShadow>
            <boxGeometry args={[0.08, 0.5, 5.4]} />
            <meshStandardMaterial color="#6b4423" roughness={0.9} />
          </mesh>

          {/* Fishing rod on dock */}
          <group position={[5.0, 0.35, 1.5]} rotation={[0.4, 0.3, -0.1]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.03, 0.05, 2.5, 6]} />
              <meshStandardMaterial color="#5c3d1e" roughness={0.9} />
            </mesh>
          </group>

          {/* Reeds around the pond */}
          {[
            [-4.5, 0, -2], [-4.8, 0, 0.5], [-5.0, 0, 2.5], [-3.5, 0, 3.8],
            [3.0, 0, -4.0], [1.5, 0, 4.5], [-1.0, 0, 4.8], [-3.0, 0, -4.5],
          ].map((reed, i) => (
            <group key={`reed-${i}`} position={reed as [number, number, number]}>
              {[0, 0.2, -0.2].map((offset, j) => (
                <mesh key={j} position={[offset * 0.5, 0.6, offset]} castShadow rotation={[0, 0, 0.06 - j * 0.04]}>
                  <cylinderGeometry args={[0.03, 0.04, 1.2 + j * 0.2, 5]} />
                  <meshStandardMaterial color="#3d7a36" roughness={0.85} />
                </mesh>
              ))}
              <mesh position={[0, 1.0, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 0.25, 5]} />
                <meshStandardMaterial color="#7c5b2b" roughness={0.88} />
              </mesh>
            </group>
          ))}

          {/* Rocks scattered around */}
          {[
            [-5.5, 0.15, -1.5], [-3.0, 0.12, 5.0], [4.5, 0.12, 3.5],
            [5.5, 0.14, -2.5], [-5.0, 0.13, 3.5], [2.0, 0.11, -5.0],
          ].map((rock, i) => (
            <mesh key={`rock-${i}`} position={rock as [number, number, number]} castShadow rotation={[0, rand(i) * 3, 0]}>
              <boxGeometry args={[0.6 + rand(i) * 0.4, 0.3 + rand(i) * 0.2, 0.5 + rand(i) * 0.3]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#6b7280' : '#4b5563'} roughness={0.95} />
            </mesh>
          ))}

          {/* Willow tree */}
          <group position={[-5.5, 0, 1.5]}>
            <mesh position={[0, 1.5, 0]} castShadow>
              <cylinderGeometry args={[0.25, 0.35, 3, 8]} />
              <meshStandardMaterial color="#4a3520" roughness={0.92} />
            </mesh>
            <mesh position={[0, 3.2, 0]} castShadow>
              <sphereGeometry args={[2, 12, 12]} />
              <meshStandardMaterial color="#2d6b30" transparent opacity={0.85} roughness={0.8} />
            </mesh>
            {/* Drooping branches */}
            {[0, 1, 2, 3, 4, 5].map((j) => {
              const a = (j / 6) * Math.PI * 2;
              return (
                <mesh key={`branch-${j}`} position={[Math.cos(a) * 1.5, 1.8, Math.sin(a) * 1.5]} rotation={[0.8, a, 0]}>
                  <cylinderGeometry args={[0.02, 0.01, 2.5, 4]} />
                  <meshStandardMaterial color="#3d8b40" transparent opacity={0.7} />
                </mesh>
              );
            })}
          </group>
        </>
      )}

      {variant === 'dark' && (
        <>
          {[
            [-1.3, 0, -1.1],
            [0.9, 0, -0.3],
            [0.1, 0, 1.25],
          ].map((tree, i) => (
            <group key={`tree-${i}`} position={tree as [number, number, number]}>
              <mesh position={[0, 2.05, 0]} castShadow rotation={[0.13, 0, 0.11 * (i - 1)]}>
                <cylinderGeometry args={[0.24, 0.42, 4.1, 7]} />
                <meshStandardMaterial color="#2a1a1a" roughness={0.92} />
              </mesh>
              <mesh position={[0.38, 3.35, 0.08]} rotation={[0.38, 0.1, Math.PI / 3]} castShadow>
                <cylinderGeometry args={[0.09, 0.15, 1.55, 5]} />
                <meshStandardMaterial color="#3b2525" roughness={0.9} />
              </mesh>
              <mesh position={[-0.33, 3.15, -0.1]} rotation={[-0.3, 0.25, -Math.PI / 3]} castShadow>
                <cylinderGeometry args={[0.08, 0.13, 1.25, 5]} />
                <meshStandardMaterial color="#3b2525" roughness={0.9} />
              </mesh>
              <mesh position={[0.05, 2.45, 0.05]} castShadow>
                <sphereGeometry args={[0.14, 7, 7]} />
                <meshStandardMaterial color="#1f1414" roughness={0.95} />
              </mesh>
              {[
                [-0.08, 2.62, 0.2, '#f59e0b'],
                [0.08, 2.62, 0.2, '#ef4444'],
              ].map((eye, eyeIdx) => (
                <mesh key={`eye-${i}-${eyeIdx}`} position={[eye[0] as number, eye[1] as number, eye[2] as number]}>
                  <sphereGeometry args={[0.045, 8, 8]} />
                  <meshStandardMaterial
                    color={eye[3] as string}
                    emissive={eye[3] as string}
                    emissiveIntensity={1.1}
                    transparent
                    opacity={0.9}
                  />
                </mesh>
              ))}
            </group>
          ))}

          {[
            [-0.4, 3.25, -0.75, 1.9, 0.32],
            [0.75, 3.0, 0.52, 2.1, -0.35],
            [0.05, 2.85, 1.1, 1.7, 0.1],
          ].map((web, i) => (
            <group key={`web-${i}`} position={[web[0], web[1], web[2]]} rotation={[0, web[4], 0]}>
              {[-0.28, -0.14, 0, 0.14, 0.28].map((offset, lineIdx) => (
                <mesh key={`web-line-h-${i}-${lineIdx}`} position={[0, offset, 0]}>
                  <boxGeometry args={[web[3], 0.01, 0.01]} />
                  <meshStandardMaterial color="#cbd5e1" transparent opacity={0.28} />
                </mesh>
              ))}
              {[-0.65, -0.32, 0, 0.32, 0.65].map((offset, lineIdx) => (
                <mesh key={`web-line-v-${i}-${lineIdx}`} position={[offset, 0, 0]}>
                  <boxGeometry args={[0.01, 0.62, 0.01]} />
                  <meshStandardMaterial color="#e2e8f0" transparent opacity={0.22} />
                </mesh>
              ))}
            </group>
          ))}

          {[
            [-1.65, 0.1, 0.9],
            [1.4, 0.1, -1.05],
            [0.45, 0.1, 1.85],
          ].map((mush, i) => (
            <group key={`glow-mush-${i}`} position={mush as [number, number, number]}>
              <mesh position={[0, 0.2, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
                <meshStandardMaterial color="#d4d4d8" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.46, 0]} castShadow>
                <coneGeometry args={[0.2, 0.22, 8]} />
                <meshStandardMaterial
                  color={isCrystalCave ? '#67e8f9' : '#a78bfa'}
                  emissive={isCrystalCave ? '#0891b2' : '#6d28d9'}
                  emissiveIntensity={0.8}
                  roughness={0.35}
                />
              </mesh>
            </group>
          ))}

          {[
            [-0.8, 1.0, -0.4],
            [1.2, 1.2, 0.9],
            [0.1, 1.3, -1.2],
          ].map((orb, i) => (
            <mesh
              key={`orb-${i}`}
              ref={(el) => {
                orbRefs.current[i] = el;
              }}
              position={orb as [number, number, number]}
            >
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial
                color={isCrystalCave ? '#7dd3fc' : '#c4b5fd'}
                emissive={isCrystalCave ? '#0284c7' : '#7c3aed'}
                emissiveIntensity={0.95}
                transparent
                opacity={0.8}
              />
            </mesh>
          ))}

          {isCrystalCave && (
            <>
              {[
                [-1.1, 0.55, 1.7, 0.42, 1.1],
                [1.5, 0.62, -0.9, 0.34, 1.25],
                [0.1, 0.48, -1.9, 0.3, 0.95],
                [1.9, 0.44, 1.2, 0.26, 0.82],
              ].map((cr, i) => (
                <mesh
                  key={`crystal-${i}`}
                  position={[cr[0], cr[1], cr[2]]}
                  rotation={[0, i * 0.6, 0.2 - i * 0.05]}
                  castShadow
                >
                  <coneGeometry args={[cr[3], cr[4], 5]} />
                  <meshStandardMaterial
                    color={i % 2 === 0 ? '#67e8f9' : '#22d3ee'}
                    emissive="#0891b2"
                    emissiveIntensity={0.65}
                    roughness={0.24}
                    metalness={0.15}
                  />
                </mesh>
              ))}
            </>
          )}
        </>
      )}

      {/* glow circle removed */}
    </group>
  );
}
