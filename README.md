# AutoMon

A monster card battling game on Monad. Players collect monster cards by buying packs, battle each other for MON wagers, and autonomous agents can play in the world.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Database**: MongoDB Atlas (off-chain state)
- **Blockchain**: Monad (EVM) for wager escrow
- **AI**: Agent strategy with Anthropic Claude and OpenAI-backed endpoints (with fallbacks)
- **Auth**: SIWE (Sign-In With Ethereum)
- **Web3**: ethers.js v6

## Features

### Cards & Packs
- Buy packs for MON (0.1 MON per pack)
- Each pack contains 5 randomly generated cards
- 6 elements: Fire, Water, Earth, Air, Dark, Light
- 5 rarities: Common (60%), Uncommon (25%), Rare (10%), Epic (4%), Legendary (1%)
- Stats scale with rarity (attack, defense, speed, HP)
- Unique abilities per element

### Battle System
- Create battles with MON wager
- Both players deposit to on-chain escrow
- Select 3 cards for battle
- Turn-based combat (speed determines order)
- Element matchups: fire > earth > air > water > fire, light/dark deal 1.5x to each other
- Actions: Attack, Ability (with cooldowns), Switch
- Winner takes pot (5% fee)

### AI Agent
- Autonomous world agents can move, battle, buy/open packs, and post chat
- AI-assisted decision making when API keys are configured
- Fallback behavior keeps agents running without AI keys
- Action reasons are logged to dashboard feeds

### Tournaments
- Entry fee in MON
- 8 or 16 player brackets
- Single elimination
- Prize pool to winner
- Tournament feature exists in code/API (not currently surfaced in main header nav)

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Monad wallet with MON (testnet by default; mainnet supported via env switch)
- Optional AI keys (Anthropic/OpenAI) for enhanced agent decisions

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
MONGODB_URI=mongodb+srv://...
AUTOMON_NETWORK=testnet
NEXT_PUBLIC_AUTOMON_NETWORK=testnet
NEXT_PUBLIC_MONAD_RPC=https://testnet.rpc.monad.xyz
NEXT_PUBLIC_CHAIN_ID=10143
ESCROW_CONTRACT_ADDRESS=<deployed contract address>
ADMIN_PRIVATE_KEY=<for settling battles>
AUTOMON_NFT_ADDRESS=<nft contract address>
NEXT_PUBLIC_AUTOMON_NFT_ADDRESS=<optional client-visible nft address>
ANTHROPIC_API_KEY=<optional>
OPENAI_API_KEY=<optional>
NEXT_PUBLIC_PACK_PRICE=100000000000000000
JWT_SECRET=<random secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For mainnet, set `AUTOMON_NETWORK=mainnet` and provide `*_MAINNET` values (RPC, chainId, and contract addresses).

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
npm start
```

## Smart Contract

The escrow contract (`contracts/AutoMonEscrow.sol`) handles:
- Battle creation with wager deposit
- Battle joining with matched wager
- Settlement by admin (pays winner minus fee)
- Cancellation (refund if no opponent)

Deploy to Monad (testnet by default):
```bash
# Using Hardhat or Foundry
# Set ESCROW_CONTRACT_ADDRESS after deployment
```

## API Routes

### Auth
- `POST /api/auth/nonce` - Get nonce for SIWE
- `POST /api/auth/verify` - Verify signature, get JWT
- `GET /api/auth/session` - Check session
- `POST /api/auth/logout` - Clear session

### Cards & Packs
- `GET /api/cards` - Get player's cards
- `GET /api/packs` - Get player's packs
- `POST /api/packs/buy` - Record pack purchase
- `POST /api/packs/open` - Open pack, generate cards

### Battle
- `GET /api/battle/list` - List open/my battles
- `POST /api/battle/create` - Create battle with wager
- `POST /api/battle/join` - Join battle
- `POST /api/battle/select-cards` - Select 3 cards
- `POST /api/battle/move` - Submit turn action
- `GET /api/battle/[id]` - Get battle state
- `POST /api/battle/cancel` - Cancel pending battle

### Tournament
- `GET /api/tournament/list` - List tournaments
- `POST /api/tournament/enter` - Enter tournament

### World Data / Chat
- `GET /api/dashboard` - World panel feed data (agents, events, tx, battles, chat)
- `GET /api/chat` - Fetch recent chat messages
- `POST /api/chat` - Post global chat message (wallet user or agent auth)

### AI Agent
- `POST /api/agent/decide` - Get AI move decision
- `POST /api/agent/auto` - AI plays full battle

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    api/                  # API routes
    battle/               # Battle page
    collection/           # Card collection page
    shop/                 # Pack shop page
    tournament/           # Tournament page
    agent/                # AI agent page
  components/             # React components
    Header.tsx
    Card.tsx
    PackOpening.tsx
    BattleArena.tsx
  context/
    WalletContext.tsx     # Wallet state management
  lib/
    mongodb.ts            # Database connection
    auth.ts               # SIWE + JWT auth
    cards.ts              # Card generation logic
    battle.ts             # Battle engine
    blockchain.ts         # Contract interaction
    wallet.ts             # Client-side wallet
    agent.ts              # AI decision integration
    types.ts              # TypeScript types
contracts/
  AutoMonEscrow.sol       # Escrow smart contract
```

## Game Mechanics

### Element Matchups
- Fire > Earth > Air > Water > Fire (cycle)
- Light and Dark deal 1.5x damage to each other

### Abilities by Element
- **Fire**: Inferno (damage), Burn (DoT)
- **Water**: Tsunami (damage), Heal (restore HP)
- **Earth**: Earthquake (damage), Fortify (buff defense)
- **Air**: Cyclone (damage), Haste (buff speed)
- **Dark**: Void Strike (damage), Curse (debuff)
- **Light**: Radiance (damage), Purify (remove debuffs)

### Battle Flow
1. Player creates battle with wager
2. Opponent joins, matching wager
3. Both players select 3 cards
4. Turn-based combat until one side has no cards left
5. Winner receives pot minus 5% fee

## License

MIT
