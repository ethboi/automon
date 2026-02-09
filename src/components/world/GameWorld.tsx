'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';

import { Ground } from './Ground';
import { Character } from './Character';
import { AICharacter } from './AICharacter';
import { WorldUI } from './WorldUI';
import { BattleArena } from './buildings/BattleArena';
import { Home } from './buildings/Home';
import { Bank } from './buildings/Bank';

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

// Building positions and interaction data
const BUILDINGS = {
  arena: {
    position: [0, 0, -14] as [number, number, number],
    radius: 5.5,
    label: 'Battle Arena',
    route: '/battle',
  },
  home: {
    position: [-14, 0, 10] as [number, number, number],
    radius: 3,
    label: 'Collection',
    route: '/collection',
  },
  bank: {
    position: [14, 0, 10] as [number, number, number],
    radius: 3.5,
    label: 'Shop',
    route: '/shop',
  },
};

const INTERACTION_DISTANCE = 4;

function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function Scene({
  onBuildingClick,
  onGroundClick,
  targetPosition,
  onCharacterMove,
  onlineAgents,
}: {
  onBuildingClick: (route: string) => void;
  onGroundClick: (point: THREE.Vector3) => void;
  targetPosition: THREE.Vector3 | null;
  onCharacterMove: (position: THREE.Vector3) => void;
  onlineAgents: OnlineAgent[];
}) {
  const buildingsArray = Object.values(BUILDINGS).map((b) => ({
    position: b.position,
    radius: b.radius,
  }));

  return (
    <>
      <color attach="background" args={['#111827']} />
      <CameraSetup />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      <Ground size={50} onClick={onGroundClick} />
      <BattleArena position={BUILDINGS.arena.position} onClick={() => onBuildingClick(BUILDINGS.arena.route)} />
      <Home position={BUILDINGS.home.position} onClick={() => onBuildingClick(BUILDINGS.home.route)} />
      <Bank position={BUILDINGS.bank.position} onClick={() => onBuildingClick(BUILDINGS.bank.route)} />

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

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}

export function GameWorld() {
  const router = useRouter();
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null);
  const [nearbyBuilding, setNearbyBuilding] = useState<string | null>(null);
  const [nearbyRoute, setNearbyRoute] = useState<string | null>(null);
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [totalBattles, setTotalBattles] = useState(0);
  const [totalCards, setTotalCards] = useState(0);

  // Fetch dashboard data periodically
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
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleBuildingClick = useCallback((route: string) => { router.push(route); }, [router]);
  const handleGroundClick = useCallback((point: THREE.Vector3) => { setTargetPosition(point); }, []);

  const handleCharacterMove = useCallback((position: THREE.Vector3) => {
    let foundNearby: string | null = null;
    let foundRoute: string | null = null;
    for (const [, building] of Object.entries(BUILDINGS)) {
      const buildingPos = new THREE.Vector3(...building.position);
      const distance = new THREE.Vector2(position.x - buildingPos.x, position.z - buildingPos.z).length();
      if (distance < building.radius + INTERACTION_DISTANCE) {
        foundNearby = building.label;
        foundRoute = building.route;
        break;
      }
    }
    setNearbyBuilding(foundNearby);
    setNearbyRoute(foundRoute);
  }, []);

  const handleEnterBuilding = useCallback(() => {
    if (nearbyRoute) router.push(nearbyRoute);
  }, [nearbyRoute, router]);

  const onlineCount = onlineAgents.filter(a => a.online).length;

  return (
    <div className="relative w-full h-[calc(100vh-80px)] bg-gray-900">
      <Canvas
        camera={{ fov: 45, position: [50, 50, 50], near: 0.1, far: 1000 }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene
            onBuildingClick={handleBuildingClick}
            onGroundClick={handleGroundClick}
            targetPosition={targetPosition}
            onCharacterMove={handleCharacterMove}
            onlineAgents={onlineAgents}
          />
        </Suspense>
      </Canvas>

      <WorldUI nearbyBuilding={nearbyBuilding} onEnterBuilding={handleEnterBuilding} />

      {/* Live Activity Feed — top right overlay */}
      <div className="absolute top-4 right-4 pointer-events-auto w-80">
        {/* Stats bar */}
        <div className="glass rounded-xl px-4 py-3 mb-2 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-gray-300">{onlineCount} online</span>
          </div>
          <div className="flex gap-4 text-xs text-gray-400">
            <span>⚔️ {totalBattles} battles</span>
            <span>🃏 {totalCards} cards</span>
          </div>
        </div>

        {/* Event feed */}
        <div className="glass rounded-xl p-3 max-h-64 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">📡 Live Feed</div>
          {events.length === 0 ? (
            <div className="text-xs text-gray-500 italic">Waiting for activity...</div>
          ) : (
            <div className="space-y-1.5">
              {events.slice(0, 15).map((e, i) => {
                const agentName = onlineAgents.find(a => a.address?.toLowerCase() === e.agent?.toLowerCase())?.name || e.agent?.slice(0, 8);
                return (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-gray-600 flex-shrink-0">{timeAgo(e.timestamp)}</span>
                    <span className="text-cyan-400 font-medium flex-shrink-0">{agentName}</span>
                    <span className="text-gray-400">{e.action}</span>
                    {e.reason && (
                      <span className="text-gray-600 italic truncate" title={e.reason}>
                        💭 {e.reason.length > 40 ? e.reason.slice(0, 40) + '…' : e.reason}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
