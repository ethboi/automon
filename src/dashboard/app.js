/* AutoMon Dashboard — Real-time hackathon demo viewer */
(function () {
  "use strict";
  const e = React.createElement;
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ─── Constants ──────────────────────────────────────────────────────
  const LOCATION_COORDS = {
    starter_town:   { x: 50, y: 50 },
    town_arena:     { x: 30, y: 26 },
    green_meadows:  { x: 22, y: 58 },
    town_market:    { x: 72, y: 38 },
    community_farm: { x: 78, y: 64 },
    old_pond:       { x: 14, y: 78 },
    dark_forest:    { x: 10, y: 38 },
    river_delta:    { x: 56, y: 82 },
    crystal_caves:  { x: 30, y: 12 },
  };

  const CONNECTIONS = [
    ["starter_town", "town_arena"],
    ["starter_town", "green_meadows"],
    ["starter_town", "town_market"],
    ["starter_town", "community_farm"],
    ["green_meadows", "old_pond"],
    ["green_meadows", "dark_forest"],
    ["town_market", "town_arena"],
    ["town_market", "community_farm"],
    ["town_market", "river_delta"],
    ["old_pond", "river_delta"],
    ["dark_forest", "crystal_caves"],
    ["river_delta", "crystal_caves"],
  ];

  const LOC_ICONS = {
    starter_town: "🏘️", town_arena: "⚔️", green_meadows: "🌿",
    town_market: "🏪", community_farm: "🌾", old_pond: "🎣",
    dark_forest: "🌲", river_delta: "🌊", crystal_caves: "💎",
  };

  const DANGER = {
    starter_town: 1, town_arena: 2, green_meadows: 2, town_market: 1,
    community_farm: 1, old_pond: 2, dark_forest: 5, river_delta: 3, crystal_caves: 7,
  };

  const DANGER_COLORS = { 1: "#22c55e", 2: "#84cc16", 3: "#eab308", 5: "#f97316", 7: "#ef4444" };

  const STYLE_COLORS = {
    explorer: "#3b82f6", grinder: "#ef4444", hoarder: "#eab308",
    farmer: "#22c55e", balanced: "#a78bfa",
  };
  const STYLE_ICONS = {
    explorer: "🧭", grinder: "⚔️", hoarder: "💰", farmer: "🌱", balanced: "⚖️",
  };

  const ELEMENT_COLORS = {
    fire: "#ef4444", water: "#3b82f6", earth: "#a16207", air: "#67e8f9",
    electric: "#eab308", shadow: "#8b5cf6", light: "#fbbf24",
  };

  const EVENT_ICONS = {
    decision: "🧠", travel: "🚶", battle: "⚔️", pvp: "🤺", catch: "🎯",
    level_up: "⬆️", evolution: "⚡", faint: "💀", death: "☠️", trade: "💰",
    heal: "💚", farm: "🌱", gather: "🎒", explore: "🔍", train: "💪",
    eat: "🍖", feed: "🦴", rest: "😴", weather: "🌤️", system: "⚙️", market: "📈",
    buy: "🛒", sell: "💵", fish: "🎣", mine: "⛏️", sleep: "💤",
    heal_automon: "💚", feed_automon: "🦴",
  };

  const IMPORTANT_EVENTS = new Set(["pvp", "death", "evolution", "level_up", "catch", "faint"]);

  const WEATHER_ICONS = { clear: "☀️", rain: "🌧️", storm: "⛈️", fog: "🌫️", heat: "🔥" };
  const TIME_ICONS = { dawn: "🌅", morning: "🌤️", afternoon: "☀️", evening: "🌆", night: "🌙" };

  const ITEM_ICONS = {
    trail_ration: "🍖", hearty_meal: "🍲", automon_chow: "🦴", lux_chow: "🥩",
    basic_trap: "🪤", pro_trap: "⚙️", bait: "🪱", ore: "⛏️", fiber: "🧵",
    herb: "🌿", minor_potion: "🧪", quick_berries_seed: "🫐",
    hearty_roots_seed: "🥕", golden_apples_seed: "🍎",
  };

  const RANK_ICONS = ["👑", "🥈", "🥉"];

  // ─── Helpers ────────────────────────────────────────────────────────
  function inferStyle(trainer) {
    const events = trainer._events || [];
    const lv = trainer.locationId;
    const battles = events.filter(e => e.type === "battle" || e.type === "pvp").length;
    const catches = events.filter(e => e.type === "catch").length;
    const farms = events.filter(e => e.type === "farm").length;
    const gathers = events.filter(e => e.type === "gather" || e.type === "mine" || e.type === "fish").length;
    const travels = events.filter(e => e.type === "travel").length;

    if (travels > 5) return "explorer";
    if (battles > catches * 2 && battles > 3) return "grinder";
    if (gathers > 4 || trainer.gold > 200) return "hoarder";
    if (farms > 3 || lv === "community_farm") return "farmer";
    return "balanced";
  }

  function fmtItem(id) {
    return id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).replace(" Seed", "");
  }

  // ─── WorldMap Component ─────────────────────────────────────────────
  function WorldMap({ locations, trainers, selected, onSelect }) {
    const locById = useMemo(() => {
      const m = {};
      (locations || []).forEach(l => { m[l.id] = l; });
      return m;
    }, [locations]);

    const trainersByLoc = useMemo(() => {
      const m = {};
      trainers.filter(t => t.health > 0).forEach(t => {
        if (!m[t.locationId]) m[t.locationId] = [];
        m[t.locationId].push(t);
      });
      return m;
    }, [trainers]);

    return e("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "xMidYMid meet", style: { width: "100%", height: "100%" } },
      // Grid
      e("defs", null,
        e("pattern", { id: "grid", width: 10, height: 10, patternUnits: "userSpaceOnUse" },
          e("path", { d: "M10 0L0 0 0 10", fill: "none", stroke: "#1f2937", strokeWidth: 0.15 })
        ),
        e("filter", { id: "glow" },
          e("feGaussianBlur", { stdDeviation: 0.8, result: "blur" }),
          e("feMerge", null, e("feMergeNode", { in: "blur" }), e("feMergeNode", { in: "SourceGraphic" }))
        )
      ),
      e("rect", { width: 100, height: 100, fill: "url(#grid)" }),

      // Connections
      CONNECTIONS.map(([from, to]) => {
        const a = LOCATION_COORDS[from], b = LOCATION_COORDS[to];
        return e("line", { key: from + to, x1: a.x, y1: a.y, x2: b.x, y2: b.y, className: "connection" });
      }),

      // Locations
      Object.entries(LOCATION_COORDS).map(([id, pos]) => {
        const danger = DANGER[id] || 1;
        const color = DANGER_COLORS[danger] || "#6b7280";
        const here = trainersByLoc[id] || [];
        const hasSelected = here.some(t => t.id === selected);

        return e("g", { key: id },
          // Glow circle
          e("circle", { cx: pos.x, cy: pos.y, r: here.length > 0 ? 4 : 2.8, fill: color + "15", stroke: color, strokeWidth: hasSelected ? 0.5 : 0.25, filter: here.length > 0 ? "url(#glow)" : undefined }),
          // Icon
          e("text", { x: pos.x, y: pos.y + 1, textAnchor: "middle", className: "loc-icon" }, LOC_ICONS[id] || "📍"),
          // Label
          e("text", { x: pos.x, y: pos.y - 4.5, textAnchor: "middle", className: "loc-label" }, locById[id]?.name || id),

          // Trainer dots
          here.map((trainer, i) => {
            const angle = (i / Math.max(here.length, 1)) * Math.PI * 2 - Math.PI / 2;
            const r = 6;
            const tx = pos.x + Math.cos(angle) * r;
            const ty = pos.y + Math.sin(angle) * r;
            const style = trainer._style || "balanced";
            const isSelected = trainer.id === selected;

            return e("g", { key: trainer.id, className: "trainer-dot", onClick: () => onSelect(isSelected ? null : trainer.id) },
              // Selection ring
              isSelected && e("circle", { cx: tx, cy: ty, r: 3, fill: "none", stroke: "#fbbf24", strokeWidth: 0.3, className: "selection-ring" }),
              // Dot
              e("circle", { cx: tx, cy: ty, r: isSelected ? 2 : 1.6, fill: STYLE_COLORS[style] || "#a78bfa", stroke: isSelected ? "#fbbf24" : "#000", strokeWidth: isSelected ? 0.3 : 0.15, filter: "url(#glow)" }),
              // Health bar
              e("rect", { x: tx - 1.8, y: ty + 2.2, width: 3.6, height: 0.5, rx: 0.25, className: "health-bg" }),
              e("rect", { x: tx - 1.8, y: ty + 2.2, width: 3.6 * Math.max(0, trainer.health / 100), height: 0.5, rx: 0.25, fill: trainer.health > 50 ? "#22c55e" : trainer.health > 20 ? "#eab308" : "#ef4444" }),
              // Name
              e("text", { x: tx, y: ty - 2.8, textAnchor: "middle", className: "trainer-name" + (isSelected ? " selected" : "") }, trainer.name),
              // Style icon
              e("text", { x: tx + 2.2, y: ty + 0.6, fontSize: "1.6px" }, STYLE_ICONS[style] || "⚖️")
            );
          })
        );
      })
    );
  }

  // ─── TrainerPanel ───────────────────────────────────────────────────
  function StatBar({ label, value, max, color }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return e("div", { className: "stat-bar" },
      e("span", { className: "label" }, label),
      e("div", { className: "track" }, e("div", { className: "fill", style: { width: pct + "%", backgroundColor: color } })),
      e("span", { className: "value" }, Math.round(value))
    );
  }

  function TrainerPanel({ trainer, trainers, selected, onSelect, events }) {
    if (!trainer) {
      return e("div", { className: "card trainer-panel" },
        e("div", { className: "card-header" }, "Trainer Detail"),
        e("div", { className: "card-body" },
          e("div", { className: "placeholder" },
            e("div", { className: "big" }, "👆"),
            e("div", null, "Click a trainer on the map"),
            e("div", { className: "quick-select" },
              trainers.filter(t => t.health > 0).map(t =>
                e("button", { key: t.id, className: "quick-btn", onClick: () => onSelect(t.id) }, t.name)
              )
            )
          )
        )
      );
    }

    const isDead = trainer.health <= 0;
    const style = trainer._style || "balanced";
    const trainerEvents = events.filter(ev => ev.trainerId === trainer.id);
    const lastDecision = [...trainerEvents].reverse().find(ev => ev.reasoning);
    const battles = trainerEvents.filter(ev => ev.type === "battle" || ev.type === "pvp").length;
    const wins = trainerEvents.filter(ev => (ev.type === "battle" || ev.type === "pvp") && ev.message.includes("defeated")).length;
    const catches = trainerEvents.filter(ev => ev.type === "catch" && ev.message.includes("caught")).length;

    return e("div", { className: "card trainer-panel" },
      e("div", { className: "card-header" }, "Trainer Detail"),
      e("div", { className: "card-body" },
        // Header
        e("div", { className: "trainer-header" },
          e("div", { className: "trainer-avatar" }, isDead ? "☠️" : "🧑‍🎤"),
          e("div", { className: "trainer-info" },
            e("div", { className: "trainer-title" }, trainer.name, isDead && e("span", { style: { fontSize: 10, color: "#ef4444", marginLeft: 6 } }, "DEAD")),
            e("div", { className: "trainer-meta" },
              e("span", { className: "badge badge-" + style }, (STYLE_ICONS[style] || "") + " " + style),
              "Elo " + trainer.elo,
              "💰 " + trainer.gold + "G"
            )
          )
        ),

        // Stat bars
        StatBar({ label: "❤️ Health", value: Math.max(0, trainer.health), max: 100, color: "#ef4444" }),
        StatBar({ label: "⚡ Energy", value: trainer.energy, max: 100, color: "#3b82f6" }),
        StatBar({ label: "🍖 Hunger", value: trainer.hunger, max: 100, color: "#f97316" }),

        // Current action
        lastDecision && e("div", { className: "current-action" },
          e("div", { className: "action-label" }, "LATEST DECISION"),
          e("div", { className: "action-name" }, lastDecision.message),
          lastDecision.reasoning && e("div", { className: "action-reason" }, "💭 \"" + lastDecision.reasoning + "\"")
        ),

        // Stable
        e("div", { className: "section-label" }, "STABLE (" + trainer.automons.length + "/" + trainer.stableCapacity + ")"),
        trainer.automons.map(mon =>
          e("div", { key: mon.id, className: "automon-card" + (mon.status === "fainted" ? " fainted" : "") },
            e("div", { className: "automon-top" },
              e("div", { style: { display: "flex", alignItems: "center" } },
                e("span", { className: "element-tag", style: { backgroundColor: (ELEMENT_COLORS[mon.element] || "#666") + "22", color: ELEMENT_COLORS[mon.element] || "#999" } }, mon.element),
                e("span", { className: "automon-name" }, mon.nickname),
                e("span", { className: "automon-level" }, "Lv" + mon.level)
              ),
              e("span", { style: { fontSize: 10, color: "#6b7280" } }, mon.personality)
            ),
            StatBar({ label: "HP", value: mon.health, max: mon.maxHealth, color: "#ef4444" }),
            e("div", { className: "automon-stats" },
              "ATK:" + mon.stats.attack, " DEF:" + mon.stats.defense,
              " SPD:" + mon.stats.speed, " ❤️:" + mon.loyalty
            )
          )
        ),

        // Inventory
        e("div", { className: "section-label" }, "INVENTORY"),
        e("div", { className: "inv-grid" },
          Object.entries(trainer.inventory || {}).filter(([, q]) => q > 0).map(([id, q]) =>
            e("span", { key: id, className: "inv-item" }, (ITEM_ICONS[id] || "📦") + " " + fmtItem(id) + " ×" + q)
          ),
          Object.values(trainer.inventory || {}).every(q => q === 0) && e("span", { style: { fontSize: 10, color: "#6b7280" } }, "Empty")
        ),

        // Mini stats
        e("div", { className: "mini-stats" },
          e("div", { className: "mini-stat" }, e("div", { className: "icon" }, "⚔️"), e("div", { className: "val" }, wins + "/" + battles), e("div", { className: "lbl" }, "Battles")),
          e("div", { className: "mini-stat" }, e("div", { className: "icon" }, "🎯"), e("div", { className: "val" }, catches), e("div", { className: "lbl" }, "Catches")),
          e("div", { className: "mini-stat" }, e("div", { className: "icon" }, "💰"), e("div", { className: "val" }, trainer.gold + "G"), e("div", { className: "lbl" }, "Gold"))
        ),

        // Recent decisions
        trainerEvents.filter(ev => ev.reasoning).length > 0 && e(React.Fragment, null,
          e("div", { className: "section-label" }, "RECENT DECISIONS"),
          e("div", { className: "decisions" },
            trainerEvents.filter(ev => ev.reasoning).slice(-5).reverse().map((d, i) =>
              e("div", { key: i, className: "decision" },
                e("span", { className: "tick" }, "T" + d.tick + " "),
                e("span", { className: "act" }, d.type + " "),
                e("span", { className: "why" }, "\"" + d.reasoning + "\"")
              )
            )
          )
        )
      )
    );
  }

  // ─── Leaderboard ────────────────────────────────────────────────────
  function Leaderboard({ trainers, selected, onSelect }) {
    const alive = [...trainers].filter(t => t.health > 0).sort((a, b) => b.elo - a.elo);
    const dead = trainers.filter(t => t.health <= 0);

    return e("div", { className: "card leaderboard-panel" },
      e("div", { className: "card-header" }, "Leaderboard"),
      e("div", { className: "card-body" },
        alive.map((t, i) => {
          const style = t._style || "balanced";
          return e("div", {
            key: t.id,
            className: "lb-entry" + (t.id === selected ? " selected" : ""),
            onClick: () => onSelect(t.id),
          },
            e("span", { className: "lb-rank" }, i < 3 ? RANK_ICONS[i] : (i + 1)),
            e("div", { className: "lb-dot", style: { backgroundColor: STYLE_COLORS[style] } }),
            e("div", { className: "lb-info" },
              e("div", { className: "lb-name" }, t.name),
              e("div", { className: "lb-sub" }, t.gold + "G • " + t.automons.length + " mons")
            ),
            e("div", { style: { textAlign: "right" } },
              e("div", { className: "lb-elo" }, t.elo),
              e("div", { className: "lb-elo-label" }, "elo")
            )
          );
        }),
        dead.length > 0 && e("div", { style: { borderTop: "1px solid #252d3d", marginTop: 4, paddingTop: 4 } },
          dead.map(t => e("div", { key: t.id, className: "lb-entry lb-dead" },
            e("span", { className: "lb-rank" }, "☠️"),
            e("div", { className: "lb-name" }, t.name)
          ))
        )
      )
    );
  }

  // ─── EventFeed ──────────────────────────────────────────────────────
  function EventFeed({ events, trainers }) {
    const ref = useRef(null);
    useEffect(() => {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [events.length]);

    const names = useMemo(() => {
      const m = {};
      trainers.forEach(t => { m[t.id] = t.name; });
      return m;
    }, [trainers]);

    return e("div", { className: "card event-feed" },
      e("div", { className: "card-header", style: { display: "flex", justifyContent: "space-between" } },
        e("span", null, "Event Feed"),
        e("span", null, events.length + " events")
      ),
      e("div", { className: "card-body", ref: ref },
        events.slice(-80).map((ev, i) => {
          const isImportant = IMPORTANT_EVENTS.has(ev.type);
          const icon = EVENT_ICONS[ev.type] || EVENT_ICONS.system;
          return e("div", { key: ev.tick + "-" + i, className: "event" + (isImportant ? " important" : "") },
            e("span", { className: "e-tick" }, "T" + ev.tick),
            e("span", { className: "e-icon" }, icon),
            e("div", { style: { flex: 1 } },
              e("span", { className: "e-msg e-" + ev.type }, ev.message),
              ev.reasoning && ev.type !== "system" && e("div", { className: "e-reason" }, "💭 \"" + ev.reasoning + "\"")
            )
          );
        })
      )
    );
  }

  // ─── Main App ───────────────────────────────────────────────────────
  function App() {
    const [snapshot, setSnapshot] = useState(null);
    const [status, setStatus] = useState("connecting");
    const [selected, setSelected] = useState(null);
    const [speed, setSpeed] = useState(1);
    const [running, setRunning] = useState(true);
    const wsRef = useRef(null);

    useEffect(() => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(protocol + "://" + location.host);
      wsRef.current = ws;

      ws.onopen = () => setStatus("live");
      ws.onclose = () => setStatus("disconnected");
      ws.onerror = () => setStatus("error");
      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          if (payload.type === "snapshot") setSnapshot(payload.data);
        } catch (err) { console.error("bad ws payload", err); }
      };

      return () => ws.close();
    }, []);

    const sendCmd = useCallback((command, value) => {
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: "command", command, value }));
      }
    }, []);

    if (!snapshot) {
      return e("div", { className: "connecting" },
        e("div", { className: "pulse" }, "🎮"),
        e("h1", null, "AutoMon Dashboard"),
        e("div", null, status === "connecting" ? "Connecting to simulation server..." : "Waiting for data..."),
        e("code", null, "npm run sim")
      );
    }

    const state = snapshot.state;

    // Enrich trainers with inferred styles
    const trainers = state.trainers.map(t => ({
      ...t,
      _style: inferStyle(t),
      _events: state.events.filter(ev => ev.trainerId === t.id),
    }));

    const selectedTrainer = trainers.find(t => t.id === selected) || null;

    return e("div", { id: "app-root" },
      // Header
      e("div", { className: "header" },
        e("div", { className: "header-left" },
          e("span", { className: "logo" }, "🎮"),
          e("span", { className: "title" }, "AutoMon"),
          e("span", { className: "subtitle" }, "Autonomous Agent Simulation")
        ),
        // Stats bar
        e("div", { className: "stats-bar" },
          e("div", { className: "stat" }, e("span", { className: "icon" }, TIME_ICONS[state.timeOfDay] || "⏰"), "Day " + state.day),
          e("div", { className: "stat" }, e("span", null, "T" + state.tick)),
          e("div", { className: "stat" }, e("span", { className: "icon" }, WEATHER_ICONS[state.weather] || "🌤️"), state.weather),
          e("div", { className: "stat" }, "👥 " + trainers.filter(t => t.health > 0).length + " alive")
        ),
        // Controls
        e("div", { className: "controls" },
          e("button", {
            className: "btn " + (running ? "pause" : "play"),
            onClick: () => { running ? sendCmd("pause") : sendCmd("resume"); setRunning(!running); }
          }, running ? "⏸ Pause" : "▶ Play"),
          e("div", { className: "speed-group" },
            [1, 2, 5, 10].map(s =>
              e("button", { key: s, className: "btn" + (speed === s ? " active" : ""), onClick: () => { sendCmd("speed", s); setSpeed(s); } }, s + "x")
            )
          ),
          e("button", { className: "btn danger", onClick: () => sendCmd("reset"), title: "Reset world" }, "🔄")
        )
      ),

      // Main grid
      e("div", { className: "main" },
        // World Map
        e("div", { className: "card world-map" },
          e("div", { className: "card-header" }, "World Map"),
          e("div", { className: "card-body", style: { padding: 0 } },
            WorldMap({ locations: snapshot.locationGraph, trainers, selected, onSelect: setSelected })
          )
        ),

        // Right panel
        e("div", { className: "right-panel" },
          TrainerPanel({ trainer: selectedTrainer, trainers, selected, onSelect: setSelected, events: state.events }),
          Leaderboard({ trainers, selected, onSelect: setSelected })
        ),

        // Event Feed
        EventFeed({ events: state.events, trainers })
      )
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("app"));
  root.render(e(App));
})();
