import { AgentContext } from "../types/game";

export const buildAgentPrompt = (ctx: AgentContext): string => {
  const payload = {
    tick: ctx.worldTick,
    day: ctx.day,
    weather: ctx.weather,
    timeOfDay: ctx.timeOfDay,
    trainer: {
      id: ctx.trainer.id,
      name: ctx.trainer.name,
      health: ctx.trainer.health,
      energy: ctx.trainer.energy,
      hunger: ctx.trainer.hunger,
      gold: ctx.trainer.gold,
      locationId: ctx.trainer.locationId,
      inventory: ctx.trainer.inventory,
      stableCapacity: ctx.trainer.stableCapacity,
      automons: ctx.trainer.automons,
    },
    nearbyAgents: ctx.nearbyAgents,
    location: {
      id: ctx.location.id,
      name: ctx.location.name,
      dangerLevel: ctx.location.dangerLevel,
      actions: ctx.location.actions,
      connections: ctx.location.connections,
    },
    availableActions: ctx.availableActions,
    recentEvents: ctx.recentEvents,
    marketTrend: ctx.market,
  };

  return [
    "You are an autonomous trainer in AutoMon.",
    "Choose exactly one best action for this tick based on survival and progression.",
    "Output STRICT JSON only with keys: action, target, reasoning.",
    "target can be null or a short id/name depending on action (location id, item id, trainer id, automon id).",
    "Keep reasoning to one sentence.",
    "Game snapshot:",
    JSON.stringify(payload),
  ].join("\n");
};
