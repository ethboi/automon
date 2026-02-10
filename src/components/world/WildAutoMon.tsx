'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

const WILD_SPECIES = [
  { name: 'Emberfox', element: 'fire', bodyColor: '#ef4444', headColor: '#f87171', glowColor: '#ff6b6b', emoji: '🔥', level: 3 },
  { name: 'Aquafin', element: 'water', bodyColor: '#3b82f6', headColor: '#60a5fa', glowColor: '#4dabff', emoji: '💧', level: 4 },
  { name: 'Thornvine', element: 'earth', bodyColor: '#22c55e', headColor: '#4ade80', glowColor: '#50e879', emoji: '🌿', level: 2 },
  { name: 'Zephyrix', element: 'air', bodyColor: '#a3e635', headColor: '#d9f99d', glowColor: '#c8ff4d', emoji: '💨', level: 5 },
  { name: 'Shadewisp', element: 'dark', bodyColor: '#7c3aed', headColor: '#a78bfa', glowColor: '#9f7aea', emoji: '🌑', level: 6 },
  { name: 'Lumiflare', element: 'light', bodyColor: '#facc15', headColor: '#fde68a', glowColor: '#ffe066', emoji: '✨', level: 4 },
];

const SPAWN_ZONES: [number, number][] = [
  [50, 50], [55, -10], [45, -45], [-50, 50], [-55, -15], [-45, -45],
  [20, 55], [-20, 55], [35, -55], [-35, -55], [60, 25], [-60, 20],
];

const TAME_CHANCE = 0.10; // 10%
const TAME_HP_COST = 15;  // HP lost per attempt

interface WildCreatureProps {
  id: number;
  species: typeof WILD_SPECIES[number];
  spawnPosition: [number, number];
  onCreatureClick: (id: number) => void;
  playerPosition: THREE.Vector3 | null;
}

