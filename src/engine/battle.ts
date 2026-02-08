import { ABILITY_BY_ID } from "../data/abilities";
import { ITEM_BY_ID } from "../data/items";
import { SPECIES_BY_ID } from "../data/species";
import { AutoMon, Trainer } from "../types/game";
import { clamp } from "../utils/random";

const elementMultiplier = (attacker: string, defender: string): number => {
  const advantage: Record<string, string> = {
    fire: "earth",
    earth: "electric",
    electric: "water",
    water: "fire",
  };
  if ((attacker === "shadow" && defender === "light") || (attacker === "light" && defender === "shadow")) return 1.5;
  return advantage[attacker] === defender ? 1.5 : 1;
};

const chooseAbility = (automon: AutoMon): string => {
  const unlocked = automon.abilities
    .map((id) => ABILITY_BY_ID[id])
    .filter(Boolean)
    .filter((ability) => ability.staminaCost <= automon.staminaCurrent)
    .sort((a, b) => b.power - a.power);

  if (!unlocked.length) {
    return automon.abilities[0];
  }
  return unlocked[0].id;
};

const applyDamage = (attacker: AutoMon, defender: AutoMon, abilityId: string): { damage: number; text: string } => {
  const ability = ABILITY_BY_ID[abilityId];
  const base = ability ? ability.power : 10;
  const multiplier = elementMultiplier(attacker.element, defender.element);
  const scaled = base + attacker.stats.attack - Math.floor(defender.stats.defense * 0.6);
  const damage = Math.max(4, Math.floor(scaled * multiplier));
  defender.health = clamp(defender.health - damage, 0, defender.maxHealth);
  attacker.staminaCurrent = clamp(attacker.staminaCurrent - (ability?.staminaCost ?? 8), 0, 999);

  const species = SPECIES_BY_ID[attacker.speciesId];
  return {
    damage,
    text: `${species.name} used ${ability?.name ?? "Struggle"} for ${damage} damage${multiplier > 1 ? " (element advantage)" : ""}.`,
  };
};

const restorePostBattle = (automon: AutoMon) => {
  automon.staminaCurrent = 20 + automon.stats.stamina;
  if (automon.health === 0) {
    automon.status = "injured";
  } else if (automon.health < Math.floor(automon.maxHealth * 0.25)) {
    automon.status = "exhausted";
  } else {
    automon.status = "healthy";
  }
};

const eloDelta = (winner: number, loser: number): number => {
  const expected = 1 / (1 + Math.pow(10, (loser - winner) / 400));
  return Math.round(28 * (1 - expected));
};

export interface BattleResult {
  winnerId: string;
  loserId: string;
  log: string[];
  winnerGold: number;
  loserGoldLoss: number;
}

export const resolveBattle = (trainerA: Trainer, trainerB: Trainer): BattleResult | null => {
  const a = trainerA.automons.find((x) => x.health > 0);
  const b = trainerB.automons.find((x) => x.health > 0);
  if (!a || !b) return null;

  const log: string[] = [];
  let turn = 0;

  while (a.health > 0 && b.health > 0 && turn < 30) {
    turn += 1;
    const first = a.stats.speed >= b.stats.speed ? [a, b] : [b, a];
    const firstAbility = chooseAbility(first[0]);
    const firstResult = applyDamage(first[0], first[1], firstAbility);
    log.push(`Turn ${turn}: ${firstResult.text}`);
    if (first[1].health <= 0) break;

    const secondAbility = chooseAbility(first[1]);
    const secondResult = applyDamage(first[1], first[0], secondAbility);
    log.push(`Turn ${turn}: ${secondResult.text}`);
  }

  const winner = a.health > 0 ? trainerA : trainerB;
  const loser = winner.id === trainerA.id ? trainerB : trainerA;
  const winnerMon = winner.id === trainerA.id ? a : b;
  const loserMon = winner.id === trainerA.id ? b : a;

  const xpGain = 20 + loserMon.level * 2;
  winnerMon.xp += xpGain;
  winnerMon.loyalty = clamp(winnerMon.loyalty + 4, 0, 100);

  const payout = 25 + loserMon.level * 3;
  const actualLoss = Math.min(loser.gold, payout);
  winner.gold += actualLoss;
  loser.gold -= actualLoss;

  const delta = eloDelta(winner.elo, loser.elo);
  winner.elo += delta;
  loser.elo -= delta;

  loserMon.status = "injured";
  loserMon.health = Math.max(1, Math.floor(loserMon.maxHealth * 0.2));

  restorePostBattle(a);
  restorePostBattle(b);

  return {
    winnerId: winner.id,
    loserId: loser.id,
    log,
    winnerGold: actualLoss,
    loserGoldLoss: actualLoss,
  };
};

export const healAutoMon = (trainer: Trainer, targetId?: string): string => {
  const cost = 35;
  if (trainer.gold < cost) return "Not enough gold to heal.";

  const target = targetId
    ? trainer.automons.find((automon) => automon.id === targetId)
    : trainer.automons.sort((a, b) => a.health - b.health)[0];
  if (!target) return "No AutoMon available to heal.";

  trainer.gold -= cost;
  target.health = target.maxHealth;
  target.status = "healthy";
  target.staminaCurrent = 20 + target.stats.stamina;
  return `Healed ${target.nickname} for ${cost}g.`;
};

export const applyPotion = (trainer: Trainer, automonId?: string): string => {
  if (!trainer.inventory.minor_potion) return "No potion available.";
  const target = automonId
    ? trainer.automons.find((automon) => automon.id === automonId)
    : trainer.automons.sort((a, b) => a.health - b.health)[0];
  if (!target) return "No AutoMon available.";

  const potion = ITEM_BY_ID.minor_potion;
  trainer.inventory.minor_potion -= 1;
  if (trainer.inventory.minor_potion <= 0) delete trainer.inventory.minor_potion;

  target.health = clamp(target.health + (potion.effects?.automonHealth ?? 20), 0, target.maxHealth);
  if (target.health > Math.floor(target.maxHealth * 0.4)) target.status = "healthy";
  return `${trainer.name} used a potion on ${target.nickname}.`;
};
