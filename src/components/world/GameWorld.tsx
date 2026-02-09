'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { MapControls } from '@react-three/drei';

import { Ground } from './Ground';
import { Character } from './Character';
import { AICharacter } from './AICharacter';
import { WorldUI } from './WorldUI';
import { LocationMarker } from './locations/LocationMarker';
import { BattleArena } from './buildings/BattleArena';

interface OnlineAgent {
  address: string;
  name: string;
  personality: string;
  isAI: boolean;
  position: { x: number; y: number; z: number };
  online: boolean;
  stats: { wins: number; losses: number; cards: number };
}

interface EventData {
  agent: string;
  action: string;
  reason: string;
  location: string | null;
  timestamp: string;
}

export const WORLD_LOCATIONS = {
  starter_town:   { position: [0, 0, 0] as [number, number, number],      label: 'Starter Town',    icon: '🏠', color: '#f59e0b', variant: 'building' as const, route: '/collection' },
  town_arena:     { position: [0, 0, -20] as [number, number, number],     label: 'Town Arena',      icon: '⚔️', color: '#ef4444', variant: 'building' as const, route: '/battle' },
  town_market:    { position: [18, 0, 0] as [number, number, number],      label: 'Town Market',     icon: '🏪', color: '#f97316', variant: 'building' as const, route: '/shop' },
  community_farm: { position: [-18, 0, 0] as [number, number, number],     label: 'Community Farm',  icon: '🌾', color: '#84cc16', variant: 'nature' as const,   route: null },
  green_meadows:  { position: [-14, 0, -18] as [number, number, number],   label: 'Green Meadows',   icon: '🌿', color: '#22c55e', variant: 'nature' as const,   route: null },
  old_pond:       { position: [-22, 0, -18] as [number, number, number],   label: 'Old Pond',        icon: '🎣', color: '#3b82f6', variant: 'water' as const,    route: null },
  dark_forest:    { position: [-24, 0, 14] as [number, number, number],    label: 'Dark Forest',     icon: '🌑', color: '#7c3aed', variant: 'dark' as const,     route: null },
  river_delta:    { position: [22, 0, -16] as [number, number, number],    label: 'River Delta',     icon: '🏞️', color: '#06b6d4', variant: 'water' as const,    route: null },
  crystal_caves:  { position: [20, 0, 16] as [number, number, number],     label: 'Crystal Caves',   icon: '💎', color: '#a78bfa', variant: 'dark' as const,     route: null },
};

const INTERACTION_DISTANCE = 5;

function CameraController({ flyTarget }: { flyTarget: THREE.Vector3 | null }) {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const flyingRef = useRef(false);
  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3(0, 0, -5));

  useEffect(() => {
    const isMobile = size.width < 768;
    if (isMobile) {
      camera.position.set(0, 65, 50);
    } else {
      camera.position.set(0, 50, 55);
    }
    currentLookAt.current.set(0, 0, -5);
    camera.lookAt(0, 0, -5);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);

  // Start fly-to when target changes
  useEffect(() => {
    if (!flyTarget) return;
    const isMobile = size.width < 768;
    const height = isMobile ? 35 : 30;
    const offsetZ = isMobile ? 25 : 22;
    targetPos.current.set(flyTarget.x, height, flyTarget.z + offsetZ);
    targetLookAt.current.copy(flyTarget);
    flyingRef.current = true;
  }, [flyTarget, size.width]);

  useFrame(() => {
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
      enableRotate={true}
      enablePan={true}
      enableZoom={true}
      minDistance={15}
      maxDistance={120}
      maxPolarAngle={Math.PI / 2.5}
      minPolarAngle={Math.PI / 8}
      panSpeed={1.2}
      zoomSpeed={1.0}
      // Enable screen-space panning (drag to move around map)
      screenSpacePanning={false}
    />
  );
}

function Scene({
  onLocationClick,
  onGroundClick,
  targetPosition,
  onCharacterMove,
  onlineAgents,
  cameraFlyTarget,
}: {
  onLocationClick: (route: string) => void;
  onGroundClick: (point: THREE.Vector3) => void;
  targetPosition: THREE.Vector3 | null;
  onCharacterMove: (position: THREE.Vector3) => void;
  onlineAgents: OnlineAgent[];
  cameraFlyTarget: THREE.Vector3 | null;
}) {
  const buildingsArray = Object.values(WORLD_LOCATIONS).map((b) => ({
    position: b.position,
    radius: 4,
  }));

  return (
    <>
      <color attach="background" args={['#1a2540']} />
      <CameraController flyTarget={cameraFlyTarget} />

      {/* Fog for depth */}
      <fog attach="fog" args={['#1a2540', 80, 150]} />

      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#c8e8ff', '#2a4a30', 0.6]} />
      <directionalLight
        position={[15, 25, 15]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />
      <directionalLight position={[-10, 15, -10]} intensity={0.3} color="#6366f1" />
      {/* Rim light for atmosphere */}
      <pointLight position={[0, 8, -20]} intensity={1.2} color="#ef4444" distance={35} />
      <pointLight position={[-18, 5, 0]} intensity={0.8} color="#84cc16" distance={30} />
      <pointLight position={[20, 5, 16]} intensity={0.8} color="#a78bfa" distance={30} />

      <Ground size={80} onClick={onGroundClick} />

      <BattleArena
        position={WORLD_LOCATIONS.town_arena.position}
        onClick={() => onLocationClick(WORLD_LOCATIONS.town_arena.route!)}
      />

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
            onClick={() => {
              // Fly camera to this location
              onGroundClick(new THREE.Vector3(...loc.position));
              // If it has a route, navigate after a brief delay
              if (loc.route) {
                setTimeout(() => onLocationClick(loc.route!), 800);
              }
            }}
          />
        ))}

      <Roads />

      {onlineAgents.filter(a => a.online).map((agent) => (
        <AICharacter
          key={agent.address}
          address={agent.address}
          name={agent.name}
          targetPosition={agent.position}
        />
      ))}

      <Character
        initialPosition={[0, 0, 8]}
        targetPosition={targetPosition}
        buildings={buildingsArray}
        onPositionChange={onCharacterMove}
      />
    </>
  );
}

