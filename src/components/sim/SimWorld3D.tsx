"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

// ─── Types ──────────────────────────────────────────────────────────
interface Trainer {
  id: string;
  name: string;
  health: number;
  energy: number;
  hunger: number;
  gold: number;
  locationId: string;
  automons: { id: string; speciesId: string; nickname: string; element: string; level: number; health: number; maxHealth: number }[];
  elo: number;
  _style?: string;
  busyAction?: string;
  pendingTravelTo?: string;
  busyUntilTick?: number;
}

interface SpeciesInfo {
  id: string;
  name: string;
  element: string;
  rarity: string;
  habitats?: string[];
}

interface SimWorld3DProps {
  trainers: Trainer[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  speciesDex?: SpeciesInfo[];
  tick?: number;
}

// ─── Constants ──────────────────────────────────────────────────────
// Map 2D coords (0-100) to 3D xz (centered around 0, scaled to ~120 units)
const COORDS_2D: Record<string, { x: number; y: number }> = {
  starter_town: { x: 50, y: 50 }, town_arena: { x: 30, y: 26 },
  green_meadows: { x: 22, y: 58 }, town_market: { x: 72, y: 38 },
  community_farm: { x: 78, y: 64 }, old_pond: { x: 14, y: 78 },
  dark_forest: { x: 10, y: 38 }, river_delta: { x: 56, y: 82 },
  crystal_caves: { x: 30, y: 12 },
};

function to3D(id: string): [number, number, number] {
  const c = COORDS_2D[id];
  if (!c) return [0, 0, 0];
  return [(c.x - 50) * 1.2, 0, (c.y - 50) * 1.2];
}

const COORDS_3D: Record<string, [number, number, number]> = Object.fromEntries(
  Object.keys(COORDS_2D).map(id => [id, to3D(id)])
) as Record<string, [number, number, number]>;

const EDGES = [
  ["starter_town", "town_arena"], ["starter_town", "green_meadows"],
  ["starter_town", "town_market"], ["starter_town", "community_farm"],
  ["green_meadows", "old_pond"], ["green_meadows", "dark_forest"],
  ["town_market", "town_arena"], ["town_market", "community_farm"],
  ["town_market", "river_delta"], ["old_pond", "river_delta"],
  ["dark_forest", "crystal_caves"], ["river_delta", "crystal_caves"],
];

const LOC_NAMES: Record<string, string> = {
  starter_town: "Starter Town", town_arena: "Town Arena", green_meadows: "Green Meadows",
  town_market: "Town Market", community_farm: "Community Farm", old_pond: "Old Pond",
  dark_forest: "Dark Forest", river_delta: "River Delta", crystal_caves: "Crystal Caves",
};

const STYLE_COLORS: Record<string, string> = {
  explorer: "#3b82f6", grinder: "#ef4444", hoarder: "#eab308",
  farmer: "#22c55e", balanced: "#a78bfa",
};

const ELEMENT_COLORS: Record<string, string> = {
  fire: "#ef4444", water: "#3b82f6", earth: "#8b6914",
  air: "#67e8f9", electric: "#eab308", shadow: "#8b5cf6", light: "#fbbf24",
};

const BIOME_COLORS: Record<string, string> = {
  starter_town: "#4a7c59", town_arena: "#8b6b4a", green_meadows: "#5da34a",
  town_market: "#7a6b5a", community_farm: "#6b8a3a", old_pond: "#3a6b8a",
  dark_forest: "#2a4a2a", river_delta: "#4a7a8a", crystal_caves: "#6a5a8a",
};

// ─── Location Landmark Components ───────────────────────────────────

function StarterTown({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Houses */}
      {[[-2, 0, -1.5], [2, 0, -1], [0, 0, 2]].map(([x, _y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[1.4, 1.2, 1.2]} />
            <meshStandardMaterial color="#c9a87c" />
          </mesh>
          <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[1.2, 0.8, 4]} />
            <meshStandardMaterial color="#8b4513" />
          </mesh>
          {/* Door */}
          <mesh position={[0, 0.35, 0.61]}>
            <boxGeometry args={[0.35, 0.5, 0.05]} />
            <meshStandardMaterial color="#5a3a1a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TownArena({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#8b6b4a" />
      </mesh>
      {/* Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <torusGeometry args={[3, 0.15, 8, 32]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      {/* Pillars */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 3.5, 1, Math.sin(angle) * 3.5]}>
            <cylinderGeometry args={[0.15, 0.15, 2, 8]} />
            <meshStandardMaterial color="#7f1d1d" />
          </mesh>
        );
      })}
    </group>
  );
}

