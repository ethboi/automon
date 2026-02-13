'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Battle, Card as CardType, BattleMove, BattleLog } from '@/lib/types';
import Card from '@/components/Card';
import BattleArena from '@/components/BattleArena';
import BattleReplay from '@/components/BattleReplay';
import { AUTOMONS } from '@/lib/automons';
import { getCardArtDataUri } from '@/lib/cardArt';

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ef4444', water: '#3b82f6', earth: '#84cc16', air: '#a78bfa', crystal: '#06b6d4',
  dark: '#8b5cf6', light: '#fbbf24',
};
const RARITY_BADGE_CLASSES: Record<string, string> = {
  legendary: 'bg-amber-500/20 text-amber-300 border border-amber-400/40',
  epic: 'bg-purple-500/20 text-purple-300 border border-purple-400/40',
  rare: 'bg-blue-500/20 text-blue-300 border border-blue-400/40',
  uncommon: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40',
  common: 'bg-gray-500/20 text-gray-300 border border-gray-400/40',
};
const ELEMENT_ICONS: Record<string, string> = {
  fire: '🔥',
  water: '💧',
  earth: '🪨',
  air: '🌪️',
  dark: '🌙',
  light: '✨',
  crystal: '💎',
};
const _ACTION_ICONS: Record<string, string> = {
  strike: '⚔️', skill: '✨', guard: '🛡️', switch: '🔄',
};

function cardImage(name: string, rarity = 'common'): string {
  const mon = AUTOMONS.find(a => a.name === name);
  return getCardArtDataUri(mon?.id ?? 1, mon?.element || 'fire', rarity);
}

function shortAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function playerName(p: any): string {
  return p?.name || shortAddr(p?.address || '');
}

