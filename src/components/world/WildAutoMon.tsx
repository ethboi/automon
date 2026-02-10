'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

// Wild AutoMon species that roam the edges of the map
const WILD_SPECIES = [
  { name: 'Emberfox', element: 'fire', bodyColor: '#ef4444', headColor: '#f87171', glowColor: '#ff6b6b', emoji: '🔥' },
  { name: 'Aquafin', element: 'water', bodyColor: '#3b82f6', headColor: '#60a5fa', glowColor: '#4dabff', emoji: '💧' },
  { name: 'Thornvine', element: 'earth', bodyColor: '#22c55e', headColor: '#4ade80', glowColor: '#50e879', emoji: '🌿' },
  { name: 'Zephyrix', element: 'air', bodyColor: '#a3e635', headColor: '#d9f99d', glowColor: '#c8ff4d', emoji: '💨' },
  { name: 'Shadewisp', element: 'dark', bodyColor: '#7c3aed', headColor: '#a78bfa', glowColor: '#9f7aea', emoji: '🌑' },
  { name: 'Lumiflare', element: 'light', bodyColor: '#facc15', headColor: '#fde68a', glowColor: '#ffe066', emoji: '✨' },
];

// Spawn zones at map edges (radius ~55-65 from center on a 140-size map)
const SPAWN_ZONES: [number, number][] = [
  [50, 50], [55, -10], [45, -45], [-50, 50], [-55, -15], [-45, -45],
  [20, 55], [-20, 55], [35, -55], [-35, -55], [60, 25], [-60, 20],
];

interface WildAutoMonProps {
  id: number;
  species: typeof WILD_SPECIES[number];
  spawnPosition: [number, number];
  onTameAttempt: (id: number, species: string) => void;
  playerPosition: THREE.Vector3 | null;
}

