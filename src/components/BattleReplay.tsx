'use client';

import { useState, useEffect, useCallback } from 'react';
import { BattleLog, BattleTurnLog, BattleEvent } from '@/lib/types';
import { AUTOMONS } from '@/lib/automons';
import { getCardArtDataUri } from '@/lib/cardArt';

function cardImage(name: string, element?: string): string {
  const mon = AUTOMONS.find(a => a.name === name);
  return getCardArtDataUri(mon?.id ?? 1, element || mon?.element || 'fire', 'common');
}

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ef4444', water: '#3b82f6', earth: '#84cc16', air: '#a78bfa', crystal: '#06b6d4',
};
const ACTION_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  strike: { icon: '⚔️', label: 'STRIKE', color: 'from-red-600 to-orange-600' },
  skill: { icon: '✨', label: 'SKILL', color: 'from-purple-600 to-pink-600' },
  guard: { icon: '🛡️', label: 'GUARD', color: 'from-blue-600 to-cyan-600' },
  switch: { icon: '🔄', label: 'SWITCH', color: 'from-yellow-600 to-amber-600' },
};
const EVENT_ICONS: Record<string, string> = {
  damage: '💥', heal: '💚', faint: '💀', element_advantage: '🔥', triangle_result: '🔺',
  interrupt: '⚡', guard_counter: '🛡️', skill_pierce: '✨', status_applied: '🌀',
  status_tick: '⏳', status_expired: '✅', switch: '🔄', battle_start: '🎯', battle_end: '🏁',
  action_reveal: '👁️',
};

type Speed = 1 | 2 | 4;

