# AutoMon - Autonomous Monster Trainer Sim

Persistent multi-agent monster-taming world built with TypeScript/Node.js.

## Features

- Tick-based world simulation (`TICK_MS`, default `10000` ms; `24` ticks/day)
- Multiple autonomous trainers sharing one world
- OpenAI-driven decisions (`gpt-4o-mini`) per trainer per tick
- Survival systems: health, energy, hunger, gold, inventory
- AutoMon systems: hunger, loyalty, levels, XP, abilities, evolution, status
- Element combat advantages including shadow/light mutual bonus
- Connected world graph with danger, travel time, and action constraints
- Activities: survival, economy, farming, crafting, exploration, catching, PvE/PvP
- Arena ELO leaderboard and dynamic market prices
- JSON persistence (`save/game-state.json`)
- Real-time dashboard (React via browser runtime + WebSocket)

## Project Structure

- `src/engine` - tick loop, mechanics, battle, persistence
- `src/agent` - OpenAI prompt + response parsing + fallback policy
- `src/data` - species, locations, items, abilities, constants, seed
- `src/server` - HTTP + WebSocket server
- `src/dashboard` - React dashboard static assets
- `src/types` - shared TypeScript interfaces

## Run

```bash
npm start
```

Open:

- `http://localhost:3000/dashboard`

## Environment

- `OPENAI_API_KEY` - optional. If missing, fallback heuristics control trainers.
- `TICK_MS` - optional tick duration in milliseconds.
- `PORT` - optional server port (default `3000`).

Example:

```bash
OPENAI_API_KEY=sk-... TICK_MS=3000 npm start
```

## Notes

- If OpenAI is unavailable, trainers still act using local fallback logic.
- World state persists every tick to `save/game-state.json`.