function WildCreature({ id, species, spawnPosition, onTameAttempt, playerPosition }: WildAutoMonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef(new THREE.Vector3(spawnPosition[0], 0, spawnPosition[1]));
  const targetRef = useRef(new THREE.Vector3(spawnPosition[0], 0, spawnPosition[1]));
  const wanderTimer = useRef(0);
  const [isMoving, setIsMoving] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [fleeing, setFleeing] = useState(false);

  // Pick new wander target within ~15 units of spawn
  const pickNewTarget = useCallback(() => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 12;
    targetRef.current.set(
      spawnPosition[0] + Math.cos(angle) * dist,
      0,
      spawnPosition[1] + Math.sin(angle) * dist,
    );
  }, [spawnPosition]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const pos = posRef.current;
    const target = targetRef.current;

    // Check distance to player
    if (playerPosition) {
      const distToPlayer = new THREE.Vector2(
        pos.x - playerPosition.x,
        pos.z - playerPosition.z
      ).length();

      if (distToPlayer < 4) {
        setShowPrompt(true);
      } else {
        setShowPrompt(false);
      }

      // Flee if player gets very close and creature is wild
      if (distToPlayer < 2.5 && !fleeing) {
        setFleeing(true);
        const awayDir = new THREE.Vector2(pos.x - playerPosition.x, pos.z - playerPosition.z).normalize();
        targetRef.current.set(
          pos.x + awayDir.x * 15,
          0,
          pos.z + awayDir.y * 15,
        );
        setTimeout(() => setFleeing(false), 3000);
      }
    }

    // Wander AI
    wanderTimer.current -= delta;
    if (wanderTimer.current <= 0 && !fleeing) {
      pickNewTarget();
      wanderTimer.current = 4 + Math.random() * 6; // wander every 4-10s
    }

    const direction = new THREE.Vector3().subVectors(target, pos);
    const distance = direction.length();
    const speed = fleeing ? 8 : 3;

    if (distance > 0.5) {
      direction.normalize();
      pos.add(direction.multiplyScalar(speed * delta));
      groupRef.current.position.copy(pos);
      setIsMoving(true);

      const targetRotation = Math.atan2(direction.x, direction.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation,
        delta * 8
      );
    } else {
      setIsMoving(false);
    }

    // Bobbing
    if (isMoving) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 10) * 0.08;
    } else {
      // Idle breathing
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.04;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[spawnPosition[0], 0, spawnPosition[1]]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onTameAttempt(id, species.name);
      }}
    >
      {/* Label */}
      {showPrompt && (
        <Html position={[0, 3, 0]} center>
          <div className="bg-black/80 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border border-amber-500/60 text-amber-300 cursor-pointer hover:bg-amber-900/40 transition-colors"
               onClick={(e) => { e.stopPropagation(); onTameAttempt(id, species.name); }}>
            {species.emoji} Tame {species.name}
          </div>
        </Html>
      )}

      {/* Name when not showing prompt */}
      {!showPrompt && (
        <Html position={[0, 2.8, 0]} center>
          <div className="bg-black/60 px-2 py-0.5 rounded text-[10px] whitespace-nowrap text-gray-400">
            {species.emoji} {species.name}
          </div>
        </Html>
      )}

      {/* Smaller body than AI agents */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.7, 8, 12]} />
        <meshStandardMaterial color={species.bodyColor} roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial color={species.headColor} roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.12, 1.55, 0.28]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.12, 1.55, 0.28]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.12, 1.55, 0.34]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position={[-0.12, 1.55, 0.34]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#111111" />
      </mesh>

      {/* Element-specific tail/feature */}
      <mesh position={[0, 0.4, -0.4]} rotation={[0.5, 0, 0]} castShadow>
        <coneGeometry args={[0.15, 0.5, 6]} />
        <meshStandardMaterial color={species.bodyColor} />
      </mesh>

      {/* Glow at feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.3, 0.5, 16]} />
        <meshBasicMaterial color={species.glowColor} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.4, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

// Tame result toast
interface TameToastProps {
  species: string;
  success: boolean;
  onDone: () => void;
}

function TameToast({ species, success, onDone }: TameToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-sm font-medium border animate-fade-in-up ${
      success
        ? 'bg-emerald-900/90 border-emerald-500/60 text-emerald-300'
        : 'bg-red-900/90 border-red-500/60 text-red-300'
    }`}>
      {success
        ? `🎉 You tamed ${species}! Check your collection.`
        : `💨 ${species} broke free! (10% chance to tame)`
      }
    </div>
  );
}

interface WildAutoMonsProps {
  playerPosition: THREE.Vector3 | null;
  walletAddress?: string;
}

export function WildAutoMons({ playerPosition, walletAddress }: WildAutoMonsProps) {
  const [creatures, setCreatures] = useState<Array<{ id: number; species: typeof WILD_SPECIES[number]; spawn: [number, number]; alive: boolean }>>([]);
  const [toast, setToast] = useState<{ species: string; success: boolean } | null>(null);
  const [taming, setTaming] = useState(false);

  // Spawn creatures on mount
  useEffect(() => {
    const spawned = SPAWN_ZONES.map((spawn, i) => ({
      id: i,
      species: WILD_SPECIES[i % WILD_SPECIES.length],
      spawn,
      alive: true,
    }));
    setCreatures(spawned);
  }, []);

  const handleTameAttempt = useCallback(async (id: number, speciesName: string) => {
    if (taming) return;
    setTaming(true);

    // 10% chance to tame
    const success = Math.random() < 0.10;

    if (success && walletAddress) {
      // Call API to mint/add card to player
      try {
        await fetch('/api/cards/tame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: walletAddress, speciesName }),
        });
        // Remove creature from map
        setCreatures(prev => prev.map(c => c.id === id ? { ...c, alive: false } : c));
      } catch (err) {
        console.error('Tame API error:', err);
      }
    }

    setToast({ species: speciesName, success });
    setTimeout(() => setTaming(false), 2000);
  }, [taming, walletAddress]);

  return (
    <>
      {creatures.filter(c => c.alive).map(c => (
        <WildCreature
          key={c.id}
          id={c.id}
          species={c.species}
          spawnPosition={c.spawn}
          onTameAttempt={handleTameAttempt}
          playerPosition={playerPosition}
        />
      ))}

      {/* Toast overlay (rendered outside Canvas via portal would be ideal, but we use Html) */}
      {toast && (
        <Html position={[0, 20, 0]} center zIndexRange={[100, 0]}>
          <TameToast species={toast.species} success={toast.success} onDone={() => setToast(null)} />
        </Html>
      )}
    </>
  );
}
