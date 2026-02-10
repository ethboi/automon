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
import { WildAutoMons } from './WildAutoMon';
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

export const WORLD_LOCATIONS = {
  starter_town:   { position: [0, 0, 0] as [number, number, number],      label: 'Starter Town',    icon: '🏠', color: '#f59e0b', variant: 'building' as const, route: '/collection' },
  town_arena:     { position: [0, 0, -30] as [number, number, number],     label: 'Town Arena',      icon: '⚔️', color: '#ef4444', variant: 'building' as const, route: '/battle' },
  town_market:    { position: [28, 0, 0] as [number, number, number],      label: 'Town Market',     icon: '🏪', color: '#f97316', variant: 'building' as const, route: '/shop' },
  community_farm: { position: [-28, 0, 0] as [number, number, number],     label: 'Community Farm',  icon: '🌾', color: '#84cc16', variant: 'farm' as const,     route: null },
  old_pond:       { position: [-36, 0, -14] as [number, number, number],   label: 'Old Pond',        icon: '🎣', color: '#3b82f6', variant: 'water' as const,    route: null },
  dark_forest:    { position: [-36, 0, 22] as [number, number, number],    label: 'Dark Forest',     icon: '🌑', color: '#7c3aed', variant: 'dark' as const,     route: null },
  crystal_caves:  { position: [32, 0, 24] as [number, number, number],     label: 'Crystal Caves',   icon: '💎', color: '#a78bfa', variant: 'dark' as const,     route: null },
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
      camera.position.set(0, 50, 40);
    } else {
      camera.position.set(0, 40, 45);
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
      maxDistance={200}
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
}) {
  const buildingsArray = Object.values(WORLD_LOCATIONS).map((b) => ({
    position: b.position,
    radius: 4,
  }));

  return (
    <>
      <color attach="background" args={['#87CEEB']} />
      <CameraController flyTarget={cameraFlyTarget} />

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
              onCameraFly(new THREE.Vector3(...loc.position));
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
          playerPositionRef.current = pos.clone();
        }}
      />

      <WildAutoMons
        playerPosition={playerPositionRef.current}
        walletAddress={walletAddress}
      />
    </>
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
      {/* Starter Town plaza — circular cobblestone area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[5, 24]} />
        <meshStandardMaterial color="#8B7355" transparent opacity={0.6} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
        <ringGeometry args={[4.5, 5.2, 24]} />
        <meshStandardMaterial color="#6b5b45" transparent opacity={0.5} roughness={0.9} />
      </mesh>
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
  const { address } = useWallet();
  const playerPositionRef = useRef<THREE.Vector3 | null>(null);
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null);
  const [cameraFlyTarget, setCameraFlyTarget] = useState<THREE.Vector3 | null>(null);
  const [nearbyBuilding, setNearbyBuilding] = useState<string | null>(null);
  const [nearbyRoute, setNearbyRoute] = useState<string | null>(null);
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
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
  const [chatMessages, setChatMessages] = useState<{ from: string; fromName: string; to?: string; toName?: string; message: string; location?: string; timestamp: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          setOnlineAgents(data.agents || []);
          setEvents(data.events || []);
          setTotalBattles(data.totalBattles || 0);
          setBattles(data.battles || []);
          setTotalCards(data.totalCards || 0);
          setTransactions(data.transactions || []);
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
          />
        </Suspense>
      </Canvas>

      <WorldUI
        nearbyBuilding={nearbyBuilding}
        onEnterBuilding={handleEnterBuilding}
        onlineAgents={onlineAgents}
        events={events}
        totalBattles={totalBattles}
        battles={battles}
        totalCards={totalCards}
        transactions={transactions}
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
