"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────
interface Snapshot {
  tickMs: number;
  locationGraph: Array<{ id: string; name: string; dangerLevel: number; connections: Array<{ to: string; travelTicks: number }> }>;
  speciesDex: Array<{ id: string; name: string; element: string; rarity: string }>;
  state: GameState;
}

interface GameState {
  tick: number;
  day: number;
  weather: string;
  timeOfDay: string;
  trainers: Trainer[];
  market: { prices: Record<string, number>; trend: Record<string, string> };
  events: GameEvent[];
  leaderboard: Array<{ trainerId: string; elo: number }>;
}

interface Trainer {
  id: string;
  name: string;
  health: number;
  energy: number;
  hunger: number;
  gold: number;
  locationId: string;
  inventory: Record<string, number>;
  stableCapacity: number;
  automons: AutoMon[];
  elo: number;
  crops: { cropType: string; plantedAtTick: number; wateredTicks: number; growthTicks: number }[];
  _style?: string;
}

interface AutoMon {
  id: string;
  speciesId: string;
  nickname: string;
  element: string;
  level: number;
  health: number;
  maxHealth: number;
  hunger: number;
  loyalty: number;
  stats: { attack: number; defense: number; speed: number; stamina: number };
  status: string;
  personality: string;
  xp: number;
}

interface GameEvent {
  tick: number;
  day: number;
  type: string;
  trainerId?: string;
  message: string;
  reasoning?: string;
}

// ─── Constants ────────────────────────────────────────────────────
const COORDS: Record<string, { x: number; y: number }> = {
  starter_town: { x: 50, y: 50 }, town_arena: { x: 30, y: 26 },
  green_meadows: { x: 22, y: 58 }, town_market: { x: 72, y: 38 },
  community_farm: { x: 78, y: 64 }, old_pond: { x: 14, y: 78 },
  dark_forest: { x: 10, y: 38 }, river_delta: { x: 56, y: 82 },
  crystal_caves: { x: 30, y: 12 },
};

const EDGES = [
  ["starter_town", "town_arena"], ["starter_town", "green_meadows"],
  ["starter_town", "town_market"], ["starter_town", "community_farm"],
  ["green_meadows", "old_pond"], ["green_meadows", "dark_forest"],
  ["town_market", "town_arena"], ["town_market", "community_farm"],
  ["town_market", "river_delta"], ["old_pond", "river_delta"],
  ["dark_forest", "crystal_caves"], ["river_delta", "crystal_caves"],
];

const LOC_ICON: Record<string, string> = {
  starter_town: "🏘️", town_arena: "⚔️", green_meadows: "🌿",
  town_market: "🏪", community_farm: "🌾", old_pond: "🎣",
  dark_forest: "🌲", river_delta: "🌊", crystal_caves: "💎",
};

const DANGER: Record<string, number> = {
  starter_town: 1, town_arena: 2, green_meadows: 2, town_market: 1,
  community_farm: 1, old_pond: 2, dark_forest: 5, river_delta: 3, crystal_caves: 7,
};
const DC: Record<number, string> = { 1: "#22c55e", 2: "#84cc16", 3: "#eab308", 5: "#f97316", 7: "#ef4444" };

const SC: Record<string, string> = { explorer: "#3b82f6", grinder: "#ef4444", hoarder: "#eab308", farmer: "#22c55e", balanced: "#a78bfa" };
const SI: Record<string, string> = { explorer: "🧭", grinder: "⚔️", hoarder: "💰", farmer: "🌱", balanced: "⚖️" };
const EC: Record<string, string> = { fire: "#ef4444", water: "#3b82f6", earth: "#a16207", air: "#67e8f9", electric: "#eab308", shadow: "#8b5cf6", light: "#fbbf24" };

