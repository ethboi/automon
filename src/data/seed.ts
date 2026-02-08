import { ABILITY_BY_ID } from "./abilities";
import { ITEM_BY_ID } from "./items";
import { SPECIES_BY_ID } from "./species";
import { STARTING_INVENTORY } from "./constants";
import { AutoMon, GameState, Trainer } from "../types/game";
import { sample, randInt } from "../utils/random";

const uid = () => Math.random().toString(36).slice(2, 10);

const createAutoMon = (speciesId: string, level: number): AutoMon => {
  const species = SPECIES_BY_ID[speciesId];
  const maxHealth = 60 + species.baseStats.stamina * 3 + level * 4;
  const abilities = species.baseAbilities.filter((abilityId) => ABILITY_BY_ID[abilityId].unlockLevel <= level);
  return {
    id: `am_${uid()}`,
    speciesId,
    nickname: species.name,
    element: species.element,
    level,
    xp: 0,
    health: maxHealth,
    maxHealth,
    hunger: 80,
    loyalty: 70,
    stats: {
      attack: species.baseStats.attack + level,
      defense: species.baseStats.defense + Math.floor(level / 2),
      speed: species.baseStats.speed + Math.floor(level / 2),
      stamina: species.baseStats.stamina + Math.floor(level / 2),
    },
    abilities,
    status: "healthy",
    personality: sample(species.personalityPool),
    staminaCurrent: 20 + species.baseStats.stamina,
  };
};

const createTrainer = (name: string, starterSpeciesId: string): Trainer => ({
  id: `tr_${uid()}`,
  name,
  health: 100,
  energy: 90,
  hunger: 90,
  gold: 120,
  locationId: "starter_town",
  inventory: { ...STARTING_INVENTORY },
  stableCapacity: 3,
  automons: [createAutoMon(starterSpeciesId, randInt(3, 5))],
  crops: [],
  elo: 1000,
});

export const createInitialState = (): GameState => {
  const prices = Object.fromEntries(Object.values(ITEM_BY_ID).map((item) => [item.id, item.price]));
  const state: GameState = {
    tick: 0,
    day: 1,
    weather: "clear",
    timeOfDay: "dawn",
    trainers: [
      createTrainer("Astra", "sparkit"),
      createTrainer("Bram", "drizzlefin"),
      createTrainer("Cyra", "cindercub"),
    ],
    market: {
      prices,
      trend: Object.fromEntries(Object.keys(prices).map((id) => [id, "steady"])),
    },
    events: [{ tick: 0, day: 1, type: "system", message: "World initialized." }],
    leaderboard: [],
  };
  state.leaderboard = state.trainers
    .map((trainer) => ({ trainerId: trainer.id, elo: trainer.elo }))
    .sort((a, b) => b.elo - a.elo);
  return state;
};
