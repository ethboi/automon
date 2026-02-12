'use client';

import { useEffect, useState } from 'react';
import { Card as CardType } from '@/lib/types';
import CardComponent from './Card';

interface AgentDetails {
  agent: {
    address: string; name: string; personality: string; model?: string | null;
    isAI: boolean; position: { x: number; y: number; z: number };
    health: number; maxHealth: number;
    mood?: number; moodLabel?: string;
    currentAction?: string | null; currentReason?: string | null;
    currentReasoning?: string | null; currentLocation?: string | null;
    lastActionAt?: string | null; lastSeen: string; createdAt?: string;
  };
  stats: {
    balance: string; tokenBalance: string; cards: number; battles: number;
    wins: number; losses: number; winRate: number; healthPercent: number;
    moodPercent?: number;
  };
  cards: CardType[];
  actions: Array<{ action: string; reason: string; reasoning?: string; timestamp: string; location?: string; healthDelta?: number }>;
  transactions?: Array<{ txHash: string; type: string; description: string; amount?: string | null; timestamp: string }>;
}
const PUBLIC_NETWORK = (process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase();
const PUBLIC_EXPLORER_BASE = (
  (PUBLIC_NETWORK === 'mainnet'
    ? process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL_MAINNET
    : process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL_TESTNET) ||
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
  'https://testnet.monadexplorer.com'
).replace(/\/+$/, '');

const ICONS: Record<string, string> = {
  battle: '⚔️', fish: '🎣', train: '🥊', trading_token: '📈', trade: '🛒', shop: '🛒',
  rest: '🛌', heal: '🛌', farm: '🌾', walk: '🚶', move: '🚶', explor: '🚶', mint: '🎴',
};
const TX_ICONS: Record<string, string> = {
  escrow_deposit: '🔒', battle_join: '⚔️', battle_settle: '🏆', mint_pack: '🎴', settlement: '💸',
  token_buy: '📈', token_sell: '📉',
};

function icon(a?: string | null) {
  const v = (a || '').toLowerCase();
  for (const [k, i] of Object.entries(ICONS)) if (v.includes(k)) return i;
  return v ? '🤖' : '💤';
}

function ago(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AgentProfileModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [d, setD] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'log' | 'cards' | 'txs'>('log');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${address}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data) setD(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [address]);

  const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const explorerAddressUrl = `${PUBLIC_EXPLORER_BASE}/address/${address}`;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const hp = d ? d.stats.healthPercent : 0;
  const mood = d?.agent.mood ?? d?.stats.moodPercent ?? 60;
  const moodLabel = d?.agent.moodLabel || 'steady';
  const hpColor = hp > 60 ? 'bg-emerald-500' : hp > 30 ? 'bg-yellow-500' : 'bg-red-500';

  // Shared sub-components
  const LogTab = () => !d?.actions.length ? (
    <div className="text-center py-10 text-gray-600 text-sm">No activity yet</div>
  ) : (
    <div className="divide-y divide-white/[0.04]">
      {d.actions.map((a, i) => (
        <div key={i} className="px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm">{icon(a.action)}</span>
              <span className="text-sm text-white font-medium capitalize">{a.action}</span>
              {a.healthDelta != null && a.healthDelta !== 0 && (
                <span className={`text-xs font-mono ${a.healthDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {a.healthDelta > 0 ? '+' : ''}{a.healthDelta} HP
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {a.location && <span className="text-xs text-purple-400">📍 {a.location}</span>}
              <span className="text-xs text-gray-600">{ago(a.timestamp)}</span>
            </div>
          </div>
          {(a.reasoning || a.reason) && (
            <p className="text-xs text-gray-400 mt-1 italic leading-relaxed line-clamp-2">💭 {a.reasoning || a.reason}</p>
          )}
        </div>
      ))}
    </div>
  );

  const CardsTab = () => !d?.cards.length ? (
    <div className="text-center py-10 text-gray-600 text-sm">No cards yet</div>
  ) : (
    <div className="flex flex-wrap gap-2.5 p-4 items-start content-start">
      {d.cards.map(card => (
        <div key={card.id || card._id?.toString()} className="w-32 shrink-0">
          <CardComponent card={card} size="sm" showStats={false} />
        </div>
      ))}
    </div>
  );

  const TxsTab = () => !d?.transactions?.length ? (
    <div className="text-center py-10 text-gray-600 text-sm">No transactions yet</div>
  ) : (
    <div className="divide-y divide-white/[0.04]">
      {d.transactions.map((tx, i) => (
        <a key={i} href={`${PUBLIC_EXPLORER_BASE}/tx/${tx.txHash}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors group">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm">{TX_ICONS[tx.type] || '📝'}</span>
            <span className="text-sm text-gray-300 truncate group-hover:text-white transition-colors">{tx.description}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {tx.amount && <span className="text-xs font-mono text-emerald-400 font-semibold">{tx.amount}</span>}
            <span className="text-xs text-gray-600">{ago(tx.timestamp)}</span>
            <span className="text-xs text-purple-400 group-hover:text-purple-300 underline">view ↗</span>
          </div>
        </a>
      ))}
    </div>
  );

  const Header = () => d && (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/25 shrink-0">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white truncate">{d.agent.name}</h2>
            {d.agent.model && (
              <span className="text-xs text-violet-400 bg-violet-500/15 px-2.5 py-0.5 rounded-full">🧠 {d.agent.model}</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyAddress}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/[0.06]"
              title={`Copy ${address}`}
            >
              <span className="font-mono">{shortAddress}</span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href={explorerAddressUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/15"
            >
              View on Monad Scan ↗
            </a>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-yellow-400">{parseFloat(d.stats.balance).toFixed(3)}</div>
          <div className="text-xs text-gray-500">MON</div>
          <div className="text-sm font-semibold text-emerald-400 mt-0.5">{parseFloat(d.stats.tokenBalance || '0').toFixed(0)}</div>
          <div className="text-[10px] text-gray-600">$AUTOMON</div>
        </div>
      </div>

      {/* HP bar */}
      <div className="flex items-center gap-3 mt-3">
        <span className="text-xs text-gray-500 font-medium w-6">HP</span>
        <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} transition-all rounded-full`} style={{ width: `${hp}%` }} />
        </div>
        <span className="text-sm text-gray-400 font-mono">{d.agent.health}/{d.agent.maxHealth}</span>
      </div>

      {/* Current status */}
      <div className="mt-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base">{icon(d.agent.currentAction)}</span>
          <span className="text-cyan-300 font-semibold capitalize">{d.agent.currentAction || 'idle'}</span>
          {d.agent.currentLocation && <span className="text-gray-500">@ {d.agent.currentLocation}</span>}
        </div>
        {(d.agent.currentReasoning || d.agent.currentReason) && (
          <p className="text-sm text-gray-400 mt-1.5 italic leading-relaxed line-clamp-2">💭 {d.agent.currentReasoning || d.agent.currentReason}</p>
        )}
      </div>
    </div>
  );

  const Stats = () => d && (
    <div className="grid grid-cols-4 border-y border-white/5">
      {[
        { v: d.stats.cards, l: 'Cards', c: 'text-purple-400' },
        { v: d.stats.battles, l: 'Battles', c: 'text-gray-300' },
        { v: `${d.stats.wins}/${d.stats.losses}`, l: 'W/L', c: 'text-emerald-400' },
        { v: `${d.stats.winRate}%`, l: 'Win Rate', c: 'text-cyan-400' },
      ].map((s, i) => (
        <div key={i} className="py-2.5 text-center border-r border-white/5 last:border-r-0">
          <div className={`text-lg font-bold ${s.c}`}>{s.v}</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider">{s.l}</div>
        </div>
      ))}
    </div>
  );

  const Tabs = ({ size = 'sm' }: { size?: 'sm' | 'lg' }) => (
    <div className="flex border-b border-white/5 shrink-0">
      {([
        { id: 'log' as const, l: '📝 Activity' },
        { id: 'cards' as const, l: `🎴 Cards (${d?.cards.length || 0})` },
        { id: 'txs' as const, l: `⛓️ Txns (${d?.transactions?.length || 0})` },
      ]).map(t => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`flex-1 ${size === 'lg' ? 'py-3 text-sm' : 'py-2 text-xs'} font-semibold transition-colors ${
            tab === t.id ? 'text-white border-b-2 border-purple-500 bg-white/[0.03]' : 'text-gray-500 hover:text-gray-300'
          }`}>
          {t.l}
        </button>
      ))}
    </div>
  );

  const Content = () => (
    <div className="overflow-y-auto flex-1 min-h-0">
      {tab === 'log' && <LogTab />}
      {tab === 'cards' && <CardsTab />}
      {tab === 'txs' && <TxsTab />}
    </div>
  );

  const Personality = () => d?.agent.personality ? (
    <div className="border-t border-white/5 px-4 py-2 shrink-0">
      <p className="text-xs text-gray-500 italic text-center">&ldquo;{d.agent.personality}&rdquo;</p>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* ── Mobile: bottom sheet ── */}
      <div
        className="lg:hidden absolute bottom-0 left-0 right-0 top-16
          bg-gray-950 border-t border-white/10 rounded-t-2xl overflow-hidden flex flex-col"
        style={{ zIndex: 61 }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="spinner mb-3" />
            <div className="text-sm">Loading agent profile…</div>
          </div>
        ) : !d ? (
          <div className="text-center py-12 text-gray-500">Failed to load</div>
        ) : (
          <>
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            <Header />
            <Stats />
            <Tabs />
            <Content />
            <Personality />
          </>
        )}
      </div>

      {/* ── Desktop: centered two-column card ── */}
      <div
        className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[780px] max-h-[85vh] bg-gray-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
        style={{ zIndex: 61 }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center w-full py-20 text-gray-400">
            <div className="spinner mb-3" />
            <div className="text-sm">Loading agent profile…</div>
          </div>
        ) : !d ? (
          <div className="text-center w-full py-12 text-gray-500">Failed to load</div>
        ) : (
          <>
            {/* Left column — profile info */}
            <div className="w-[300px] shrink-0 border-r border-white/5 flex flex-col overflow-hidden">
              <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center z-10">
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Agent identity */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/25 shrink-0">
                    🤖
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{d.agent.name}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={copyAddress}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/[0.06]"
                        title={`Copy ${address}`}
                      >
                        <span className="font-mono">{shortAddress}</span>
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a
                        href={explorerAddressUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/15"
                      >
                        View on Monad Scan ↗
                      </a>
                    </div>
                  </div>
                </div>

                {d.agent.model && (
                  <span className="inline-block text-xs text-violet-400 bg-violet-500/15 px-2.5 py-1 rounded-full mb-3">🧠 {d.agent.model}</span>
                )}

                {/* Balance */}
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 mb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Balance</div>
                  <div className="text-2xl font-bold text-yellow-400">{parseFloat(d.stats.balance).toFixed(3)} <span className="text-sm text-gray-500">MON</span></div>
                  <div className="text-sm font-semibold text-emerald-400 mt-1">
                    📈 {parseFloat(d.stats.tokenBalance || '0').toFixed(0)} <span className="text-xs text-gray-500">$AUTOMON</span>
                  </div>
                </div>

                {/* HP */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Health</span>
                    <span className="font-mono">{d.agent.health}/{d.agent.maxHealth}</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${hpColor} transition-all rounded-full`} style={{ width: `${hp}%` }} />
                  </div>
                </div>

                {/* Mood */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Mood</span>
                    <span className="font-mono">{Math.round(mood)} <span className="capitalize text-pink-300">{moodLabel}</span></span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-400 transition-all rounded-full" style={{ width: `${Math.max(0, Math.min(100, mood))}%` }} />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { v: d.stats.cards, l: 'Cards', c: 'text-purple-400' },
                    { v: d.stats.battles, l: 'Battles', c: 'text-gray-300' },
                    { v: `${d.stats.wins}/${d.stats.losses}`, l: 'W/L', c: 'text-emerald-400' },
                    { v: `${d.stats.winRate}%`, l: 'Win Rate', c: 'text-cyan-400' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-lg px-3 py-2 text-center">
                      <div className={`text-lg font-bold ${s.c}`}>{s.v}</div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider">{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Current status */}
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Current Activity</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">{icon(d.agent.currentAction)}</span>
                    <span className="text-cyan-300 font-semibold capitalize">{d.agent.currentAction || 'idle'}</span>
                    {d.agent.currentLocation && <span className="text-gray-500 text-xs">@ {d.agent.currentLocation}</span>}
                  </div>
                  {(d.agent.currentReasoning || d.agent.currentReason) && (
                    <p className="text-xs text-gray-400 mt-1.5 italic leading-relaxed line-clamp-3">💭 {d.agent.currentReasoning || d.agent.currentReason}</p>
                  )}
                </div>
              </div>

              {/* Personality at bottom */}
              {d.agent.personality && (
                <div className="mt-auto border-t border-white/5 px-5 py-3">
                  <p className="text-xs text-gray-500 italic">&ldquo;{d.agent.personality}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Right column — tabs + content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <Tabs size="lg" />
              <Content />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
