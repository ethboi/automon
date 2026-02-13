/**
 * Agent-side battle simulation.
 * Deterministic smart AI — no Claude API calls per turn.
 * Runs instantly, POSTs result back to the API.
 */

// ─── Types (minimal, matching server) ───

interface BattleCard {
  id?: string;
  name: string;
  element: string;
  rarity?: string;
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  maxHp: number;
  ability?: { name: string; damage: number; effect: string; cooldown: number; currentCooldown?: number };
  statusEffects?: { type: string; duration: number; value: number }[];
  isActive?: boolean;
  fainted?: boolean;
}

interface Player {
  address: string;
  cards: BattleCard[];
  ready?: boolean;
  selectedCards?: unknown[];
  cardSelectionReasoning?: string;
  name?: string;
}

interface Battle {
  battleId: string;
  player1: Player;
  player2: Player;
  wager: string;
  status: string;
  currentTurn: number;
  rounds: Round[];
}

interface BattleMove {
  action: 'attack' | 'defend' | 'skill' | 'switch';
  switchTo?: number;
  reasoning?: string;
}

interface BattleEvent {
  type: string;
  source: string;
  target: string;
  message: string;
  value?: number;
}

interface Round {
  turn: number;
  player1Move: BattleMove;
  player2Move: BattleMove;
  triangleResult?: string;
  events: BattleEvent[];
  timestamp: Date;
}

interface TurnLog {
  turn: number;
  player1: { card: string; activeCard: string; cardHp: number; action: string; reasoning?: string; prediction?: string };
  player2: { card: string; activeCard: string; cardHp: number; action: string; reasoning?: string; prediction?: string };
  events: BattleEvent[];
  triangleResult?: string | { player1Result: string; player2Result: string };
}

interface BattleLog {
  battleId: string;
  player1: { address: string; cards: { id: string; name: string; element: string }[]; isAI: boolean; name?: string; cardSelectionReasoning?: string };
  player2: { address: string; cards: { id: string; name: string; element: string }[]; isAI: boolean; name?: string; cardSelectionReasoning?: string };
  wager: string;
  turns: TurnLog[];
  winner: string;
  totalDamageDealt: { player1: number; player2: number };
  cardsFainted: { player1: number; player2: number };
  duration: number;
  startedAt: Date;
  endedAt: Date;
}

// ─── Element system ───

const ELEMENT_CHART: Record<string, string[]> = {
  fire: ['earth', 'air'], water: ['fire'], earth: ['water', 'light'],
  air: ['earth'], light: ['dark'], dark: ['light', 'water'],
};

function getElementMultiplier(attacker: string, defender: string): number {
  if (ELEMENT_CHART[attacker]?.includes(defender)) return 1.5;
  if (ELEMENT_CHART[defender]?.includes(attacker)) return 0.75;
  return 1.0;
}

// ─── Battle helpers ───

function getActiveCard(player: Player): BattleCard {
  return player.cards.find(c => c.isActive && !c.fainted) || player.cards.find(c => !c.fainted) || player.cards[0];
}

function initCard(card: any): BattleCard {
  // Cards from MongoDB may have stats nested under .stats and ability.power instead of .damage
  const stats = card.stats || {};
  const attack = card.attack || stats.attack || 50;
  const defense = card.defense || stats.defense || 30;
  const speed = card.speed || stats.speed || 40;
  const hp = card.hp || stats.hp || card.currentHp || 100;
  const maxHp = card.maxHp || stats.maxHp || hp;
  const rawAbility = card.ability;
  const ability = rawAbility ? {
    name: rawAbility.name || 'Power Strike',
    damage: rawAbility.damage || rawAbility.power || 25,
    effect: rawAbility.effect || 'damage',
    cooldown: rawAbility.cooldown || 3,
    currentCooldown: 0,
  } : { name: 'Power Strike', damage: 25, effect: 'damage', cooldown: 3, currentCooldown: 0 };

  return {
    id: card.id || card._id?.toString(),
    name: card.name || 'Unknown',
    element: card.element || 'fire',
    rarity: card.rarity,
    attack, defense, speed, hp, maxHp,
    ability,
    statusEffects: [],
    isActive: false,
    fainted: false,
  };
}

// ─── Triangle system (attack > skill > defend > attack) ───

