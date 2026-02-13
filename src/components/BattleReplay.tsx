'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BattleLog, BattleEvent, Element } from '@/lib/types';
import { AUTOMONS } from '@/lib/automons';
import { getCardArtDataUri } from '@/lib/cardArt';

/* ═══════════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════════ */

const ELEMENT_HEX: Record<string, string> = {
  fire: '#ef4444', water: '#3b82f6', earth: '#84cc16',
  air: '#a78bfa', dark: '#a855f7', light: '#fbbf24',
};

function getCardImage(cardName: string, element?: string): string {
  const mon = AUTOMONS.find(a => a.name === cardName);
  return getCardArtDataUri(mon?.id ?? 1, element || mon?.element || 'fire', 'common');
}

function getCardElement(cardName: string, cards?: { name: string; element: Element }[]): string {
  const fromCards = cards?.find(c => c.name === cardName);
  if (fromCards) return fromCards.element;
  const mon = AUTOMONS.find(a => a.name === cardName);
  return mon?.element || 'fire';
}

function elColor(el: string): string { return ELEMENT_HEX[el] || ELEMENT_HEX.fire; }

function hpColor(pct: number): string {
  if (pct > 60) return '#22c55e';
  if (pct > 30) return '#eab308';
  return '#ef4444';
}

const EVENT_ICONS: Record<string, string> = {
  damage: '⚔️', heal: '💚', faint: '💀', switch: '🔄',
  element_advantage: '🔥', triangle_result: '🔺', interrupt: '⚡',
  guard_counter: '🛡️', skill_pierce: '✨', status_applied: '💫',
  status_tick: '🌀', status_expired: '⏰', action_reveal: '📢',
  battle_start: '🎬', battle_end: '🏁',
};

const ACTION_ICONS: Record<string, string> = {
  strike: '⚔️', skill: '✨', guard: '🛡️', switch: '🔄',
};

const ACTION_COLORS: Record<string, string> = {
  strike: '#ef4444', skill: '#a855f7', guard: '#3b82f6', switch: '#eab308',
};

const TRIANGLE_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  win:     { bg: 'rgba(34,197,94,0.25)',  fg: '#22c55e', label: 'WIN' },
  lose:    { bg: 'rgba(239,68,68,0.25)',  fg: '#ef4444', label: 'LOSE' },
  neutral: { bg: 'rgba(234,179,8,0.25)',  fg: '#eab308', label: 'DRAW' },
};

/* ═══════════════════════════════════════════════════════════
   CSS Keyframes (injected once)
   ═══════════════════════════════════════════════════════════ */

