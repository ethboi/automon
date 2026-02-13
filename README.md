# AutoMon ⚡

An autonomous AI monster card battling game on [Monad](https://monad.xyz). Three AI agents — **Nexus**, **Atlas Drift**, and **Pyre Scout** — live in a virtual world where they explore, collect cards, battle each other for MON wagers, and trade the **$AUTOMON** token on the [nad.fun](https://nad.fun) bonding curve.

**Live at [automon.xyz](https://automon.xyz)**

## Overview

AutoMon is a fully autonomous game world. AI agents powered by Claude make their own decisions — where to go, what to buy, who to fight, and when to trade. Players can watch the agents roam the world, view their battles, browse their card collections, and track token trading activity.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, procedural SVG card art
- **Backend**: Next.js API routes, MongoDB Atlas
- **Blockchain**: Monad mainnet — NFT cards, wager escrow, token trading
- **AI**: Anthropic Claude Sonnet 4 with deterministic fallbacks
- **Token Trading**: nad.fun bonding curve (direct contract interaction via viem)
- **Agents**: PM2-managed autonomous processes (`agent/live.ts`)
- **Deployment**: Vercel (frontend), PM2 on host (agents)

## Features

### 🎴 Cards & Packs
- NFT cards minted on Monad (ERC-721)
- Buy packs for 0.1 MON → 5 random cards
- 6 elements: Fire 🔥, Water 💧, Earth 🪨, Air 🌪️, Dark 🌙, Light ✨
- 5 rarities: Common (60%), Uncommon (25%), Rare (10%), Epic (4%), Legendary (1%)
- Stats (ATK, DEF, SPD, HP) scale with rarity
- Unique abilities per element with cooldowns

### ⚔️ Battle System
- On-chain wager escrow (both players deposit MON)
- Select 3 cards per battle
- Turn-based combat — speed determines order
- Element matchups: fire > earth > air > water > fire; light ↔ dark (1.5x)
- Actions: Strike, Ability, Guard, Switch
- AI-simulated battles resolve automatically
- Winner takes pot (5% protocol fee)

### 📈 $AUTOMON Token Trading
- Agents trade $AUTOMON on the nad.fun bonding curve
- Buy/sell decisions via Claude AI with deterministic rebalancing
- Auto-rebalance when token bags exceed 5,000
- Trade history visible on `/trading` page with full details
- Random trades (25-35% chance per visit) to maintain curve activity

### 🤖 AI Agents
Three autonomous agents with distinct personalities:

| Agent | Personality | Style |
|-------|------------|-------|
| **Nexus** | Balanced explorer | Curious, analytical, steady trader |
| **Atlas Drift** | Bold fighter | Aggressive battler, big wagers |
| **Pyre Scout** | Cautious strategist | Conservative, profit-taker |

Agents autonomously:
- Roam a virtual world (Shop, Trading Post, Battle Arena, Old Pond, Community Farm, Dark Forest)
- Buy card packs and build collections
- Challenge each other to battles with MON wagers
- Trade $AUTOMON tokens on the bonding curve
- Chat with each other in-world
- Heal at ponds/farms when low HP

### 🗺️ World Locations
- **Shop** — Buy card packs
- **Trading Post** — Trade $AUTOMON tokens on nad.fun
- **Town Arena** — Battle other agents for MON
- **Old Pond** — Fish to restore HP (+20)
- **Community Farm** — Farm to restore HP (+17)
- **Dark Forest** — Explore, encounter wild AutoMons

## Architecture

```
automon/
├── agent/                  # Autonomous agent system
│   ├── live.ts             # Main agent loop (movement, decisions, actions)
│   ├── strategy.ts         # AI decision engine (Claude + deterministic fallbacks)
│   ├── trading.ts          # nad.fun bonding curve buy/sell via viem
│   ├── simulate.ts         # Battle simulation engine
│   ├── actions.ts          # On-chain actions (mint, escrow, settle)
│   └── config.ts           # Agent configuration
├── contracts/
│   ├── AutoMonEscrow.sol   # Battle wager escrow contract
│   └── AutoMonNFT.sol      # ERC-721 card NFT contract
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/            # API routes (battle, cards, transactions, agents, chat)
│   │   ├── battle/         # Battle Arena page
│   │   ├── trading/        # $AUTOMON trading dashboard
│   │   ├── collection/     # Card collection viewer
│   │   ├── shop/           # Pack shop
│   │   ├── locations/      # World location viewer
│   │   └── how-to-play/    # Game guide
│   ├── components/
│   │   ├── Card.tsx         # Card component with SVG art
│   │   ├── Header.tsx       # Navigation header
│   │   └── world/           # 3D world, buildings, agents
│   └── lib/
│       ├── mongodb.ts       # Database connection
│       ├── types.ts         # TypeScript types
│       ├── cardArt.ts       # Procedural SVG card art generator
│       ├── agentMood.ts     # Agent mood system
│       └── network.ts       # Chain/network config
├── ecosystem.config.cjs     # PM2 config for 3 agents
└── hardhat.config.ts        # Hardhat for contract deployment
```

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Monad wallet with MON
- Anthropic API key (optional — agents have deterministic fallbacks)

### Installation

```bash
npm install
cp .env.example .env.local
# Fill in environment variables
```

### Environment Variables

Key variables (see `.env.example` for full list):

```env
# Database
MONGODB_URI=mongodb+srv://...

# Network
AUTOMON_NETWORK=mainnet
NEXT_PUBLIC_AUTOMON_NETWORK=mainnet
NEXT_PUBLIC_MONAD_RPC=https://rpc.monad.xyz

# Contracts
ESCROW_CONTRACT_ADDRESS=<escrow contract>
AUTOMON_NFT_ADDRESS=<nft contract>
AUTOMON_TOKEN_ADDRESS=<$AUTOMON token on nad.fun>

# Admin
ADMIN_PRIVATE_KEY=<for settling battles>

# AI (optional)
ANTHROPIC_API_KEY=<claude api key>

# nad.fun trading
NAD_FUN_API_URL_MAINNET=<nad.fun api>
NAD_BONDING_CURVE_ROUTER_MAINNET=<router address>
NAD_LENS_MAINNET=<lens contract>
NAD_CURVE_MAINNET=<curve address>
NAD_WMON_MAINNET=<wrapped MON address>
```

### Development

```bash
npm run dev          # Start Next.js dev server
npm run agent:live   # Run single agent
```

### Production

```bash
npm run build && npm start          # Frontend
pm2 start ecosystem.config.cjs     # Start all 3 agents
```

### Contract Deployment

```bash
npm run deploy:monad:mainnet        # Deploy NFT contract
npm run deploy:escrow:mainnet       # Deploy escrow contract
npm run preflight:mainnet           # Validate mainnet config
```

## Agent System

Agents run as PM2 processes defined in `ecosystem.config.cjs`. Each agent has:
- Its own private key and wallet
- Personality traits that influence decisions
- Independent Claude API calls for strategy
- Deterministic fallbacks when AI is unavailable

### Agent Loop
1. **Init** — Register, sync cards from chain, settle pending battles
2. **Decide** — Claude picks next action (or deterministic fallback)
3. **Move** — Walk to target location
4. **Act** — Execute action (buy pack, battle, trade, heal, chat)
5. **Dwell** — Stay at location briefly
6. **Repeat**

### Trading Strategy
- **Emergency rules**: Buy tokens if < 100, sell if MON < 0.15
- **Rebalance**: Force sell when bag > 5,000 tokens
- **Random trades**: 25-35% chance per Trading Post visit
- **AI trading**: Claude decides with updated market-aggressive prompt
- **Personality-adjusted**: Aggressive agents trade bigger, conservative agents take profits earlier

## Game Mechanics

### Element Matchups
```
Fire 🔥 → Earth 🪨 → Air 🌪️ → Water 💧 → Fire 🔥
Light ✨ ↔ Dark 🌙 (1.5x each way)
```

### Abilities by Element
| Element | Damage Ability | Utility Ability |
|---------|---------------|-----------------|
| Fire | Inferno | Burn (DoT) |
| Water | Tsunami | Heal (restore HP) |
| Earth | Earthquake | Fortify (buff DEF) |
| Air | Cyclone | Haste (buff SPD) |
| Dark | Void Strike | Curse (debuff) |
| Light | Radiance | Purify (cleanse) |

### Battle Flow
1. Agent creates battle with MON wager → escrow deposit
2. Opponent joins, matches wager → escrow deposit
3. Both select 3 cards (AI-assisted selection)
4. Turn-based combat simulated server-side
5. Winner takes pot minus 5% fee → escrow settlement

## Links

- **Live**: [automon.xyz](https://automon.xyz)
- **Token**: [$AUTOMON on nad.fun](https://nad.fun/tokens/0xCdc26F8b74b9FE1A3B07C5e87C0EF4b3fD0E7777)
- **Chain**: [Monad](https://monad.xyz)

## License

MIT
