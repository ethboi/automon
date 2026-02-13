'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { MapControls, Text } from '@react-three/drei';

import { Ground } from './Ground';
import { Character } from './Character';
import { AICharacter } from './AICharacter';
import { WorldUI } from './WorldUI';
import { LocationMarker } from './locations/LocationMarker';
import { BattleArena } from './buildings/BattleArena';
import { TradingPost } from './buildings/TradingPost';
import CrystalCaves from './buildings/CrystalCaves';
import DarkForest from './buildings/DarkForest';
import { WildAutoMons, TameDialog, WILD_SPECIES, SPAWN_ZONES, TAME_CHANCE, type TameState } from './WildAutoMon';
import AgentProfileModal from '@/components/AgentProfileModal';
import { useWallet } from '@/context/WalletContext';

interface OnlineAgent {
  address: string;
  name: string;
  personality: string;
  isAI: boolean;
  position: { x: number; y: number; z: number };
  online: boolean;
  currentAction?: string | null;
  currentReason?: string | null;
  currentLocation?: string | null;
  stats: { wins: number; losses: number; cards: number };
}

interface EventData {
  agent: string;
  action: string;
  reason: string;
  location: string | null;
  timestamp: string;
}

interface OnlinePlayer {
  address: string;
  name: string;
  lastSeen?: string;
}

export const WORLD_LOCATIONS = {
  starter_town:   { position: [0, 0, 0] as [number, number, number],      label: 'Home',    icon: '🏠', color: '#f59e0b', variant: 'none' as const, route: '/collection' },
  town_arena:     { position: [0, 0, -30] as [number, number, number],     label: 'Town Arena',      icon: '⚔️', color: '#ef4444', variant: 'building' as const, route: '/battle' },
  town_market:    { position: [28, 0, 0] as [number, number, number],      label: 'Shop',     icon: '🏪', color: '#f97316', variant: 'none' as const, route: '/shop', hideLabel: true },
  community_farm: { position: [-28, 0, 0] as [number, number, number],     label: 'Community Farm',  icon: '🌾', color: '#84cc16', variant: 'farm' as const,     route: '/locations/community-farm' },
  old_pond:       { position: [-36, 0, -14] as [number, number, number],   label: 'Old Pond',        icon: '🎣', color: '#3b82f6', variant: 'water' as const,    route: '/locations/old-pond' },
  dark_forest:    { position: [-36, 0, 22] as [number, number, number],    label: 'Dark Forest',     icon: '🌑', color: '#7c3aed', variant: 'none' as const,     route: '/locations/dark-forest' },
  crystal_caves:  { position: [32, 0, 24] as [number, number, number],  label: 'Crystal Caves',   icon: '💎', color: '#a78bfa', variant: 'none' as const,       route: '/locations/crystal-caves' },
  trading_post:   { position: [20, 0, -20] as [number, number, number],   label: 'Trading Post',    icon: '📈', color: '#10b981', variant: 'none' as const,       route: '/trading', hideLabel: true },
};

const INTERACTION_DISTANCE = 5;
type CameraMode = 'isometric' | 'shoulder';