const REPLAY_STYLES = `
@keyframes br-vs-pulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.18);opacity:1}}
@keyframes br-card-left{from{transform:translateX(-30px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes br-card-right{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes br-badge-pop{0%{transform:scale(0) translateX(-50%)}70%{transform:scale(1.12) translateX(-50%)}100%{transform:scale(1) translateX(-50%)}}
@keyframes br-float-up{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes br-celebrate{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-6px) rotate(-1deg)}75%{transform:translateY(-3px) rotate(1deg)}}
@keyframes br-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes br-glow-ring{0%,100%{box-shadow:0 0 12px var(--el) ,inset 0 0 8px var(--el)}50%{box-shadow:0 0 24px var(--el),inset 0 0 16px var(--el)}}
`;

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface BattleReplayProps {
  battleLog: BattleLog;
  onClose?: () => void;
}
type Speed = 1 | 2 | 4;

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export default function BattleReplay({ battleLog, onClose }: BattleReplayProps) {
  const [turnIdx, setTurnIdx]       = useState(-1);      // -1 = intro
  const [eventIdx, setEventIdx]     = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [speed, setSpeed]           = useState<Speed>(1);

  const turns    = battleLog.turns;
  const rawTurn  = turnIdx >= 0 && turnIdx < turns.length ? turns[turnIdx] : null;

  // Normalize turn data — support both old (card) and new (activeCard/cardHp) formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turn = useMemo(() => {
    if (!rawTurn) return null;
    const rp1 = rawTurn.player1 as any;
    const rp2 = rawTurn.player2 as any;
    const tri = rawTurn.triangleResult;
    const normTri = typeof tri === 'string'
      ? { player1Result: 'neutral' as const, player2Result: 'neutral' as const }
      : tri;
    const p1Card = rawTurn.player1.activeCard || rp1.card || '???';
    const p2Card = rawTurn.player2.activeCard || rp2.card || '???';
    const p1Mon = AUTOMONS.find(a => a.name === p1Card);
    const p2Mon = AUTOMONS.find(a => a.name === p2Card);
    return {
      ...rawTurn,
      player1: {
        ...rawTurn.player1,
        activeCard: p1Card,
        cardHp: rawTurn.player1.cardHp ?? p1Mon?.baseHp ?? 100,
      },
      player2: {
        ...rawTurn.player2,
        activeCard: p2Card,
        cardHp: rawTurn.player2.cardHp ?? p2Mon?.baseHp ?? 100,
      },
      triangleResult: normTri,
    };
  }, [rawTurn]);

  const events   = turn?.events.slice(0, eventIdx + 1) ?? [];
  const isLast   = turnIdx === turns.length - 1;
  const phase    = turnIdx === -1 ? 'intro' : (isLast && !playing) ? 'victory' : 'battle';

  /* --- computed max-HP per card (highest seen across all turns) --- */
  const maxHp = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of turns) {
      // Support both formats: activeCard (new) and card (old agent sim)
      const p1Card = t.player1.activeCard || (t.player1 as any).card;
      const p2Card = t.player2.activeCard || (t.player2 as any).card;
      const p1Hp = t.player1.cardHp ?? 0;
      const p2Hp = t.player2.cardHp ?? 0;
      if (p1Card) m[p1Card] = Math.max(m[p1Card] || 0, p1Hp);
      if (p2Card) m[p2Card] = Math.max(m[p2Card] || 0, p2Hp);
    }
    for (const [n, hp] of Object.entries(m)) {
      const mon = AUTOMONS.find(a => a.name === n);
      if (mon && mon.baseHp > hp) m[n] = mon.baseHp;
    }
    return m;
  }, [turns]);

  /* --- winner helpers --- */
  const p1Name = battleLog.player1.name || battleLog.player1.address.slice(0, 8);
  const p2Name = battleLog.player2.name || battleLog.player2.address.slice(0, 8);
  const p1Color = '#818cf8';   // indigo-400
  const p2Color = '#34d399';   // emerald-400
  const winP1   = battleLog.winner === battleLog.player1.address;
  const winP2   = battleLog.winner === battleLog.player2.address;
  const winName = winP1 ? p1Name : winP2 ? p2Name : battleLog.winner?.slice(0, 10) ?? '???';

  /* --- auto-play timer --- */
  useEffect(() => {
    if (!playing) return;
    const ms = (turnIdx === -1 ? 3000 : 2000) / speed;
    const t = setTimeout(() => {
      if (turnIdx === -1) { setTurnIdx(0); setEventIdx(0); return; }
      if (turn && eventIdx < turn.events.length - 1) { setEventIdx(i => i + 1); return; }
      if (turnIdx < turns.length - 1) { setTurnIdx(i => i + 1); setEventIdx(0); return; }
      setPlaying(false);
    }, ms);
    return () => clearTimeout(t);
  }, [playing, turnIdx, eventIdx, turn, turns.length, speed]);

  /* --- controls --- */
  const restart    = useCallback(() => { setTurnIdx(-1); setEventIdx(0); setPlaying(false); }, []);
  const skipToEnd  = useCallback(() => {
    if (!turns.length) return;
    setTurnIdx(turns.length - 1);
    setEventIdx(turns[turns.length - 1].events.length - 1);
    setPlaying(false);
  }, [turns]);
  const togglePlay = useCallback(() => {
    if (turnIdx === -1) { setTurnIdx(0); setEventIdx(0); }
    setPlaying(p => !p);
  }, [turnIdx]);

  /* --- progress % --- */
  const progress = turnIdx < 0 ? 0 : ((turnIdx + 1) / turns.length) * 100;

  /* ═══════════════════ Render ═══════════════════ */
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REPLAY_STYLES }} />

      <div className="fixed inset-0 z-50 flex flex-col text-white"
        style={{ background: 'linear-gradient(180deg, #030712 0%, #0c0a1a 50%, #030712 100%)' }}>

        {/* ──── Wager Banner ──── */}
        <div className="shrink-0 text-center py-1.5 text-xs sm:text-sm font-bold tracking-wide"
          style={{ background: 'linear-gradient(90deg,rgba(124,58,237,.3),rgba(6,182,212,.3),rgba(124,58,237,.3))' }}>
          💰 <span className="text-white">{battleLog.wager} MON</span>
          <span className="text-gray-400 ml-1">wager</span>
        </div>

        {/* ──── Header / Controls ──── */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 sm:px-5 sm:py-3"
          style={{ background: 'rgba(17,24,39,.85)', borderBottom: '1px solid rgba(75,85,99,.25)' }}>

          {/* names */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-extrabold text-xs sm:text-sm truncate" style={{ color: p1Color }}>{p1Name}</span>
            <span className="text-[10px] text-gray-600">vs</span>
            <span className="font-extrabold text-xs sm:text-sm truncate" style={{ color: p2Color }}>{p2Name}</span>
          </div>

          {/* playback */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Btn onClick={restart} title="Restart">⏮</Btn>

            <button onClick={togglePlay}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-sm transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }}>
              {playing ? '⏸' : '▶'}
            </button>

            <Btn onClick={skipToEnd} title="Skip to end">⏭</Btn>

            <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(31,41,55,.8)' }}>
              {([1, 2, 4] as Speed[]).map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className="px-2 py-1 text-[10px] sm:text-xs font-bold transition"
                  style={speed === s
                    ? { background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', color: '#fff' }
                    : { color: '#6b7280' }}>
                  {s}x
                </button>
              ))}
            </div>

            {onClose && <Btn onClick={onClose} title="Close">✕</Btn>}
          </div>
        </div>

        {/* ──── Content ──── */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-3 sm:space-y-5">

            {/* Turn Badge */}
            <div className="text-center">
              <span className="inline-block px-4 py-1.5 rounded-full text-[11px] sm:text-sm font-bold tracking-wide"
                style={{
                  background: phase === 'victory'
                    ? 'linear-gradient(135deg,#b45309,#d97706)'
                    : 'linear-gradient(135deg,rgba(124,58,237,.45),rgba(6,182,212,.45))',
                  border: '1px solid rgba(255,255,255,.1)',
                }}>
                {phase === 'intro'   && '⚡ Preparing for Battle…'}
                {phase === 'battle'  && `Turn ${turnIdx + 1} / ${turns.length}`}
                {phase === 'victory' && '🏆 Battle Complete!'}
              </span>
            </div>

            {/* ═══════ INTRO ═══════ */}
            {phase === 'intro' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                <TeamPanel
                  label={`${p1Name}'s Team`}
                  color={p1Color}
                  cards={battleLog.player1.cards}
                  reasoning={(battleLog.player1 as any).cardSelectionReasoning}
                />
                <TeamPanel
                  label={`${p2Name}'s Team`}
                  color={p2Color}
                  cards={battleLog.player2.cards}
                  reasoning={(battleLog.player2 as any).cardSelectionReasoning}
                />
              </div>
            )}

            {/* ═══════ BATTLE ═══════ */}
            {turn && phase === 'battle' && (
              <>
                {/* Arena */}
                <div className="flex items-start gap-1 sm:gap-3">
                  <div className="flex-1" style={{ animation: 'br-card-left .4s ease-out' }}>
                    <CardPanel
                      name={p1Name} color={p1Color}
                      card={turn.player1.activeCard}
                      hp={turn.player1.cardHp} max={maxHp[turn.player1.activeCard] || 100}
                      action={turn.player1.action}
                      result={turn.triangleResult?.player1Result}
                      reasoning={turn.player1.reasoning}
                      prediction={turn.player1.prediction}
                      element={getCardElement(turn.player1.activeCard, battleLog.player1.cards)}
                      rarity={(battleLog.player1.cards.find((c: any) => c.name === turn.player1.activeCard) as any)?.rarity}
                      side="left"
                    />
                  </div>

                  {/* VS */}
                  <div className="flex flex-col items-center pt-10 sm:pt-20 shrink-0">
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg,#ef4444,#f59e0b)',
                        boxShadow: '0 0 18px rgba(239,68,68,.45)',
                        animation: 'br-vs-pulse 2s ease-in-out infinite',
                      }}>
                      <span className="text-[10px] sm:text-sm font-black tracking-wider text-white drop-shadow-lg">VS</span>
                    </div>
                    <div className="w-px h-6 sm:h-12 mt-1"
                      style={{ background: 'linear-gradient(180deg,rgba(239,68,68,.4),transparent)' }} />
                  </div>

                  <div className="flex-1" style={{ animation: 'br-card-right .4s ease-out' }}>
                    <CardPanel
                      name={p2Name} color={p2Color}
                      card={turn.player2.activeCard}
                      hp={turn.player2.cardHp} max={maxHp[turn.player2.activeCard] || 100}
                      action={turn.player2.action}
                      result={turn.triangleResult?.player2Result}
                      reasoning={turn.player2.reasoning}
                      prediction={turn.player2.prediction}
                      element={getCardElement(turn.player2.activeCard, battleLog.player2.cards)}
                      rarity={(battleLog.player2.cards.find((c: any) => c.name === turn.player2.activeCard) as any)?.rarity}
                      side="right"
                    />
                  </div>
                </div>

                {/* Event Log */}
                <EventLog events={events} turnLabel={`Turn ${turnIdx + 1}`} />
              </>
            )}

            {/* ═══════ VICTORY ═══════ */}
            {phase === 'victory' && (
              <>
                {/* Winner Banner */}
                <div className="text-center" style={{ animation: 'br-float-up .5s ease-out' }}>
                  <div className="inline-block rounded-2xl px-6 py-5 sm:px-10 sm:py-8"
                    style={{
                      background: 'linear-gradient(135deg,rgba(180,83,9,.35),rgba(217,119,6,.15))',
                      border: '1px solid rgba(251,191,36,.25)',
                      boxShadow: '0 0 50px rgba(251,191,36,.12)',
                    }}>
                    <div className="text-4xl sm:text-5xl mb-2">🏆</div>
                    <h2 className="text-lg sm:text-2xl font-black mb-1"
                      style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {winName} Wins!
                    </h2>
                    <p className="text-xl sm:text-3xl font-extrabold text-green-400">+{battleLog.wager} MON</p>
                  </div>
                </div>

                {/* Final Teams */}
                <div className="grid grid-cols-2 gap-2 sm:gap-5">
                  <FinalTeam name={p1Name} color={p1Color} cards={battleLog.player1.cards}
                    dmg={battleLog.totalDamageDealt.player1} fainted={battleLog.cardsFainted.player1}
                    isWinner={winP1} />
                  <FinalTeam name={p2Name} color={p2Color} cards={battleLog.player2.cards}
                    dmg={battleLog.totalDamageDealt.player2} fainted={battleLog.cardsFainted.player2}
                    isWinner={winP2} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs">
                  <StatBox label="Total Turns" value={String(turns.length)} />
                  <StatBox label="Duration" value={`${Math.round(battleLog.duration / 1000)}s`} />
                  <StatBox label="Cards Fainted"
                    value={`${battleLog.cardsFainted.player1} — ${battleLog.cardsFainted.player2}`} />
                </div>

                {/* Last Turn Events */}
                {turn && <EventLog events={turn.events} turnLabel="Final Turn" />}
              </>
            )}
          </div>
        </div>

        {/* ──── Progress Bar ──── */}
        <div className="shrink-0 px-3 py-2 sm:px-5 sm:py-3"
          style={{ background: 'rgba(17,24,39,.9)', borderTop: '1px solid rgba(75,85,99,.2)' }}>
          <div className="max-w-5xl mx-auto">
            <div className="h-1.5 sm:h-2 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,.4)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#06b6d4)' }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════ */