const EI: Record<string, string> = {
  decision: "🧠", travel: "🚶", battle: "⚔️", pvp: "🤺", catch: "🎯",
  level_up: "⬆️", evolution: "⚡", faint: "💀", death: "☠️", trade: "💰",
  heal: "💚", farm: "🌱", gather: "🎒", explore: "🔍", train: "💪",
  eat: "🍖", feed: "🦴", rest: "😴", weather: "🌤️", system: "⚙️",
  market: "📈", buy: "🛒", sell: "💵", fish: "🎣", mine: "⛏️",
  sleep: "💤", heal_automon: "💚", feed_automon: "🦴",
};

const WI: Record<string, string> = { clear: "☀️", rain: "🌧️", storm: "⛈️", fog: "🌫️", heat: "🔥" };
const TI: Record<string, string> = { dawn: "🌅", morning: "🌤️", afternoon: "☀️", evening: "🌆", night: "🌙" };
const II: Record<string, string> = {
  trail_ration: "🍖", hearty_meal: "🍲", automon_chow: "🦴", lux_chow: "🥩",
  basic_trap: "🪤", pro_trap: "⚙️", bait: "🪱", ore: "⛏️", fiber: "🧵",
  herb: "🌿", minor_potion: "🧪", quick_berries_seed: "🫐",
  hearty_roots_seed: "🥕", golden_apples_seed: "🍎",
};

const IMPORTANT = new Set(["pvp", "death", "evolution", "level_up", "catch", "faint"]);
const RANKS = ["👑", "🥈", "🥉"];

function inferStyle(t: Trainer, events: GameEvent[]): string {
  const te = events.filter(e => e.trainerId === t.id);
  const battles = te.filter(e => e.type === "battle" || e.type === "pvp").length;
  const farms = te.filter(e => e.type === "farm").length;
  const gathers = te.filter(e => e.type === "gather" || e.type === "mine" || e.type === "fish").length;
  const travels = te.filter(e => e.type === "travel").length;
  if (travels > 5) return "explorer";
  if (battles > 3) return "grinder";
  if (gathers > 4 || t.gold > 200) return "hoarder";
  if (farms > 3 || t.locationId === "community_farm") return "farmer";
  return "balanced";
}

function fmtItem(id: string) { return id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).replace(" Seed", ""); }

// ─── Styles (inline for self-containment) ─────────────────────────
const S = {
  page: { height: "100vh", display: "flex", flexDirection: "column" as const, overflow: "hidden", background: "#0a0e17" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#111827", borderBottom: "1px solid #252d3d", flexShrink: 0 },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  logo: { fontSize: 22 },
  title: { fontSize: 18, fontWeight: 700, background: "linear-gradient(135deg, #f59e0b, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  sub: { fontSize: 11, color: "#6b7280" },
  statsBar: { display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#9ca3af" },
  stat: { display: "flex", alignItems: "center", gap: 4 },
  controls: { display: "flex", alignItems: "center", gap: 8 },
  btn: (active?: boolean, color?: string) => ({
    padding: "4px 12px", borderRadius: 6, border: `1px solid ${active ? (color || "#3b82f6") : "#252d3d"}`,
    background: active ? (color || "#3b82f6") : "#1a1f2e", color: active ? "#fff" : "#9ca3af",
    cursor: "pointer", fontSize: 12, fontWeight: 500,
  }),
  main: { flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", gridTemplateRows: "1fr 200px", gap: 8, padding: 8, minHeight: 0 },
  card: { background: "#1a1f2e", border: "1px solid #252d3d", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" as const },
  cardHeader: { padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "1px solid #252d3d", flexShrink: 0 },
  cardBody: { flex: 1, overflowY: "auto" as const, padding: 8, minHeight: 0 },
  rightPanel: { gridRow: "1/3", gridColumn: 2, display: "flex", flexDirection: "column" as const, gap: 8, minHeight: 0 },
  sectionLabel: { fontSize: 10, color: "#6b7280", fontWeight: 600, letterSpacing: 0.3, margin: "6px 0 3px", textTransform: "uppercase" as const },
};

// ─── Components ───────────────────────────────────────────────────

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "3px 0" }}>
      <span style={{ fontSize: 11, width: 70, color: "#9ca3af" }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: 10, width: 24, textAlign: "right", color: "#6b7280" }}>{Math.round(value)}</span>
    </div>
  );
}

