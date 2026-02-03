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
  events: BattleEvent[];
  timestamp: Date;
}

export interface BattleMove {
  action: 'attack' | 'ability' | 'switch';
  targetIndex?: number;
}

export interface BattleEvent {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'faint' | 'switch' | 'dot';
  source: string;
  target: string;
  value?: number;
  message: string;
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
  action: 'attack' | 'ability' | 'switch';
  targetIndex?: number;
  reason: string;
}