function GreenMeadows({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Flower patches */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 1.5 + Math.sin(i * 3) * 1.5;
        const colors = ["#ff69b4", "#ffd700", "#ff6347", "#da70d6", "#87ceeb"];
        return (
          <mesh key={i} position={[Math.cos(angle) * r, 0.15, Math.sin(angle) * r]}>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshStandardMaterial color={colors[i % colors.length]} emissive={colors[i % colors.length]} emissiveIntensity={0.3} />
          </mesh>
        );
      })}
      {/* Tall grass */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 2 + Math.cos(i * 5) * 0.8;
        return (
          <mesh key={`g${i}`} position={[Math.cos(angle) * r, 0.3, Math.sin(angle) * r]}>
            <coneGeometry args={[0.08, 0.6, 4]} />
            <meshStandardMaterial color="#4ade80" />
          </mesh>
        );
      })}
    </group>
  );
}

function TownMarket({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Market stalls */}
      {[[-1.5, 0, -1], [1.5, 0, -1], [0, 0, 1.5]].map(([x, _y, z], i) => {
        const stallColors = ["#e74c3c", "#3498db", "#f39c12"];
        return (
          <group key={i} position={[x, 0, z]}>
            {/* Counter */}
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[1.2, 0.8, 0.6]} />
              <meshStandardMaterial color="#8b6b4a" />
            </mesh>
            {/* Awning */}
            <mesh position={[0, 1.1, 0]}>
              <boxGeometry args={[1.5, 0.05, 0.9]} />
              <meshStandardMaterial color={stallColors[i]} />
            </mesh>
            {/* Posts */}
            {[-0.6, 0.6].map(px => (
              <mesh key={px} position={[px, 0.55, -0.35]}>
                <cylinderGeometry args={[0.04, 0.04, 1.1, 6]} />
                <meshStandardMaterial color="#5a3a1a" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function CommunityFarm({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Crop rows */}
      {Array.from({ length: 5 }).map((_, row) => (
        <group key={row}>
          {Array.from({ length: 6 }).map((_, col) => (
            <mesh key={col} position={[(col - 2.5) * 0.7, 0.2, (row - 2) * 0.8]}>
              <coneGeometry args={[0.06, 0.4 + Math.sin(row + col) * 0.1, 4]} />
              <meshStandardMaterial color={row % 2 === 0 ? "#22c55e" : "#84cc16"} />
            </mesh>
          ))}
          {/* Soil row */}
          <mesh position={[0, 0.02, (row - 2) * 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4.5, 0.4]} />
            <meshStandardMaterial color="#5a3a1a" />
          </mesh>
        </group>
      ))}
      {/* Fence posts */}
      {[[-2.5, 0, -2.5], [2.5, 0, -2.5], [2.5, 0, 2.5], [-2.5, 0, 2.5]].map(([x, _y, z], i) => (
        <mesh key={i} position={[x, 0.3, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
          <meshStandardMaterial color="#8b6b4a" />
        </mesh>
      ))}
    </group>
  );
}

function OldPond({ position }: { position: [number, number, number] }) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y = 0.05 + Math.sin(clock.elapsedTime * 0.8) * 0.02;
    }
  });
  return (
    <group position={position}>
      {/* Water */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#1e90ff" transparent opacity={0.7} />
      </mesh>
      {/* Shore rocks */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 3.2, 0.15, Math.sin(angle) * 3.2]}>
            <sphereGeometry args={[0.25 + Math.sin(i) * 0.1, 6, 5]} />
            <meshStandardMaterial color="#6b7280" />
          </mesh>
        );
      })}
      {/* Reeds */}
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i / 4) * Math.PI * 2 + 0.3;
        return (
          <mesh key={`r${i}`} position={[Math.cos(angle) * 2.5, 0.5, Math.sin(angle) * 2.5]}>
            <cylinderGeometry args={[0.02, 0.02, 1, 4]} />
            <meshStandardMaterial color="#6b8a3a" />
          </mesh>
        );
      })}
    </group>
  );
}