/* ---- tiny button wrapper ---- */
function Btn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="p-1.5 rounded-lg transition hover:bg-white/10 active:scale-90 text-sm text-gray-300">
      {children}
    </button>
  );
}

const RARITY_COLORS: Record<string, { bg: string; fg: string }> = {
  legendary: { bg: 'rgba(251,191,36,0.25)', fg: '#fbbf24' },
  epic:      { bg: 'rgba(168,85,247,0.25)', fg: '#a855f7' },
  rare:      { bg: 'rgba(59,130,246,0.25)', fg: '#3b82f6' },
  uncommon:  { bg: 'rgba(34,197,94,0.25)',  fg: '#22c55e' },
  common:    { bg: 'rgba(107,114,128,0.2)', fg: '#9ca3af' },
};

/* ---- Team panel (intro) ---- */
function TeamPanel({ label, color, cards, reasoning }: {
  label: string; color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cards: any[];
  reasoning?: string;
}) {
  return (
    <div className="rounded-xl p-3 sm:p-5" style={{ background: `${color}0a`, border: `1px solid ${color}30` }}>
      <h3 className="font-bold text-sm sm:text-base mb-3 flex items-center gap-2" style={{ color }}>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </h3>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map((c, i) => {
          const ec = elColor(c.element);
          const mon = AUTOMONS.find(a => a.name === c.name);
          const rarity = c.rarity || 'common';
          const rc = RARITY_COLORS[rarity] || RARITY_COLORS.common;
          // Use actual card stats if available, fall back to AUTOMONS base stats
          const atk = c.stats?.attack ?? mon?.baseAttack ?? '?';
          const def = c.stats?.defense ?? mon?.baseDefense ?? '?';
          const spd = c.stats?.speed ?? mon?.baseSpeed ?? '?';
          const hp = c.stats?.hp ?? mon?.baseHp ?? '?';
          return (
            <div key={i} className="text-center" style={{ animation: `br-float-up .4s ease-out ${i * .1}s both` }}>
              <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden mb-1"
                style={{ border: `2px solid ${ec}`, boxShadow: `0 0 14px ${ec}35` }}>
                <img src={getCardImage(c.name, c.element)} alt={c.name} className="w-full h-full object-cover" />
                {/* Rarity badge */}
                <span className="absolute top-0.5 right-0.5 px-1 py-px rounded text-[7px] sm:text-[8px] font-black uppercase"
                  style={{ background: rc.bg, color: rc.fg, backdropFilter: 'blur(4px)' }}>
                  {rarity}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs font-bold truncate">{c.name}</p>
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase" style={{ color: ec }}>{c.element}</p>
              <p className="text-[8px] sm:text-[9px] text-gray-500 mt-0.5">
                ⚔{atk} 🛡{def} ⚡{spd} ❤️{hp}
              </p>
            </div>
          );
        })}
      </div>

      {reasoning && (
        <div className="mt-3 rounded-lg p-2 sm:p-3 text-[10px] sm:text-xs leading-relaxed text-gray-300"
          style={{ background: `${color}0d`, border: `1px solid ${color}18` }}>
          <span className="font-bold" style={{ color }}>🧠 Draft strategy:</span> {reasoning}
        </div>
      )}
    </div>
  );
}

