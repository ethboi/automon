'use client';

import { useEffect, useState } from 'react';

interface WorldUIProps {
  nearbyBuilding: string | null;
  onEnterBuilding?: () => void;
  onSelectAgent?: (address: string) => void;
  onlineAgents?: OnlineAgent[];
  events?: EventData[];
  transactions?: TxData[];
  totalBattles?: number;
  totalCards?: number;
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
  stats?: { wins: number; losses: number; cards: number };
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

interface TxData {
  txHash: string;
  type: string;
  from: string;
  description: string;
  explorerUrl: string;
  timestamp: string;
}

type Tab = 'agents' | 'feed' | 'chain';

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

function shortHash(hash: string) {
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
};

export function WorldUI({
  nearbyBuilding, onEnterBuilding, onSelectAgent,
  onlineAgents = [], events = [], transactions = [],
  totalBattles: _totalBattles = 0, totalCards: _totalCards = 0,
}: WorldUIProps) {
  const [tab, setTab] = useState<Tab>('agents');
  const [panelOpen, setPanelOpen] = useState(false);

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
            <span className="text-sm font-medium text-gray-300">{onlineCount} online</span>
            <span className="text-gray-600">|</span>
            <span className="text-sm text-gray-400">⛓️ Chain</span>
          </button>
        ) : (
          <div className="w-[calc(100vw-24px)] sm:w-[420px] max-h-[70vh] sm:max-h-[75vh] bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in flex flex-col">
            {/* Tabs */}
            <div className="flex items-center border-b border-white/5 flex-shrink-0">
              {([
                { id: 'agents' as Tab, label: '🤖', count: onlineCount },
                { id: 'chain' as Tab, label: '⛓️', count: transactions.length },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs sm:text-sm font-semibold transition-colors ${
                    tab === t.id ? 'text-white bg-white/5 border-b-2 border-purple-500' : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      tab === t.id ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'
                    }`}>{t.count}</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setPanelOpen(false)}
                className="px-3 py-2.5 text-gray-600 hover:text-gray-400 transition-colors text-xs"
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
                  <div className="space-y-0.5 sm:space-y-1">
                    {online.map(agent => {
                      const activity = activityBadge(agent.currentAction);
                      const shortPersonality = (agent.personality || '').split(/[\s,]/)[0] || 'AI';
                      return (
                      <button
                        key={agent.address}
                        onClick={() => onSelectAgent?.(agent.address)}
                        className="flex items-center justify-between w-full hover:bg-white/5 rounded-lg px-2 py-2.5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500 shadow-sm shadow-green-500/50" />
                          <span className="text-sm text-cyan-400 font-semibold">{agent.name}</span>
                          <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{shortPersonality}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${activity.cls}`}>
                            {activity.icon} {activity.label}
                          </span>
                          {agent.stats && (
                            <span className="text-xs text-gray-600">{agent.stats.wins}W/{agent.stats.losses}L</span>
                          )}
                        </div>
                      </button>
                    )})}
                  </div>
                );
              })()}

              {/* Chain Tab */}
              {tab === 'chain' && (
                transactions.length === 0 ? (
                  <Empty text="No on-chain activity yet" />
                ) : (
                  <div className="space-y-1">
                    {transactions.slice(0, 20).map((tx, i) => {
                      const agentName = onlineAgents.find(a => a.address?.toLowerCase() === tx.from?.toLowerCase())?.name || shortAddr(tx.from);
                      return (
                        <div key={i} className="bg-white/[0.02] rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2 hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 sm:gap-1.5">
                              <span className="text-xs">{TX_ICONS[tx.type] || '📝'}</span>
                              <span className="text-[10px] sm:text-xs text-gray-300">{tx.description}</span>
                            </div>
                            <span className="text-[9px] text-gray-700">{timeAgo(tx.timestamp)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 sm:mt-1">
                            <span className="text-[9px] text-cyan-600">{agentName}</span>
                            <a
                              href={tx.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] text-purple-500 hover:text-purple-400 font-mono transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              {shortHash(tx.txHash)} ↗
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── AI Activity Log (bottom left, always open) ─── */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 pointer-events-auto" style={{ zIndex: 50 }}>
        <div className="bg-black/75 backdrop-blur-md rounded-xl border border-purple-500/20 shadow-xl overflow-hidden"
          style={{ width: 'min(380px, calc(100vw - 24px))', maxWidth: '380px' }}>
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">🧠 AI Agent Log</span>
            <span className="text-[10px] text-gray-500 ml-auto">{onlineCount} active</span>
          </div>
          {/* Events */}
          <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
            {events.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-600 italic">Waiting for agent actions...</div>
            ) : (
              <div className="divide-y divide-white/5">
                {events.slice(0, 15).map((e, i) => {
                  const agentName = onlineAgents.find(a => a.address?.toLowerCase() === e.agent?.toLowerCase())?.name || shortAddr(e.agent);
                  const badge = activityBadge(e.action);
                  return (
                    <div key={i} className="px-3 py-2 hover:bg-white/5 transition-colors">
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
                            <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">{timeAgo(e.timestamp)}</span>
                          </div>
                          {(e.reasoning || e.reason) && (
                            <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">
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
            )}
          </div>
        </div>
      </div>

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
    <div className="text-[10px] sm:text-xs text-gray-600 italic py-6 text-center">
      {text}
      {hint && <><br /><code className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded mt-1 inline-block">{hint}</code></>}
    </div>
  );
}

// Minimap removed
