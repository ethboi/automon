'use client';

import { useEffect, useState } from 'react';
import { Card as CardType } from '@/lib/types';
import CardComponent from './Card';

interface AgentDetails {
  agent: {
    address: string;
    name: string;
    personality: string;
    model?: string | null;
    isAI: boolean;
    position: { x: number; y: number; z: number };
    health: number;
    maxHealth: number;
    currentAction?: string | null;
    currentReason?: string | null;
    currentReasoning?: string | null;
    currentLocation?: string | null;
    lastActionAt?: string | null;
    lastSeen: string;
    createdAt?: string;
  };
  stats: {
    balance: string;
    cards: number;
    battles: number;
    wins: number;
    losses: number;
    winRate: number;
    healthPercent: number;
  };
  cards: CardType[];
  actions: Array<{
    action: string;
    reason: string;
    reasoning?: string;
    timestamp: string;
    location?: string;
    healthDelta?: number;
  }>;
  transactions?: Array<{
    txHash: string;
    type: string;
    description: string;
    amount?: string | null;
    timestamp: string;
  }>;
}

const ACTIVITY_ICONS: Record<string, string> = {
  battle: '⚔️', fish: '🎣', train: '🥊', trade: '🛒', shop: '🛒',
  rest: '🛌', heal: '🛌', farm: '🌾', walk: '🚶', move: '🚶', explor: '🚶',
  mint: '🎴',
};
const TX_ICONS: Record<string, string> = {
  escrow_deposit: '🔒', battle_join: '⚔️', battle_settle: '🏆', mint_pack: '🎴', settlement: '💸',
};

function getIcon(action?: string | null): string {
  const v = (action || '').toLowerCase();
  for (const [k, icon] of Object.entries(ACTIVITY_ICONS)) if (v.includes(k)) return icon;
  return v ? '🤖' : '💤';
}

function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AgentProfileModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [d, setD] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'cards' | 'log' | 'txs'>('log');

  useEffect(() => {
    fetch(`/api/agents/${address}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data) setD(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [address]);

  const hp = d ? d.stats.healthPercent : 0;
  const hpColor = hp > 60 ? 'bg-emerald-500' : hp > 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />

      {/* Bottom sheet on mobile, centered card on desktop */}
      <div
        className="absolute bottom-0 left-0 right-0 top-16 sm:top-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[420px] sm:max-h-[85vh] sm:rounded-2xl
          bg-gray-950 border-t sm:border border-white/10 rounded-t-2xl overflow-hidden flex flex-col"
        style={{ zIndex: 61 }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin text-2xl">🔄</div></div>
        ) : !d ? (
          <div className="text-center py-12 text-gray-500">Failed to load</div>
        ) : (
          <>
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pt-2 pb-3 shrink-0">
              <button onClick={onClose} className="hidden sm:flex absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center">
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20 shrink-0">
                  🤖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white truncate">{d.agent.name}</h2>
                    {d.agent.model && (
                      <span className="text-[10px] text-violet-400 bg-violet-500/15 px-2 py-0.5 rounded-full shrink-0">🧠 {d.agent.model}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-yellow-400">{parseFloat(d.stats.balance).toFixed(2)}</div>
                  <div className="text-[10px] text-gray-500">MON</div>
                </div>
              </div>

              {/* HP bar */}
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-xs text-gray-500">HP</span>
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hp}%` }} />
                </div>
                <span className="text-xs text-gray-400 font-mono">{d.agent.health}/{d.agent.maxHealth}</span>
              </div>

              {/* Current status */}
              <div className="mt-2 bg-white/[0.03] rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span>{getIcon(d.agent.currentAction)}</span>
                  <span className="text-cyan-300 font-semibold capitalize">{d.agent.currentAction || 'idle'}</span>
                  {d.agent.currentLocation && <span className="text-gray-500">@ {d.agent.currentLocation}</span>}
                </div>
                {(d.agent.currentReasoning || d.agent.currentReason) && (
                  <p className="text-xs text-gray-400 mt-1 italic leading-relaxed line-clamp-2">💭 {d.agent.currentReasoning || d.agent.currentReason}</p>
                )}
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 border-y border-white/5 shrink-0">
              {[
                { v: d.stats.cards, l: 'Cards', c: 'text-purple-400' },
                { v: d.stats.battles, l: 'Battles', c: 'text-gray-300' },
                { v: `${d.stats.wins}/${d.stats.losses}`, l: 'W/L', c: 'text-emerald-400' },
                { v: `${d.stats.winRate}%`, l: 'Win Rate', c: 'text-cyan-400' },
              ].map((s, i) => (
                <div key={i} className="py-2 text-center border-r border-white/5 last:border-r-0">
                  <div className={`text-sm font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-[10px] text-gray-600 uppercase tracking-wide">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 shrink-0">
              {([
                { id: 'log' as const, l: '📝 Activity' },
                { id: 'cards' as const, l: `🎴 Cards (${d.cards.length})` },
                { id: 'txs' as const, l: `⛓️ Txns (${d.transactions?.length || 0})` },
              ]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    tab === t.id ? 'text-white border-b-2 border-purple-500 bg-white/[0.03]' : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 min-h-0">

              {tab === 'log' && (
                d.actions.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No activity yet</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {d.actions.map((a, i) => (
                      <div key={i} className="px-4 py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm">{getIcon(a.action)}</span>
                            <span className="text-sm text-white font-medium capitalize">{a.action}</span>
                            {a.healthDelta != null && a.healthDelta !== 0 && (
                              <span className={`text-xs font-mono ${a.healthDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {a.healthDelta > 0 ? '+' : ''}{a.healthDelta} HP
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {a.location && <span className="text-[10px] text-purple-400">📍 {a.location}</span>}
                            <span className="text-[10px] text-gray-600">{timeAgo(a.timestamp)}</span>
                          </div>
                        </div>
                        {(a.reasoning || a.reason) && (
                          <p className="text-xs text-gray-400 mt-1 italic leading-relaxed line-clamp-2">💭 {a.reasoning || a.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'cards' && (
                d.cards.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No cards yet</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5 p-4">
                    {d.cards.map(card => (
                      <div key={card.id || card._id?.toString()}>
                        <CardComponent card={card} size="sm" showStats={false} />
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'txs' && (
                !d.transactions?.length ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No transactions yet</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {d.transactions.map((tx, i) => (
                      <a key={i} href={`https://testnet.monadexplorer.com/tx/${tx.txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors group">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{TX_ICONS[tx.type] || '📝'}</span>
                          <span className="text-sm text-gray-300 truncate group-hover:text-white transition-colors">{tx.description}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {tx.amount && <span className="text-xs font-mono text-emerald-400 font-semibold">{tx.amount}</span>}
                          <span className="text-[10px] text-gray-600">{timeAgo(tx.timestamp)}</span>
                          <span className="text-xs text-purple-400 group-hover:text-purple-300 underline">view ↗</span>
                        </div>
                      </a>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Personality footer */}
            {d.agent.personality && (
              <div className="border-t border-white/5 px-4 py-2 shrink-0">
                <p className="text-xs text-gray-500 italic text-center">&ldquo;{d.agent.personality}&rdquo;</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
