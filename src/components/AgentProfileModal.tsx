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

interface AgentProfileModalProps {
  address: string;
  onClose: () => void;
}

export default function AgentProfileModal({ address, onClose }: AgentProfileModalProps) {
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'activity' | 'txs'>('cards');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/agents/${address}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setDetails(data);
      } catch (err) {
        setError('Failed to load agent details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [address]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const healthColor = (pct: number) => {
    if (pct > 60) return 'from-emerald-500 to-green-400';
    if (pct > 30) return 'from-yellow-500 to-amber-400';
    return 'from-red-600 to-red-400';
  };

  const activityIcon = (action?: string | null): string => {
    const v = (action || '').toLowerCase();
    if (!v) return '💤';
    if (v.includes('battle') || v.includes('arena')) return '⚔️';
    if (v.includes('fish')) return '🎣';
    if (v.includes('train')) return '🥊';
    if (v.includes('trade') || v.includes('shop')) return '🛒';
    if (v.includes('rest') || v.includes('heal')) return '🛌';
    if (v.includes('farm')) return '🌾';
    if (v.includes('walk') || v.includes('move') || v.includes('explor')) return '🚶';
    return '🤖';
  };

  const txIcon: Record<string, string> = {
    escrow_deposit: '🔒', battle_join: '⚔️', battle_settle: '🏆',
    mint_pack: '🎴', settlement: '💸',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-950/95 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-md max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-scale-in">
        {loading ? (
          <div className="p-16 flex items-center justify-center">
            <div className="animate-spin text-3xl">🔄</div>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 text-sm">{error}</div>
        ) : details && (
          <>
            {/* ─── Header ─── */}
            <div className="relative px-4 pt-4 pb-3 border-b border-white/5">
              <button onClick={onClose}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/20">
                  🤖
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white truncate">{details.agent.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500 font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
                    {details.agent.model && (
                      <span className="text-[10px] text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded-full">🧠 {details.agent.model}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Personality */}
              {details.agent.personality && (
                <p className="text-[11px] text-gray-500 mt-2 italic">&ldquo;{details.agent.personality}&rdquo;</p>
              )}

              {/* HP bar */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-gray-500 w-6 shrink-0">HP</span>
                <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${healthColor(details.stats.healthPercent)} transition-all duration-500`}
                    style={{ width: `${details.stats.healthPercent}%` }} />
                </div>
                <span className="text-[10px] text-white font-mono w-14 text-right shrink-0">
                  {details.agent.health}/{details.agent.maxHealth}
                </span>
              </div>

              {/* Current status */}
              <div className="flex items-center gap-1.5 mt-2 text-[11px]">
                <span>{activityIcon(details.agent.currentAction)}</span>
                <span className="text-cyan-300 font-medium capitalize">{details.agent.currentAction || 'idle'}</span>
                {details.agent.currentLocation && (
                  <span className="text-gray-600">@ {details.agent.currentLocation}</span>
                )}
              </div>
              {(details.agent.currentReasoning || details.agent.currentReason) && (
                <p className="text-[10px] text-gray-500 mt-1 italic line-clamp-2">
                  💭 {details.agent.currentReasoning || details.agent.currentReason}
                </p>
              )}
            </div>

            {/* ─── Stats Row ─── */}
            <div className="grid grid-cols-5 border-b border-white/5">
              {[
                { val: parseFloat(details.stats.balance).toFixed(2), label: 'MON', color: 'text-yellow-400' },
                { val: details.stats.cards, label: 'Cards', color: 'text-purple-400' },
                { val: details.stats.battles, label: 'Battles', color: 'text-gray-300' },
                { val: `${details.stats.wins}/${details.stats.losses}`, label: 'W/L', color: 'text-emerald-400' },
                { val: `${details.stats.winRate}%`, label: 'Win', color: 'text-cyan-400' },
              ].map((s, i) => (
                <div key={i} className="py-2.5 text-center border-r border-white/5 last:border-r-0">
                  <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
                  <div className="text-[9px] text-gray-600 uppercase mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* ─── Tabs ─── */}
            <div className="flex border-b border-white/5">
              {([
                { id: 'cards' as const, label: `🎴 ${details.cards.length}` },
                { id: 'activity' as const, label: `📝 ${details.actions.length}` },
                { id: 'txs' as const, label: `⛓️ ${details.transactions?.length || 0}` },
              ]).map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
                    activeTab === t.id ? 'text-white border-b-2 border-purple-500 bg-white/5' : 'text-gray-600 hover:text-gray-400'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── Tab Content ─── */}
            <div className="overflow-y-auto max-h-[calc(92vh-260px)] sm:max-h-[calc(85vh-280px)]">

              {/* Cards */}
              {activeTab === 'cards' && (
                <div className="p-3">
                  {details.cards.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">🎴 No cards yet</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 justify-items-center">
                      {details.cards.map((card) => (
                        <CardComponent key={card.id || card._id?.toString()} card={card} size="sm" showStats={true} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Activity */}
              {activeTab === 'activity' && (
                <div className="divide-y divide-white/5">
                  {details.actions.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">📝 No activity yet</div>
                  ) : details.actions.map((action, i) => (
                    <div key={i} className="px-3 py-2 hover:bg-white/[0.02]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs shrink-0">{activityIcon(action.action)}</span>
                          <span className="text-xs text-white font-medium truncate">{action.action}</span>
                          {action.healthDelta != null && action.healthDelta !== 0 && (
                            <span className={`text-[10px] font-mono shrink-0 ${action.healthDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {action.healthDelta > 0 ? '+' : ''}{action.healthDelta}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-700 shrink-0 ml-2">
                          {formatTime(action.timestamp)} · {formatDate(action.timestamp)}
                        </div>
                      </div>
                      {(action.reasoning || action.reason) && (
                        <p className="text-[10px] text-gray-500 mt-0.5 italic line-clamp-2">💭 {action.reasoning || action.reason}</p>
                      )}
                      {action.location && (
                        <span className="text-[10px] text-cyan-600 mt-0.5 block">📍 {action.location}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Transactions */}
              {activeTab === 'txs' && (
                <div className="divide-y divide-white/5">
                  {!details.transactions?.length ? (
                    <div className="text-center py-8 text-gray-600 text-xs">⛓️ No transactions yet</div>
                  ) : details.transactions.map((tx, i) => (
                    <a key={i} href={`https://testnet.monadexplorer.com/tx/${tx.txHash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs shrink-0">{txIcon[tx.type] || '📝'}</span>
                        <span className="text-[11px] text-gray-300 truncate">{tx.description}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {tx.amount && <span className="text-[10px] font-mono text-emerald-400">{tx.amount}</span>}
                        <span className="text-[10px] text-gray-700">{formatTime(tx.timestamp)}</span>
                        <span className="text-[10px] text-purple-500">↗</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