function Roads() {
  const connections: [string, string][] = [
    ['starter_town', 'town_arena'],
    ['starter_town', 'town_market'],
    ['starter_town', 'community_farm'],
    ['starter_town', 'green_meadows'],
    ['green_meadows', 'old_pond'],
    ['green_meadows', 'dark_forest'],
    ['old_pond', 'river_delta'],
    ['town_market', 'river_delta'],
    ['community_farm', 'dark_forest'],
    ['crystal_caves', 'town_market'],
    ['crystal_caves', 'dark_forest'],
  ];

  return (
    <group>
      {connections.map(([from, to], i) => {
        const a = WORLD_LOCATIONS[from as keyof typeof WORLD_LOCATIONS].position;
        const b = WORLD_LOCATIONS[to as keyof typeof WORLD_LOCATIONS].position;
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const len = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);

        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, -angle]} position={[(a[0] + b[0]) / 2, 0.02, (a[2] + b[2]) / 2]}>
            <planeGeometry args={[1.5, len]} />
            <meshStandardMaterial color="#3d4555" transparent opacity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

export function GameWorld() {
  const router = useRouter();
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null);
  const [cameraFlyTarget, setCameraFlyTarget] = useState<THREE.Vector3 | null>(null);
  const [nearbyBuilding, setNearbyBuilding] = useState<string | null>(null);
  const [nearbyRoute, setNearbyRoute] = useState<string | null>(null);
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [totalBattles, setTotalBattles] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [transactions, setTransactions] = useState<{ txHash: string; type: string; from: string; description: string; explorerUrl: string; timestamp: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          setOnlineAgents(data.agents || []);
          setEvents(data.events || []);
          setTotalBattles(data.totalBattles || 0);
          setTotalCards(data.totalCards || 0);
          setTransactions(data.transactions || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLocationClick = useCallback((route: string) => { router.push(route); }, [router]);
  const handleGroundClick = useCallback((point: THREE.Vector3) => {
    setTargetPosition(point);
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

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ fov: 45, position: [0, 50, 55], near: 0.1, far: 1000 }}
        shadows
        style={{ background: '#1a2540' }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Scene
            onLocationClick={handleLocationClick}
            onGroundClick={handleGroundClick}
            targetPosition={targetPosition}
            onCharacterMove={handleCharacterMove}
            onlineAgents={onlineAgents}
            cameraFlyTarget={cameraFlyTarget}
          />
        </Suspense>
      </Canvas>

      <WorldUI
        nearbyBuilding={nearbyBuilding}
        onEnterBuilding={handleEnterBuilding}
        onlineAgents={onlineAgents}
        events={events}
        totalBattles={totalBattles}
        totalCards={totalCards}
        transactions={transactions}
      />
    </div>
  );
}
