import { AgentContext, AgentDecision } from "../types/game";

const chooseByNeed = (ctx: AgentContext): AgentDecision => {
  const trainer = ctx.trainer;
  const locationActions = new Set(ctx.availableActions);

  if (trainer.health < 35 && locationActions.has("heal_automon") && trainer.automons.some((a) => a.health < a.maxHealth * 0.5)) {
    return { action: "heal_automon", reasoning: "Critical roster health; restore the team now." };
  }

  if (trainer.hunger < 25) {
    if (trainer.inventory.trail_ration && locationActions.has("eat")) {
      return { action: "eat", target: "trail_ration", reasoning: "Hunger is low and food is available." };
    }
    if (locationActions.has("buy") && trainer.gold >= 12) {
      return { action: "buy", target: "trail_ration", reasoning: "Buy food to avoid starvation damage." };
    }
  }

  if (trainer.energy < 20 && locationActions.has("rest")) {
    return { action: "rest", reasoning: "Energy is low; recover to keep options open." };
  }

  if (trainer.automons.some((a) => a.hunger < 30) && trainer.inventory.automon_chow && locationActions.has("feed_automon")) {
    return { action: "feed_automon", target: trainer.automons[0].id, reasoning: "Feed AutoMon to protect loyalty." };
  }

  if (locationActions.has("battle_pve") && trainer.automons.some((a) => a.health > a.maxHealth * 0.4) && trainer.energy >= 15) {
    return { action: "battle_pve", reasoning: "Safe XP and gold gains from PvE battle." };
  }

  if (locationActions.has("fish") && trainer.inventory.bait && trainer.energy >= 10) {
    return { action: "fish", reasoning: "Fishing converts bait into sellable resources." };
  }

  if (locationActions.has("explore") && trainer.energy >= 10) {
    return { action: "explore", reasoning: "Exploring can find resources and encounters." };
  }

  if (locationActions.has("travel")) {
    const connection = ctx.location.connections[Math.floor(Math.random() * ctx.location.connections.length)];
    if (connection) {
      return { action: "travel", target: connection.to, reasoning: "Repositioning for fresh opportunities." };
    }
  }

  if (locationActions.has("rest")) {
    return { action: "rest", reasoning: "Fallback recovery action." };
  }

  return { action: ctx.availableActions[0] ?? "rest", reasoning: "Default fallback action." };
};

export const fallbackDecision = (ctx: AgentContext): AgentDecision => chooseByNeed(ctx);