function DarkForest({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Dark trees */}
      {Array.from({ length: 7 }).map((_, i) => {
        const angle = (i / 7) * Math.PI * 2;
        const r = i === 0 ? 0 : 2.2 + Math.sin(i * 4) * 0.5;
        const height = 2 + Math.sin(i * 3) * 0.8;
        return (
          <group key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
            <mesh position={[0, height / 2, 0]}>
              <cylinderGeometry args={[0.12, 0.18, height, 6]} />
              <meshStandardMaterial color="#3a2a1a" />
            </mesh>
            <mesh position={[0, height + 0.4, 0]}>
              <coneGeometry args={[0.8, 1.6, 6]} />
              <meshStandardMaterial color="#1a3a1a" />
            </mesh>
            <mesh position={[0, height - 0.3, 0]}>
              <coneGeometry args={[1, 1.2, 6]} />
              <meshStandardMaterial color="#1a3a1a" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function RiverDelta({ position }: { position: [number, number, number] }) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y = 0.03 + Math.sin(clock.elapsedTime * 1.2) * 0.02;
    }
  });
  return (
    <group position={position}>
      {/* Water channels */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color="#1e90ff" transparent opacity={0.6} />
      </mesh>
      {/* Islands */}
      {[[-1.5, 0.1, -0.5], [1, 0.1, 0.8], [0, 0.1, -1.2]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[-Math.PI / 2, 0, i * 0.5]}>
          <circleGeometry args={[0.8 + i * 0.2, 8]} />
          <meshStandardMaterial color="#5da34a" />
        </mesh>
      ))}
      {/* Reeds */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`r${i}`} position={[(i - 2) * 1.2, 0.4, 1.2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
          <meshStandardMaterial color="#6b8a3a" />
        </mesh>
      ))}
    </group>
  );
}