function hpPercent(hp: number, max = 150) { return Math.max(0, Math.min(100, (hp / max) * 100)); }
function hpColor(pct: number) { return pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500'; }

function getElement(name: string) { return AUTOMONS.find(a => a.name === name)?.element || 'fire'; }

interface Props { battleLog: BattleLog; onClose?: () => void; }

export default function BattleReplay({ battleLog, onClose }: Props) {
  const [turnIdx, setTurnIdx] = useState(-1);
  const [eventIdx, setEventIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const turn: BattleTurnLog | null = turnIdx >= 0 && turnIdx < battleLog.turns.length ? battleLog.turns[turnIdx] : null;
  const events: BattleEvent[] = turn?.events.slice(0, eventIdx + 1) || [];
  const isEnd = turnIdx === battleLog.turns.length - 1 && (!turn || eventIdx >= (turn?.events.length || 1) - 1);
  const p1 = battleLog.player1;
  const p2 = battleLog.player2;
  const p1Name = p1.name || p1.address.slice(0, 8);
  const p2Name = p2.name || p2.address.slice(0, 8);
  const wager = parseFloat(battleLog.wager || '0');
  const payout = (wager * 2 * 0.95).toFixed(4);
  const winnerIsP1 = battleLog.winner?.toLowerCase() === p1.address.toLowerCase();

  useEffect(() => {
    if (!playing) return;
    const ms = 1800 / speed;
    const t = setTimeout(() => {
      if (turnIdx === -1) { setTurnIdx(0); setEventIdx(0); }
      else if (turn) {
        if (eventIdx < turn.events.length - 1) setEventIdx(i => i + 1);
        else if (turnIdx < battleLog.turns.length - 1) { setTurnIdx(i => i + 1); setEventIdx(0); }
        else setPlaying(false);
      }
    }, ms);
    return () => clearTimeout(t);
  }, [playing, turnIdx, eventIdx, turn, battleLog.turns.length, speed]);

  const play = useCallback(() => {
    if (turnIdx === -1) { setTurnIdx(0); setEventIdx(0); }
    setPlaying(p => !p);
  }, [turnIdx]);
  const skip = useCallback(() => {
    const last = battleLog.turns.length - 1;
    setTurnIdx(last); setEventIdx(battleLog.turns[last].events.length - 1); setPlaying(false);
  }, [battleLog.turns]);
  const restart = useCallback(() => { setTurnIdx(-1); setEventIdx(0); setPlaying(false); }, []);

  const CardPanel = ({ player, side }: { player: 'p1' | 'p2'; side: 'left' | 'right' }) => {
    if (!turn) return null;
    const data = player === 'p1' ? turn.player1 : turn.player2;
    const info = player === 'p1' ? p1 : p2;
    const name = player === 'p1' ? p1Name : p2Name;
    const el = getElement(data.activeCard);
    const elColor = ELEMENT_COLORS[el] || '#a78bfa';
    const action = ACTION_DISPLAY[data.action] || ACTION_DISPLAY.strike;
    const tri = turn.triangleResult;
    const result = player === 'p1' ? tri?.player1Result : tri?.player2Result;
    const resultColor = result === 'win' ? 'text-emerald-400' : result === 'lose' ? 'text-red-400' : 'text-yellow-400';
    const resultLabel = result === 'win' ? 'WINS' : result === 'lose' ? 'LOSES' : 'DRAW';
    const hp = hpPercent(data.cardHp);

    return (
      <div className="flex-1 min-w-0">
        {/* Player name */}
        <div className={`flex items-center gap-2 mb-2 ${side === 'right' ? 'justify-end' : ''}`}>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm sm:text-base font-bold text-white truncate">{name}</span>
          {info.isAI && <span className="text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">AI</span>}
        </div>

        {/* Card display */}
        <div className="relative bg-gray-900/60 border border-white/10 rounded-xl p-3 sm:p-4">
          {/* Action badge */}
          <div className={`absolute -top-3 ${side === 'left' ? 'left-3' : 'right-3'} z-10`}>
            <div className={`bg-gradient-to-r ${action.color} px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg`}>
              <span className="text-sm">{action.icon}</span>
              <span className="text-[10px] sm:text-xs font-bold text-white">{action.label}</span>
            </div>
          </div>

          {/* Triangle result */}
          {tri && (
            <div className={`absolute -top-3 ${side === 'left' ? 'right-3' : 'left-3'} z-10`}>
              <span className={`text-[10px] sm:text-xs font-bold ${resultColor} bg-gray-950 px-2 py-1 rounded-full border border-white/10`}>{resultLabel}</span>
            </div>
          )}

          {/* Card art + name */}
          <div className="flex items-center gap-3">
            <div className="shrink-0" style={{ borderColor: elColor }}>
              <img
                src={cardImage(data.activeCard, el)}
                alt={data.activeCard}
                className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg object-cover border-2 shadow-lg"
                style={{ borderColor: elColor, boxShadow: `0 0 15px ${elColor}33` }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm sm:text-lg font-bold text-white truncate">{data.activeCard}</div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider" style={{ color: elColor }}>{el}</div>

              {/* HP bar */}
              <div className="mt-1.5">
                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                  <span>HP</span>
                  <span className="font-mono">{data.cardHp}</span>
                </div>
                <div className="h-2.5 sm:h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${hpColor(hp)} transition-all duration-700 rounded-full`} style={{ width: `${hp}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          {data.reasoning && (
            <div className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px]">🧠</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">AI Thinking</span>
              </div>
              <p className="text-xs text-gray-400 italic leading-relaxed line-clamp-3">{data.reasoning}</p>
            </div>
          )}
        </div>

        {/* Team cards (small) */}
        <div className={`flex gap-1.5 mt-2 ${side === 'right' ? 'justify-end' : ''}`}>
          {info.cards.map((c, i) => {
            const cel = c.element || getElement(c.name);
            const isActive = c.name === data.activeCard;
            return (
              <div key={i} className={`relative ${isActive ? 'ring-2 ring-white/40' : 'opacity-50'}`}>
                <img
                  src={cardImage(c.name, cel)}
                  alt={c.name}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded object-cover border"
                  style={{ borderColor: isActive ? ELEMENT_COLORS[cel] || '#888' : '#333' }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-950/95 backdrop-blur-sm z-50 flex flex-col">
      {/* ── Header ── */}
      <div className="bg-gray-900/80 border-b border-white/5 px-3 py-2.5 sm:px-6 sm:py-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg sm:text-xl">⚔️</span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-white truncate">{p1Name} vs {p2Name}</h2>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                <span className="text-yellow-400 font-semibold">{battleLog.wager} MON wager</span>
                <span>•</span>
                <span>{battleLog.turns.length} turns</span>
                <span>•</span>
                <span>💰 {payout} MON to winner</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button onClick={restart} className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition text-sm" title="Restart">⏮️</button>
            <button onClick={play} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs sm:text-sm font-semibold transition shadow-lg shadow-purple-600/20">
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={skip} className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition text-sm" title="Skip to end">⏭️</button>
            <div className="flex bg-gray-800 rounded-lg p-0.5 ml-1">
              {([1, 2, 4] as Speed[]).map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold transition ${speed === s ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                  {s}x
                </button>
              ))}
            </div>
            {onClose && <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg ml-1 text-gray-400 hover:text-white transition">✕</button>}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-3 py-4 sm:px-6 sm:py-6">

          {/* Intro screen */}
          {turnIdx === -1 && (
            <div className="text-center py-8 sm:py-16">
              <div className="inline-block bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-white/10 rounded-2xl px-8 py-6 sm:px-12 sm:py-10">
                <h2 className="text-2xl sm:text-4xl font-black text-white mb-2">⚔️ BATTLE</h2>
                <div className="flex items-center justify-center gap-4 sm:gap-8 mb-4">
                  <span className="text-lg sm:text-2xl font-bold text-cyan-400">{p1Name}</span>
                  <span className="text-gray-600 text-sm">VS</span>
                  <span className="text-lg sm:text-2xl font-bold text-purple-400">{p2Name}</span>
                </div>
                <div className="text-yellow-400 font-bold text-sm sm:text-lg mb-6">💰 {battleLog.wager} MON wager</div>

                {/* Team previews */}
                <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-6">
                  {[p1, p2].map((p, pi) => (
                    <div key={pi}>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{pi === 0 ? p1Name : p2Name}&apos;s Team</div>
                      <div className="flex justify-center gap-2">
                        {p.cards.map((c, ci) => {
                          const el = c.element || getElement(c.name);
                          return (
                            <div key={ci} className="text-center">
                              <img src={cardImage(c.name, el)} alt={c.name}
                                className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover border-2 shadow-lg"
                                style={{ borderColor: ELEMENT_COLORS[el], boxShadow: `0 0 10px ${ELEMENT_COLORS[el]}33` }} />
                              <div className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate w-12 sm:w-16">{c.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={play}
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 px-8 py-3 rounded-xl text-sm sm:text-base font-bold shadow-lg transition">
                  ▶ Start Battle
                </button>
              </div>
            </div>
          )}

          {/* Active turn */}
          {turn && (
            <>
              {/* Turn indicator */}
              <div className="text-center mb-4 sm:mb-6">
                <span className="bg-gray-800 border border-white/10 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-gray-300">
                  Turn {turnIdx + 1} of {battleLog.turns.length}
                </span>
              </div>

              {/* Battle arena — side by side */}
              <div className="flex gap-3 sm:gap-6 items-start mb-4 sm:mb-6">
                <CardPanel player="p1" side="left" />

                {/* VS */}
                <div className="shrink-0 flex flex-col items-center justify-center pt-10 sm:pt-14">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-600/30">
                    <span className="text-xs sm:text-base font-black text-white">VS</span>
                  </div>
                </div>

                <CardPanel player="p2" side="right" />
              </div>

              {/* Event log */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-400">⚡ Battle Events</h3>
                  <span className="text-[10px] text-gray-600">{events.length} / {turn.events.length}</span>
                </div>
                <div className="max-h-40 sm:max-h-52 overflow-y-auto p-2 sm:p-3 space-y-1">
                  {events.map((e, i) => {
                    const eIcon = EVENT_ICONS[e.type] || '📝';
                    const isD = e.type === 'damage' || e.type === 'interrupt' || e.type === 'skill_pierce';
                    const isH = e.type === 'heal' || e.type === 'status_expired';
                    const isF = e.type === 'faint';
                    return (
                      <div key={i} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm transition-all ${
                        i === events.length - 1 ? 'bg-white/[0.04] border border-white/[0.06]' : ''
                      }`}>
                        <span className="shrink-0 text-sm">{eIcon}</span>
                        <span className={`leading-relaxed ${
                          isF ? 'text-red-400 font-semibold' : isD ? 'text-orange-300' : isH ? 'text-emerald-400' : 'text-gray-300'
                        }`}>
                          {e.message}
                          {e.value && isD && <span className="ml-1 text-red-400 font-mono font-bold">-{e.value}</span>}
                          {e.value && isH && <span className="ml-1 text-emerald-400 font-mono font-bold">+{e.value}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Victory screen */}
          {isEnd && !playing && (
            <div className="mt-6 sm:mt-10 text-center">
              <div className="inline-block bg-gradient-to-br from-yellow-600/20 via-amber-600/20 to-orange-600/20 border border-yellow-500/30 rounded-2xl px-6 py-6 sm:px-12 sm:py-10 shadow-2xl">
                <div className="text-4xl sm:text-6xl mb-3">🏆</div>
                <h2 className="text-xl sm:text-3xl font-black text-white mb-1">VICTORY</h2>
                <p className="text-lg sm:text-2xl font-bold text-yellow-400 mb-4">{winnerIsP1 ? p1Name : p2Name}</p>

                <div className="grid grid-cols-2 gap-6 sm:gap-10 text-center mb-4">
                  <div>
                    <div className={`text-lg sm:text-2xl font-bold ${winnerIsP1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {winnerIsP1 ? '👑 Winner' : 'Defeated'}
                    </div>
                    <div className="text-sm text-gray-400">{p1Name}</div>
                    <div className="text-xs text-gray-500 mt-1">Damage: {battleLog.totalDamageDealt.player1}</div>
                    <div className="text-xs text-gray-500">Fainted: {battleLog.cardsFainted.player1}</div>
                  </div>
                  <div>
                    <div className={`text-lg sm:text-2xl font-bold ${!winnerIsP1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {!winnerIsP1 ? '👑 Winner' : 'Defeated'}
                    </div>
                    <div className="text-sm text-gray-400">{p2Name}</div>
                    <div className="text-xs text-gray-500 mt-1">Damage: {battleLog.totalDamageDealt.player2}</div>
                    <div className="text-xs text-gray-500">Fainted: {battleLog.cardsFainted.player2}</div>
                  </div>
                </div>

                <div className="bg-black/30 rounded-xl px-6 py-3 inline-block">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Payout</div>
                  <div className="text-xl sm:text-3xl font-black text-emerald-400">{payout} MON</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="bg-gray-900/80 border-t border-white/5 px-4 py-2.5 sm:py-3 shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 transition-all duration-500 rounded-full"
              style={{ width: `${turnIdx < 0 ? 0 : ((turnIdx + 1) / battleLog.turns.length) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-600">
            <span>Start</span>
            <span>💰 {battleLog.wager} MON</span>
            <span>End</span>
          </div>
        </div>
      </div>
    </div>
  );
}
