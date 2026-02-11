/**
 * Shared type definitions for the AutoMon Agent
 */

export interface CardStats {
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  maxHp: number;
}

export interface CardAbility {
  name: string;
  effect: string;
  power: number;
  cooldown: number;
}

export interface Card {
  _id: string;
  id?: string;
  name: string;
  element: string;
  rarity: string;
  stats: CardStats;
  ability: CardAbility;
}

export interface Battle {
  battleId: string;
  player1: {
    address: string;
    cards: Card[];
    ready: boolean;
  };
  player2?: {
    address: string;
    cards: Card[];
    ready: boolean;
  };
  wager: string;
  status: string;
  winner?: string;
}

export interface Pack {
  packId: string;
  opened: boolean;
  cards: string[];
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Agent {
  address: string;
  name: string;
  personality?: string;
  position?: Position;
  online?: boolean;
  health?: number;
  maxHealth?: number;
  mood?: number;
  moodLabel?: string;
  currentAction?: string;
  currentLocation?: string;
}

export interface StrategicDecision {
  decision: boolean;
  reasoning: string;
  confidence: number;
  details?: Record<string, unknown>;
}

export interface NFTCard {
  tokenId: number;
  automonId: number;
  rarity: number;
}

export interface MintedCard {
  tokenId: number;
  name: string;
  element: string;
  rarity: string;
}
