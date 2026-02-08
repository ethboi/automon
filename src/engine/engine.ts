import { EventEmitter } from "node:events";
import { decideAction } from "../agent/openaiAgent";
import { WEATHER_STATES, TIME_STATES } from "../data/constants";
import { ITEM_BY_ID, ITEMS } from "../data/items";
import { LOCATION_BY_ID, LOCATIONS } from "../data/locations";
import { SPECIES_BY_ID, SPECIES } from "../data/species";
import { healAutoMon, resolveBattle, applyPotion } from "./battle";
import { loadState, saveState, deleteSave } from "./persistence";
import { AgentContext, AgentDecision, AutoMon, GameConfig, GameState, LocationDef, Trainer } from "../types/game";
import { clamp, randInt, sample, weightedChoice } from "../utils/random";

const DEFAULT_CONFIG: GameConfig = {
  tickMs: Number(process.env.TICK_MS ?? 10_000),
  ticksPerDay: 24,
  maxLogEntries: 250,
};

const uid = () => Math.random().toString(36).slice(2, 10);

const xpToNext = (level: number): number => 40 + level * 18;

const itemDelta = (inv: Record<string, number>, id: string, amount: number): void => {
  inv[id] = (inv[id] ?? 0) + amount;
  if (inv[id] <= 0) delete inv[id];
};

const pickWildAutoMon = (location: LocationDef, weather: string, timeOfDay: string): AutoMon | null => {
  if (!location.spawnTable.length) return null;

  const adjusted = location.spawnTable.map((spawn) => {
    let weatherBoost = 0;
    const species = SPECIES_BY_ID[spawn.speciesId];
    if (weather === "rain" && species.element === "water") weatherBoost = 2;
    if (weather === "storm" && species.element === "electric") weatherBoost = 2;
    if (weather === "fog" && species.element === "shadow") weatherBoost = 2;
    if (weather === "heat" && species.element === "fire") weatherBoost = 2;
    if (timeOfDay === "night" && (species.element === "shadow" || species.rarity === "epic")) weatherBoost += 2;
    return { ...spawn, weight: spawn.weight + weatherBoost };
  });

  const chosen = weightedChoice(adjusted);
  if (!chosen) return null;

  const species = SPECIES_BY_ID[chosen.speciesId];
  const level = randInt(chosen.minLevel, chosen.maxLevel);
  const maxHealth = 52 + species.baseStats.stamina * 3 + level * 3;

  return {
    id: `wild_${uid()}`,
    speciesId: species.id,
    nickname: species.name,
    element: species.element,
    level,
    xp: 0,
    health: maxHealth,
    maxHealth,
    hunger: 100,
    loyalty: 0,
    stats: {
      attack: species.baseStats.attack + level,
      defense: species.baseStats.defense + Math.floor(level / 2),
      speed: species.baseStats.speed + Math.floor(level / 2),
      stamina: species.baseStats.stamina + Math.floor(level / 2),
    },
    abilities: [...species.baseAbilities],
    status: "healthy",
    personality: sample(species.personalityPool),
    staminaCurrent: 20 + species.baseStats.stamina,
  };
};

const evolveIfEligible = (automon: AutoMon): string | null => {
  const species = SPECIES_BY_ID[automon.speciesId];
  if (!species.evolveAtLevel || !species.evolvesTo) return null;
  if (automon.level < species.evolveAtLevel) return null;

  const evolved = SPECIES_BY_ID[species.evolvesTo];
  if (!evolved) return null;

  automon.speciesId = evolved.id;
  automon.nickname = evolved.name;
  automon.element = evolved.element;
  automon.maxHealth += 18;
  automon.health = clamp(automon.health + 15, 1, automon.maxHealth);
  automon.stats.attack += 5;
  automon.stats.defense += 4;
  automon.stats.speed += 4;
  automon.stats.stamina += 4;

  for (const abilityId of evolved.baseAbilities) {
    if (!automon.abilities.includes(abilityId)) automon.abilities.push(abilityId);
  }
  return `${species.name} evolved into ${evolved.name}!`;
};

export class GameEngine extends EventEmitter {
  private state: GameState;
  private interval: NodeJS.Timeout | null = null;
  private readonly config: GameConfig;