/* ---- Active card panel (battle) ---- */
function CardPanel({ name, color, card, hp, max, action, result, reasoning, prediction, element, rarity, side }: {
  name: string; color: string; card: string;
  hp: number; max: number; action: string;
  result?: 'win' | 'lose' | 'neutral';
  reasoning?: string; prediction?: string;
  element: string; rarity?: string; side: 'left' | 'right';
}) {
  const pct   = Math.max(0, Math.min(100, (hp / max) * 100));
  const hpC   = hpColor(pct);
  const ec    = elColor(element);
  const dead  = hp <= 0;
  const actC  = ACTION_COLORS[action] || '#6b7280';
  const badge = result ? TRIANGLE_BADGE[result] : null;

  return (
    <div className="flex flex-col items-center">
      {/* player name + card name */}
      <p className="font-extrabold text-[10px] sm:text-sm truncate max-w-full" style={{ color }}>{name}</p>
      <p className="text-[9px] sm:text-xs text-gray-400 mb-1 sm:mb-2 truncate max-w-full">🃏 {card}</p>

      {/* card art */}
      <div className="relative w-[72px] h-[72px] sm:w-32 sm:h-32 rounded-xl overflow-hidden"
        style={{
          ['--el' as string]: `${ec}40`,
          border: `3px solid ${ec}`,
          boxShadow: `0 0 20px ${ec}30`,
          animation: dead ? undefined : 'br-glow-ring 3s ease-in-out infinite',
          filter: dead ? 'grayscale(.8) brightness(.45)' : undefined,
        }}>
        <img src={getCardImage(card, element)} alt={card} className="w-full h-full object-cover" />

        {/* action badge */}
        <div className="absolute -bottom-px left-1/2"
          style={{ animation: 'br-badge-pop .35s ease-out both' }}>
          <div className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-black uppercase tracking-wider whitespace-nowrap"
            style={{ background: `${actC}dd`, boxShadow: `0 0 10px ${actC}55`, border: '1px solid rgba(255,255,255,.15)' }}>
            {ACTION_ICONS[action] || '?'} {action}
          </div>
        </div>

        {/* triangle badge */}
        {badge && (
          <div className="absolute top-1 sm:top-1.5" style={{ [side === 'left' ? 'right' : 'left']: '4px' }}>
            <span className="px-1.5 py-0.5 rounded text-[7px] sm:text-[9px] font-black"
              style={{ background: badge.bg, color: badge.fg }}>
              {badge.label}
            </span>
          </div>
        )}

        {/* faint overlay */}
        {dead && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.55)' }}>
            <span className="text-2xl sm:text-4xl">💀</span>
          </div>
        )}
      </div>

      {/* card name + element + rarity */}
      <p className="text-xs sm:text-base font-bold mt-1.5 sm:mt-2 truncate max-w-full">{card}</p>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <p className="text-[9px] sm:text-[10px] font-semibold uppercase" style={{ color: ec }}>{element}</p>
        {rarity && rarity !== 'common' && (() => {
          const rc = RARITY_COLORS[rarity] || RARITY_COLORS.common;
          return (
            <span className="px-1 py-px rounded text-[7px] sm:text-[8px] font-black uppercase"
              style={{ background: rc.bg, color: rc.fg }}>{rarity}</span>
          );
        })()}
      </div>

      {/* HP bar */}
      <div className="w-full" style={{ maxWidth: 180 }}>
        <div className="h-2.5 sm:h-3.5 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,.5)' }}>
          <div className="h-full rounded-full relative overflow-hidden"
            style={{ width: `${pct}%`, background: hpC, transition: 'width .8s ease, background-color .5s ease' }}>
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)', backgroundSize: '200% 100%', animation: 'br-shimmer 2s ease-in-out infinite' }} />
          </div>
        </div>
        <p className="text-[9px] sm:text-[11px] text-center mt-0.5 font-bold tabular-nums" style={{ color: hpC }}>
          {hp} / {max}
        </p>
      </div>

      {/* AI reasoning bubble */}
      {reasoning && (
        <div className="mt-2 sm:mt-3 w-full rounded-lg p-2 sm:p-3 text-[9px] sm:text-xs leading-relaxed"
          style={{ background: `${color}0d`, border: `1px solid ${color}20` }}>
          <div className="flex items-start gap-1.5">
            <span className="text-sm sm:text-base shrink-0">🧠</span>
            <div className="min-w-0">
              <span className="font-bold" style={{ color }}>Thinking: </span>
              <span className="text-gray-300">{reasoning}</span>
              {prediction && (
                <p className="mt-1 text-gray-400 italic">
                  <span className="not-italic font-semibold text-gray-300">🎯 Predicts: </span>{prediction}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Event log ---- */
function EventLog({ events, turnLabel }: { events: BattleEvent[]; turnLabel: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,24,39,.55)', border: '1px solid rgba(75,85,99,.18)' }}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid rgba(75,85,99,.15)' }}>
        <span className="text-[11px] sm:text-sm font-bold text-gray-300">📜 Battle Events</span>
        <span className="text-[9px] sm:text-[10px] text-gray-500">{turnLabel}</span>
      </div>
      <div className="max-h-36 sm:max-h-52 overflow-y-auto p-1.5 sm:p-2 space-y-1">
        {events.length === 0 && (
          <p className="text-[10px] text-gray-600 text-center py-2">Waiting…</p>
        )}
        {events.map((ev, i) => <EventRow key={i} event={ev} />)}
      </div>
    </div>
  );
}

/* ---- Single event row ---- */
function EventRow({ event }: { event: BattleEvent }) {
  const icon = EVENT_ICONS[event.type] || '•';
  const isDmg  = event.type === 'damage';
  const isHeal = event.type === 'heal';
  const isFaint = event.type === 'faint';
  const isElAdv = event.type === 'element_advantage';

  const fg = isDmg ? '#fca5a5' : isHeal ? '#86efac' : isFaint ? '#9ca3af' : isElAdv ? '#fde68a' : '#d1d5db';
  const bg = isDmg ? 'rgba(239,68,68,.08)' : isHeal ? 'rgba(34,197,94,.08)' : isFaint ? 'rgba(107,114,128,.12)' : isElAdv ? 'rgba(234,179,8,.08)' : 'rgba(31,41,55,.25)';
  const isActionReveal = event.type === 'action_reveal';
  const modelLabel = event.aiModel || 'AI';
  const detailText = isActionReveal && event.reasoning
    ? `${event.message} - ${event.reasoning} - 🧠 ${modelLabel}`
    : event.message;

  return (
    <div className="flex items-start gap-2 rounded-lg px-2.5 py-1.5"
      style={{ background: bg, color: fg, animation: 'br-float-up .25s ease-out' }}>
      <span className="shrink-0 text-xs sm:text-sm">{icon}</span>
      <span className="text-[10px] sm:text-xs leading-relaxed flex-1">{detailText}</span>
      {event.value != null && event.value !== 0 && (
        <span className="ml-auto shrink-0 font-bold text-[10px] sm:text-xs"
          style={{ color: isDmg ? '#f87171' : '#4ade80' }}>
          {isDmg ? '−' : '+'}{Math.abs(event.value)}
        </span>
      )}
    </div>
  );
}

/* ---- Final team display (victory) ---- */
function FinalTeam({ name, color, cards, dmg, fainted, isWinner }: {
  name: string; color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cards: any[];
  dmg: number; fainted: number; isWinner: boolean;
}) {
  return (
    <div className="rounded-xl p-2.5 sm:p-4 transition"
      style={{
        background: `${color}${isWinner ? '0d' : '06'}`,
        border: `1px solid ${color}${isWinner ? '30' : '12'}`,
        opacity: isWinner ? 1 : .55,
        animation: isWinner ? 'br-celebrate 1.8s ease-in-out infinite' : undefined,
      }}>
      <p className="font-bold text-[11px] sm:text-sm mb-2 truncate" style={{ color }}>
        {isWinner && '👑 '}{name}
      </p>

      <div className="flex gap-1 sm:gap-2 justify-center">
        {cards.map((c, i) => {
          const rc = RARITY_COLORS[c.rarity] || RARITY_COLORS.common;
          return (
            <div key={i} className="relative">
              <img src={getCardImage(c.name, c.element)} alt={c.name}
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg object-cover"
                style={{
                  border: `2px solid ${elColor(c.element)}`,
                  filter: !isWinner ? 'grayscale(.7) brightness(.5)' : undefined,
                }} />
              {c.rarity && c.rarity !== 'common' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded text-[6px] font-black uppercase whitespace-nowrap"
                  style={{ background: rc.bg, color: rc.fg }}>{c.rarity}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-3 mt-2 text-[9px] sm:text-xs text-gray-400">
        <span><span className="text-red-400 font-bold">{dmg}</span> dmg</span>
        <span><span className="text-gray-300 font-bold">{fainted}</span> 💀</span>
      </div>
    </div>
  );
}

/* ---- Small stat box ---- */
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2 sm:p-3" style={{ background: 'rgba(31,41,55,.4)' }}>
      <p className="text-gray-500 mb-0.5">{label}</p>
      <p className="font-bold text-white">{value}</p>
    </div>
  );
}
