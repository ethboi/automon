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
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
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
    <div className="fixed inset-0 z-[60] pointer-events-auto" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet — sits below header on mobile, centered on desktop */}
      <div
        className="absolute bottom-0 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-sm sm:rounded-2xl
          bg-gray-950 border-t sm:border border-white/10 rounded-t-2xl max-h-[calc(100vh-4rem)] sm:max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin text-2xl">🔄</div></div>
        ) : !d ? (
          <div className="text-center py-12 text-gray-500 text-sm">Failed to load</div>
        ) : (
          <>
            {/* ── Drag handle (mobile) ── */}
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* ── Header ── */}
            <div className="px-3 pt-1 pb-2 sm:px-4 sm:pt-3 sm:pb-3">
              {/* Close btn desktop */}
              <button onClick={onClose} className="hidden sm:flex absolute top-2 right-2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center">
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-base shadow-lg shadow-cyan-500/20 shrink-0">
                  🤖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-white truncate">{d.agent.name}</h2>
                    {d.agent.model && (
                      <span className="text-[9px] text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded-full shrink-0">🧠 {d.agent.model}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
                </div>
                {/* MON balance */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-yellow-400">{parseFloat(d.stats.balance).toFixed(2)}</div>
                  <div className="text-[9px] text-gray-600">MON</div>
                </div>
              </div>

              {/* HP bar */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hp}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 font-mono w-12 text-right">{d.agent.health}/{d.agent.maxHealth}</span>
              </div>

              {/* Status line */}
              <div className="flex items-center gap-1 mt-1.5 text-[10px]">
                <span>{getIcon(d.agent.currentAction)}</span>
                <span className="text-cyan-300 font-medium capitalize">{d.agent.currentAction || 'idle'}</span>
                {d.agent.currentLocation && <span className="text-gray-600">@ {d.agent.currentLocation}</span>}
              </div>
              {(d.agent.currentReasoning || d.agent.currentReason) && (
                <p className="text-[9px] text-gray-600 mt-0.5 italic line-clamp-1">💭 {d.agent.currentReasoning || d.agent.currentReason}</p>
              )}
            </div>

            {/* ── Stats strip ── */}
            <div className="grid grid-cols-4 border-y border-white/5">
              {[
                { v: d.stats.cards, l: 'Cards', c: 'text-purple-400' },
                { v: d.stats.battles, l: 'Battles', c: 'text-gray-300' },
                { v: `${d.stats.wins}/${d.stats.losses}`, l: 'W/L', c: 'text-emerald-400' },
                { v: `${d.stats.winRate}%`, l: 'Win', c: 'text-cyan-400' },
              ].map((s, i) => (
                <div key={i} className="py-1.5 text-center border-r border-white/5 last:border-r-0">
                  <div className={`text-xs font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-[8px] text-gray-700 uppercase">{s.l}</div>
                </div>
              ))}
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b border-white/5">
              {([
                { id: 'log' as const, l: `📝 Log` },
                { id: 'cards' as const, l: `🎴 ${d.cards.length}` },
                { id: 'txs' as const, l: `⛓️ ${d.transactions?.length || 0}` },
              ]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${
                    tab === t.id ? 'text-white border-b-2 border-purple-500 bg-white/[0.03]' : 'text-gray-600 hover:text-gray-400'
                  }`}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* ── Content ── */}
            <div className="overflow-y-auto max-h-[calc(100vh-4rem-220px)] sm:max-h-[calc(80vh-240px)]">

              {/* Log */}
              {tab === 'log' && (
                d.actions.length === 0 ? (
                  <div className="text-center py-8 text-gray-700 text-[10px]">No activity yet</div>
                ) : (
                  <div className="divide-y divide-white/[0.03]">
                    {d.actions.map((a, i) => (
                      <div key={i} className="px-3 py-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px]">{getIcon(a.action)}</span>
                            <span className="text-[10px] text-white font-medium truncate">{a.action}</span>
                            {a.healthDelta != null && a.healthDelta !== 0 && (
                              <span className={`text-[9px] font-mono ${a.healthDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {a.healthDelta > 0 ? '+' : ''}{a.healthDelta}
                              </span>
                            )}
                            {a.location && <span className="text-[9px] text-gray-700">@ {a.location}</span>}
                          </div>
                          <span className="text-[9px] text-gray-700 shrink-0 ml-1">{timeAgo(a.timestamp)}</span>
                        </div>
                        {(a.reasoning || a.reason) && (
                          <p className="text-[9px] text-gray-600 mt-0.5 italic line-clamp-1">💭 {a.reasoning || a.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Cards */}
              {tab === 'cards' && (
                d.cards.length === 0 ? (
                  <div className="text-center py-8 text-gray-700 text-[10px]">No cards yet</div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 p-2">
                    {d.cards.map(card => (
                      <CardComponent key={card.id || card._id?.toString()} card={card} size="sm" showStats={true} />
                    ))}
                  </div>
                )
              )}

              {/* Txs */}
              {tab === 'txs' && (
                !d.transactions?.length ? (
                  <div className="text-center py-8 text-gray-700 text-[10px]">No transactions yet</div>
                ) : (
                  <div className="divide-y divide-white/[0.03]">
                    {d.transactions.map((tx, i) => (
                      <a key={i} href={`https://testnet.monadexplorer.com/tx/${tx.txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[10px]">{TX_ICONS[tx.type] || '📝'}</span>
                          <span className="text-[10px] text-gray-400 truncate">{tx.description}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {tx.amount && <span className="text-[9px] font-mono text-emerald-400">{tx.amount}</span>}
                          <span className="text-[9px] text-gray-700">{timeAgo(tx.timestamp)}</span>
                          <span className="text-[9px] text-purple-500">↗</span>
                        </div>
                      </a>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Personality footer */}
            {d.agent.personality && (
              <div className="border-t border-white/5 px-3 py-1.5">
                <p className="text-[9px] text-gray-700 italic text-center">&ldquo;{d.agent.personality}&rdquo;</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