function timeAgo(d: string | Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDuration(start: string | Date, end?: string | Date | null): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return '0s';
  const total = Math.floor((endMs - startMs) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function labelRarity(rarity?: string): string {
  const safe = (rarity || 'common').toLowerCase();
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

function rarityBadgeClass(rarity?: string): string {
  return RARITY_BADGE_CLASSES[(rarity || 'common').toLowerCase()] || RARITY_BADGE_CLASSES.common;
}

function elementLabel(element?: string): string {
  const safe = (element || 'unknown').toLowerCase();
  return safe.charAt(0).toUpperCase() + safe.slice(1, 3);
}

function TeamCardChip({ card }: { card: { name?: string; element?: string; rarity?: string } }) {
  const name = card?.name || 'Unknown';
  const element = (card?.element || '').toLowerCase();
  const rarity = (card?.rarity || 'common').toLowerCase();

  return (
    <div className="w-16 sm:w-20 shrink-0">
      <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-lg overflow-hidden border-2 shadow-md"
        style={{ borderColor: ELEMENT_COLORS[element] || '#4b5563' }}>
        <img src={cardImage(name, rarity)} alt={name} title={`${name} • ${labelRarity(rarity)} • ${element || 'unknown'}`}
          className="w-full h-full object-cover" />
      </div>
      <div className="mt-1 text-[10px] sm:text-xs text-gray-200 text-center truncate" title={name}>{name}</div>
      <div className="mt-1 flex items-center justify-center gap-1">
        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[9px] sm:text-[10px] bg-black/30 border border-white/10 text-gray-200">
          <span aria-hidden>{ELEMENT_ICONS[element] || '◉'}</span>
          <span>{elementLabel(element)}</span>
        </span>
        <span className={`px-1 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold ${rarityBadgeClass(rarity)}`}>
          {labelRarity(rarity)}
        </span>
      </div>
    </div>
  );
}

type View = 'list' | 'create' | 'select-cards' | 'battle' | 'replay' | 'simulating';

export default function BattlePage() {
  const { address, refreshBalance } = useWallet();
  const [view, setView] = useState<View>('list');
  const [battles, setBattles] = useState<Battle[]>([]);
  const [myCards, setMyCards] = useState<CardType[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [currentBattle, setCurrentBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wagerAmount, setWagerAmount] = useState('0.01');
  const [battleLog, setBattleLog] = useState<BattleLog | null>(null);

  useEffect(() => { fetchData(); }, [address]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentBattle && view === 'simulating') {
      const iv = setInterval(async () => {
        const res = await fetch(`/api/battle/${currentBattle.battleId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.battle) {
          setCurrentBattle(data.battle);
          if (data.battle.status === 'complete') {
            // Auto-show replay
            await watchReplay(data.battle.battleId);
          }
        }
      }, 3000);
      return () => clearInterval(iv);
    }
  }, [currentBattle?.battleId, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const battlesRes = await fetch('/api/battle/list?type=all');
      const battlesData = await battlesRes.json();
      setBattles(battlesData.battles || []);
      if (address) {
        const cardsRes = await fetch(`/api/cards?address=${address}`);
        const cardsData = await cardsRes.json();
        setMyCards(cardsData.cards || []);
      }
    } catch (e) { console.error('Failed to fetch:', e); }
    finally { setLoading(false); }
  };

  const _refreshBattle = async () => {
    if (!currentBattle) return;
    try {
      const res = await fetch(`/api/battle/${currentBattle.battleId}`);
      const data = await res.json();
      if (data.battle) setCurrentBattle(data.battle);
    } catch (e) { console.error('Refresh failed:', e); }
  };

  const createBattle = async () => {
    setError(null);
    try {
      const res = await fetch('/api/battle/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wager: wagerAmount, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create battle');
      setCurrentBattle(data.battle);
      setView('select-cards');
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  };

  const joinBattle = async (battleId: string) => {
    setError(null);
    try {
      const res = await fetch('/api/battle/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setCurrentBattle(data.battle);
      setView('select-cards');
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  };

  const selectCards = async () => {
    if (selectedCards.length !== 3) { setError('Select exactly 3 cards'); return; }
    setError(null);
    try {
      const res = await fetch('/api/battle/select-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId: currentBattle?.battleId, cardIds: selectedCards, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to select');
      setCurrentBattle(data.battle);
      if (data.simulationComplete && data.battleLog) { setBattleLog(data.battleLog); setView('replay'); }
      else { setView('simulating'); /* Poll until complete */ }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  };

  const watchReplay = async (battleId: string) => {
    try {
      const res = await fetch(`/api/battle/simulate?battleId=${battleId}`);
      if (!res.ok) throw new Error('Failed to fetch battle log');
      const data = await res.json();
      if (data.battleLog) {
        // Inject agent names from battles list
        const battle = battles.find(b => b.battleId === battleId);
        if (battle) {
          const p1n = playerName(battle.player1);
          const p2n = playerName(battle.player2);
          if (p1n && !data.battleLog.player1.name) data.battleLog.player1.name = p1n;
          if (p2n && !data.battleLog.player2.name) data.battleLog.player2.name = p2n;
        }
        setBattleLog(data.battleLog);
        setView('replay');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load replay'); }
  };

  const resumeBattleSimulation = async (battleId: string) => {
    setError(null);
    try {
      const res = await fetch('/api/battle/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, action: 'start_simulation' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resume battle simulation');
      await fetchData();
      if (data?.battleLog) {
        setBattleLog(data.battleLog as BattleLog);
        setView('replay');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resume battle simulation');
    }
  };

  const submitMove = async (move: BattleMove) => {
    if (!currentBattle) return;
    const res = await fetch('/api/battle/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId: currentBattle.battleId, move, address }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit move');
    setCurrentBattle(data.battle);
    if (data.battle.status === 'complete') refreshBalance();
  };

  const getAIDecision = async (): Promise<BattleMove> => {
    const res = await fetch('/api/agent/decide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId: currentBattle?.battleId, address }),
    });
    return (await res.json()).decision;
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : prev.length >= 3 ? prev : [...prev, cardId]);
  };

  const openBattles = battles.filter(b => b.status === 'pending' && b.player1.address.toLowerCase() !== address?.toLowerCase());
  const myBattles = battles.filter(b => b.player1.address.toLowerCase() === address?.toLowerCase() || b.player2?.address.toLowerCase() === address?.toLowerCase());
  const activeBattles = battles.filter(b => b.status === 'active');
  const recentBattles = battles.filter(b => b.status === 'complete');

  const openBattleView = async (battleId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/battle/${battleId}`);
      const data = await res.json();
      if (!res.ok || !data?.battle) throw new Error(data?.error || 'Failed to load active battle');
      const battle = data.battle as Battle;
      const addr = address?.toLowerCase();
      const isParticipant = !!addr && (
        battle.player1?.address?.toLowerCase() === addr ||
        battle.player2?.address?.toLowerCase() === addr
      );

      // Spectator auto-recovery: if an active battle is still at turn 0 with no rounds,
      // trigger server-side AI simulation so Watch Live lands in full replay view.
      const looksStuckAtStart = (
        battle.status === 'active' &&
        battle.currentTurn === 0 &&
        (!battle.rounds || battle.rounds.length === 0) &&
        !!battle.player1?.ready &&
        !!battle.player2?.ready
      );

      if (!isParticipant && looksStuckAtStart) {
        const resumeRes = await fetch('/api/battle/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ battleId, action: 'start_simulation' }),
        });
        const resumeData = await resumeRes.json();
        if (resumeRes.ok && resumeData?.battleLog) {
          setBattleLog(resumeData.battleLog as BattleLog);
          setView('replay');
          await fetchData();
          return;
        }
      }

      // If already complete, open replay
      if (battle.status === 'complete') {
        await watchReplay(battleId);
        return;
      }

      setCurrentBattle(battle);
      // Auto-simulated battles go to simulating view (polls until complete)
      setView('simulating');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open live battle');
    }
  };

  if (loading) return (
    <div className="page-container flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="spinner mb-4" />
        <p className="text-gray-500 text-sm">Loading battles…</p>
      </div>
    </div>
  );

  if (view === 'simulating' && currentBattle) return (
    <div className="page-container page-transition">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-cyan-600 animate-pulse flex items-center justify-center">
            <span className="text-4xl">⚔️</span>
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-purple-400/30 animate-spin" style={{ borderTopColor: 'rgb(168 85 247)' }} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Battle in Progress</h2>
        <p className="text-gray-400 mb-6 text-center max-w-md">
          {currentBattle.status === 'complete'
            ? 'Battle complete! Loading replay...'
            : currentBattle.status === 'active'
            ? 'Both teams ready! AI agents are battling it out...'
            : currentBattle.status === 'selecting'
            ? 'Opponent joined! Waiting for them to pick cards...'
            : 'Waiting for an AI agent to accept your challenge...'}
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          <span>Polling for results...</span>
        </div>
        <button onClick={() => { setCurrentBattle(null); setView('list'); fetchData(); }}
          className="mt-8 text-gray-500 hover:text-white text-sm transition">
          ← Back to battles
        </button>
      </div>
    </div>
  );

  if (view === 'replay' && battleLog) return (
    <BattleReplay battleLog={battleLog} onClose={() => { setBattleLog(null); setView('list'); fetchData(); }} />
  );

  if (view === 'battle' && currentBattle) return (
    <div className="page-container page-transition">
      <button onClick={() => { setCurrentBattle(null); setView('list'); fetchData(); }}
        className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition group">
        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>Back to battles
      </button>
      <BattleArena battle={currentBattle} onMove={submitMove} onAIDecide={getAIDecision} />
    </div>
  );

  if (view === 'select-cards') return (
    <div className="page-container page-transition">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Select Your Team</h1>
        <p className="text-sm text-gray-400 mt-1">Choose 3 cards for battle</p>
      </div>
      {error && <ErrorBanner msg={error} />}
      <div className="section-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Your Team</h3>
          <span className={`text-sm font-medium ${selectedCards.length === 3 ? 'text-emerald-400' : 'text-gray-400'}`}>{selectedCards.length}/3</span>
        </div>
        <div className="flex gap-2 min-h-[60px] items-center">
          {[0, 1, 2].map(slot => {
            const cid = selectedCards[slot];
            const card = cid ? myCards.find(c => (c._id?.toString() || c.id) === cid) : null;
            return (
              <div key={slot} className={`w-16 h-20 rounded-xl border-2 border-dashed flex items-center justify-center transition ${card ? 'border-purple-500 bg-purple-500/20' : 'border-gray-600 bg-white/5'}`}>
                {card ? <img src={cardImage(card.name)} alt={card.name} className="w-12 h-16 rounded object-cover" /> : <span className="text-gray-500 text-2xl">+</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-8">
        {[...myCards].sort((a, b) => {
          const order: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
          return (order[a.rarity || 'common'] ?? 5) - (order[b.rarity || 'common'] ?? 5);
        }).map((card, i) => (
          <div key={card._id?.toString() || card.id} className="animate-fade-in-up opacity-0" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}>
            <Card card={card} selected={selectedCards.includes(card._id?.toString() || card.id || '')} onClick={() => toggleCardSelection(card._id?.toString() || card.id || '')} size="md" />
          </div>
        ))}
      </div>
      <div className="section-card flex items-center justify-between sticky bottom-4">
        <button onClick={() => { setSelectedCards([]); setView('list'); }} className="btn-secondary">Cancel</button>
        <button onClick={selectCards} disabled={selectedCards.length !== 3} className="btn-primary disabled:opacity-50">Confirm Selection →</button>
      </div>
    </div>
  );

  if (view === 'create') return (
    <div className="page-container page-transition">
      <button onClick={() => setView('list')} className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition group">
        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>Back
      </button>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Create Battle</h1>
        <p className="text-sm text-gray-400 mt-1">Set your wager and challenge</p>
      </div>
      {error && <ErrorBanner msg={error} />}
      <div className="max-w-lg">
        <div className="section-card">
          <label className="block text-sm text-gray-400 mb-2 font-medium">Wager Amount (MON)</label>
          <div className="relative mb-6">
            <input type="number" value={wagerAmount} onChange={e => setWagerAmount(e.target.value)} min="0.001" step="0.001" className="input-field text-2xl font-bold pr-16" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 font-medium">MON</span>
          </div>
          <div className="glass-light rounded-xl p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Total Pool</span><span className="text-white font-medium">{(parseFloat(wagerAmount) * 2).toFixed(4)} MON</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Fee (5%)</span><span className="text-red-400">-{(parseFloat(wagerAmount) * 2 * 0.05).toFixed(4)}</span></div>
            <div className="border-t border-white/10 pt-2 flex justify-between font-medium"><span className="text-white">Winner Takes</span><span className="text-emerald-400 font-bold">{(parseFloat(wagerAmount) * 2 * 0.95).toFixed(4)} MON</span></div>
          </div>
          <button onClick={createBattle} disabled={myCards.length < 3} className="w-full btn-primary py-4 text-lg disabled:opacity-50">
            {myCards.length < 3 ? '⚠️ Need 3 cards' : '⚔️ Create Battle'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ═══════════ BATTLE LIST (main view) ═══════════ */
  return (
    <div className="page-container page-transition">
      {/* Header */}
      <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            ⚔️ Battle Arena
          </h1>
          <p className="text-sm text-gray-400 mt-1">Challenge trainers • Win MON</p>
        </div>
        <button onClick={() => setView('create')} className="btn-primary flex items-center gap-2">
          <span>⚔️</span><span>Create Battle</span>
        </button>
      </div>

      {error && <ErrorBanner msg={error} />}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <StatCard label="Active" value={activeBattles.length} color="text-yellow-400" icon="⚡" />
        <StatCard label="Open" value={openBattles.length} color="text-emerald-400" icon="🏟️" />
        <StatCard label="Completed" value={recentBattles.length} color="text-purple-400" icon="🏆" />
      </div>

      {/* Active Battles */}
      {activeBattles.length > 0 && (
        <Section title="Active Battles" count={activeBattles.length} pulse>
          <div className="grid gap-2">
            {activeBattles.map((battle, i) => (
              <BattleCard
                key={battle.battleId}
                battle={battle}
                index={i}
                onReplay={watchReplay}
                onOpen={() => { void openBattleView(battle.battleId); }}
                onResume={() => { void resumeBattleSimulation(battle.battleId); }}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Open Battles */}
      {openBattles.length > 0 && (
        <Section title="Open Battles" count={openBattles.length} pulse>
          <div className="grid gap-2">
            {openBattles.map((b, i) => (
              <div key={b.battleId} className="bg-gray-900/60 border border-emerald-500/20 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 animate-fade-in-up opacity-0" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-lg shrink-0">⚔️</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{playerName(b.player1)}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="text-yellow-400">💰 {b.wager} MON</span>
                      {b.createdAt && <span>• {timeAgo(b.createdAt as unknown as string)}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => joinBattle(b.battleId)} disabled={myCards.length < 3}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                  {myCards.length < 3 ? 'Need 3 cards' : 'Join ⚔️'}
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recent Battles */}
      <Section title="Recent Battles" count={recentBattles.length}>
        {recentBattles.length === 0 ? (
          <EmptyState icon="📺" title="No battles yet" desc="Create one or wait for agents!" />
        ) : (
          <div className="grid gap-2">
            {recentBattles.map((battle, i) => (
              <BattleCard key={battle.battleId} battle={battle} index={i} onReplay={watchReplay} />
            ))}
          </div>
        )}
      </Section>

      {/* My Battles */}
      {address && (
        <Section title="My Battles" count={myBattles.length}>
          {myBattles.length === 0 ? (
            <EmptyState icon="⚔️" title="No battles yet" desc="Create or join a battle!" />
          ) : (
            <div className="grid gap-2">
              {myBattles.map((battle, i) => {
                const isMyBattle = battle.player1.address.toLowerCase() === address?.toLowerCase();
                const isWinner = battle.winner?.toLowerCase() === address?.toLowerCase();
                return (
                  <div key={battle.battleId} className="bg-gray-900/60 border border-white/5 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 animate-fade-in-up opacity-0" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${battle.status === 'complete' ? (isWinner ? 'bg-emerald-500/20' : 'bg-red-500/20') : 'bg-yellow-500/20'}`}>
                        {battle.status === 'complete' ? (isWinner ? '🏆' : '💀') : '⏳'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={battle.status} isWinner={isWinner} />
                          <span className="text-sm text-gray-300">vs {playerName(isMyBattle ? battle.player2 : battle.player1)}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">💰 {battle.wager} MON</div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {battle.status === 'complete' && <button onClick={() => watchReplay(battle.battleId)} className="btn-secondary text-xs">📺 Replay</button>}
                      {battle.status === 'active' && <button onClick={() => { setCurrentBattle(battle); setView('simulating'); }} className="btn-primary text-xs">⚡ Watch Battle</button>}
                      {(battle.status === 'selecting' || (battle.status === 'pending' && isMyBattle)) && (() => {
                        const myReady = isMyBattle ? (battle.player1 as unknown as { ready?: boolean })?.ready : (battle.player2 as unknown as { ready?: boolean })?.ready;
                        return myReady
                          ? <button onClick={() => { setCurrentBattle(battle); setView('simulating'); }} className="btn-primary text-xs">⏳ Waiting...</button>
                          : <button onClick={() => { setCurrentBattle(battle); setView('select-cards'); }} className="btn-primary text-xs">Select Cards</button>;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/* ─── Battle Card Component ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BattleCard({ battle, index, onReplay, onOpen, onResume }: { battle: any; index: number; onReplay: (id: string) => void; onOpen?: () => void; onResume?: () => void }) {
  const p1 = battle.player1;
  const p2 = battle.player2;
  const p1Name = playerName(p1);
  const p2Name = playerName(p2);
  const isActive = battle.status === 'active';
  const winner = battle.winner;
  const winnerName = battle.winnerName || (winner ? shortAddr(winner) : null);
  const p1Cards = p1.selectedCards || [];
  const p2Cards = p2?.selectedCards || [];
  const payout = (parseFloat(battle.wager || '0') * 2 * 0.95).toFixed(4);
  const _lastRound = battle.lastRound;
  const duration = battle.createdAt ? formatDuration(battle.createdAt, battle.status === 'complete' ? battle.updatedAt || null : null) : null;

  return (
    <div
      className={`bg-gray-900/60 border border-white/5 hover:border-white/10 rounded-xl p-3 sm:p-4 transition animate-fade-in-up opacity-0 ${isActive && onOpen ? 'cursor-pointer' : ''}`}
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={isActive && onOpen ? onOpen : undefined}
    >
      {/* Players + cards — centered layout */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3">
        {/* Player 1 side */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <span className={`text-sm font-bold truncate max-w-full ${winner?.toLowerCase() === p1?.address?.toLowerCase() ? 'text-yellow-300' : 'text-cyan-400'}`}>{p1Name}</span>
          <div className="flex gap-1.5 sm:gap-2">
            {p1Cards.slice(0, 3).filter(Boolean).map((c: { name?: string; element?: string; rarity?: string }, i: number) => (
              <TeamCardChip key={i} card={c} />
            ))}
          </div>
        </div>

        {/* VS badge */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shrink-0 shadow-lg">
          <span className="text-[10px] font-black text-white">VS</span>
        </div>

        {/* Player 2 side */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <span className={`text-sm font-bold truncate max-w-full ${winner?.toLowerCase() === p2?.address?.toLowerCase() ? 'text-yellow-300' : 'text-purple-400'}`}>{p2Name || '…'}</span>
          <div className="flex gap-1.5 sm:gap-2">
            {p2Cards.slice(0, 3).filter(Boolean).map((c: { name?: string; element?: string; rarity?: string }, i: number) => (
              <TeamCardChip key={i} card={c} />
            ))}
          </div>
        </div>
      </div>

      {/* Info row — compact single line */}
      <div className="flex items-center justify-center gap-2 text-xs flex-wrap">
        <span className="text-yellow-400 font-semibold">💰 {battle.wager} MON</span>
        {winner && <span className="text-emerald-400">🏆 {winnerName} +{payout}</span>}
        {isActive && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold animate-pulse text-[10px]">LIVE</span>}
        {duration && (
          <span className={`${isActive ? 'text-yellow-300' : 'text-gray-400'}`}>
            ⏱️ {duration}{isActive ? ' running' : ''}
          </span>
        )}
        {isActive && onOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-300 px-2 py-0.5 rounded-lg transition font-medium text-[10px]"
          >
            👁️ Watch Live
          </button>
        )}
        {isActive && onResume && (
          <button
            onClick={(e) => { e.stopPropagation(); onResume(); }}
            className="bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 px-2 py-0.5 rounded-lg transition font-medium text-[10px]"
          >
            ▶ Resume AI
          </button>
        )}
        {battle.status === 'complete' && <button onClick={() => onReplay(battle.battleId)} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 px-2 py-0.5 rounded-lg transition font-medium text-[10px]">📺 Replay</button>}
        {battle.createdAt && <span className="text-gray-600">{timeAgo(battle.createdAt)}</span>}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center gap-3">
      <span className="text-lg">⚠️</span>
      <p className="text-sm text-red-400">{msg}</p>
    </div>
  );
}

function Section({ title, count, pulse, children }: { title: string; count: number; pulse?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {count > 0 && (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${pulse ? 'bg-emerald-500/20 text-emerald-300 animate-pulse' : 'bg-white/10 text-gray-300'}`}>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 text-center">
      <div className="text-lg mb-1">{icon}</div>
      <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function StatusBadge({ status, isWinner }: { status: string; isWinner?: boolean }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    complete: isWinner ? { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Victory' } : { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Defeat' },
    active: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Live' },
    pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Waiting' },
    selecting: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Selecting' },
  };
  const s = map[status] || map.pending;
  return <span className={`${s.bg} ${s.text} px-2 py-0.5 rounded text-[10px] font-semibold`}>{s.label}</span>;
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="section-card text-center py-10">
      <div className="text-4xl mb-3 opacity-50">{icon}</div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}
