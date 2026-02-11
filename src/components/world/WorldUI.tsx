'use client';

import { useEffect, useState } from 'react';

interface WorldUIProps {
  nearbyBuilding: string | null;
  onEnterBuilding?: () => void;
  onSelectAgent?: (address: string) => void;
  onFlyToAgent?: (address: string) => void;
  walletAddress?: string | null;
  onlineAgents?: OnlineAgent[];
  events?: EventData[];
  transactions?: TxData[];
  totalBattles?: number;
  totalCards?: number;
  battles?: BattleData[];
  chat?: ChatMessage[];
}

interface OnlineAgent {
  address: string;
  name: string;
  personality?: string;
  isAI: boolean;
  online?: boolean;
  currentAction?: string | null;
  currentReason?: string | null;
  currentLocation?: string | null;
  mood?: number;
  moodLabel?: string;
  health?: number;
  maxHealth?: number;
  stats?: { wins: number; losses: number; cards: number };
  balance?: string | null;
  model?: string;
}

interface EventData {
  agent: string;
  action: string;
  reason: string;
  reasoning?: string;
  location: string | null;
  healthDelta?: number;
  healthAfter?: number;
  timestamp: string;
}

interface ChatMessage {
  from: string;
  fromName: string;
  to?: string;
  toName?: string;
  message: string;
  location?: string;
  timestamp: string;
}

interface BattleData {
  id: string;
  status: string;
  player1: string;
  player2: string | null;
  player1Cards?: string[];
  player2Cards?: string[];
  player1Reasoning?: string | null;
  player2Reasoning?: string | null;
  winner: string | null;
  wager?: string;
  payout?: string | null;
  settleTxHash?: string | null;
  lastRound?: {
    turn: number;
    player1Move?: { action: string; reasoning?: string | null } | null;
    player2Move?: { action: string; reasoning?: string | null } | null;
  } | null;
  rounds: number;
  createdAt: string;
}

interface TxData {
  txHash: string;
  type: string;
  from: string;
  description: string;
  explorerUrl: string;
  timestamp: string;
  amount?: string | null;
}

type Tab = 'agents' | 'feed' | 'chat' | 'trades' | 'chain';
const PUBLIC_NETWORK = (process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase();
const PUBLIC_EXPLORER_BASE = (
  (PUBLIC_NETWORK === 'mainnet'
    ? process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL_MAINNET
    : process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL_TESTNET) ||
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
  'https://testnet.monadexplorer.com'
).replace(/\/+$/, '');

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}