function WorldMap({ locs, trainers, selected, onSelect }: { locs: Snapshot["locationGraph"]; trainers: Trainer[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const byLoc = useMemo(() => {
    const m: Record<string, Trainer[]> = {};
    trainers.filter(t => t.health > 0).forEach(t => {
      (m[t.locationId] ||= []).push(t);
    });
    return m;
  }, [trainers]);

  const locNames = useMemo(() => {
    const m: Record<string, string> = {};
    locs.forEach(l => m[l.id] = l.name);
    return m;
  }, [locs]);

  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="g" width={10} height={10} patternUnits="userSpaceOnUse">
          <path d="M10 0L0 0 0 10" fill="none" stroke="#1f2937" strokeWidth={0.15} />
        </pattern>
        <filter id="gl">
          <feGaussianBlur stdDeviation={0.8} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={100} height={100} fill="url(#g)" />

      {EDGES.map(([a, b]) => {
        const pa = COORDS[a], pb = COORDS[b];
        return <line key={a + b} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#252d3d" strokeWidth={0.3} strokeDasharray="1.5,1" />;
      })}

      {Object.entries(COORDS).map(([id, pos]) => {
        const d = DANGER[id] || 1;
        const col = DC[d] || "#6b7280";
        const here = byLoc[id] || [];
        const hasSel = here.some(t => t.id === selected);

        return (
          <g key={id}>
            <circle cx={pos.x} cy={pos.y} r={here.length > 0 ? 4 : 2.8} fill={col + "15"} stroke={col} strokeWidth={hasSel ? 0.5 : 0.25} filter={here.length > 0 ? "url(#gl)" : undefined} />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" fontSize={3.5} style={{ pointerEvents: "none" }}>{LOC_ICON[id] || "📍"}</text>
            <text x={pos.x} y={pos.y - 4.5} textAnchor="middle" fontSize={2} fill="#9ca3af" fontWeight={500} style={{ pointerEvents: "none" }}>{locNames[id] || id}</text>

            {here.map((trainer, i) => {
              const angle = (i / Math.max(here.length, 1)) * Math.PI * 2 - Math.PI / 2;
              const tx = pos.x + Math.cos(angle) * 6;
              const ty = pos.y + Math.sin(angle) * 6;
              const sty = trainer._style || "balanced";
              const isSel = trainer.id === selected;

              return (
                <g key={trainer.id} style={{ cursor: "pointer" }} onClick={() => onSelect(isSel ? null : trainer.id)}>
                  {isSel && <circle cx={tx} cy={ty} r={3} fill="none" stroke="#fbbf24" strokeWidth={0.3} opacity={0.7}>
                    <animate attributeName="r" values="2.8;3.4;2.8" dur="1.5s" repeatCount="indefinite" />
                  </circle>}
                  <circle cx={tx} cy={ty} r={isSel ? 2 : 1.6} fill={SC[sty] || "#a78bfa"} stroke={isSel ? "#fbbf24" : "#000"} strokeWidth={isSel ? 0.3 : 0.15} filter="url(#gl)" />
                  <rect x={tx - 1.8} y={ty + 2.2} width={3.6} height={0.5} rx={0.25} fill="#374151" />
                  <rect x={tx - 1.8} y={ty + 2.2} width={3.6 * Math.max(0, trainer.health / 100)} height={0.5} rx={0.25} fill={trainer.health > 50 ? "#22c55e" : trainer.health > 20 ? "#eab308" : "#ef4444"} />
                  <text x={tx} y={ty - 2.8} textAnchor="middle" fontSize={1.8} fill={isSel ? "#fbbf24" : "#e5e7eb"} fontWeight={isSel ? 700 : 500} style={{ pointerEvents: "none" }}>{trainer.name}</text>
                  <text x={tx + 2.2} y={ty + 0.6} fontSize={1.6} style={{ pointerEvents: "none" }}>{SI[sty] || "⚖️"}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function TrainerPanel({ trainer, trainers, events, onSelect }: { trainer: Trainer | null; trainers: Trainer[]; events: GameEvent[]; selected: string | null; onSelect: (id: string) => void }) {
  if (!trainer) {
    return (
      <div style={{ ...S.card, flex: 1 }}>
        <div style={S.cardHeader}>Trainer Detail</div>
        <div style={{ ...S.cardBody, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#6b7280" }}>
          <div style={{ fontSize: 32 }}>👆</div>
          <div>Click a trainer on the map</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, marginTop: 6 }}>
            {trainers.filter(t => t.health > 0).map(t => (
              <button key={t.id} onClick={() => onSelect(t.id)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 4, border: "1px solid #252d3d", background: "#1a1f2e", color: "#9ca3af", cursor: "pointer" }}>{t.name}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sty = trainer._style || "balanced";
  const te = events.filter(e => e.trainerId === trainer.id);
  const lastDec = [...te].reverse().find(e => e.reasoning);
  const battles = te.filter(e => e.type === "battle" || e.type === "pvp").length;
  const wins = te.filter(e => (e.type === "battle" || e.type === "pvp") && e.message.includes("defeated")).length;
  const catches = te.filter(e => e.type === "catch" && e.message.includes("caught")).length;

  return (
    <div style={{ ...S.card, flex: 1, minHeight: 0 }}>
      <div style={S.cardHeader}>Trainer Detail</div>
      <div style={{ ...S.cardBody, overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 28 }}>{trainer.health <= 0 ? "☠️" : "🧑‍🎤"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{trainer.name}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: (SC[sty] || "#a78bfa") + "22", color: SC[sty] || "#a78bfa" }}>{SI[sty]} {sty}</span>
              <span>Elo {trainer.elo}</span>
              <span>💰 {trainer.gold}G</span>
            </div>
          </div>
        </div>

        <StatBar label="❤️ Health" value={Math.max(0, trainer.health)} max={100} color="#ef4444" />
        <StatBar label="⚡ Energy" value={trainer.energy} max={100} color="#3b82f6" />
        <StatBar label="🍖 Hunger" value={trainer.hunger} max={100} color="#f97316" />

        {lastDec && (
          <div style={{ background: "#1f293744", border: "1px solid #252d3d", borderRadius: 6, padding: "6px 8px", margin: "6px 0" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>LATEST DECISION</div>
            <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>{lastDec.message}</div>
            {lastDec.reasoning && <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic", marginTop: 2 }}>💭 &quot;{lastDec.reasoning}&quot;</div>}
          </div>
        )}

        <div style={S.sectionLabel}>STABLE ({trainer.automons.length}/{trainer.stableCapacity})</div>
        {trainer.automons.map(mon => (
          <div key={mon.id} style={{ background: "#11182744", border: "1px solid #252d3d", borderRadius: 6, padding: "6px 8px", margin: "4px 0", opacity: mon.status === "fainted" ? 0.4 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, background: (EC[mon.element] || "#666") + "22", color: EC[mon.element] || "#999" }}>{mon.element}</span>
                <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6 }}>{mon.nickname}</span>
                <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 4 }}>Lv{mon.level}</span>
              </div>
              <span style={{ fontSize: 10, color: "#6b7280" }}>{mon.personality}</span>
            </div>
            <StatBar label="HP" value={mon.health} max={mon.maxHealth} color="#ef4444" />
            <div style={{ fontSize: 10, color: "#6b7280", display: "flex", gap: 6 }}>
              <span>ATK:{mon.stats.attack}</span><span>DEF:{mon.stats.defense}</span><span>SPD:{mon.stats.speed}</span><span>❤️:{mon.loyalty}</span>
            </div>
          </div>
        ))}

        <div style={S.sectionLabel}>INVENTORY</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(trainer.inventory || {}).filter(([, q]) => q > 0).map(([id, q]) => (
            <span key={id} style={{ fontSize: 10, background: "#1f293766", padding: "2px 6px", borderRadius: 4, color: "#9ca3af" }}>{II[id] || "📦"} {fmtItem(id)} ×{q}</span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 6 }}>
          {[{ icon: "⚔️", val: `${wins}/${battles}`, lbl: "Battles" }, { icon: "🎯", val: String(catches), lbl: "Catches" }, { icon: "💰", val: `${trainer.gold}G`, lbl: "Gold" }].map((s, i) => (
            <div key={i} style={{ textAlign: "center", background: "#1f293744", borderRadius: 6, padding: 6 }}>
              <div style={{ fontSize: 16 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontSize: 9, color: "#6b7280" }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        {te.filter(e => e.reasoning).length > 0 && <>
          <div style={S.sectionLabel}>RECENT DECISIONS</div>
          <div style={{ maxHeight: 100, overflowY: "auto" }}>
            {te.filter(e => e.reasoning).slice(-5).reverse().map((d, i) => (
              <div key={i} style={{ fontSize: 10, padding: "3px 6px", margin: "2px 0", background: "#1f293733", borderRadius: 4 }}>
                <span style={{ color: "#6b7280" }}>T{d.tick} </span>
                <span style={{ color: "#f59e0b", fontWeight: 500 }}>{d.type} </span>
                <span style={{ color: "#6b7280", fontStyle: "italic" }}>&quot;{d.reasoning}&quot;</span>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

function Leaderboard({ trainers, selected, onSelect }: { trainers: Trainer[]; selected: string | null; onSelect: (id: string) => void }) {
  const alive = [...trainers].filter(t => t.health > 0).sort((a, b) => b.elo - a.elo);
  const dead = trainers.filter(t => t.health <= 0);

  return (
    <div style={{ ...S.card, flexShrink: 0, maxHeight: 220 }}>
      <div style={S.cardHeader}>Leaderboard</div>
      <div style={S.cardBody}>
        {alive.map((t, i) => (
          <div key={t.id} onClick={() => onSelect(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 6, cursor: "pointer", background: t.id === selected ? "#1f293799" : "transparent", outline: t.id === selected ? "1px solid #f59e0b44" : "none" }}>
            <span style={{ width: 18, textAlign: "center", fontSize: 13 }}>{i < 3 ? RANKS[i] : i + 1}</span>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: SC[t._style || "balanced"] }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{t.gold}G • {t.automons.length} mons</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>{t.elo}</div>
              <div style={{ fontSize: 9, color: "#6b7280" }}>elo</div>
            </div>
          </div>
        ))}
        {dead.length > 0 && <div style={{ borderTop: "1px solid #252d3d", marginTop: 4, paddingTop: 4 }}>
          {dead.map(t => <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", opacity: 0.35 }}><span>☠️</span><span style={{ textDecoration: "line-through" }}>{t.name}</span></div>)}
        </div>}
      </div>
    </div>
  );
}

function EventFeed({ events }: { events: GameEvent[]; trainers: Trainer[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events.length]);

  return (
    <div style={{ ...S.card, gridRow: 2, gridColumn: 1 }}>
      <div style={{ ...S.cardHeader, display: "flex", justifyContent: "space-between" }}>
        <span>Event Feed</span><span>{events.length} events</span>
      </div>
      <div ref={ref} style={S.cardBody}>
        {events.slice(-80).map((ev, i) => {
          const imp = IMPORTANT.has(ev.type);
          return (
            <div key={`${ev.tick}-${i}`} style={{ display: "flex", gap: 6, padding: imp ? "3px 6px" : "2px 4px", fontSize: 11, alignItems: "flex-start", background: imp ? "#1f293744" : "transparent", borderRadius: imp ? 4 : 0, margin: "1px 0" }}>
              <span style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 10, width: 28, flexShrink: 0 }}>T{ev.tick}</span>
              <span style={{ flexShrink: 0, fontSize: 12 }}>{EI[ev.type] || "⚙️"}</span>
              <div style={{ flex: 1 }}>
                <span>{ev.message}</span>
                {ev.reasoning && ev.type !== "system" && (
                  <div style={{ fontSize: 10, color: "#6b7280", fontStyle: "italic", marginTop: 1, paddingLeft: 8, borderLeft: "2px solid #252d3d" }}>
                    💭 &quot;{ev.reasoning}&quot;
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState("connecting");
  const [selected, setSelected] = useState<string | null>(null);
  const [speed, setSpeedState] = useState(1);
  const [running, setRunning] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = typeof window !== "undefined"
    ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:3001`
    : "";

  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setStatus("live");
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (msg) => {
      try {
        const p = JSON.parse(msg.data);
        if (p.type === "snapshot") setSnapshot(p.data);
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [wsUrl]);

  const cmd = useCallback((command: string, value?: number) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "command", command, value }));
    }
  }, []);

  if (!snapshot) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, color: "#9ca3af" }}>
        <div style={{ fontSize: 48, animation: "pulse 1.5s infinite" }}>🎮</div>
        <h1 style={{ fontSize: 22, color: "#e5e7eb" }}>AutoMon Dashboard</h1>
        <div>{status === "connecting" ? "Connecting to simulation server..." : "Waiting for data..."}</div>
        <code style={{ background: "#1a1f2e", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>npm run sim</code>
        <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>
    );
  }

  const state = snapshot.state;
  const trainers = state.trainers.map(t => ({ ...t, _style: inferStyle(t, state.events) }));
  const sel = trainers.find(t => t.id === selected) || null;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.logo}>🎮</span>
          <span style={S.title}>AutoMon</span>
          <span style={S.sub}>Autonomous Agent Simulation</span>
        </div>
        <div style={S.statsBar}>
          <div style={S.stat}><span>{TI[state.timeOfDay] || "⏰"}</span> Day {state.day}</div>
          <div style={S.stat}>T{state.tick}</div>
          <div style={S.stat}><span>{WI[state.weather] || "🌤️"}</span> {state.weather}</div>
          <div style={S.stat}>👥 {trainers.filter(t => t.health > 0).length} alive</div>
        </div>
        <div style={S.controls}>
          <button style={S.btn(false, running ? "#f59e0b" : "#22c55e")} onClick={() => { if (running) { cmd("pause"); } else { cmd("resume"); } setRunning(!running); }}>
            {running ? "⏸ Pause" : "▶ Play"}
          </button>
          {[1, 2, 5, 10].map(s => (
            <button key={s} style={S.btn(speed === s)} onClick={() => { cmd("speed", s); setSpeedState(s); }}>{s}x</button>
          ))}
          <button style={S.btn(false, "#ef4444")} onClick={() => cmd("reset")}>🔄</button>
        </div>
      </div>

      {/* Grid */}
      <div style={S.main}>
        <div style={{ ...S.card, gridRow: 1, gridColumn: 1 }}>
          <div style={S.cardHeader}>World Map</div>
          <div style={{ flex: 1, padding: 0, minHeight: 0 }}>
            <WorldMap locs={snapshot.locationGraph} trainers={trainers} selected={selected} onSelect={setSelected} />
          </div>
        </div>

        <div style={S.rightPanel}>
          <TrainerPanel trainer={sel} trainers={trainers} events={state.events} selected={selected} onSelect={setSelected} />
          <Leaderboard trainers={trainers} selected={selected} onSelect={setSelected} />
        </div>

        <EventFeed events={state.events} trainers={trainers} />
      </div>
    </div>
  );
}