  constructor(config?: Partial<GameConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = loadState();
  }

  getState(): GameState {
    return this.state;
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.tick().catch((error) => {
        this.addEvent("system", `Tick failed: ${(error as Error).message}`);
        this.flush();
      });
    }, this.config.tickMs);
    this.addEvent("system", `Engine started @ ${this.config.tickMs}ms/tick.`);
    this.flush();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.addEvent("system", "Engine stopped.");
    this.flush();
  }

  setSpeed(multiplier: number): void {
    const wasRunning = !!this.interval;
    if (wasRunning) {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
    }
    this.config.tickMs = Math.max(200, Math.round(10_000 / multiplier));
    if (wasRunning) {
      this.interval = setInterval(() => {
        this.tick().catch((error) => {
          this.addEvent("system", `Tick failed: ${(error as Error).message}`);
          this.flush();
        });
      }, this.config.tickMs);
    }
    this.addEvent("system", `Speed set to ${multiplier}x (${this.config.tickMs}ms/tick).`);
    this.flush();
  }

  reset(): void {
    deleteSave();
    this.state = loadState(); // creates fresh initial state
    this.addEvent("system", "World reset.");
    this.flush();
  }

  private flush(): void {
    this.state.leaderboard = this.state.trainers
      .map((trainer) => ({ trainerId: trainer.id, elo: trainer.elo }))
      .sort((a, b) => b.elo - a.elo);
    saveState(this.state);
    this.emit("state", this.state);
  }

  private addEvent(type: string, message: string, trainerId?: string, reasoning?: string): void {
    this.state.events.push({
      tick: this.state.tick,
      day: this.state.day,
      type,
      trainerId,
      message,
      reasoning,
    });
    if (this.state.events.length > this.config.maxLogEntries) {
      this.state.events = this.state.events.slice(-this.config.maxLogEntries);
    }
  }

  private nextWorldState(): void {
    this.state.tick += 1;
    if (this.state.tick % this.config.ticksPerDay === 0) {
      this.state.day += 1;
      this.state.weather = sample(WEATHER_STATES);
    }
    this.state.timeOfDay = TIME_STATES[this.state.tick % TIME_STATES.length];

    for (const item of ITEMS) {
      const current = this.state.market.prices[item.id] ?? item.price;
      const drift = randInt(-3, 3);
      const next = clamp(current + drift, Math.max(1, Math.floor(item.price * 0.6)), Math.floor(item.price * 1.8));
      this.state.market.prices[item.id] = next;
      this.state.market.trend[item.id] = drift > 0 ? "up" : drift < 0 ? "down" : "steady";
    }
  }

  private applyPassiveNeeds(trainer: Trainer): void {
    trainer.hunger = clamp(trainer.hunger - 2, 0, 100);
    trainer.energy = clamp(trainer.energy - 1, 0, 100);

    if (trainer.hunger === 0) {
      trainer.health = clamp(trainer.health - 4, 0, 100);
      this.addEvent("survival", `${trainer.name} is starving and loses health.`, trainer.id);
    }

    if (trainer.energy === 0) {
      trainer.health = clamp(trainer.health - 2, 0, 100);
    }

    for (const automon of [...trainer.automons]) {
      automon.hunger = clamp(automon.hunger - 1, 0, 100);
      if (automon.hunger === 0) {
        automon.loyalty = clamp(automon.loyalty - 3, 0, 100);
        automon.health = clamp(automon.health - 2, 0, automon.maxHealth);
      }
      if (automon.health === 0) automon.status = "fainted";
      if (automon.loyalty <= 0) {
        trainer.automons = trainer.automons.filter((x) => x.id !== automon.id);
        this.addEvent("automon", `${automon.nickname} ran away from ${trainer.name} due to neglect.`, trainer.id);
      }
    }

    if (trainer.health <= 0) {
      trainer.health = 25;
      trainer.hunger = 25;
      trainer.energy = 30;
      trainer.locationId = "starter_town";
      this.addEvent("survival", `${trainer.name} collapsed and was rescued back to Starter Town.`, trainer.id);
    }
  }

  private buildContext(trainer: Trainer): AgentContext {
    const location = LOCATION_BY_ID[trainer.locationId];
    const nearbyAgents = this.state.trainers
      .filter((other) => other.id !== trainer.id && other.locationId === trainer.locationId)
      .map((other) => ({
        id: other.id,
        name: other.name,
        locationId: other.locationId,
        gold: other.gold,
        elo: other.elo,
      }));

    return {
      trainer,
      nearbyAgents,
      availableActions: location.actions,
      market: this.state.market,
      location,
      recentEvents: this.state.events.slice(-10),
      worldTick: this.state.tick,
      day: this.state.day,
      weather: this.state.weather,
      timeOfDay: this.state.timeOfDay,
    };
  }

  private completeBusyActions(trainer: Trainer): boolean {
    if (!trainer.busyUntilTick) return false;
    if (this.state.tick < trainer.busyUntilTick) return true;

    if (trainer.busyAction === "sleep") {
      trainer.energy = 100;
      trainer.health = clamp(trainer.health + 15, 0, 100);
      this.addEvent("survival", `${trainer.name} woke up fully rested.`, trainer.id);
    }

    if (trainer.busyAction === "travel" && trainer.pendingTravelTo) {
      trainer.locationId = trainer.pendingTravelTo;
      this.addEvent("travel", `${trainer.name} arrived at ${LOCATION_BY_ID[trainer.locationId].name}.`, trainer.id);
    }

    trainer.busyUntilTick = undefined;
    trainer.busyAction = undefined;
    trainer.pendingTravelTo = undefined;
    return false;
  }

  private gainAutoMonXp(trainer: Trainer, amount: number): string[] {
    const log: string[] = [];
    const mon = trainer.automons[0];
    if (!mon) return log;
    mon.xp += amount;

    while (mon.xp >= xpToNext(mon.level)) {
      mon.xp -= xpToNext(mon.level);
      mon.level += 1;
      mon.maxHealth += 8;
      mon.health = clamp(mon.health + 8, 1, mon.maxHealth);
      mon.stats.attack += 2;
      mon.stats.defense += 2;
      mon.stats.speed += 1;
      mon.stats.stamina += 1;
      log.push(`${trainer.name}'s ${mon.nickname} reached level ${mon.level}.`);
      const evolveMessage = evolveIfEligible(mon);
      if (evolveMessage) log.push(`${trainer.name}: ${evolveMessage}`);
    }

    return log;
  }

  private resolveAction(trainer: Trainer, decision: AgentDecision): void {
    const location = LOCATION_BY_ID[trainer.locationId];
    const action = location.actions.includes(decision.action) ? decision.action : "rest";
    const target = decision.target;

    switch (action) {
      case "rest": {
        trainer.energy = clamp(trainer.energy + 10, 0, 100);
        trainer.health = clamp(trainer.health + 2, 0, 100);
        this.addEvent("action", `${trainer.name} rests and recovers.`, trainer.id, decision.reasoning);
        break;
      }
      case "sleep": {
        trainer.busyAction = "sleep";
        trainer.busyUntilTick = this.state.tick + 6;
        this.addEvent("action", `${trainer.name} starts sleeping for 6 ticks.`, trainer.id, decision.reasoning);
        break;
      }
      case "eat": {
        const itemId = target && trainer.inventory[target] ? target : trainer.inventory.trail_ration ? "trail_ration" : "hearty_meal";
        const item = ITEM_BY_ID[itemId];
        if (!item || !trainer.inventory[itemId]) {
          this.addEvent("action", `${trainer.name} tried to eat but has no food.`, trainer.id, decision.reasoning);
          break;
        }
        itemDelta(trainer.inventory, itemId, -1);
        trainer.hunger = clamp(trainer.hunger + (item.effects?.trainerHunger ?? 0), 0, 100);
        trainer.energy = clamp(trainer.energy + (item.effects?.trainerEnergy ?? 0), 0, 100);
        this.addEvent("action", `${trainer.name} ate ${item.name}.`, trainer.id, decision.reasoning);
        break;
      }
      case "feed_automon": {
        if (!trainer.inventory.automon_chow && !trainer.inventory.lux_chow) {
          this.addEvent("action", `${trainer.name} tried to feed an AutoMon but has no feed.`, trainer.id, decision.reasoning);
          break;
        }
        const foodId = trainer.inventory.lux_chow ? "lux_chow" : "automon_chow";
        const food = ITEM_BY_ID[foodId];
        const mon = target ? trainer.automons.find((x) => x.id === target) : trainer.automons.sort((a, b) => a.hunger - b.hunger)[0];
        if (!mon) {
          this.addEvent("action", `${trainer.name} has no AutoMon to feed.`, trainer.id, decision.reasoning);
          break;
        }
        itemDelta(trainer.inventory, foodId, -1);
        mon.hunger = clamp(mon.hunger + (food.effects?.automonHunger ?? 25), 0, 100);
        mon.loyalty = clamp(mon.loyalty + 3 + (food.effects?.automonLoyalty ?? 0), 0, 100);
        this.addEvent("action", `${trainer.name} fed ${mon.nickname}.`, trainer.id, decision.reasoning);
        break;
      }
      case "fish": {
        if (trainer.energy < 5 || !trainer.inventory.bait) {
          this.addEvent("action", `${trainer.name} failed to fish (needs energy and bait).`, trainer.id, decision.reasoning);
          break;
        }
        trainer.energy = clamp(trainer.energy - 5, 0, 100);
        itemDelta(trainer.inventory, "bait", -1);

        let successRate = 0.58;
        if (location.id === "river_delta") successRate += 0.12;
        if (this.state.weather === "rain") successRate += 0.1;
        if (this.state.weather === "storm") successRate -= 0.15;

        if (Math.random() <= successRate) {
          const fishItem = Math.random() > 0.75 ? "hearty_roots_seed" : "trail_ration";
          itemDelta(trainer.inventory, fishItem, 1);
          trainer.gold += 6;
          this.addEvent("economy", `${trainer.name} landed a catch and found ${ITEM_BY_ID[fishItem].name}.`, trainer.id, decision.reasoning);
        } else {
          this.addEvent("economy", `${trainer.name} fished with no luck.`, trainer.id, decision.reasoning);
        }
        break;
      }
      case "plant": {
        const seed = target && trainer.inventory[target] ? target : trainer.inventory.quick_berries_seed ? "quick_berries_seed" : trainer.inventory.hearty_roots_seed ? "hearty_roots_seed" : "golden_apples_seed";
        const growthTicks = seed === "quick_berries_seed" ? 3 : seed === "hearty_roots_seed" ? 8 : 20;
        if (!trainer.inventory[seed]) {
          this.addEvent("farm", `${trainer.name} has no seeds to plant.`, trainer.id, decision.reasoning);
          break;
        }
        itemDelta(trainer.inventory, seed, -1);
        trainer.crops.push({
          cropType: seed === "quick_berries_seed" ? "quick_berries" : seed === "hearty_roots_seed" ? "hearty_roots" : "golden_apples",
          plantedAtTick: this.state.tick,
          wateredTicks: 0,
          growthTicks,
        });
        this.addEvent("farm", `${trainer.name} planted ${seed}.`, trainer.id, decision.reasoning);
        break;
      }
      case "water": {
        const crop = trainer.crops[0];
        if (!crop) {
          this.addEvent("farm", `${trainer.name} has no crops to water.`, trainer.id, decision.reasoning);
          break;
        }
        crop.wateredTicks += 1;
        this.addEvent("farm", `${trainer.name} watered their crops.`, trainer.id, decision.reasoning);
        break;
      }
      case "harvest": {
        const ready = trainer.crops.filter((crop) => this.state.tick - crop.plantedAtTick >= crop.growthTicks - Math.min(2, crop.wateredTicks));
        if (!ready.length) {
          this.addEvent("farm", `${trainer.name} tried to harvest but crops are not ready.`, trainer.id, decision.reasoning);
          break;
        }
        for (const crop of ready) {
          if (crop.cropType === "quick_berries") itemDelta(trainer.inventory, "trail_ration", 2);
          if (crop.cropType === "hearty_roots") itemDelta(trainer.inventory, "hearty_meal", 2);
          if (crop.cropType === "golden_apples") {
            trainer.gold += 45;
            itemDelta(trainer.inventory, "minor_potion", 1);
          }
        }
        trainer.crops = trainer.crops.filter((crop) => !ready.includes(crop));
        this.addEvent("farm", `${trainer.name} harvested ${ready.length} crop(s).`, trainer.id, decision.reasoning);
        break;
      }
      case "gather":
      case "mine": {
        if (trainer.energy < 8) {
          this.addEvent("economy", `${trainer.name} is too tired to gather materials.`, trainer.id, decision.reasoning);
          break;
        }
        trainer.energy -= 8;
        const pool = action === "mine" ? ["ore", "ore", "herb"] : ["fiber", "fiber", "herb", "ore"];
        const reward = sample(pool);
        itemDelta(trainer.inventory, reward, 1);
        this.addEvent("economy", `${trainer.name} gathered ${ITEM_BY_ID[reward].name}.`, trainer.id, decision.reasoning);
        break;
      }
      case "buy": {
        const itemId = target && ITEM_BY_ID[target] ? target : "trail_ration";
        const price = this.state.market.prices[itemId] ?? ITEM_BY_ID[itemId].price;
        if (trainer.gold < price) {
          this.addEvent("market", `${trainer.name} couldn't afford ${ITEM_BY_ID[itemId].name}.`, trainer.id, decision.reasoning);
          break;
        }
        trainer.gold -= price;
        itemDelta(trainer.inventory, itemId, 1);
        this.addEvent("market", `${trainer.name} bought ${ITEM_BY_ID[itemId].name} for ${price}g.`, trainer.id, decision.reasoning);
        break;
      }
      case "sell": {
        const itemId = target && trainer.inventory[target] ? target : Object.keys(trainer.inventory)[0];
        if (!itemId || !trainer.inventory[itemId]) {
          this.addEvent("market", `${trainer.name} has nothing to sell.`, trainer.id, decision.reasoning);
          break;
        }
        const price = Math.max(1, Math.floor((this.state.market.prices[itemId] ?? 5) * 0.8));
        itemDelta(trainer.inventory, itemId, -1);
        trainer.gold += price;
        this.addEvent("market", `${trainer.name} sold ${ITEM_BY_ID[itemId]?.name ?? itemId} for ${price}g.`, trainer.id, decision.reasoning);
        break;
      }
      case "craft": {
        if ((trainer.inventory.herb ?? 0) >= 1 && (trainer.inventory.fiber ?? 0) >= 1) {
          itemDelta(trainer.inventory, "herb", -1);
          itemDelta(trainer.inventory, "fiber", -1);
          itemDelta(trainer.inventory, "minor_potion", 1);
          this.addEvent("craft", `${trainer.name} crafted a Minor Potion.`, trainer.id, decision.reasoning);
        } else {
          this.addEvent("craft", `${trainer.name} failed crafting (needs herb + fiber).`, trainer.id, decision.reasoning);
        }
        break;
      }
      case "battle_pve": {
        if (trainer.energy < 12 || !trainer.automons.length) {
          this.addEvent("battle", `${trainer.name} can't start PvE battle right now.`, trainer.id, decision.reasoning);
          break;
        }
        trainer.energy -= 12;
        const wild = pickWildAutoMon(location, this.state.weather, this.state.timeOfDay);
        const mon = trainer.automons[0];
        if (!wild || !mon) {
          this.addEvent("battle", `${trainer.name} found no suitable PvE opponent.`, trainer.id, decision.reasoning);
          break;
        }

        const trainerProxy: Trainer = {
          ...trainer,
          automons: [mon],
          inventory: { ...trainer.inventory },
          crops: [...trainer.crops],
        };
        const npc: Trainer = {
          id: `npc_${uid()}`,
          name: `Wild ${wild.nickname}`,
          health: 100,
          energy: 100,
          hunger: 100,
          gold: 0,
          locationId: trainer.locationId,
          inventory: {},
          stableCapacity: 1,
          automons: [wild],
          crops: [],
          elo: trainer.elo,
        };

        const result = resolveBattle(trainerProxy, npc);
        if (!result) {
          this.addEvent("battle", `${trainer.name}'s PvE battle failed to resolve.`, trainer.id, decision.reasoning);
          break;
        }

        mon.health = trainerProxy.automons[0].health;
        mon.status = trainerProxy.automons[0].status;
        mon.xp = trainerProxy.automons[0].xp;
        mon.loyalty = trainerProxy.automons[0].loyalty;
        trainer.gold += 12 + Math.floor(wild.level * 1.5);

        const levelLog = this.gainAutoMonXp(trainer, 24 + wild.level * 2);
        this.addEvent("battle", `${trainer.name} won a PvE battle vs ${wild.nickname}.`, trainer.id, decision.reasoning);
        for (const msg of levelLog) this.addEvent("battle", msg, trainer.id);
        break;
      }
      case "battle_pvp": {
        if (trainer.energy < 15) {
          this.addEvent("battle", `${trainer.name} is too tired for PvP.`, trainer.id, decision.reasoning);
          break;
        }
        const rivals = this.state.trainers.filter(
          (other) => other.id !== trainer.id && other.locationId === trainer.locationId && other.automons.some((m) => m.health > 0),
        );
        if (!rivals.length) {
          this.addEvent("battle", `${trainer.name} looked for PvP but found no rivals nearby.`, trainer.id, decision.reasoning);
          break;
        }

        const opponent = target ? rivals.find((r) => r.id === target) ?? sample(rivals) : sample(rivals);
        const entry = 20;
        if (trainer.gold < entry || opponent.gold < entry) {
          this.addEvent("battle", `${trainer.name} or ${opponent.name} lacks gold for PvP entry fee.`, trainer.id, decision.reasoning);
          break;
        }

        trainer.gold -= entry;
        opponent.gold -= entry;
        trainer.energy -= 15;
        opponent.energy = clamp(opponent.energy - 8, 0, 100);

        const result = resolveBattle(trainer, opponent);
        if (!result) {
          this.addEvent("battle", `${trainer.name}'s PvP battle failed to resolve.`, trainer.id, decision.reasoning);
          break;
        }
        const winner = this.state.trainers.find((t) => t.id === result.winnerId);
        if (winner) winner.gold += entry * 2;

        this.addEvent(
          "battle",
          `${trainer.name} battled ${opponent.name}. Winner: ${this.state.trainers.find((t) => t.id === result.winnerId)?.name ?? "unknown"}.`,
          trainer.id,
          decision.reasoning,
        );
        break;
      }
      case "train_automon": {
        const mon = trainer.automons[0];
        if (!mon || trainer.energy < 10) {
          this.addEvent("training", `${trainer.name} cannot train right now.`, trainer.id, decision.reasoning);
          break;
        }
        trainer.energy -= 10;
        const gained = 14;
        const log = this.gainAutoMonXp(trainer, gained);
        this.addEvent("training", `${trainer.name} trained ${mon.nickname} (+${gained} XP).`, trainer.id, decision.reasoning);
        for (const msg of log) this.addEvent("training", msg, trainer.id);
        break;
      }
      case "heal_automon": {
        const message = healAutoMon(trainer, target);
        this.addEvent("healing", `${trainer.name}: ${message}`, trainer.id, decision.reasoning);
        break;
      }
      case "travel": {
        const edge = location.connections.find((conn) => conn.to === target) ?? location.connections[0];
        if (!edge) {
          this.addEvent("travel", `${trainer.name} has nowhere to travel from here.`, trainer.id, decision.reasoning);
          break;
        }
        trainer.busyAction = "travel";
        trainer.pendingTravelTo = edge.to;
        trainer.busyUntilTick = this.state.tick + edge.travelTicks;
        this.addEvent("travel", `${trainer.name} travels to ${LOCATION_BY_ID[edge.to].name} (${edge.travelTicks} ticks).`, trainer.id, decision.reasoning);
        break;
      }
      case "explore": {
        if (trainer.energy < 8) {
          this.addEvent("explore", `${trainer.name} is too tired to explore.`, trainer.id, decision.reasoning);
          break;
        }
        trainer.energy -= 8;
        if (Math.random() < 0.35) {
          const found = sample(["fiber", "herb", "bait", "trail_ration"]);
          itemDelta(trainer.inventory, found, 1);
          this.addEvent("explore", `${trainer.name} explored and found ${ITEM_BY_ID[found].name}.`, trainer.id, decision.reasoning);
        } else {
          this.addEvent("explore", `${trainer.name} explored but found nothing notable.`, trainer.id, decision.reasoning);
        }
        break;
      }
      case "catch_automon": {
        if (!trainer.inventory.basic_trap && !trainer.inventory.pro_trap) {
          this.addEvent("catch", `${trainer.name} has no traps to catch AutoMon.`, trainer.id, decision.reasoning);
          break;
        }
        if (trainer.automons.length >= trainer.stableCapacity) {
          this.addEvent("catch", `${trainer.name}'s stable is full.`, trainer.id, decision.reasoning);
          break;
        }

        const wild = pickWildAutoMon(location, this.state.weather, this.state.timeOfDay);
        if (!wild) {
          this.addEvent("catch", `${trainer.name} found no wild AutoMon to catch.`, trainer.id, decision.reasoning);
          break;
        }
        const trap = trainer.inventory.pro_trap ? "pro_trap" : "basic_trap";
        itemDelta(trainer.inventory, trap, -1);

        const levelPenalty = Math.max(0, wild.level - (trainer.automons[0]?.level ?? 1)) * 0.03;
        const trapBonus = trap === "pro_trap" ? 0.3 : 0.15;
        const healthFactor = 1 - wild.health / wild.maxHealth;
        const chance = clamp(0.25 + trapBonus + healthFactor - levelPenalty, 0.05, 0.9);

        if (Math.random() < chance) {
          wild.id = `am_${uid()}`;
          wild.loyalty = 55;
          wild.hunger = 75;
          trainer.automons.push(wild);
          this.addEvent("catch", `${trainer.name} caught a ${SPECIES_BY_ID[wild.speciesId].name}!`, trainer.id, decision.reasoning);
        } else {
          this.addEvent("catch", `${trainer.name} failed to catch ${SPECIES_BY_ID[wild.speciesId].name}.`, trainer.id, decision.reasoning);
        }
        break;
      }
      case "use_item": {
        const message = applyPotion(trainer, target);
        this.addEvent("item", message, trainer.id, decision.reasoning);
        break;
      }
      case "release_automon": {
        const targetMon = target ? trainer.automons.find((m) => m.id === target) : trainer.automons[trainer.automons.length - 1];
        if (!targetMon || trainer.automons.length <= 1) {
          this.addEvent("management", `${trainer.name} cannot release that AutoMon.`, trainer.id, decision.reasoning);
          break;
        }
        trainer.automons = trainer.automons.filter((m) => m.id !== targetMon.id);
        this.addEvent("management", `${trainer.name} released ${targetMon.nickname}.`, trainer.id, decision.reasoning);
        break;
      }
      default:
        this.addEvent("action", `${trainer.name} idles.`, trainer.id, decision.reasoning);
        break;
    }
  }

  async tick(): Promise<void> {
    this.nextWorldState();

    for (const trainer of this.state.trainers) {
      this.applyPassiveNeeds(trainer);
    }

    for (const trainer of this.state.trainers) {
      const isBusy = this.completeBusyActions(trainer);
      if (isBusy) {
        this.addEvent("action", `${trainer.name} is busy: ${trainer.busyAction}.`, trainer.id);
        continue;
      }

      const context = this.buildContext(trainer);
      const decision = await decideAction(context);
      this.resolveAction(trainer, decision);
    }

    this.flush();
  }

  getWorldSnapshot() {
    return {
      tickMs: this.config.tickMs,
      locationGraph: LOCATIONS.map((location) => ({
        id: location.id,
        name: location.name,
        dangerLevel: location.dangerLevel,
        connections: location.connections,
      })),
      speciesDex: SPECIES.map((species) => ({
        id: species.id,
        name: species.name,
        element: species.element,
        rarity: species.rarity,
        habitats: species.habitats,
      })),
      state: this.state,
    };
  }
}