function CameraController({
  flyTarget,
  cameraMode = 'isometric',
  playerPositionRef,
  moveTarget = null,
}: {
  flyTarget: THREE.Vector3 | null;
  cameraMode?: CameraMode;
  playerPositionRef?: React.MutableRefObject<THREE.Vector3 | null>;
  moveTarget?: THREE.Vector3 | null;
}) {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const flyingRef = useRef(false);
  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3(0, 0, -5));
  const shoulderForward = useRef(new THREE.Vector3(0, 0, -1));
  const prevPlayerPos = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (cameraMode === 'isometric') {
      const isMobile = size.width < 768;
      if (isMobile) {
        camera.position.set(0, 50, 40);
      } else {
        camera.position.set(0, 40, 45);
      }
      currentLookAt.current.set(0, 0, -5);
      camera.lookAt(0, 0, -5);
    }
    camera.updateProjectionMatrix();
  }, [camera, size.width, cameraMode]);

  // Start fly-to when target changes
  useEffect(() => {
    if (cameraMode !== 'isometric') return;
    if (!flyTarget) return;
    const isMobile = size.width < 768;
    const height = isMobile ? 35 : 30;
    const offsetZ = isMobile ? 25 : 22;
    targetPos.current.set(flyTarget.x, height, flyTarget.z + offsetZ);
    targetLookAt.current.copy(flyTarget);
    flyingRef.current = true;
  }, [flyTarget, size.width, cameraMode]);

  useFrame(() => {
    if (cameraMode === 'shoulder') {
      flyingRef.current = false;
      const playerPos = playerPositionRef?.current;
      if (!playerPos) return;

      // Primary follow direction: actual player movement vector
      if (!prevPlayerPos.current) {
        prevPlayerPos.current = playerPos.clone();
      } else {
        const moveDelta = new THREE.Vector3().subVectors(playerPos, prevPlayerPos.current);
        const moveDist = moveDelta.length();
        if (moveDist > 0.02) {
          moveDelta.y = 0;
          moveDelta.normalize();
          shoulderForward.current.lerp(moveDelta, 0.18);
        }
        prevPlayerPos.current.copy(playerPos);
      }

      // Fallback/anticipation: target direction while moving toward click target
      if (moveTarget) {
        const toTarget = new THREE.Vector3().subVectors(moveTarget, playerPos);
        if (toTarget.lengthSq() > 0.25) {
          toTarget.y = 0;
          toTarget.normalize();
          shoulderForward.current.lerp(toTarget, 0.08);
        }
      }

      const isMobile = size.width < 768;
      const shoulderDistance = isMobile ? 5.8 : 7.4;
      const shoulderHeight = isMobile ? 2.6 : 3.2;
      const lookAhead = isMobile ? 3.4 : 4.8;
      const sideOffset = isMobile ? 0.7 : 1.1;

      const right = new THREE.Vector3()
        .crossVectors(shoulderForward.current, new THREE.Vector3(0, 1, 0))
        .normalize();

      const desiredCameraPos = new THREE.Vector3()
        .copy(playerPos)
        .addScaledVector(shoulderForward.current, -shoulderDistance)
        .addScaledVector(right, sideOffset)
        .add(new THREE.Vector3(0, shoulderHeight, 0));
      const desiredLookAt = new THREE.Vector3()
        .copy(playerPos)
        .addScaledVector(shoulderForward.current, lookAhead)
        .add(new THREE.Vector3(0, 1.4, 0));

      camera.position.lerp(desiredCameraPos, 0.1);
      currentLookAt.current.lerp(desiredLookAt, 0.12);
      camera.lookAt(currentLookAt.current);
      return;
    }

    // Reset tracking when leaving shoulder mode.
    prevPlayerPos.current = null;

    if (!flyingRef.current) return;

    // Smoothly lerp camera position
    camera.position.lerp(targetPos.current, 0.04);
    currentLookAt.current.lerp(targetLookAt.current, 0.04);
    camera.lookAt(currentLookAt.current);

    // Update controls target to match
    if (controlsRef.current) {
      controlsRef.current.target.copy(currentLookAt.current);
    }

    // Stop when close enough
    if (camera.position.distanceTo(targetPos.current) < 0.5) {
      flyingRef.current = false;
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      enabled={cameraMode === 'isometric'}
      enableRotate={cameraMode === 'isometric'}
      enablePan={cameraMode === 'isometric'}
      enableZoom={cameraMode === 'isometric'}
      minDistance={15}
      maxDistance={100}
      maxPolarAngle={Math.PI / 2.5}
      minPolarAngle={Math.PI / 8}
      panSpeed={1.2}
      zoomSpeed={1.0}
      screenSpacePanning={false}
    />
  );
}

function Scene({
  onLocationClick,
  onGroundClick,
  onCameraFly,
  targetPosition,
  onCharacterMove,
  onlineAgents,
  cameraFlyTarget,
  onAgentClick,
  walletAddress,
  playerPositionRef,
  cameraMode,
  tameState,
  setTameState,
  wildCreatures,
  setWildCreatures,
}: {
  onLocationClick: (route: string) => void;
  onGroundClick: (point: THREE.Vector3) => void;
  onCameraFly: (point: THREE.Vector3) => void;
  targetPosition: THREE.Vector3 | null;
  onCharacterMove: (position: THREE.Vector3) => void;
  onlineAgents: OnlineAgent[];
  cameraFlyTarget: THREE.Vector3 | null;
  onAgentClick: (address: string) => void;
  walletAddress?: string;
  playerPositionRef: React.MutableRefObject<THREE.Vector3 | null>;
  cameraMode: CameraMode;
  tameState: TameState;
  setTameState: (s: TameState) => void;
  wildCreatures: Array<{ id: number; species: typeof WILD_SPECIES[number]; spawn: [number, number]; alive: boolean }>;
  setWildCreatures: React.Dispatch<React.SetStateAction<Array<{ id: number; species: typeof WILD_SPECIES[number]; spawn: [number, number]; alive: boolean }>>>;
}) {
  const buildingsArray = Object.values(WORLD_LOCATIONS).map((b) => ({
    position: b.position,
    radius: 4,
  }));

  return (
    <>
      <color attach="background" args={['#87CEEB']} />
      <CameraController
        flyTarget={cameraFlyTarget}
        cameraMode={cameraMode}
        playerPositionRef={playerPositionRef}
        moveTarget={targetPosition}
      />

      {/* Soft fog at edges */}
      <fog attach="fog" args={['#b8d8f0', 120, 220]} />

      {/* Sky dome */}
      <Sky />

      {/* Bright daylight lighting */}
      <ambientLight intensity={1.4} />
      <hemisphereLight args={['#87CEEB', '#4a7a3a', 0.8]} />
      {/* Sun */}
      <directionalLight
        position={[30, 40, 20]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      {/* Fill light */}
      <directionalLight position={[-20, 20, -15]} intensity={0.5} color="#ffe4b5" />
      {/* Warm sun glow from top-right */}
      <pointLight position={[62, 58, 28]} intensity={0.65} color="#ffd08a" distance={220} decay={1.6} />
      {/* Subtle location accent lights */}
      <pointLight position={[0, 4, -30]} intensity={0.6} color="#ef4444" distance={20} />
      <pointLight position={[-28, 4, 0]} intensity={0.5} color="#84cc16" distance={20} />
      <pointLight position={[32, 4, 24]} intensity={0.5} color="#a78bfa" distance={20} />

      <Ground size={140} onClick={onGroundClick} />

      <BattleArena
        position={WORLD_LOCATIONS.town_arena.position}
        onClick={() => onLocationClick(WORLD_LOCATIONS.town_arena.route!)}
      />
      <TradingPost position={WORLD_LOCATIONS.trading_post.position} />
      <group position={WORLD_LOCATIONS.crystal_caves.position}>
        <CrystalCaves />
      </group>
      <group position={WORLD_LOCATIONS.dark_forest.position}>
        <DarkForest />
      </group>

      {Object.entries(WORLD_LOCATIONS)
        .filter(([key]) => key !== 'town_arena')
        .map(([key, loc]) => (
          <LocationMarker
            key={key}
            position={loc.position}
            label={loc.label}
            icon={loc.icon}
            color={loc.color}
            variant={loc.variant}
            hideLabel={'hideLabel' in loc && !!loc.hideLabel}
            onClick={() => {
              // Fly camera to this location
              onCameraFly(new THREE.Vector3(...loc.position));
              // If it has a route, navigate after a brief delay
              if (loc.route) {
                setTimeout(() => onLocationClick(loc.route!), 800);
              }
            }}
          />
        ))}

      <Roads />
      <WorldEdgeSign />

      {onlineAgents.filter(a => a.online).map((agent) => (
        <AICharacter
          key={agent.address}
          address={agent.address}
          name={agent.name}
          targetPosition={agent.position}
          activity={agent.currentAction}
          onClick={onAgentClick}
        />
      ))}

      <Character
        initialPosition={[0, 0, 8]}
        targetPosition={targetPosition}
        buildings={buildingsArray}
        onPositionChange={(pos: THREE.Vector3) => {
          onCharacterMove(pos);
          if (playerPositionRef) { playerPositionRef.current = pos.clone(); }
        }}
      />

      <WildAutoMons
        playerPosition={playerPositionRef?.current ?? null}
        walletAddress={walletAddress}
        tameState={tameState}
        setTameState={setTameState}
        creatures={wildCreatures}
        setCreatures={setWildCreatures}
      />
    </>
  );
}

function WorldEdgeSign() {
  return (
    <group position={[0, 0.25, -63]}>
      {/* Back layer for fake depth/extrusion */}
      <Text
        position={[0, 3.9, -0.45]}
        font="/fonts/GeistMonoVF.woff"
        fontSize={3.8}
        letterSpacing={0.05}
        anchorX="center"
        anchorY="middle"
        color="#0b1022"
        outlineWidth={0.03}
        outlineColor="#020617"
      >
        MONAD MOLTIVERSE
      </Text>
      {/* Front glowing face */}
      <Text
        position={[0, 4.15, 0]}
        font="/fonts/GeistMonoVF.woff"
        fontSize={3.8}
        letterSpacing={0.05}
        anchorX="center"
        anchorY="middle"
        color="#e2e8f0"
        outlineWidth={0.045}
        outlineColor="#4338ca"
      >
        MONAD MOLTIVERSE
      </Text>

      {/* Underline plinth */}
      <mesh position={[0, 0.75, -0.4]} receiveShadow castShadow>
        <boxGeometry args={[40, 1.2, 2.4]} />
        <meshStandardMaterial color="#1f2937" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.45, 0.7]} receiveShadow castShadow>
        <boxGeometry args={[36, 0.35, 0.55]} />
        <meshStandardMaterial color="#312e81" roughness={0.5} metalness={0.4} emissive="#312e81" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

function Roads() {
  // Logical road network: main roads from Starter Town hub, then connecting paths
  const mainRoads: [string, string][] = [
    // Hub connections from Starter Town
    ['starter_town', 'town_arena'],      // North: main road to arena
    ['starter_town', 'town_market'],      // East: trade route
    ['starter_town', 'community_farm'],   // West: farm path
  ];

  const secondaryRoads: [string, string][] = [
    // West side
    ['community_farm', 'old_pond'],       // West: farm → pond
    ['old_pond', 'town_arena'],           // Northwest: pond → arena

    // East side
    ['town_market', 'crystal_caves'],     // Southeast: market → caves

    // Outer paths
    ['community_farm', 'dark_forest'],    // Southwest: farm → forest
    ['crystal_caves', 'dark_forest'],     // South: caves → forest (cross map)
  ];

  const renderRoad = (from: string, to: string, width: number, color: string, opacity: number, yOffset: number, key: string) => {
    const a = WORLD_LOCATIONS[from as keyof typeof WORLD_LOCATIONS].position;
    const b = WORLD_LOCATIONS[to as keyof typeof WORLD_LOCATIONS].position;
    const midX = (a[0] + b[0]) / 2;
    const midZ = (a[2] + b[2]) / 2;
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);

    return (
      <group key={key} position={[midX, yOffset, midZ]} rotation={[0, -angle, 0]}>
        {/* Road edge (wider, underneath) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.6, len]} />
          <meshStandardMaterial color="#5a4a3a" transparent opacity={opacity * 0.4} roughness={1} />
        </mesh>
        {/* Road surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[width, len]} />
          <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.95} />
        </mesh>
        {/* Center line (dashed effect via thin strip) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
          <planeGeometry args={[0.15, len]} />
          <meshStandardMaterial color="#b8a88a" transparent opacity={opacity * 0.3} roughness={0.9} />
        </mesh>
      </group>
    );
  };

  return (
    <group>
      {/* Main roads — wider, more visible */}
      {mainRoads.map(([from, to], i) =>
        renderRoad(from, to, 2.5, '#8B7355', 0.7, 0.03, `main-${i}`)
      )}
      {/* Secondary paths — narrower dirt paths */}
      {secondaryRoads.map(([from, to], i) =>
        renderRoad(from, to, 1.8, '#7a6b55', 0.5, 0.025, `sec-${i}`)
      )}
      {/* ─── Shop — market stall with awning + display ─── */}
      <group position={[28, 0, 0]}>
        {/* Main building */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[5, 3, 4]} />
          <meshStandardMaterial color="#c9a66b" roughness={0.8} />
        </mesh>
        {/* Flat roof */}
        <mesh position={[0, 3.05, 0]} castShadow>
          <boxGeometry args={[5.4, 0.15, 4.4]} />
          <meshStandardMaterial color="#8B6914" roughness={0.9} />
        </mesh>
        {/* Front awning — striped canopy */}
        <mesh position={[0, 2.8, 2.8]} rotation={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[5.2, 0.08, 2]} />
          <meshStandardMaterial color="#e74c3c" roughness={0.6} />
        </mesh>
        {/* Awning stripes */}
        {[-2, -1, 0, 1, 2].map((x, i) => (
          <mesh key={`stripe-${i}`} position={[x, 2.78, 2.78]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.5, 0.09, 2]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#fff5e6' : '#e74c3c'} roughness={0.6} />
          </mesh>
        ))}
        {/* Awning support poles */}
        {[-2.2, 2.2].map((x, i) => (
          <mesh key={`pole-${i}`} position={[x, 1.5, 3.5]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 3, 6]} />
            <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
          </mesh>
        ))}
        {/* Shop door */}
        <mesh position={[0, 0.9, 2.01]}>
          <boxGeometry args={[1.2, 1.8, 0.05]} />
          <meshStandardMaterial color="#3a2510" roughness={0.9} />
        </mesh>
        {/* Display windows */}
        {[-1.6, 1.6].map((x, i) => (
          <mesh key={`shopwin-${i}`} position={[x, 1.5, 2.01]}>
            <boxGeometry args={[1, 1, 0.05]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} roughness={0.2} metalness={0.3} />
          </mesh>
        ))}
        {/* === 3D "MON SHOP" — wooden carved sign style === */}
        {/* Sign board — warm wood — wider */}
        <mesh position={[0, 4.2, 0.1]} castShadow>
          <boxGeometry args={[6, 1.4, 0.2]} />
          <meshStandardMaterial color="#5c3a1e" roughness={0.85} />
        </mesh>
        {/* Inner panel — darker wood */}
        <mesh position={[0, 4.2, 0.22]}>
          <boxGeometry args={[5.6, 1.1, 0.05]} />
          <meshStandardMaterial color="#3a2010" roughness={0.9} />
        </mesh>
        {/* Hanging chains */}
        {[-2.5, 2.5].map((x, i) => (
          <mesh key={`chain-${i}`} position={[x, 3.6, 0.1]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
            <meshStandardMaterial color="#92400e" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        {/* 3D carved letters — "MON SHOP" — smaller, centered */}
        {[
          // M
          { x: -2.2, w: 0.14, h: 0.6 }, { x: -1.8, w: 0.14, h: 0.6 },
          { x: -2.1, w: 0.14, h: 0.4, y: 0.1, r: 0.3 }, { x: -1.9, w: 0.14, h: 0.4, y: 0.1, r: -0.3 },
          // O
          { x: -1.4, w: 0.14, h: 0.6 }, { x: -1.05, w: 0.14, h: 0.6 },
          { x: -1.225, w: 0.35, h: 0.14, y: 0.23 }, { x: -1.225, w: 0.35, h: 0.14, y: -0.23 },
          // N
          { x: -0.65, w: 0.14, h: 0.6 }, { x: -0.3, w: 0.14, h: 0.6 },
          { x: -0.475, w: 0.14, h: 0.5, r: 0.3 },
          // (space)
          // S
          { x: 0.2, w: 0.35, h: 0.14, y: 0.23 }, { x: 0.15, w: 0.25, h: 0.14, y: 0 },
          { x: 0.2, w: 0.35, h: 0.14, y: -0.23 }, { x: 0.07, w: 0.14, h: 0.2, y: 0.12 }, { x: 0.33, w: 0.14, h: 0.2, y: -0.12 },
          // H
          { x: 0.65, w: 0.14, h: 0.6 }, { x: 1.0, w: 0.14, h: 0.6 },
          { x: 0.825, w: 0.35, h: 0.14, y: 0 },
          // O
          { x: 1.3, w: 0.14, h: 0.6 }, { x: 1.65, w: 0.14, h: 0.6 },
          { x: 1.475, w: 0.35, h: 0.14, y: 0.23 }, { x: 1.475, w: 0.35, h: 0.14, y: -0.23 },
          // P
          { x: 1.95, w: 0.14, h: 0.6 }, { x: 2.125, w: 0.25, h: 0.14, y: 0.23 },
          { x: 2.125, w: 0.25, h: 0.14, y: 0 }, { x: 2.25, w: 0.14, h: 0.2, y: 0.12 },
        ].map((l, i) => (
          <mesh key={`shopletter-${i}`} position={[l.x, 4.2 + (l.y || 0), 0.3]} rotation={[0, 0, l.r || 0]} castShadow>
            <boxGeometry args={[l.w, l.h, 0.12]} />
            <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.6} metalness={0.4} roughness={0.3} />
          </mesh>
        ))}
        {/* Warm lantern glow on sign */}
        <pointLight position={[0, 4.2, 1.5]} intensity={1} color="#f97316" distance={8} decay={2} />
        {/* Display crates outside */}
        {[[-1.8, 0.3, 3.2], [1.8, 0.3, 3.2], [0, 0.25, 3.5]].map(([x, y, z], i) => (
          <mesh key={`crate-${i}`} position={[x, y, z]} rotation={[0, i * 0.4, 0]} castShadow>
            <boxGeometry args={[0.6, 0.5, 0.6]} />
            <meshStandardMaterial color={['#8B6914', '#a0722a', '#7a5a10'][i]} roughness={0.9} />
          </mesh>
        ))}
        {/* Potion bottles on crates */}
        {[[-1.8, 0.7, 3.2], [1.8, 0.7, 3.2], [0, 0.65, 3.5]].map(([x, y, z], i) => (
          <mesh key={`bottle-${i}`} position={[x, y, z]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 0.25, 6]} />
            <meshStandardMaterial color={['#e74c3c', '#3498db', '#2ecc71'][i]} transparent opacity={0.8} roughness={0.3} />
          </mesh>
        ))}
        {/* Barrel next to shop */}
        <mesh position={[3, 0.5, 1.5]} castShadow>
          <cylinderGeometry args={[0.4, 0.35, 1, 10]} />
          <meshStandardMaterial color="#6b4226" roughness={0.9} />
        </mesh>
        {/* Lantern hanging from awning */}
        <mesh position={[0, 2.3, 3.3]} castShadow>
          <boxGeometry args={[0.2, 0.3, 0.2]} />
          <meshStandardMaterial color="#d4a017" roughness={0.5} metalness={0.3} />
        </mesh>
        <pointLight position={[0, 2.2, 3.3]} intensity={0.3} color="#ffaa44" distance={5} />
      </group>

      {/* ─── Home — cottage + stables + AutoMons ─── */}

      {/* Cobblestone yard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#8B7355" transparent opacity={0.5} roughness={0.9} />
      </mesh>

      {/* Main cottage — two-story manor */}
      <group position={[0, 0, -2]}>
        {/* Stone foundation */}
        <mesh position={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[4.4, 0.3, 4]} />
          <meshStandardMaterial color="#6b7280" roughness={0.95} />
        </mesh>

        {/* Main body — first floor */}
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[4, 2.1, 3.5]} />
          <meshStandardMaterial color="#e8dcc8" roughness={0.8} />
        </mesh>

        {/* Darker timber beams — half-timbered look */}
        {/* Horizontal beams */}
        {[0.2, 1.2, 2.25].map((y, i) => (
          <mesh key={`hbeam-${i}`} position={[0, y, 1.76]} castShadow>
            <boxGeometry args={[4.05, 0.08, 0.06]} />
            <meshStandardMaterial color="#4a3520" roughness={0.9} />
          </mesh>
        ))}
        {/* Vertical beams */}
        {[-2, -0.8, 0.8, 2].map((x, i) => (
          <mesh key={`vbeam-${i}`} position={[x, 1.2, 1.76]} castShadow>
            <boxGeometry args={[0.08, 2.1, 0.06]} />
            <meshStandardMaterial color="#4a3520" roughness={0.9} />
          </mesh>
        ))}

        {/* Roof — two tilted thick panels */}
        {(() => {
          const w = 4.6, h = 1.8, d = 4;
          const angle = Math.atan2(h, w / 2);
          const slope = Math.sqrt((w / 2) ** 2 + h ** 2);
          return (
            <>
              <mesh position={[-w / 4, 2.25 + h / 2, 0]} rotation={[0, 0, angle]} castShadow>
                <boxGeometry args={[slope + 0.1, 0.2, d]} />
                <meshStandardMaterial color="#8B4513" roughness={0.85} />
              </mesh>
              <mesh position={[w / 4, 2.25 + h / 2, 0]} rotation={[0, 0, -angle]} castShadow>
                <boxGeometry args={[slope + 0.1, 0.2, d]} />
                <meshStandardMaterial color="#8B4513" roughness={0.85} />
              </mesh>
              {/* Ridge beam */}
              <mesh position={[0, 2.25 + h, 0]} castShadow>
                <boxGeometry args={[0.15, 0.15, d + 0.2]} />
                <meshStandardMaterial color="#5a3218" roughness={0.9} />
              </mesh>
            </>
          );
        })()}

        {/* Front door with frame */}
        <mesh position={[0, 0.15, 1.76]}>
          <boxGeometry args={[1.1, 0.06, 0.06]} />
          <meshStandardMaterial color="#4a3520" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.85, 1.76]}>
          <boxGeometry args={[0.9, 1.5, 0.08]} />
          <meshStandardMaterial color="#5c3317" roughness={0.8} />
        </mesh>
        {/* Door handle */}
        <mesh position={[0.3, 0.85, 1.84]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Door arch */}
        <mesh position={[0, 1.65, 1.76]}>
          <boxGeometry args={[1.1, 0.1, 0.06]} />
          <meshStandardMaterial color="#4a3520" roughness={0.9} />
        </mesh>

        {/* Windows with shutters */}
        {[-1.2, 1.2].map((x, i) => (
          <group key={`win-${i}`} position={[x, 1.5, 1.76]}>
            {/* Glass */}
            <mesh>
              <boxGeometry args={[0.7, 0.6, 0.04]} />
              <meshStandardMaterial color="#87CEEB" emissive="#93c5fd" emissiveIntensity={0.15} transparent opacity={0.8} />
            </mesh>
            {/* Cross frame */}
            <mesh position={[0, 0, 0.03]}>
              <boxGeometry args={[0.72, 0.06, 0.03]} />
              <meshStandardMaterial color="#4a3520" />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <boxGeometry args={[0.06, 0.62, 0.03]} />
              <meshStandardMaterial color="#4a3520" />
            </mesh>
            {/* Shutters */}
            <mesh position={[-0.42, 0, 0.02]}>
              <boxGeometry args={[0.12, 0.65, 0.04]} />
              <meshStandardMaterial color="#2d5a27" roughness={0.8} />
            </mesh>
            <mesh position={[0.42, 0, 0.02]}>
              <boxGeometry args={[0.12, 0.65, 0.04]} />
              <meshStandardMaterial color="#2d5a27" roughness={0.8} />
            </mesh>
            {/* Window box with flowers */}
            <mesh position={[0, -0.38, 0.1]}>
              <boxGeometry args={[0.7, 0.12, 0.15]} />
              <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
            </mesh>
            {[-0.2, 0, 0.2].map((fx, fi) => (
              <mesh key={fi} position={[fx, -0.28, 0.12]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshStandardMaterial color={fi === 1 ? '#f472b6' : '#ef4444'} roughness={0.5} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Side windows */}
        {[[-2.01, 1.5, 0], [2.01, 1.5, 0], [-2.01, 1.5, -1.2], [2.01, 1.5, -1.2]].map(([x, y, z], i) => (
          <mesh key={`swin-${i}`} position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.5, 0.5, 0.04]} />
            <meshStandardMaterial color="#87CEEB" emissive="#93c5fd" emissiveIntensity={0.1} transparent opacity={0.7} />
          </mesh>
        ))}

        {/* Chimney — brick */}
        <mesh position={[1.4, 3.5, -0.8]} castShadow>
          <boxGeometry args={[0.6, 2, 0.6]} />
          <meshStandardMaterial color="#8b4513" roughness={0.9} />
        </mesh>
        <mesh position={[1.4, 4.55, -0.8]}>
          <boxGeometry args={[0.7, 0.15, 0.7]} />
          <meshStandardMaterial color="#6b3a14" />
        </mesh>

        {/* Porch with roof */}
        <mesh position={[0, 0.08, 2.4]} receiveShadow>
          <boxGeometry args={[2.5, 0.12, 1.2]} />
          <meshStandardMaterial color="#8b7355" roughness={0.9} />
        </mesh>
        {/* Porch step */}
        <mesh position={[0, 0.02, 3.1]} receiveShadow>
          <boxGeometry args={[1.8, 0.06, 0.3]} />
          <meshStandardMaterial color="#7a6548" roughness={0.9} />
        </mesh>
        {/* Porch columns */}
        {[-0.95, 0.95].map((x, i) => (
          <mesh key={`pcol-${i}`} position={[x, 1.0, 2.9]} castShadow>
            <boxGeometry args={[0.12, 1.8, 0.12]} />
            <meshStandardMaterial color="#e8e0d8" roughness={0.7} />
          </mesh>
        ))}
        {/* Porch awning */}
        <mesh position={[0, 1.95, 2.6]} castShadow rotation={[0.1, 0, 0]}>
          <boxGeometry args={[2.6, 0.1, 1.2]} />
          <meshStandardMaterial color="#8B4513" roughness={0.85} />
        </mesh>

        {/* Warm light from windows at night */}
        <pointLight position={[0, 1.3, 2]} color="#fde68a" intensity={0.5} distance={4} />
      </group>

      {/* Stables — open-front barn to the right */}
      <group position={[5, 0, 1]}>
        {/* Back wall */}
        <mesh position={[0, 1, -1.5]} castShadow>
          <boxGeometry args={[5, 2, 0.2]} />
          <meshStandardMaterial color="#8B6914" roughness={0.9} />
        </mesh>
        {/* Side walls */}
        {[-2.4, 2.4].map((x, i) => (
          <mesh key={`sw-${i}`} position={[x, 1, 0]} castShadow>
            <boxGeometry args={[0.2, 2, 3]} />
            <meshStandardMaterial color="#8B6914" roughness={0.9} />
          </mesh>
        ))}
        {/* Roof — slanted */}
        <mesh position={[0, 2.2, -0.2]} rotation={[0.15, 0, 0]} castShadow>
          <boxGeometry args={[5.4, 0.15, 3.6]} />
          <meshStandardMaterial color="#654321" roughness={0.9} />
        </mesh>
        {/* Support posts */}
        {[-1.8, 0, 1.8].map((x, i) => (
          <mesh key={`post-${i}`} position={[x, 1, 1.4]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 2, 6]} />
            <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
          </mesh>
        ))}
        {/* Hay bales */}
        {[[-1.5, 0.3, -0.8], [1.2, 0.3, -1], [0, 0.2, -0.5]].map(([x, y, z], i) => (
          <mesh key={`hay-${i}`} position={[x, y, z]} rotation={[0, i * 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.6, 8]} />
            <meshStandardMaterial color="#DAA520" roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Fence around stable paddock */}
      {(() => {
        const posts: Array<[number, number, number]> = [];
        // Front fence (with gap for entrance)
        for (let x = 3; x <= 7.5; x += 1.2) {
          if (x > 4.2 && x < 5.8) continue; // gap
          posts.push([x, 0.4, 3.5]);
        }
        // Right side
        for (let z = 3.5; z >= 0; z -= 1.2) posts.push([7.5, 0.4, z]);
        return posts.map((p, i) => (
          <group key={`sfence-${i}`}>
            <mesh position={p} castShadow>
              <cylinderGeometry args={[0.05, 0.06, 0.8, 5]} />
              <meshStandardMaterial color="#7a4a24" roughness={0.9} />
            </mesh>
          </group>
        ));
      })()}
      {/* Fence rails */}
      {[
        [5.2, 0.5, 3.5, 4.5, 0], [5.2, 0.3, 3.5, 4.5, 0],
        [7.5, 0.5, 1.75, 3.5, Math.PI / 2], [7.5, 0.3, 1.75, 3.5, Math.PI / 2],
      ].map((r, i) => (
        <mesh key={`srail-${i}`} position={[r[0], r[1], r[2]]} rotation={[0, r[4], 0]}>
          <boxGeometry args={[r[3], 0.06, 0.06]} />
          <meshStandardMaterial color="#6b3a14" roughness={0.9} />
        </mesh>
      ))}

      {/* AutoMons in the paddock — decorative creatures */}
      {[
        { pos: [4, 0, 2.5] as [number,number,number], color: '#ff6b35', size: 0.4 },
        { pos: [6, 0, 2] as [number,number,number], color: '#4ecdc4', size: 0.35 },
        { pos: [5.5, 0, 3] as [number,number,number], color: '#ffe66d', size: 0.3 },
      ].map((m, i) => (
        <group key={`padmon-${i}`} position={m.pos}>
          {/* Body */}
          <mesh position={[0, m.size * 1.2, 0]} castShadow>
            <sphereGeometry args={[m.size, 8, 8]} />
            <meshStandardMaterial color={m.color} roughness={0.7} />
          </mesh>
          {/* Head */}
          <mesh position={[0, m.size * 2, 0.1]} castShadow>
            <sphereGeometry args={[m.size * 0.6, 8, 8]} />
            <meshStandardMaterial color={m.color} roughness={0.7} />
          </mesh>
          {/* Eyes */}
          <mesh position={[m.size * 0.15, m.size * 2.1, m.size * 0.4]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>
          <mesh position={[-m.size * 0.15, m.size * 2.1, m.size * 0.4]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>
          {/* Legs */}
          {[[-0.15, 0], [0.15, 0], [-0.15, -0.2], [0.15, -0.2]].map(([lx, lz], li) => (
            <mesh key={`leg-${i}-${li}`} position={[lx, 0.25, lz]}>
              <cylinderGeometry args={[0.04, 0.05, 0.5, 5]} />
              <meshStandardMaterial color={m.color} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Mailbox */}
      <group position={[-2.5, 0, 1.5]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 1, 5]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[0.4, 0.25, 0.2]} />
          <meshStandardMaterial color="#cc3333" roughness={0.7} />
        </mesh>
      </group>

      {/* Welcome sign */}
      <group position={[-1, 0, 4]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 1.2, 5]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[1.4, 0.5, 0.08]} />
          <meshStandardMaterial color="#8B6914" roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

/* Sky dome — warm gradient with lightweight cloud forms */
function Sky() {
  const clouds: Array<{ p: [number, number, number]; s: [number, number, number] }> = [
    { p: [-62, 96, -42], s: [12, 5, 7] },
    { p: [-18, 88, 18], s: [10, 4.2, 6] },
    { p: [34, 106, -16], s: [13, 5.2, 7.5] },
    { p: [70, 92, 38], s: [11, 4.8, 6.2] },
    { p: [4, 116, 68], s: [15, 5.8, 8] },
    { p: [-74, 102, 46], s: [9, 3.8, 5.4] },
  ];

  return (
    <group>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[180, 32, 16]} />
        <shaderMaterial
          side={2}
          uniforms={{
            topColor: { value: new THREE.Color('#4a90d9') },
            bottomColor: { value: new THREE.Color('#f7d8a0') },
            offset: { value: 10 },
            exponent: { value: 0.56 },
          }}
          vertexShader={`
            varying vec3 vWorldPosition;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPosition.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
              float h = normalize(vWorldPosition + offset).y;
              gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
          `}
        />
      </mesh>

      {clouds.map((cloud, i) => (
        <group key={`cloud-${i}`} position={cloud.p}>
          {[-0.35, 0, 0.4].map((offset, j) => (
            <mesh key={`cloud-part-${i}-${j}`} position={[offset * cloud.s[0], j % 2 === 0 ? 0 : 1.1, (0.2 - j * 0.2) * cloud.s[2]]} scale={cloud.s}>
              <sphereGeometry args={[1, 12, 12]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.5} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function GameWorld() {
  const router = useRouter();
  const { address, playerName, ensureAuthenticated } = useWallet();
  const playerPositionRef = useRef<THREE.Vector3 | null>(null);
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null);
  const [cameraFlyTarget, setCameraFlyTarget] = useState<THREE.Vector3 | null>(null);
  const [nearbyBuilding, setNearbyBuilding] = useState<string | null>(null);
  const [nearbyRoute, setNearbyRoute] = useState<string | null>(null);
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [tameState, setTameState] = useState<TameState>(null);
  const [wildCreatures, setWildCreatures] = useState(() =>
    SPAWN_ZONES.map((spawn, i) => ({ id: i, species: WILD_SPECIES[i % WILD_SPECIES.length], spawn, alive: true }))
  );
  const [totalBattles, setTotalBattles] = useState(0);
  const [battles, setBattles] = useState<{
    id: string;
    status: string;
    player1: string;
    player2: string | null;
    player1Cards?: string[];
    player2Cards?: string[];
    winner: string | null;
    wager?: string;
    lastRound?: {
      turn: number;
      player1Move?: { action: string; reasoning?: string | null } | null;
      player2Move?: { action: string; reasoning?: string | null } | null;
    } | null;
    rounds: number;
    createdAt: string;
  }[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [transactions, setTransactions] = useState<{ txHash: string; type: string; from: string; description: string; explorerUrl: string; timestamp: string }[]>([]);
  const [tokenTrades, setTokenTrades] = useState<{ txHash: string; type: string; from: string; agentName?: string; description: string; explorerUrl: string; timestamp: string; amount?: string | null; details?: { tokensReceived?: string; monReceived?: string; tokensSold?: string; monSpent?: string } }[]>([]);
  const [chatMessages, setChatMessages] = useState<{ from: string; fromName: string; to?: string; toName?: string; message: string; location?: string; timestamp: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('isometric');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          setOnlineAgents(data.agents || []);
          setOnlinePlayers(data.onlinePlayers || []);
          setEvents(data.events || []);
          setTotalBattles(data.totalBattles || 0);
          setBattles(data.battles || []);
          setTotalCards(data.totalCards || 0);
          setTransactions(data.transactions || []);
          setTokenTrades(data.tokenTrades || []);
          setChatMessages(data.chat || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'v') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      setCameraMode(prev => (prev === 'isometric' ? 'shoulder' : 'isometric'));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLocationClick = useCallback((route: string) => { router.push(route); }, [router]);
  // Right-click on ground moves the character
  const handleGroundClick = useCallback((point: THREE.Vector3) => {
    setTargetPosition(point);
  }, []);

  const handleCameraFly = useCallback((point: THREE.Vector3) => {
    setCameraFlyTarget(point.clone());
  }, []);

  const handleCharacterMove = useCallback((position: THREE.Vector3) => {
    let foundNearby: string | null = null;
    let foundRoute: string | null = null;
    for (const [, loc] of Object.entries(WORLD_LOCATIONS)) {
      const locPos = new THREE.Vector3(...loc.position);
      const distance = new THREE.Vector2(position.x - locPos.x, position.z - locPos.z).length();
      if (distance < INTERACTION_DISTANCE && loc.route) {
        foundNearby = loc.label;
        foundRoute = loc.route;
        break;
      }
    }
    setNearbyBuilding(foundNearby);
    setNearbyRoute(foundRoute);
  }, []);

  const handleEnterBuilding = useCallback(() => {
    if (nearbyRoute) router.push(nearbyRoute);
  }, [nearbyRoute, router]);

  const handleSelectAgent = useCallback((address: string) => {
    setSelectedAgent(address);
  }, []);

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ fov: 45, position: [0, 40, 45], near: 0.1, far: 500 }}
        shadows
        style={{ background: '#87CEEB' }}
        gl={{ antialias: true, alpha: false }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Suspense fallback={null}>
          <Scene
            onLocationClick={handleLocationClick}
            onGroundClick={handleGroundClick}
            onCameraFly={handleCameraFly}
            targetPosition={targetPosition}
            onCharacterMove={handleCharacterMove}
            onlineAgents={onlineAgents}
            cameraFlyTarget={cameraFlyTarget}
            onAgentClick={handleSelectAgent}
            walletAddress={address || undefined}
            playerPositionRef={playerPositionRef}
            cameraMode={cameraMode}
            tameState={tameState}
            setTameState={setTameState}
            wildCreatures={wildCreatures}
            setWildCreatures={setWildCreatures}
          />
        </Suspense>
      </Canvas>

      <TameDialog
        tameState={tameState}
        onCancel={() => setTameState(null)}
        onTameAttempt={async () => {
          if (!tameState || tameState.phase !== 'confirm') return;
          const { creatureId, species } = tameState;
          setTameState({ phase: 'attempting', species });
          await new Promise(r => setTimeout(r, 1500));
          const success = Math.random() < TAME_CHANCE;
          let cardName = '';
          if (success && address) {
            try {
              const res = await fetch('/api/cards/tame', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, speciesName: species.name }),
              });
              if (res.ok) {
                const data = await res.json();
                cardName = data.card?.name || species.name;
                setWildCreatures(prev => prev.map(c => c.id === creatureId ? { ...c, alive: false } : c));
              }
            } catch (err) { console.error('Tame API error:', err); }
          }
          setTameState({ phase: 'result', species, success, cardName });
          setTimeout(() => setTameState(null), 3500);
        }}
      />

      <WorldUI
        nearbyBuilding={nearbyBuilding}
        onEnterBuilding={handleEnterBuilding}
        walletAddress={address}
        playerName={playerName}
        ensureWalletSession={ensureAuthenticated}
        onlineAgents={onlineAgents}
        onlinePlayers={onlinePlayers}
        events={events}
        totalBattles={totalBattles}
        battles={battles}
        totalCards={totalCards}
        transactions={transactions}
        tokenTrades={tokenTrades}
        chat={chatMessages}
        onSelectAgent={handleSelectAgent}
        onFlyToAgent={(address: string) => {
          const agent = onlineAgents.find(a => a.address?.toLowerCase() === address.toLowerCase());
          if (agent?.position) {
            setCameraFlyTarget(new THREE.Vector3(agent.position.x, 0, agent.position.z));
          }
        }}
      />

      {selectedAgent && (
        <AgentProfileModal address={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}