function triangleResult(m1: string, m2: string): { winner: 'p1' | 'p2' | 'tie'; label: string } {
  if (m1 === m2) return { winner: 'tie', label: 'Clash!' };
  const wins: Record<string, string> = { attack: 'skill', skill: 'defend', defend: 'attack' };
  if (wins[m1] === m2) return { winner: 'p1', label: `${m1} beats ${m2}` };
  if (wins[m2] === m1) return { winner: 'p2', label: `${m2} beats ${m1}` };
  return { winner: 'tie', label: 'Neutral' };
}

// ─── Resolve a turn ───

function resolveTurn(battle: Battle, move1: BattleMove, move2: BattleMove): { events: BattleEvent[]; winner: string | null; turnLog: TurnLog } {
  const events: BattleEvent[] = [];
  const p1Card = getActiveCard(battle.player1);
  const p2Card = getActiveCard(battle.player2);

  // Handle switches first
  if (move1.action === 'switch' && move1.switchTo !== undefined) {
    const target = battle.player1.cards[move1.switchTo];
    if (target && !target.fainted) {
      p1Card.isActive = false;
      target.isActive = true;
      events.push({ type: 'switch', source: p1Card.name, target: target.name, message: `${p1Card.name} switched to ${target.name}!` });
    }
  }
  if (move2.action === 'switch' && move2.switchTo !== undefined) {
    const target = battle.player2.cards[move2.switchTo];
    if (target && !target.fainted) {
      p2Card.isActive = false;
      target.isActive = true;
      events.push({ type: 'switch', source: p2Card.name, target: target.name, message: `${p2Card.name} switched to ${target.name}!` });
    }
  }

  const active1 = getActiveCard(battle.player1);
  const active2 = getActiveCard(battle.player2);
  const tri = triangleResult(move1.action, move2.action);

  // Calculate damage
  const calcDamage = (attacker: BattleCard, defender: BattleCard, action: string, bonus: boolean): number => {
    if (action === 'defend') return 0;
    let baseDmg = action === 'skill' && attacker.ability ? attacker.ability.damage : attacker.attack * 0.8;
    const elemMult = getElementMultiplier(attacker.element, defender.element);
    baseDmg *= elemMult;
    if (bonus) baseDmg *= 1.3; // triangle winner bonus
    const defReduction = action === 'skill' ? 0.3 : 0.5;
    const finalDmg = Math.max(1, Math.round(baseDmg - defender.defense * defReduction));
    return finalDmg;
  };

  // Apply damage
  const applyDmg = (attacker: BattleCard, defender: BattleCard, action: string, bonus: boolean, playerLabel: string) => {
    if (action === 'defend') {
      const heal = Math.round(defender.maxHp * 0.05);
      defender.hp = Math.min(defender.maxHp, defender.hp + heal);
      events.push({ type: 'defend', source: defender.name, target: defender.name, message: `${defender.name} defends! (+${heal} HP)`, value: heal });
      return;
    }
    if (action === 'skill' && attacker.ability?.currentCooldown && attacker.ability.currentCooldown > 0) {
      // Skill on cooldown, fallback to attack
      const dmg = calcDamage(attacker, defender, 'attack', bonus);
      defender.hp -= dmg;
      events.push({ type: 'damage', source: attacker.name, target: defender.name, message: `${attacker.name}'s skill on cooldown — basic attack for ${dmg}!`, value: dmg });
    } else {
      const dmg = calcDamage(attacker, defender, action, bonus);
      defender.hp -= dmg;
      if (action === 'skill' && attacker.ability) {
        attacker.ability.currentCooldown = attacker.ability.cooldown;
        events.push({ type: 'damage', source: attacker.name, target: defender.name, message: `${attacker.name} uses ${attacker.ability.name} for ${dmg}!`, value: dmg });
      } else {
        events.push({ type: 'damage', source: attacker.name, target: defender.name, message: `${attacker.name} attacks for ${dmg}!`, value: dmg });
      }
    }
  };

  const p1Bonus = tri.winner === 'p1';
  const p2Bonus = tri.winner === 'p2';

  // Speed determines who goes first
  if (active1.speed >= active2.speed) {
    applyDmg(active1, active2, move1.action, p1Bonus, 'P1');
    if (active2.hp > 0) applyDmg(active2, active1, move2.action, p2Bonus, 'P2');
  } else {
    applyDmg(active2, active1, move2.action, p2Bonus, 'P2');
    if (active1.hp > 0) applyDmg(active1, active2, move1.action, p1Bonus, 'P1');
  }

  // Tick cooldowns
  for (const c of [...battle.player1.cards, ...battle.player2.cards]) {
    if (c.ability?.currentCooldown && c.ability.currentCooldown > 0) c.ability.currentCooldown--;
  }

  // Check faints
  let winner: string | null = null;
  for (const card of battle.player1.cards) {
    if (card.hp <= 0 && !card.fainted) {
      card.fainted = true;
      card.isActive = false;
      events.push({ type: 'faint', source: card.name, target: card.name, message: `${card.name} fainted!` });
    }
  }
  for (const card of battle.player2.cards) {
    if (card.hp <= 0 && !card.fainted) {
      card.fainted = true;
      card.isActive = false;
      events.push({ type: 'faint', source: card.name, target: card.name, message: `${card.name} fainted!` });
    }
  }

  // Auto-switch to next alive card
  if (!battle.player1.cards.some(c => c.isActive && !c.fainted)) {
    const next = battle.player1.cards.find(c => !c.fainted);
    if (next) { next.isActive = true; events.push({ type: 'switch', source: 'auto', target: next.name, message: `${next.name} enters the fight!` }); }
  }
  if (!battle.player2.cards.some(c => c.isActive && !c.fainted)) {
    const next = battle.player2.cards.find(c => !c.fainted);
    if (next) { next.isActive = true; events.push({ type: 'switch', source: 'auto', target: next.name, message: `${next.name} enters the fight!` }); }
  }

  // Check if all cards fainted
  if (battle.player1.cards.every(c => c.fainted)) winner = battle.player2.address;
  if (battle.player2.cards.every(c => c.fainted)) winner = battle.player1.address;

  // Get current active cards (may have changed due to faints/switches)
  const final1 = getActiveCard(battle.player1);
  const final2 = getActiveCard(battle.player2);

  const turnLog: TurnLog = {
    turn: battle.currentTurn,
    player1: { card: active1.name, activeCard: final1.name, cardHp: Math.max(0, final1.hp), action: move1.action, reasoning: move1.reasoning },
    player2: { card: active2.name, activeCard: final2.name, cardHp: Math.max(0, final2.hp), action: move2.action, reasoning: move2.reasoning },
    events,
    triangleResult: {
      player1Result: tri.winner === 'p1' ? 'win' : tri.winner === 'p2' ? 'lose' : 'neutral',
      player2Result: tri.winner === 'p2' ? 'win' : tri.winner === 'p1' ? 'lose' : 'neutral',
    },
  };

  return { events, winner, turnLog };
}

