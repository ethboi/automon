'use client';

import * as THREE from 'three';
import { useMemo } from 'react';

interface GroundProps {
  size?: number;
  onClick?: (point: THREE.Vector3) => void;
}

export function Ground({ size = 80, onClick }: GroundProps) {
  const handleContextMenu = (event: { point: THREE.Vector3; stopPropagation: () => void; nativeEvent?: { preventDefault?: () => void } }) => {
    event.stopPropagation();
    event.nativeEvent?.preventDefault?.();
    if (onClick) onClick(event.point);
  };

  const trees = useMemo(() => [
    [-10, -10], [10, -10], [-10, 10], [10, 10],
    [-30, -25], [30, -25], [-30, 25], [30, 25],
    [-20, -5], [25, 5], [-5, -25], [5, 25],
    [15, -30], [-15, 28], [32, 0], [-32, -10],
    [-6, -30], [28, 24], [-28, -20], [12, 30],
    [-35, -15], [35, 10], [-8, 35], [8, -35],
    [-22, 18], [-26, 8], [-40, 18], [-12, 2],
    [22, -18], [18, 14], [2, 34], [38, -8],
  ], []);

  const streamSegments = useMemo(() => [
    { p: [-35.2, 0.02, -13.6], r: 0.35, w: 5.2 },
    { p: [-31.8, 0.02, -11.4], r: 0.5, w: 5.6 },
    { p: [-27.8, 0.02, -8.4], r: 0.38, w: 6.0 },
    { p: [-23.6, 0.02, -5.0], r: 0.6, w: 5.8 },
    { p: [-19.4, 0.02, -1.4], r: 0.34, w: 5.5 },
    { p: [-15.2, 0.02, 2.2], r: 0.52, w: 5.2 },
    { p: [-10.6, 0.02, 5.8], r: 0.36, w: 4.8 },
    { p: [-6.5, 0.02, 8.8], r: 0.48, w: 4.2 },
  ], []);

  const hillDomes = useMemo(() => [
    [-12, 0.15, -16, 3.2, 1.0, 0.85],
    [11, 0.18, -14, 3.6, 1.05, 0.82],
    [17, 0.12, 8, 2.8, 0.92, 0.9],
    [-17, 0.16, 9, 3.0, 1.1, 0.84],
    [-31, 0.1, 4, 2.6, 0.95, 0.8],
    [4, 0.1, 24, 2.4, 1.0, 0.86],
  ], []);

  const flowerPatches = useMemo(() => [
    { c: [-8, 5], col: ['#f59e0b', '#ef4444', '#fde047'] },
    { c: [11, 14], col: ['#f472b6', '#fb7185', '#facc15'] },
    { c: [-20, -12], col: ['#60a5fa', '#a78bfa', '#22c55e'] },
    { c: [24, 8], col: ['#eab308', '#fb7185', '#38bdf8'] },
    { c: [-14, 20], col: ['#f97316', '#84cc16', '#e879f9'] },
    { c: [6, -22], col: ['#f43f5e', '#f59e0b', '#93c5fd'] },
  ], []);

  const farmFencePosts = useMemo(() => {
    const posts: Array<[number, number, number]> = [];
    const centerX = -28;
    const centerZ = 0;
    const halfW = 6.5;
    const halfD = 6;

    for (let x = -halfW; x <= halfW; x += 1.6) {
      posts.push([centerX + x, 0.45, centerZ - halfD]);
      posts.push([centerX + x, 0.45, centerZ + halfD]);
    }
    for (let z = -halfD + 1.6; z <= halfD - 1.6; z += 1.6) {
      posts.push([centerX - halfW, 0.45, centerZ + z]);
      posts.push([centerX + halfW, 0.45, centerZ + z]);
    }

    return posts;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onContextMenu={handleContextMenu} onDoubleClick={handleContextMenu}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#3d8b37" roughness={0.85} />
      </mesh>

      {[
        [-8, 10, 5, '#4a9e42'], [5, -12, 4, '#358030'], [12, 8, 6, '#4a9e42'],
        [-10, -8, 4, '#2d7528'], [0, 15, 5, '#4a9e42'], [-15, 0, 4, '#358030'],
        [25, -5, 5, '#4a9e42'], [-25, 8, 4.5, '#358030'], [15, -20, 4, '#2d7528'],
        [-20, -15, 5, '#358030'], [28, 12, 4, '#4a9e42'], [-12, 22, 4.5, '#2d7528'],
        [8, 25, 4, '#358030'], [-28, -5, 5, '#4a9e42'], [20, -25, 4, '#2d7528'],
        [-35, 10, 6, '#358030'], [35, -15, 5, '#4a9e42'], [0, -35, 6, '#2d7528'],
        [40, 5, 5, '#358030'], [-40, -20, 6, '#4a9e42'],
      ].map(([x, z, r, color], i) => (
        <mesh key={`g-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x as number, 0.005, z as number]}>
          <circleGeometry args={[r as number, 16]} />
          <meshStandardMaterial color={color as string} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Subtle terrain undulation */}
      {hillDomes.map(([x, y, z, radius, sx, sz], i) => (
        <mesh key={`hill-dome-${i}`} position={[x as number, y as number, z as number]} scale={[sx as number, 1, sz as number]} receiveShadow>
          <sphereGeometry args={[radius as number, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#4e9a45' : '#45893f'} roughness={0.9} />
        </mesh>
      ))}

      {/* Water zones (Old Pond kept, River Delta removed) */}
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-36, 0.015, -14]}>
          <circleGeometry args={[6, 32]} />
          <meshStandardMaterial color="#3b7dd8" transparent opacity={0.75} roughness={0.1} metalness={0.3} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-36, 0.01, -14]}>
          <ringGeometry args={[5.7, 7.0, 32]} />
          <meshStandardMaterial color="#c4a265" transparent opacity={0.4} roughness={0.9} />
        </mesh>
      </group>

      {/* Winding stream from Old Pond toward south-east */}
      {streamSegments.map((seg, i) => (
        <group key={`stream-${i}`} position={seg.p as [number, number, number]} rotation={[-Math.PI / 2, seg.r, 0]}>
          <mesh>
            <planeGeometry args={[seg.w, 1.45]} />
            <meshStandardMaterial color="#60a5fa" transparent opacity={0.48} roughness={0.18} metalness={0.18} />
          </mesh>
          <mesh position={[0, -0.004, 0]}>
            <planeGeometry args={[seg.w + 0.5, 1.8]} />
            <meshStandardMaterial color="#bfdbfe" transparent opacity={0.18} roughness={0.7} />
          </mesh>
        </group>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-36, 0.008, 22]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#1e3a1e" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[32, 0.008, 24]}>
        <circleGeometry args={[6, 24]} />
        <meshStandardMaterial color="#2a1e3a" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-28, 0.008, 0]}>
        <circleGeometry args={[6, 24]} />
        <meshStandardMaterial color="#5a7a30" transparent opacity={0.5} />
      </mesh>

      {/* Diverse trees: pine, oak, shrub */}
      {trees.map(([x, z], i) => {
        const h = 1.9 + (i % 4) * 0.55;
        const treeType = i % 3;
        if (treeType === 0) {
          return (
            <group key={`pine-${i}`} position={[x, 0, z]}>
              <mesh position={[0, h * 0.38, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.25, h * 0.76, 6]} />
                <meshStandardMaterial color="#5b3821" roughness={0.9} />
              </mesh>
              <mesh position={[0, h * 0.9, 0]} castShadow>
                <coneGeometry args={[0.95 + (i % 2) * 0.22, h * 0.72, 8]} />
                <meshStandardMaterial color="#2f8b40" roughness={0.82} />
              </mesh>
              <mesh position={[0, h * 1.16, 0]} castShadow>
                <coneGeometry args={[0.62, h * 0.42, 7]} />
                <meshStandardMaterial color="#3aa34b" roughness={0.82} />
              </mesh>
            </group>
          );
        }

        if (treeType === 1) {
          return (
            <group key={`oak-${i}`} position={[x, 0, z]}>
              <mesh position={[0, h * 0.45, 0]} castShadow>
                <cylinderGeometry args={[0.19, 0.3, h * 0.9, 8]} />
                <meshStandardMaterial color="#6b4226" roughness={0.9} />
              </mesh>
              <mesh position={[0, h * 1.02, 0]} castShadow>
                <sphereGeometry args={[0.9 + (i % 2) * 0.2, 10, 9]} />
                <meshStandardMaterial color="#3f9c4d" roughness={0.8} />
              </mesh>
              <mesh position={[0.5, h * 0.98, 0.2]} castShadow>
                <sphereGeometry args={[0.52, 8, 8]} />
                <meshStandardMaterial color="#328a42" roughness={0.8} />
              </mesh>
            </group>
          );
        }

        return (
          <group key={`bush-${i}`} position={[x, 0, z]}>
            <mesh position={[0, 0.34, 0]} castShadow>
              <sphereGeometry args={[0.62 + (i % 2) * 0.14, 9, 8]} />
              <meshStandardMaterial color="#2f7f3a" roughness={0.84} />
            </mesh>
            <mesh position={[0.45, 0.26, -0.2]} castShadow>
              <sphereGeometry args={[0.42, 8, 7]} />
              <meshStandardMaterial color="#3a9345" roughness={0.84} />
            </mesh>
            <mesh position={[-0.4, 0.24, 0.2]} castShadow>
              <sphereGeometry args={[0.36, 8, 7]} />
              <meshStandardMaterial color="#2a7134" roughness={0.86} />
            </mesh>
          </group>
        );
      })}

      {/* Rocks with mossy variants */}
      {[
        [-6, -15, 0.55], [8, -20, 0.44], [-16, 5, 0.72], [14, 12, 0.38],
        [26, -8, 0.58], [-26, -12, 0.78], [0, -35, 0.52], [-10, 28, 0.63],
        [38, -3, 0.42], [-38, 18, 0.48], [45, 15, 0.52], [-45, -10, 0.62],
        [15, 40, 0.4], [-20, -40, 0.5], [-31, 20, 0.6], [34, 22, 0.54],
      ].map(([x, z, s], i) => (
        <group key={`r-${i}`} position={[x as number, (s as number) * 0.4, z as number]}>
          <mesh castShadow>
            <dodecahedronGeometry args={[s as number, 0]} />
            <meshStandardMaterial color={['#8a8e95', '#7a7e85', '#6a6e75'][i % 3]} roughness={0.85} />
          </mesh>
          {i % 3 === 0 && (
            <mesh position={[0.05, (s as number) * 0.2, 0.06]}>
              <sphereGeometry args={[(s as number) * 0.32, 8, 7]} />
              <meshStandardMaterial color="#4f7f4d" roughness={0.9} />
            </mesh>
          )}
        </group>
      ))}

      {/* Flower patches with clustered blooms */}
      {flowerPatches.map((patch, patchIndex) => (
        <group key={`patch-${patchIndex}`} position={[patch.c[0], 0, patch.c[1]]}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const ox = Math.cos(i * 0.9) * (0.25 + (i % 3) * 0.15);
            const oz = Math.sin(i * 0.9) * (0.2 + (i % 2) * 0.18);
            return (
              <group key={`fl-${patchIndex}-${i}`} position={[ox, 0, oz]}>
                <mesh position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.018, 0.025, 0.24, 5]} />
                  <meshStandardMaterial color="#3f7c3b" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.27, 0]}>
                  <sphereGeometry args={[0.08, 6, 6]} />
                  <meshStandardMaterial color={patch.col[i % patch.col.length]} roughness={0.65} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}

      {/* Mushrooms near Dark Forest */}
      {[
        [-38.5, 0, 18.8], [-34.8, 0, 20.6], [-40.1, 0, 23.7],
        [-35.2, 0, 25.1], [-32.7, 0, 22.9],
      ].map((m, i) => (
        <group key={`mush-${i}`} position={m as [number, number, number]}>
          <mesh position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 0.28, 6]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.3, 0]} castShadow>
            <coneGeometry args={[0.14 + (i % 2) * 0.03, 0.15, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#7c2d12' : '#991b1b'} roughness={0.65} />
          </mesh>
        </group>
      ))}

      {/* Farm perimeter fence posts + rails */}
      {farmFencePosts.map((post, i) => (
        <mesh key={`farm-post-${i}`} position={post} castShadow>
          <cylinderGeometry args={[0.08, 0.09, 0.9, 6]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.92} />
        </mesh>
      ))}
      {[
        [-28, 0.65, -6, 13, 0], [-28, 0.38, -6, 13, 0],
        [-28, 0.65, 6, 13, 0], [-28, 0.38, 6, 13, 0],
        [-34.5, 0.65, 0, 12, Math.PI / 2], [-34.5, 0.38, 0, 12, Math.PI / 2],
        [-21.5, 0.65, 0, 12, Math.PI / 2], [-21.5, 0.38, 0, 12, Math.PI / 2],
      ].map((rail, i) => (
        <mesh key={`farm-rail-${i}`} position={[rail[0], rail[1], rail[2]]} rotation={[0, rail[4], 0]}>
          <boxGeometry args={[rail[3], 0.08, 0.08]} />
          <meshStandardMaterial color="#7a4a24" roughness={0.9} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[size / 2 - 6, size / 2 + 2, 64]} />
        <meshStandardMaterial color="#90c090" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