function shortAddr(addr: string) {
  if (!addr) return '???';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function _shortHash(hash: string) {
  if (!hash) return '???';
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function activityBadge(activity?: string | null): { icon: string; label: string; cls: string } {
  const value = (activity || '').toLowerCase();
  if (value === 'came online') return { icon: '🚶', label: 'wandering', cls: 'text-cyan-300 bg-cyan-500/10' };
  if (!value) return { icon: '💤', label: 'idle', cls: 'text-gray-400 bg-white/5' };
  if (value.includes('battle') || value.includes('arena') || value.includes('duel')) return { icon: '⚔️', label: 'battling', cls: 'text-red-300 bg-red-500/10' };
  if (value.includes('fish') || value.includes('catch')) return { icon: '🎣', label: 'fishing', cls: 'text-sky-300 bg-sky-500/10' };
  if (value.includes('train')) return { icon: '🥊', label: 'training', cls: 'text-orange-300 bg-orange-500/10' };
  if (value.includes('trading_token') || value.includes('bought') || value.includes('sold')) return { icon: '📈', label: 'trading $AUTOMON', cls: 'text-emerald-300 bg-emerald-500/10' };
  if (value.includes('trade') || value.includes('shop') || value.includes('market')) return { icon: '🛒', label: 'trading', cls: 'text-yellow-300 bg-yellow-500/10' };
  if (value.includes('rest') || value.includes('heal') || value.includes('sleep')) return { icon: '🛌', label: 'resting', cls: 'text-lime-300 bg-lime-500/10' };
  if (value.includes('move') || value.includes('wander') || value.includes('explor') || value.includes('walk')) return { icon: '🚶', label: 'wandering', cls: 'text-cyan-300 bg-cyan-500/10' };
  return { icon: '🤖', label: activity || 'active', cls: 'text-purple-300 bg-purple-500/10' };
}

const TX_ICONS: Record<string, string> = {
  mint_pack: '📦',
  open_pack: '🎴',
  battle_create: '⚔️',
  battle_settle: '🏆',
  battle_join: '🤝',
  nft_mint: '💎',
  escrow_deposit: '🔒',
  escrow_settle: '🔓',
  token_buy: '📈',
  token_sell: '📉',
};

export function WorldUI({
  nearbyBuilding, onEnterBuilding, onSelectAgent, onFlyToAgent,
  walletAddress = null,
  onlineAgents = [], events = [], transactions = [], battles = [], chat = [],
  totalBattles: _totalBattles = 0, totalCards: _totalCards = 0,
}: WorldUIProps) {
  const [tab, setTab] = useState<Tab>('agents');
  const [panelOpen, setPanelOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  // aiLogOpen removed — feed is now a tab in the right panel

  const onlineCount = onlineAgents.filter(a => a.online).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && nearbyBuilding && onEnterBuilding) {
        onEnterBuilding();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearbyBuilding, onEnterBuilding]);

  const sendChat = async () => {
    if (!walletAddress || !chatInput.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          from: walletAddress,
          fromName: shortAddr(walletAddress),
          message: chatInput.trim(),
        }),
      });
      setChatInput('');
    } catch (error) {
      console.error('Send chat failed:', error);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* ─── Controls Legend ─── */}
      <div className="absolute top-16 right-4 pointer-events-auto hidden sm:block">
        <div className="bg-black/60 backdrop-blur-md rounded-xl px-4 py-3 border border-white/10 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-gray-500 w-20">🖱️ Left</span>
            <span>Pan / Rotate</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-gray-500 w-20">🖱️ Right</span>
            <span>Move Character</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-gray-500 w-20">🖱️ Scroll</span>
            <span>Zoom</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-gray-500 w-20">
              <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px] font-bold border border-white/10">E</kbd>
            </span>
            <span>Enter Building</span>
          </div>
        </div>
      </div>

      {/* ─── Unified Panel (bottom right) ─── */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 pointer-events-auto" style={{ zIndex: 50 }}>
        {!panelOpen ? (
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-2.5 bg-black/70 backdrop-blur-md rounded-full px-5 py-3 border border-white/10 hover:border-purple-500/30 transition-all shadow-xl hover:shadow-purple-500/10 active:scale-95"
          >
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-base font-medium text-gray-300">{onlineCount} online</span>
            <span className="text-gray-600">|</span>
            <span className="text-base text-gray-400">📡 💬 ⛓️</span>
          </button>
        ) : (
          <div className="w-[calc(100vw-24px)] sm:w-[420px] max-h-[70vh] sm:max-h-[75vh] bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in flex flex-col">
            {/* Tabs */}
            <div className="flex items-center border-b border-white/5 flex-shrink-0">
              {([
                { id: 'agents' as Tab, label: '🤖', count: onlineCount },
                { id: 'feed' as Tab, label: '📡', count: events.length + battles.length },
                { id: 'chat' as Tab, label: '💬', count: chat.length },
                { id: 'trades' as Tab, label: '📈', count: transactions.filter(t => t.type === 'token_buy' || t.type === 'token_sell').length },
                { id: 'chain' as Tab, label: '⛓️', count: transactions.length },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                    tab === t.id ? 'text-white bg-white/5 border-b-2 border-purple-500' : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tab === t.id ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'
                    }`}>{t.count}</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setPanelOpen(false)}
                className="px-3 py-2.5 text-gray-600 hover:text-gray-400 transition-colors text-sm"
              >✕</button>
            </div>

            {/* Content */}
            <div className="p-2 sm:p-3 overflow-y-auto flex-1">
              {/* Agents Tab */}
              {tab === 'agents' && (() => {
                const online = onlineAgents.filter(a => a.online);
                return online.length === 0 ? (
                  <Empty text="No agents online" />
                ) : (
                  <div className="space-y-0.5">
                    {online.map(agent => {
                      const activity = activityBadge(agent.currentAction);
                      return (
                      <button
                        key={agent.address}
                        onClick={() => { onFlyToAgent?.(agent.address); onSelectAgent?.(agent.address); }}
                        className="w-full hover:bg-white/5 rounded-lg px-2 py-1.5 sm:py-2 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500 shadow-sm shadow-green-500/50" />
                            <span className="text-xs sm:text-sm text-cyan-400 font-semibold truncate">{agent.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${activity.cls}`}>
                              {activity.icon} {activity.label}
                            </span>
                            {agent.model && <span className="text-[9px] text-violet-400/60 hidden sm:inline">🧠</span>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            {agent.balance && (
                              <span className="text-[10px] sm:text-xs font-mono text-yellow-400">{parseFloat(agent.balance).toFixed(2)} <span className="text-yellow-600">MON</span></span>
                            )}
                            {agent.stats && (
                              <span className="text-[10px] sm:text-xs text-gray-600">{agent.stats.wins}W/{agent.stats.losses}L</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-pink-400"
                              style={{ width: `${Math.max(0, Math.min(100, agent.mood ?? 60))}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-pink-300 capitalize">{agent.moodLabel || 'steady'}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{
                                width: `${Math.max(0, Math.min(100, ((agent.health ?? 100) / Math.max(1, agent.maxHealth ?? 100)) * 100))}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-emerald-300 tabular-nums">
                            HP {Math.max(0, Math.round(agent.health ?? 100))}/{Math.max(1, Math.round(agent.maxHealth ?? 100))}
                          </span>
                        </div>
                      </button>
                    )})}
                  </div>
                );
              })()}

              {/* Feed Tab (AI Activity + Battles) */}
              {tab === 'feed' && (() => {
                // Interleave events and battles by timestamp
                type FeedItem = { type: 'event'; data: EventData } | { type: 'battle'; data: BattleData };
                const feed: FeedItem[] = [
                  ...events.slice(0, 15).map(e => ({ type: 'event' as const, data: e })),
                  ...battles.slice(0, 10).map(b => ({ type: 'battle' as const, data: b })),
                ].sort((a, b) => {
                  const tA = 'timestamp' in a.data ? a.data.timestamp : ('createdAt' in a.data ? a.data.createdAt : '');
                  const tB = 'timestamp' in b.data ? b.data.timestamp : ('createdAt' in b.data ? b.data.createdAt : '');
                  return new Date(tB).getTime() - new Date(tA).getTime();
                }).slice(0, 25);

                return feed.length === 0 ? (
                  <Empty text="Waiting for agent actions..." />
                ) : (
                  <div className="divide-y divide-white/5">
                    {feed.map((item, i) => {
                      if (item.type === 'battle') {
                        const b = item.data;
                        const p1 = onlineAgents.find(a => a.address?.toLowerCase() === b.player1?.toLowerCase())?.name || shortAddr(b.player1);
                        const p2 = b.player2 ? (onlineAgents.find(a => a.address?.toLowerCase() === b.player2?.toLowerCase())?.name || shortAddr(b.player2)) : null;
                        const winner = b.winner ? (onlineAgents.find(a => a.address?.toLowerCase() === b.winner?.toLowerCase())?.name || shortAddr(b.winner)) : null;
                        const isComplete = b.status === 'complete';
                        return (
                          <div key={`battle-${i}`} className={`px-2 py-1.5 ${isComplete ? 'bg-yellow-500/[0.03]' : 'hover:bg-white/5'} transition-colors`}>
                            <div className="flex items-start gap-2">
                              <span className="text-sm flex-shrink-0 mt-0.5">⚔️</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold ${b.winner?.toLowerCase() === b.player1?.toLowerCase() ? 'text-yellow-300' : 'text-gray-300'}`}>{p1}</span>
                                  <span className="text-[10px] text-gray-600">vs</span>
                                  {p2 ? (
                                    <span className={`text-xs font-bold ${b.winner?.toLowerCase() === b.player2?.toLowerCase() ? 'text-yellow-300' : 'text-gray-300'}`}>{p2}</span>
                                  ) : (
                                    <span className="text-[10px] text-yellow-500/50 italic animate-pulse">waiting…</span>
                                  )}
                                  <span className="text-[10px] text-gray-700 ml-auto shrink-0">{timeAgo(b.createdAt)}</span>
                                </div>
                                {(b.player1Cards?.length || b.player2Cards?.length) ? (
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    🎴 {b.player1Cards?.join(', ') || '—'} vs {b.player2Cards?.join(', ') || '—'}
                                  </div>
                                ) : null}
                                {isComplete && winner && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-yellow-400">🏆 {winner}</span>
                                    {b.payout && <span className="text-[10px] font-mono text-emerald-400">+{b.payout} MON</span>}
                                    {b.settleTxHash && b.settleTxHash !== 'pre-escrow-fix' && (
                                      <a href={`${PUBLIC_EXPLORER_BASE}/tx/${b.settleTxHash}`} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] text-purple-500 hover:text-purple-400 font-mono ml-auto" onClick={e => e.stopPropagation()}>
                                        settled ↗
                                      </a>
                                    )}
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-600 mt-0.5">💰 {b.wager || '0'} MON{b.rounds > 0 ? ` • ${b.rounds} turns` : ''}</div>
                                {b.player1Reasoning && (
                                  <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">🧠 {p1}: {b.player1Reasoning}</div>
                                )}
                                {b.player2Reasoning && (
                                  <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">🧠 {p2}: {b.player2Reasoning}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const e = item.data as EventData;
                      const agentName = onlineAgents.find(a => a.address?.toLowerCase() === e.agent?.toLowerCase())?.name || shortAddr(e.agent);
                      const badge = activityBadge(e.action);
                      return (
                        <div key={`ev-${i}`} className="px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => onFlyToAgent?.(e.agent)}>
                          <div className="flex items-start gap-2">
                            <span className="text-sm flex-shrink-0 mt-0.5">{badge.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-cyan-400">{agentName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.cls}`}>{e.action}</span>
                                {e.healthDelta != null && e.healthDelta !== 0 && (
                                  <span className={`text-[10px] font-mono ${e.healthDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {e.healthDelta > 0 ? '+' : ''}{e.healthDelta}HP
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-700 ml-auto flex-shrink-0">{timeAgo(e.timestamp)}</span>
                              </div>
                              {(e.reasoning || e.reason) && (
                                <div className="text-xs text-gray-400 mt-0.5 leading-tight line-clamp-2">
                                  💭 {e.reasoning || e.reason}
                                </div>
                              )}
                              {e.location && (
                                <div className="text-[10px] text-purple-400/60 mt-0.5">📍 {e.location}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Chat Tab */}
              {tab === 'chat' && (
                <div className="flex flex-col gap-2 h-full">
                  <div className="flex-1 overflow-y-auto divide-y divide-white/5 min-h-[220px]">
                    {chat.length === 0 ? (
                      <Empty text="No chat yet" hint="Say hi in Global Chat" />
                    ) : (
                      chat.slice().reverse().map((c, i) => (
                        <div key={`${c.from}-${c.timestamp}-${i}`} className="px-2 py-2 hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-cyan-400">{c.fromName || shortAddr(c.from)}</span>
                            {(() => {
                              const sender = onlineAgents.find(a => a.address?.toLowerCase() === c.from?.toLowerCase());
                              return sender?.model ? (
                                <span className="text-[10px] text-violet-400/80">🧠 {sender.model}</span>
                              ) : null;
                            })()}
                            {c.toName && (
                              <>
                                <span className="text-[10px] text-gray-600">→</span>
                                <span className="text-xs font-semibold text-purple-400">{c.toName}</span>
                              </>
                            )}
                            <span className="text-[10px] text-gray-700 ml-auto">{timeAgo(c.timestamp)}</span>
                          </div>
                          <div className="text-xs text-gray-300 mt-0.5 leading-snug break-words">{c.message}</div>
                          {c.location && <div className="text-[10px] text-gray-600 mt-0.5">📍 {c.location}</div>}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-2">
                    {!walletAddress ? (
                      <div className="text-xs text-gray-500 px-1">Connect wallet to chat</div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void sendChat();
                            }
                          }}
                          placeholder="Message global chat..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40"
                          maxLength={240}
                        />
                        <button
                          onClick={() => void sendChat()}
                          disabled={sendingChat || !chatInput.trim()}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chain Tab */}
              {/* Trades Tab */}
              {tab === 'trades' && (() => {
                const trades = transactions.filter(t => t.type === 'token_buy' || t.type === 'token_sell');
                return trades.length === 0 ? (
                  <Empty text="No token trades yet" />
                ) : (
                  <div className="space-y-0.5">
                    {trades.slice(0, 30).map((tx, i) => {
                      const agentName = onlineAgents.find(a => a.address?.toLowerCase() === tx.from?.toLowerCase())?.name || shortAddr(tx.from);
                      const isBuy = tx.type === 'token_buy';
                      return (
                        <a key={i} href={tx.explorerUrl} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center justify-between w-full rounded-lg px-2 py-1.5 transition-colors ${
                            isBuy ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/10' : 'bg-red-500/[0.06] hover:bg-red-500/10'
                          }`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>{isBuy ? 'BUY' : 'SELL'}</span>
                            <span className="text-xs text-cyan-400 font-semibold shrink-0">{agentName}</span>
                            <span className="text-[10px] text-gray-400 truncate">{tx.description}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            {tx.amount && <span className={`text-[10px] font-mono font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{tx.amount} MON</span>}
                            <span className="text-[10px] text-gray-700">{timeAgo(tx.timestamp)}</span>
                            <span className="text-[10px] text-purple-400 underline">view ↗</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                );
              })()}

              {tab === 'chain' && (
                transactions.length === 0 ? (
                  <Empty text="No on-chain activity yet" />
                ) : (
                  <div className="space-y-0.5">
                    {transactions.slice(0, 20).map((tx, i) => {
                      const agentName = onlineAgents.find(a => a.address?.toLowerCase() === tx.from?.toLowerCase())?.name || shortAddr(tx.from);
                      const isSettle = tx.type === 'battle_settle';
                      return (
                        <a key={i} href={tx.explorerUrl} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center justify-between w-full rounded-lg px-2 py-1.5 transition-colors ${
                            isSettle ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/10' : 'hover:bg-white/5'
                          }`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs shrink-0">{TX_ICONS[tx.type] || '📝'}</span>
                            <span className="text-xs text-cyan-400 font-semibold shrink-0">{agentName}</span>
                            <span className={`text-[10px] truncate ${isSettle ? 'text-emerald-300' : 'text-gray-400'}`}>{tx.description}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            {tx.amount && <span className={`text-[10px] font-mono ${isSettle ? 'text-emerald-400 font-bold' : 'text-yellow-400'}`}>{tx.amount} MON</span>}
                            <span className="text-[10px] text-gray-700">{timeAgo(tx.timestamp)}</span>
                            <span className="text-[10px] text-purple-400 underline">view ↗</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Activity Log moved to Feed tab in right panel */}

      {/* ─── Branding ─── */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 sm:bottom-3 pointer-events-none">
        <div className="text-[8px] sm:text-[9px] text-gray-700 tracking-wider uppercase">
          On-chain AI Battles • <span className="text-purple-800">Monad</span>
        </div>
      </div>

      {/* ─── Interaction prompt ─── */}
      {nearbyBuilding && (
        <div className="absolute bottom-12 sm:bottom-16 left-1/2 transform -translate-x-1/2 pointer-events-auto">
          <button onClick={onEnterBuilding} className="relative group">
            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-2xl" />
            <div className="relative bg-black/60 backdrop-blur-md rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 flex items-center gap-3 border border-purple-500/30 shadow-xl hover:shadow-purple-500/30 transition-all group-hover:scale-105">
              <kbd className="w-6 h-6 sm:w-7 sm:h-7 bg-purple-600 rounded-lg flex items-center justify-center text-xs font-bold text-white border border-purple-400 shadow">E</kbd>
              <span className="text-white font-semibold text-sm sm:text-base">Enter {nearbyBuilding}</span>
            </div>
          </button>
        </div>
      )}

    </div>
  );
}

function Empty({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="text-xs sm:text-sm text-gray-600 italic py-6 text-center">
      {text}
      {hint && <><br /><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded mt-1 inline-block">{hint}</code></>}
    </div>
  );
}

// Minimap removed
