'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';

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
  location: string | null;
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
  totalBattles = 0, totalCards = 0,
}: WorldUIProps) {
  const { address, isAuthenticated, isConnecting, connect, disconnect } = useWallet();
  const [tab, setTab] = useState<Tab>('feed');
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

      {/* ─── Top Bar ─── */}
      <div className="absolute top-0 left-0 right-0 pointer-events-auto">
        <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-3"
          style={{ background: 'linear-gradient(180deg, rgba(8,12,24,0.9) 0%, rgba(8,12,24,0) 100%)' }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg viewBox="0 0 32 32" className="w-5 h-5 sm:w-6 sm:h-6" fill="none">
                <circle cx="16" cy="16" r="12" fill="#a855f7" />
                <circle cx="11" cy="14" r="3" fill="white" />
                <circle cx="21" cy="14" r="3" fill="white" />
                <circle cx="12" cy="14" r="1.5" fill="#1f2937" />
                <circle cx="22" cy="14" r="1.5" fill="#1f2937" />
                <path d="M10 20 Q16 25 22 20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="font-[var(--font-orbitron)] text-sm sm:text-lg font-black tracking-wide">
                <span className="text-white">AUTO</span><span className="text-purple-400">MON</span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 -mt-0.5 hidden sm:block">Autonomous AI Battles</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAuthenticated ? (
              <button
                onClick={() => disconnect()}
                className="flex items-center gap-1 bg-emerald-500/15 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-emerald-500/40 hover:bg-emerald-500/20 transition-colors"
                title={address || undefined}
              >
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-300">
                  {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connected'}
                </span>
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await connect();
                  } catch (error) {
                    console.error('Wallet connect failed:', error);
                  }
                }}
                disabled={isConnecting}
                className="flex items-center gap-1 bg-purple-500/20 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-purple-500/40 hover:bg-purple-500/30 disabled:opacity-60 transition-colors"
              >
                <span className="text-[10px] sm:text-xs font-semibold text-purple-200">
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </span>
              </button>
            )}
            <div className="flex items-center gap-1 sm:gap-1.5 bg-white/5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-white/5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] sm:text-xs font-semibold text-green-400">{onlineCount}</span>
              <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">online</span>
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-white/5">
              <span className="text-[10px] sm:text-xs">⚔️</span>
              <span className="text-[10px] sm:text-xs font-semibold text-purple-400">{totalBattles}</span>
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-white/5">
              <span className="text-[10px] sm:text-xs">🃏</span>
              <span className="text-[10px] sm:text-xs font-semibold text-amber-400">{totalCards}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Controls (desktop) ─── */}
      <div className="absolute top-16 right-4 pointer-events-auto hidden lg:block">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/5 text-[10px] text-gray-500">
          {['W','A','S','D'].map(k => (
            <kbd key={k} className="w-4 h-4 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold text-gray-400 border border-white/10">{k}</kbd>
          ))}
          <span>Move</span>
          <span className="mx-1 text-gray-700">|</span>
          <span>🖱️ Click</span>
        </div>
      </div>

      {/* ─── Unified Panel (bottom right) ─── */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 pointer-events-auto" style={{ zIndex: 50 }}>
        {!panelOpen ? (
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2.5 border border-white/10 hover:border-purple-500/30 transition-all shadow-xl hover:shadow-purple-500/10 active:scale-95"
          >
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] sm:text-xs font-medium text-gray-300">{onlineCount}</span>
            <span className="text-gray-700">·</span>
            <span className="text-[10px] sm:text-xs text-gray-500">📡</span>
            <span className="text-gray-700">·</span>
            <span className="text-[10px] sm:text-xs text-gray-500">⛓️</span>
          </button>
        ) : (
          <div className="w-[calc(100vw-24px)] sm:w-[340px] max-h-[60vh] sm:max-h-[70vh] bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in flex flex-col">
            {/* Tabs */}
            <div className="flex items-center border-b border-white/5 flex-shrink-0">
              {([
                { id: 'agents' as Tab, label: '🤖', count: onlineCount },
                { id: 'feed' as Tab, label: '📡', count: events.length },
                { id: 'chain' as Tab, label: '⛓️', count: transactions.length },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 text-[10px] sm:text-xs font-semibold transition-colors ${
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
              {tab === 'agents' && (
                onlineAgents.length === 0 ? (
                  <Empty text="No agents online" hint="npm run agent:demo" />
                ) : (
                  <div className="space-y-0.5 sm:space-y-1">
                    {onlineAgents
                      .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
                      .map(agent => {
                      const activity = activityBadge(agent.currentAction);
                      return (
                      <button
                        key={agent.address}
                        onClick={() => onSelectAgent?.(agent.address)}
                        className="flex items-center justify-between w-full hover:bg-white/5 rounded-lg px-1.5 py-1.5 sm:px-2 sm:py-2 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agent.online ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-gray-700'}`} />
                          <span className="text-xs sm:text-sm text-cyan-400 font-medium">{agent.name}</span>
                          <span className="text-[9px] text-gray-600">{agent.personality}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activity.cls}`}>
                            {activity.icon} {activity.label}
                          </span>
                          {agent.stats && (
                            <span className="text-[9px] text-gray-600">{agent.stats.wins}W/{agent.stats.losses}L</span>
                          )}
                          <span className="text-[9px] text-gray-700">{shortAddr(agent.address)}</span>
                        </div>
                      </button>
                    )})}
                  </div>
                )
              )}

              {/* Feed Tab */}
              {tab === 'feed' && (
                events.length === 0 ? (
                  <Empty text="Waiting for activity…" />
                ) : (
                  <div className="space-y-0.5">
                    {events.slice(0, 25).map((e, i) => {
                      const agentName = onlineAgents.find(a => a.address?.toLowerCase() === e.agent?.toLowerCase())?.name || shortAddr(e.agent);
                      return (
                        <div key={i} className="text-[10px] sm:text-xs leading-snug sm:leading-relaxed py-0.5">
                          <span className="text-gray-700 mr-1">{timeAgo(e.timestamp)}</span>
                          <span className="text-cyan-500 font-medium">{agentName}</span>
                          <span className="text-gray-500"> {e.action}</span>
                          {e.location && <span className="text-gray-700"> @ {e.location}</span>}
                          {e.reason && (
                            <div className="text-gray-600 italic pl-2 sm:pl-3 truncate" title={e.reason}>💭 {e.reason}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

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

      {/* ─── Minimap (desktop) ─── */}
      <div className="absolute bottom-4 left-4 pointer-events-auto hidden md:block">
        <div className="bg-black/50 backdrop-blur-sm rounded-xl p-2 border border-white/5">
          <div className="relative w-28 h-28 rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-green-900/40" />
            <div className="absolute inset-0 opacity-15" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '14px 14px'
            }} />
            {Object.entries(WORLD_LOCATIONS).map(([key, loc]) => {
              const mx = 50 + (loc.position[0] / 30) * 40;
              const mz = 50 + (loc.position[2] / 30) * 40;
              return (
                <div key={key} className="absolute w-2 h-2 rounded-full" style={{
                  left: `${mx}%`, top: `${mz}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: loc.color,
                  boxShadow: `0 0 4px ${loc.color}60`,
                }} title={loc.label} />
              );
            })}
            <div className="absolute w-2.5 h-2.5 rounded-full" style={{ left: '50%', top: '60%', transform: 'translate(-50%, -50%)' }}>
              <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-60" />
              <div className="relative w-full h-full bg-purple-400 rounded-full border border-white/50" />
            </div>
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

const WORLD_LOCATIONS = {
  starter_town:   { position: [0, 0, 0],      color: '#f59e0b', label: 'Starter Town' },
  town_arena:     { position: [0, 0, -20],     color: '#ef4444', label: 'Town Arena' },
  town_market:    { position: [18, 0, 0],      color: '#f97316', label: 'Town Market' },
  community_farm: { position: [-18, 0, 0],     color: '#84cc16', label: 'Community Farm' },
  green_meadows:  { position: [-14, 0, -18],   color: '#22c55e', label: 'Green Meadows' },
  old_pond:       { position: [-22, 0, -18],   color: '#3b82f6', label: 'Old Pond' },
  dark_forest:    { position: [-24, 0, 14],    color: '#7c3aed', label: 'Dark Forest' },
  river_delta:    { position: [22, 0, -16],    color: '#06b6d4', label: 'River Delta' },
  crystal_caves:  { position: [20, 0, 16],     color: '#a78bfa', label: 'Crystal Caves' },
};
