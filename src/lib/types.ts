import { ObjectId } from 'mongodb';

export type Element = 'fire' | 'water' | 'earth' | 'air' | 'dark' | 'light';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CardStats {
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  maxHp: number;
}

export interface Ability {
  name: string;
  effect: 'damage' | 'heal' | 'buff' | 'debuff' | 'dot';
  power: number;
  cooldown: number;
  currentCooldown?: number;
  description: string;
}

export interface Card {
  _id?: ObjectId;
  id?: string;
  owner: string;
  name: string;
  element: Element;
  rarity: Rarity;
  stats: CardStats;
  ability: Ability;
  level: number;
  xp: number;
  packId: string;
  createdAt: Date;
}

export interface BattleCard extends Card {
  currentHp: number;
  buffs: Buff[];
  debuffs: Debuff[];
  statusEffects: StatusEffect[];
  isStunned?: boolean; // Can't use STRIKE/SKILL/GUARD but can switch
}

export interface Buff {
  stat: 'attack' | 'defense' | 'speed';
  amount: number;
  turnsRemaining: number;
}

export interface Debuff {
  type: 'curse' | 'burn';
  power: number;
  turnsRemaining: number;
}

export interface PlayerState {
  address: string;
  cards: BattleCard[];
  activeCardIndex: number;
  ready: boolean;
}

export interface BattleRound {
  turn: number;
  player1Move?: BattleMove;
  player2Move?: BattleMove;
  triangleResult?: {
    player1Result: TriangleResult;
    player2Result: TriangleResult;
  };
  events: BattleEvent[];
  timestamp: Date;
}

// Action Triangle: STRIKE > SKILL > GUARD > STRIKE
export type BattleAction = 'strike' | 'skill' | 'guard' | 'switch';
export type TriangleResult = 'win' | 'lose' | 'neutral';

export interface BattleMove {
  action: BattleAction;
  targetIndex?: number; // For switch - which card to switch to
  prediction?: string; // AI's prediction of opponent's move
  reasoning?: string; // AI's reasoning for this decision
}

// Status effect types
export type StatusType = 'burn' | 'stun' | 'speed_up' | 'speed_down' | 'attack_up' | 'attack_down' | 'defense_up' | 'defense_down' | 'regen';

export interface StatusEffect {
  type: StatusType;
  power: number; // damage for burn/regen, percentage for buffs/debuffs
  turnsRemaining: number;
  source: string; // card name that applied this
}

export type BattleEventType =
  | 'action_reveal' // When both players reveal their actions
  | 'triangle_result' // Result of action triangle comparison
  | 'damage' // Damage dealt
  | 'heal' // HP restored
  | 'status_applied' // Status effect applied
  | 'status_tick' // Status effect damage/heal tick
  | 'status_expired' // Status effect wore off
  | 'faint' // Card fainted
  | 'switch' // Card switched out
  | 'guard_counter' // Guard counters strike
  | 'skill_pierce' // Skill pierces guard
  | 'interrupt' // Strike interrupts skill
  | 'element_advantage' // Element matchup message
  | 'battle_start' // Battle begins
  | 'battle_end'; // Battle ends

export interface BattleEvent {
  type: BattleEventType;
  source: string;
  target: string;
  value?: number;
  message: string;
  triangleResult?: TriangleResult;
  elementMultiplier?: number;
  action?: BattleAction;
  prediction?: string;
  reasoning?: string;
}

export type BattleStatus = 'pending' | 'selecting' | 'active' | 'complete' | 'cancelled';

export interface Battle {
  _id?: ObjectId;
  battleId: string;
  player1: PlayerState;
  player2: PlayerState | null;
  wager: string;
  status: BattleStatus;
  currentTurn: number;
  rounds: BattleRound[];
  winner: string | null;
  escrowTxHash: string | null;
  settleTxHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Pack {
  _id?: ObjectId;
  packId: string;
  owner: string;
  purchaseTxHash: string;
  price: string;
  opened: boolean;
  cards: string[];
  createdAt: Date;
  openedAt: Date | null;
}

export type TournamentStatus = 'upcoming' | 'registration' | 'active' | 'complete';

export interface TournamentMatch {
  round: number;
  matchIndex: number;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  battleId: string | null;
}

export interface Tournament {
  _id?: ObjectId;
  tournamentId: string;
  name: string;
  entryFee: string;
  prizePool: string;
  maxParticipants: 8 | 16;
  participants: string[];
  bracket: TournamentMatch[];
  status: TournamentStatus;
  winner: string | null;
  startAt: Date;
  createdAt: Date;
}

export interface User {
  _id?: ObjectId;
  address: string;
  nonce: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface AgentDecision {
  action: BattleAction;
  targetIndex?: number;
  prediction: string; // What the AI predicts the opponent will do
  reasoning: string; // Detailed explanation of the decision
  confidence?: number; // 0-100 confidence level
}

// Full battle log for replay and analysis
export interface BattleTurnLog {
  turn: number;
  player1: {
    address: string;
    activeCard: string;
    cardHp: number;
    action: BattleAction;
    prediction?: string;
    reasoning?: string;
  };
  player2: {
    address: string;
    activeCard: string;
    cardHp: number;
    action: BattleAction;
    prediction?: string;
    reasoning?: string;
  };
  triangleResult: {
    player1Result: TriangleResult;
    player2Result: TriangleResult;
  };
  events: BattleEvent[];
  timestamp: Date;
}

export interface BattleLog {
  battleId: string;
  player1: {
    address: string;
    cards: { id: string; name: string; element: Element }[];
    isAI: boolean;
  };
  player2: {
    address: string;
    cards: { id: string; name: string; element: Element }[];
    isAI: boolean;
  };
  wager: string;
  turns: BattleTurnLog[];
  winner: string;
  totalDamageDealt: { player1: number; player2: number };
  cardsFainted: { player1: number; player2: number };
  duration: number; // in ms
  startedAt: Date;
  endedAt: Date;
}

// AI personality for more interesting battles
export interface AIPersonality {
  name: string;
  aggression: number; // 0-1, higher = more likely to STRIKE
  caution: number; // 0-1, higher = more likely to GUARD
  skillPreference: number; // 0-1, higher = more likely to use SKILL
  adaptability: number; // 0-1, higher = better at predicting opponent
}