function CrystalCaves({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Cave entrance — dark rock mound */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#374151" side={THREE.DoubleSide} />
      </mesh>
      {/* Crystals */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const r = 1.5 + Math.sin(i * 2) * 0.5;
        const h = 0.8 + Math.sin(i * 3) * 0.4;
        const crystalColors = ["#a78bfa", "#818cf8", "#c084fc", "#e879f9", "#67e8f9", "#a5b4fc"];
        return (
          <mesh key={i} position={[Math.cos(angle) * r, h / 2 + 0.1, Math.sin(angle) * r]} rotation={[0.1 * i, 0, 0.15 * i]}>
            <coneGeometry args={[0.15, h, 5]} />
            <meshStandardMaterial
              color={crystalColors[i]}
              emissive={crystalColors[i]}
              emissiveIntensity={0.6}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
      {/* Inner glow */}
      <pointLight position={[0, 0.5, 0]} color="#a78bfa" intensity={2} distance={5} />
    </group>
  );
}

const LANDMARK_COMPONENTS: Record<string, React.FC<{ position: [number, number, number] }>> = {
  starter_town: StarterTown,
  town_arena: TownArena,
  green_meadows: GreenMeadows,
  town_market: TownMarket,
  community_farm: CommunityFarm,
  old_pond: OldPond,
  dark_forest: DarkForest,
  river_delta: RiverDelta,
  crystal_caves: CrystalCaves,
};

// ─── Location Label ─────────────────────────────────────────────────
function LocationLabel({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <Html position={[position[0], 4, position[2]]} center distanceFactor={60} zIndexRange={[0, 0]}>
      <div style={{
        color: "#d1d5db", fontSize: 11, fontWeight: 600, fontFamily: "monospace",
        background: "#111827cc", padding: "2px 8px", borderRadius: 4,
        border: "1px solid #374151", whiteSpace: "nowrap", userSelect: "none",
        pointerEvents: "none",
      }}>
        {name}
      </div>
    </Html>
  );
}

// ─── Paths Between Locations ────────────────────────────────────────
function RoadPath({ from, to }: { from: string; to: string }) {
  const p1 = COORDS_3D[from];
  const p2 = COORDS_3D[to];
  if (!p1 || !p2) return null;

  const midX = (p1[0] + p2[0]) / 2;
  const midZ = (p1[2] + p2[2]) / 2;
  const dx = p2[0] - p1[0];
  const dz = p2[2] - p1[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  return (
    <mesh position={[midX, 0.02, midZ]} rotation={[- Math.PI / 2, 0, angle]}>
      <planeGeometry args={[0.5, length]} />
      <meshStandardMaterial color="#4a4535" transparent opacity={0.6} />
    </mesh>
  );
}

// ─── Trainer Agent 3D ───────────────────────────────────────────────
function TrainerAgent({
  trainer,
  isSelected,
  onSelect,
}: {
  trainer: Trainer;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const wanderRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const wanderTimerRef = useRef(Math.random() * 10);
  const initializedRef = useRef(false);

  const basePos = COORDS_3D[trainer.locationId];
  const destPos = trainer.busyAction === "travel" && trainer.pendingTravelTo
    ? COORDS_3D[trainer.pendingTravelTo]
    : null;

  const styleColor = STYLE_COLORS[trainer._style || "balanced"] || "#a78bfa";

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const base = basePos || [0, 0, 0];

    if (!initializedRef.current) {
      posRef.current.set(base[0], 0, base[2]);
      initializedRef.current = true;
    }

    if (destPos) {
      // Traveling: interpolate between current location and destination
      const progress = 0.5 + Math.sin(clock.elapsedTime * 0.5) * 0.3;
      targetRef.current.set(
        base[0] + (destPos[0] - base[0]) * progress,
        0,
        base[2] + (destPos[2] - base[2]) * progress,
      );
    } else {
      // Idle wander around the location
      wanderTimerRef.current -= delta;
      if (wanderTimerRef.current <= 0) {
        wanderTimerRef.current = 2 + Math.random() * 4;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 2;
        wanderRef.current.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      }
      targetRef.current.set(
        base[0] + wanderRef.current.x,
        0,
        base[2] + wanderRef.current.z,
      );
    }

    // Smooth move towards target
    posRef.current.lerp(targetRef.current, delta * 2);

    // Apply position with bobbing
    const bob = Math.sin(clock.elapsedTime * 3 + trainer.id.charCodeAt(0)) * 0.05;
    groupRef.current.position.set(posRef.current.x, bob, posRef.current.z);

    // Face direction of movement
    const dx = targetRef.current.x - posRef.current.x;
    const dz = targetRef.current.z - posRef.current.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }
  });

  const hpPct = Math.max(0, trainer.health / 100);
  const hpColor = trainer.health > 50 ? "#22c55e" : trainer.health > 20 ? "#eab308" : "#ef4444";

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.7, 0.85, 24]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} />
        </mesh>
      )}

      {/* Body — capsule */}
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.2, 0.5, 8, 16]} />
        <meshStandardMaterial color={styleColor} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color={styleColor} emissive={styleColor} emissiveIntensity={0.2} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.08, 1.1, 0.17]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.08, 1.1, 0.17]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 4]} />
        <meshStandardMaterial color={styleColor} />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={styleColor} emissive={styleColor} emissiveIntensity={0.8} />
      </mesh>

      {/* Name + HP label */}
      <Html position={[0, 1.8, 0]} center distanceFactor={40} zIndexRange={[0, 0]}>
        <div
          style={{
            textAlign: "center", userSelect: "none", cursor: "pointer",
            pointerEvents: "auto",
          }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          <div style={{
            color: isSelected ? "#fbbf24" : "#e5e7eb",
            fontSize: 10, fontWeight: isSelected ? 700 : 500,
            fontFamily: "monospace", whiteSpace: "nowrap",
            textShadow: "0 0 4px #000",
          }}>
            {trainer.name}
          </div>
          {/* HP bar */}
          <div style={{
            width: 36, height: 3, background: "#374151", borderRadius: 2,
            margin: "1px auto 0", overflow: "hidden",
          }}>
            <div style={{
              width: `${hpPct * 100}%`, height: "100%",
              background: hpColor, borderRadius: 2,
            }} />
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── Monster Creature ───────────────────────────────────────────────
function MonsterCreature({
  position,
  element,
  index,
}: {
  position: [number, number, number];
  element: string;
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const color = ELEMENT_COLORS[element] || "#888888";

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Gentle bobbing and rotation
    const t = clock.elapsedTime + index * 2;
    groupRef.current.position.y = position[1] + 0.3 + Math.sin(t * 1.5) * 0.1;
    groupRef.current.rotation.y = t * 0.5;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[0.25, 8, 7]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.08, 0.08, 0.2]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.08, 0.08, 0.2]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Pupils */}
      <mesh position={[0.08, 0.08, 0.24]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh position={[-0.08, 0.08, 0.24]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      {/* Tail/spike */}
      <mesh position={[0, 0.15, -0.2]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.06, 0.2, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// ─── Monsters at Locations ──────────────────────────────────────────
function LocationMonsters({ speciesDex }: { speciesDex: SpeciesInfo[] }) {
  const monsterPlacements = useMemo(() => {
    const placements: { position: [number, number, number]; element: string; index: number }[] = [];
    const habitatMap: Record<string, SpeciesInfo[]> = {};

    speciesDex.forEach(sp => {
      (sp.habitats || []).forEach(h => {
        (habitatMap[h] ||= []).push(sp);
      });
    });

    let idx = 0;
    Object.entries(habitatMap).forEach(([locId, species]) => {
      const base = COORDS_3D[locId];
      if (!base) return;
      // Place up to 3 creatures per location
      const toPlace = species.slice(0, 3);
      toPlace.forEach((sp, i) => {
        const angle = (i / toPlace.length) * Math.PI * 2 + 1; // offset from trainers
        const r = 4 + Math.sin(i * 7) * 0.5;
        placements.push({
          position: [base[0] + Math.cos(angle) * r, 0, base[2] + Math.sin(angle) * r],
          element: sp.element,
          index: idx++,
        });
      });
    });

    return placements;
  }, [speciesDex]);

  return (
    <>
      {monsterPlacements.map((m, i) => (
        <MonsterCreature key={i} position={m.position} element={m.element} index={m.index} />
      ))}
    </>
  );
}

// ─── Ground Terrain ─────────────────────────────────────────────────
function Terrain() {
  return (
    <group>
      {/* Main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[130, 130]} />
        <meshStandardMaterial color="#2d4a2d" />
      </mesh>

      {/* Biome patches */}
      {Object.entries(COORDS_3D).map(([id, pos]) => (
        <mesh key={id} rotation={[-Math.PI / 2, 0, 0]} position={[pos[0], 0.01, pos[2]]}>
          <circleGeometry args={[5, 24]} />
          <meshStandardMaterial color={BIOME_COLORS[id] || "#3a5a3a"} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Scene Contents ─────────────────────────────────────────────────
function SceneContents({
  trainers,
  selected,
  onSelect,
  speciesDex,
}: SimWorld3DProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[30, 40, 20]} intensity={1} castShadow />
      <hemisphereLight color="#87ceeb" groundColor="#2d4a2d" intensity={0.3} />

      {/* Terrain */}
      <Terrain />

      {/* Roads */}
      {EDGES.map(([a, b]) => (
        <RoadPath key={`${a}-${b}`} from={a} to={b} />
      ))}

      {/* Location landmarks */}
      {Object.entries(COORDS_3D).map(([id, pos]) => {
        const Component = LANDMARK_COMPONENTS[id];
        return Component ? <Component key={id} position={pos} /> : null;
      })}

      {/* Location labels */}
      {Object.entries(COORDS_3D).map(([id, pos]) => (
        <LocationLabel key={`label-${id}`} position={pos} name={LOC_NAMES[id] || id} />
      ))}

      {/* Trainers */}
      {trainers.filter(t => t.health > 0).map(t => (
        <TrainerAgent
          key={t.id}
          trainer={t}
          isSelected={t.id === selected}
          onSelect={() => onSelect(t.id === selected ? null : t.id)}
        />
      ))}

      {/* Monsters */}
      {speciesDex && speciesDex.length > 0 && (
        <LocationMonsters speciesDex={speciesDex} />
      )}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.5}
        minPolarAngle={Math.PI / 6}
        minDistance={20}
        maxDistance={120}
        enablePan
        target={[0, 0, 0]}
      />
    </>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────
export default function SimWorld3D(props: SimWorld3DProps) {
  return (
    <div style={{ width: "100%", height: "100%", background: "#0a1520" }}>
      <Canvas
        camera={{
          position: [60, 60, 60],
          fov: 45,
          near: 0.1,
          far: 500,
        }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true }}
      >
        <SceneContents {...props} />
      </Canvas>
    </div>
  );
}