// ─── Element advantage map ───
const ELEM_ADVANTAGE: Record<string, string[]> = {
  fire: ['earth', 'air'], water: ['fire'], earth: ['water', 'light'],
  light: ['dark'], dark: ['light', 'water'], air: ['earth'],
};

function hasAdvantage(atk: string, def: string): boolean {
  return (ELEM_ADVANTAGE[atk.toLowerCase()] || []).includes(def.toLowerCase());
}

// ─── Smart deterministic AI (no API calls, rich reasoning) ───

async function getAIMove(battle: Battle, playerAddress: string): Promise<BattleMove> {
  const isP1 = battle.player1.address.toLowerCase() === playerAddress.toLowerCase();
  const myCards = isP1 ? battle.player1.cards : battle.player2.cards;
  const myActive = getActiveCard(isP1 ? battle.player1 : battle.player2);
  const oppActive = getActiveCard(isP1 ? battle.player2 : battle.player1);
  const bench = myCards.filter(c => !c.fainted && !c.isActive);
  const hpPct = Math.round(myActive.hp / myActive.maxHp * 100);
  const oppHpPct = Math.round(oppActive.hp / oppActive.maxHp * 100);
  const iHaveAdvantage = hasAdvantage(myActive.element, oppActive.element);
  const theyHaveAdvantage = hasAdvantage(oppActive.element, myActive.element);

  // 1. Critical HP — switch to counter or defend
  if (hpPct < 25 && bench.length > 0) {
    const counter = bench.find(c => hasAdvantage(c.element, oppActive.element));
    if (counter) {
      return { action: 'switch', switchTo: myCards.indexOf(counter),
        reasoning: `${myActive.name} hanging on at ${hpPct}% HP — tagging in ${counter.name} (${counter.element}) for the ${oppActive.element} matchup` };
    }
    if (hpPct < 15) {
      return { action: 'defend',
        reasoning: `${myActive.name} barely standing at ${hpPct}% — digging in and bracing for impact, no good bench options` };
    }
  }

  // 2. Finish off low HP opponent — go aggressive
  if (oppHpPct < 20 && myActive.attack > 30) {
    if (myActive.ability && (!myActive.ability.currentCooldown || myActive.ability.currentCooldown <= 0)) {
      return { action: 'skill',
        reasoning: `${oppActive.name} is on the ropes at ${oppHpPct}% — ${myActive.name} goes for the KO with ${myActive.ability.name}!` };
    }
    return { action: 'attack',
      reasoning: `${oppActive.name} hanging by a thread at ${oppHpPct}% — ${myActive.name} presses the advantage!` };
  }

  // 3. Use skill when available (with element context)
  if (myActive.ability && (!myActive.ability.currentCooldown || myActive.ability.currentCooldown <= 0)) {
    const elemNote = iHaveAdvantage ? ` — ${myActive.element} is super effective vs ${oppActive.element}!` :
                     theyHaveAdvantage ? ` — need burst damage to overcome the ${oppActive.element} advantage` : '';
    return { action: 'skill',
      reasoning: `${myActive.name} charges up ${myActive.ability.name} (${myActive.ability.damage} power)${elemNote}` };
  }

  // 4. Bad element matchup — swap to counter
  if (theyHaveAdvantage && bench.length > 0 && battle.currentTurn % 3 === 0) {
    const counter = bench.find(c => hasAdvantage(c.element, oppActive.element));
    if (counter) {
      return { action: 'switch', switchTo: myCards.indexOf(counter),
        reasoning: `${oppActive.element} has the edge over ${myActive.element} — pivoting to ${counter.name} to flip the matchup` };
    }
    const neutral = bench.find(c => !hasAdvantage(oppActive.element, c.element));
    if (neutral) {
      return { action: 'switch', switchTo: myCards.indexOf(neutral),
        reasoning: `${myActive.name} taking too much ${oppActive.element} damage — rotating ${neutral.name} in for a neutral matchup` };
    }
  }

  // 5. Defend when hurt and outgunned
  if (hpPct < 40 && oppActive.attack > myActive.defense && Math.random() < 0.3) {
    return { action: 'defend',
      reasoning: `${myActive.name} at ${hpPct}% with ${oppActive.name}'s ${oppActive.attack} ATK bearing down — needs to buy a turn to survive` };
  }

  // 6. Strategic defend when opponent likely to skill (every 4th turn pattern)
  if (battle.currentTurn % 4 === 0 && hpPct > 50 && Math.random() < 0.2) {
    return { action: 'defend',
      reasoning: `${myActive.name} reads the rhythm and raises guard — anticipating ${oppActive.name}'s next big move` };
  }

  // 7. Attack with element context
  if (iHaveAdvantage) {
    return { action: 'attack',
      reasoning: `${myActive.name} exploits the ${myActive.element} vs ${oppActive.element} advantage — pressing the attack!` };
  }

  // 8. Default attack with varied reasoning
  const attackReasons = [
    `${myActive.name} closes in on ${oppActive.name} with a direct strike`,
    `${myActive.name} goes on the offensive — ${oppActive.name} at ${oppHpPct}% can't take many more hits`,
    `No fancy plays needed — ${myActive.name} swings hard at ${oppActive.name}`,
    `${myActive.name} keeps up the pressure, looking for an opening in ${oppActive.name}'s guard`,
    `Steady aggression from ${myActive.name} — wearing ${oppActive.name} down turn by turn`,
  ];
  return { action: 'attack', reasoning: attackReasons[battle.currentTurn % attackReasons.length] };
}