function WildCreature({ id, species, spawnPosition, onCreatureClick, playerPosition }: WildCreatureProps) {
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef(new THREE.Vector3(spawnPosition[0], 0, spawnPosition[1]));
  const targetRef = useRef(new THREE.Vector3(spawnPosition[0], 0, spawnPosition[1]));
  const wanderTimer = useRef(0);
  const [isMoving, setIsMoving] = useState(false);
  const [fleeing, setFleeing] = useState(false);
  const [nearby, setNearby] = useState(false);

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
      setNearby(distToPlayer < 6);

      if (distToPlayer < 2.5 && !fleeing) {
        setFleeing(true);
        const awayDir = new THREE.Vector2(pos.x - playerPosition.x, pos.z - playerPosition.z).normalize();
        targetRef.current.set(pos.x + awayDir.x * 15, 0, pos.z + awayDir.y * 15);
        setTimeout(() => setFleeing(false), 3000);
      }
    }

    wanderTimer.current -= delta;
    if (wanderTimer.current <= 0 && !fleeing) {
      pickNewTarget();
      wanderTimer.current = 4 + Math.random() * 6;
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
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, delta * 8);
    } else {
      setIsMoving(false);
    }

    if (isMoving) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 10) * 0.08;
    } else {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.04;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[spawnPosition[0], 0, spawnPosition[1]]}
    >
      {/* Invisible click hitbox — large and easy to click */}
      <mesh
        position={[0, 1, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onCreatureClick(id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <boxGeometry args={[2, 3, 2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {/* Name label */}
      <Html position={[0, 2.8, 0]} center>
        <div
          className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-all cursor-pointer ${
            nearby
              ? 'bg-black/80 border-amber-500/60 text-amber-300 scale-110'
              : 'bg-black/50 border-white/10 text-gray-400 scale-100'
          }`}
          style={{ transform: nearby ? 'scale(1.1)' : 'scale(1)' }}
        >
          {species.emoji} {species.name} <span className="text-gray-500">Lv.{species.level}</span>
        </div>
      </Html>

      {/* Body */}
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
      {/* Tail */}
      <mesh position={[0, 0.4, -0.4]} rotation={[0.5, 0, 0]} castShadow>
        <coneGeometry args={[0.15, 0.5, 6]} />
        <meshStandardMaterial color={species.bodyColor} />
      </mesh>
      {/* Ears */}
      <mesh position={[0.2, 1.85, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.08, 0.25, 4]} />
        <meshStandardMaterial color={species.headColor} />
      </mesh>
      <mesh position={[-0.2, 1.85, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.08, 0.25, 4]} />
        <meshStandardMaterial color={species.headColor} />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.3, 0.5, 16]} />
        <meshBasicMaterial color={species.glowColor} transparent opacity={nearby ? 0.5 : 0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.4, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

interface WildAutoMonsProps {
  playerPosition: THREE.Vector3 | null;
  walletAddress?: string;
}

type TameState = 
  | { phase: 'confirm'; creatureId: number; species: typeof WILD_SPECIES[number] }
  | { phase: 'attempting'; species: typeof WILD_SPECIES[number] }
  | { phase: 'result'; species: typeof WILD_SPECIES[number]; success: boolean; cardName?: string }
  | null;

export function WildAutoMons({ playerPosition, walletAddress }: WildAutoMonsProps) {
  const [creatures, setCreatures] = useState<Array<{ id: number; species: typeof WILD_SPECIES[number]; spawn: [number, number]; alive: boolean }>>([]);
  const [tameState, setTameState] = useState<TameState>(null);

  useEffect(() => {
    const spawned = SPAWN_ZONES.map((spawn, i) => ({
      id: i,
      species: WILD_SPECIES[i % WILD_SPECIES.length],
      spawn,
      alive: true,
    }));
    setCreatures(spawned);
  }, []);

  const handleCreatureClick = useCallback((id: number) => {
    if (tameState) return; // busy
    const creature = creatures.find(c => c.id === id && c.alive);
    if (!creature) return;

    setTameState({ phase: 'confirm', creatureId: id, species: creature.species });
  }, [tameState, creatures, playerPosition]);

  const handleTameAttempt = useCallback(async () => {
    if (!tameState || tameState.phase !== 'confirm') return;
    const { creatureId, species } = tameState;

    setTameState({ phase: 'attempting', species });

    // Simulate delay
    await new Promise(r => setTimeout(r, 1500));

    const success = Math.random() < TAME_CHANCE;

    let cardName = '';
    if (success && walletAddress) {
      try {
        const res = await fetch('/api/cards/tame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: walletAddress, speciesName: species.name }),
        });
        if (res.ok) {
          const data = await res.json();
          cardName = data.card?.name || species.name;
          setCreatures(prev => prev.map(c => c.id === creatureId ? { ...c, alive: false } : c));
        }
      } catch (err) {
        console.error('Tame API error:', err);
      }
    }

    setTameState({ phase: 'result', species, success, cardName });

    // Auto-dismiss after 3s
    setTimeout(() => setTameState(null), 3500);
  }, [tameState, walletAddress]);

  const handleCancel = useCallback(() => {
    setTameState(null);
  }, []);

  return (
    <>
      {creatures.filter(c => c.alive).map(c => (
        <WildCreature
          key={c.id}
          id={c.id}
          species={c.species}
          spawnPosition={c.spawn}
          onCreatureClick={handleCreatureClick}
          playerPosition={playerPosition}
        />
      ))}

      {/* Tame Dialog — rendered as HTML overlay via drei */}
      {tameState && (
        <Html position={[0, 30, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'auto' }}>
          <div className="fixed inset-0 flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
            {/* Backdrop */}
            {tameState.phase === 'confirm' && (
              <div className="absolute inset-0" onClick={handleCancel} />
            )}

            {/* Dialog */}
            <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl p-6 w-80 animate-scale-in">
              
              {/* Confirm Phase */}
              {tameState.phase === 'confirm' && (
                <>
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-2">{tameState.species.emoji}</div>
                    <h3 className="text-lg font-bold text-white">
                      Wild {tameState.species.name}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Level {tameState.species.level} • {tameState.species.element}
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Tame Chance</span>
                      <span className="text-amber-400 font-bold">10%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">HP Cost</span>
                      <span className="text-red-400 font-bold">-{TAME_HP_COST} ❤️</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 text-center mb-4">
                    Attempting to tame will cost health regardless of success
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-gray-300 text-sm font-medium hover:bg-white/15 transition-colors"
                    >
                      Walk Away
                    </button>
                    <button
                      onClick={handleTameAttempt}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition-all active:scale-95"
                    >
                      Tame! 🎯
                    </button>
                  </div>
                </>
              )}

              {/* Attempting Phase */}
              {tameState.phase === 'attempting' && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4 animate-bounce">{tameState.species.emoji}</div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                    <span className="text-white font-medium">Attempting to tame...</span>
                  </div>
                  <div className="text-xs text-red-400 mt-2">-{TAME_HP_COST} HP</div>
                </div>
              )}

              {/* Result Phase */}
              {tameState.phase === 'result' && (
                <div className="text-center py-4">
                  {tameState.success ? (
                    <>
                      <div className="text-5xl mb-3">🎉</div>
                      <h3 className="text-xl font-bold text-emerald-400 mb-2">Tamed!</h3>
                      <p className="text-sm text-gray-300">
                        {tameState.species.emoji} <span className="font-semibold">{tameState.cardName}</span> joined your collection!
                      </p>
                      <p className="text-xs text-gray-500 mt-2">Check your collection to see your new card</p>
                    </>
                  ) : (
                    <>
                      <div className="text-5xl mb-3">💨</div>
                      <h3 className="text-xl font-bold text-red-400 mb-2">Escaped!</h3>
                      <p className="text-sm text-gray-300">
                        {tameState.species.name} broke free and ran away!
                      </p>
                      <p className="text-xs text-red-400 mt-2">-{TAME_HP_COST} HP lost</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}