// Keep old fallback structure for compatibility
function _fallbackMove(): BattleMove {
  const r = Math.random();
  if (r < 0.5) return { action: 'attack', reasoning: 'Fallback — going aggressive' };
  if (r < 0.75) return { action: 'skill', reasoning: 'Fallback — using skill' };
  return { action: 'defend', reasoning: 'Fallback — playing safe' };
}

// ─── Main simulation runner ───

export async function runBattleSimulation(
  battleData: Battle,
  _apiBase: string,
  apiFn: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<{ winner: string; battleLog: BattleLog } | null> {
  console.log(`[simulate] Starting battle ${battleData.battleId}`);
  console.log(`[simulate] P1: ${battleData.player1.address.slice(0, 10)} vs P2: ${battleData.player2.address.slice(0, 10)}`);

  // Initialize cards
  const battle: Battle = {
    ...battleData,
    player1: { ...battleData.player1, cards: battleData.player1.cards.map(initCard) },
    player2: { ...battleData.player2, cards: battleData.player2.cards.map(initCard) },
    rounds: [],
    currentTurn: 0,
  };

  // Set first cards active
  if (battle.player1.cards.length > 0) battle.player1.cards[0].isActive = true;
  if (battle.player2.cards.length > 0) battle.player2.cards[0].isActive = true;

  const startTime = Date.now();
  const turns: TurnLog[] = [];
  let totalDmgP1 = 0, totalDmgP2 = 0, faintsP1 = 0, faintsP2 = 0;
  let winner: string | null = null;
  const MAX_TURNS = 50;

  while (!winner && battle.currentTurn < MAX_TURNS) {
    battle.currentTurn++;

    const [move1, move2] = await Promise.all([
      getAIMove(battle, battle.player1.address),
      getAIMove(battle, battle.player2.address),
    ]);

    const { events, winner: turnWinner, turnLog } = resolveTurn(battle, move1, move2);

    for (const e of events) {
      if (e.type === 'damage' && e.value) {
        const p1Names = battle.player1.cards.map(c => c.name);
        if (p1Names.includes(e.source)) totalDmgP1 += e.value; else totalDmgP2 += e.value;
      }
      if (e.type === 'faint') {
        const p1Names = battle.player1.cards.map(c => c.name);
        if (p1Names.includes(e.target)) faintsP1++; else faintsP2++;
      }
    }

    turns.push(turnLog);
    battle.rounds.push({ turn: battle.currentTurn, player1Move: move1, player2Move: move2, triangleResult: turnLog.triangleResult, events, timestamp: new Date() });
    winner = turnWinner;

    console.log(`[simulate] Turn ${battle.currentTurn}: ${move1.action} vs ${move2.action} → ${turnLog.triangleResult} ${winner ? `WINNER: ${winner.slice(0,8)}` : ''}`);
  }

  const finalWinner = winner || 'draw';
  const duration = Date.now() - startTime;

  const battleLog: BattleLog = {
    battleId: battle.battleId,
    player1: {
      address: battle.player1.address, name: battle.player1.name,
      cards: battleData.player1.cards.map(c => ({ id: c.id || '', name: c.name, element: c.element })),
      isAI: true, cardSelectionReasoning: battleData.player1.cardSelectionReasoning,
    },
    player2: {
      address: battle.player2.address, name: battle.player2.name,
      cards: battleData.player2.cards.map(c => ({ id: c.id || '', name: c.name, element: c.element })),
      isAI: true, cardSelectionReasoning: battleData.player2.cardSelectionReasoning,
    },
    wager: battle.wager,
    turns,
    winner: finalWinner,
    totalDamageDealt: { player1: totalDmgP1, player2: totalDmgP2 },
    cardsFainted: { player1: faintsP1, player2: faintsP2 },
    duration,
    startedAt: new Date(startTime),
    endedAt: new Date(),
  };

  console.log(`[simulate] Battle complete! Winner: ${finalWinner} in ${turns.length} turns (${duration}ms)`);

  // POST result back to API
  try {
    const saveRes = await apiFn('/api/battle/save-result', {
      method: 'POST',
      body: JSON.stringify({
        battleId: battle.battleId,
        winner: finalWinner,
        rounds: battle.rounds,
        currentTurn: battle.currentTurn,
        battleLog,
        address: battle.player1.address, // needed for agent auth
      }),
    });
    if (saveRes.ok) {
      console.log(`[simulate] Result saved to API`);
    } else {
      console.log(`[simulate] Failed to save result: ${saveRes.status}`);
    }
  } catch (e) {
    console.error(`[simulate] Save error:`, (e as Error).message);
  }

  return { winner: finalWinner, battleLog };
}
