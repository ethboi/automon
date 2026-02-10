'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Battle, Card as CardType, BattleMove, BattleLog } from '@/lib/types';
import Card from '@/components/Card';
import BattleArena from '@/components/BattleArena';
import BattleReplay from '@/components/BattleReplay';

type View = 'list' | 'create' | 'select-cards' | 'battle' | 'replay';

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

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (currentBattle && currentBattle.status === 'active') {
      const interval = setInterval(() => refreshBattle(), 3000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBattle]);

  const fetchData = async () => {
    if (!address) return;
    try {
      const [battlesRes, cardsRes] = await Promise.all([
        fetch('/api/battle/list'),
        fetch(`/api/cards?address=${address}`),
      ]);

      const battlesData = await battlesRes.json();
      const cardsData = await cardsRes.json();

      setBattles(battlesData.battles || []);
      setMyCards(cardsData.cards || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshBattle = async () => {
    if (!currentBattle) return;
    try {
      const res = await fetch(`/api/battle/${currentBattle.battleId}`);
      const data = await res.json();
      if (data.battle) {
        setCurrentBattle(data.battle);
      }
    } catch (error) {
      console.error('Failed to refresh battle:', error);
    }
  };

  const createBattle = async () => {
    setError(null);
    try {
      const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

      const res = await fetch('/api/battle/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wager: wagerAmount, txHash, address }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create battle');
      }

      setCurrentBattle(data.battle);
      setView('select-cards');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const joinBattle = async (battleId: string) => {
    setError(null);
    try {
      const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

      const res = await fetch('/api/battle/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, txHash, address }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join battle');
      }

      setCurrentBattle(data.battle);
      setView('select-cards');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const selectCards = async () => {
    if (selectedCards.length !== 3) {
      setError('Select exactly 3 cards');
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/battle/select-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId: currentBattle?.battleId,
          cardIds: selectedCards,
          address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to select cards');
      }
      setCurrentBattle(data.battle);

      // If simulation completed, show the replay
      if (data.simulationComplete && data.battleLog) {
        setBattleLog(data.battleLog);
        setView('replay');
      } else if (data.battle.status === 'active') {
        setView('battle');
      } else {
        // Cards selected, waiting for opponent — go back to list
        setCurrentBattle(data.battle);
        setSelectedCards([]);
        setView('list');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const watchReplay = async (battleId: string) => {
    try {
      const res = await fetch(`/api/battle/simulate?battleId=${battleId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch battle log');
      }
      const data = await res.json();
      if (data.battleLog) {
        setBattleLog(data.battleLog);
        setView('replay');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load replay');
    }
  };

  const submitMove = async (move: BattleMove) => {
    if (!currentBattle) return;

    const res = await fetch('/api/battle/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        battleId: currentBattle.battleId,
        move,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit move');
    }

    const { battle } = data;
    setCurrentBattle(battle);

    if (battle.status === 'complete') {
      refreshBalance();
    }
  };

  const getAIDecision = async (): Promise<BattleMove> => {
    const res = await fetch('/api/agent/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId: currentBattle?.battleId }),
    });

    const data = await res.json();
    return data.decision;
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, cardId];
    });
  };

  const openBattles = battles.filter(
    b => b.status === 'pending' && b.player1.address.toLowerCase() !== address?.toLowerCase()
  );

  const myBattles = battles.filter(
    b =>
      b.player1.address.toLowerCase() === address?.toLowerCase() ||
      b.player2?.address.toLowerCase() === address?.toLowerCase()
  );

  const allBattles = battles.filter(b => b.status === 'complete' || b.status === 'active');

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="spinner mb-4" />
          <p className="text-gray-400 animate-pulse">Loading battles...</p>
        </div>
      </div>
    );
  }

  // Replay view
  if (view === 'replay' && battleLog) {
    return (
      <BattleReplay
        battleLog={battleLog}
        onClose={() => {
          setBattleLog(null);
          setView('list');
          fetchData();
        }}
      />
    );
  }

  // Battle view
  if (view === 'battle' && currentBattle) {
    return (
      <div className="page-container page-transition">
        <button
          onClick={() => {
            setCurrentBattle(null);
            setView('list');
            fetchData();
          }}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to battles</span>
        </button>

        <BattleArena
          battle={currentBattle}
          onMove={submitMove}
          onAIDecide={getAIDecision}
        />
      </div>
    );
  }

  // Card selection view
  if (view === 'select-cards') {
    return (
      <div className="page-container page-transition">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Select Your Team
          </h1>
          <p className="text-gray-400">Choose 3 cards for battle</p>
        </div>

        {error && (
          <div className="glass border border-red-500/30 rounded-2xl p-4 mb-6 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">⚠️</span>
              </div>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Selected cards preview */}
        <div className="section-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Your Team</h3>
            <span className={`text-sm font-medium ${selectedCards.length === 3 ? 'text-emerald-400' : 'text-gray-400'}`}>
              {selectedCards.length}/3 selected
            </span>
          </div>
          <div className="flex gap-4 min-h-[80px] items-center">
            {[0, 1, 2].map((slot) => {
              const cardId = selectedCards[slot];
              const card = cardId ? myCards.find(c => (c._id?.toString() || c.id) === cardId) : null;
              return (
                <div
                  key={slot}
                  className={`w-16 h-20 rounded-xl border-2 border-dashed flex items-center justify-center transition-all ${
                    card ? 'border-purple-500 bg-purple-500/20' : 'border-gray-600 bg-white/5'
                  }`}
                >
                  {card ? (
                    <span className="text-2xl">{card.element === 'fire' ? '🔥' : card.element === 'water' ? '💧' : card.element === 'earth' ? '🌍' : card.element === 'air' ? '💨' : card.element === 'dark' ? '🌑' : '✨'}</span>
                  ) : (
                    <span className="text-gray-500 text-2xl">+</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {myCards.map((card, index) => (
            <div
              key={card._id?.toString() || card.id}
              className="animate-fade-in-up opacity-0"
              style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
            >
              <Card
                card={card}
                selected={selectedCards.includes(card._id?.toString() || card.id || '')}
                onClick={() => toggleCardSelection(card._id?.toString() || card.id || '')}
                size="md"
              />
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="section-card flex items-center justify-between sticky bottom-4">
          <button
            onClick={() => {
              setSelectedCards([]);
              setView('list');
            }}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={selectCards}
            disabled={selectedCards.length !== 3}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <span>Confirm Selection</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Create battle view
  if (view === 'create') {
    return (
      <div className="page-container page-transition">
        <button
          onClick={() => setView('list')}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Create Battle
          </h1>
          <p className="text-gray-400">Set your wager and challenge other players</p>
        </div>

        {error && (
          <div className="glass border border-red-500/30 rounded-2xl p-4 mb-6 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">⚠️</span>
              </div>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        <div className="max-w-lg">
          <div className="section-card">
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2 font-medium">Wager Amount (MON)</label>
              <div className="relative">
                <input
                  type="number"
                  value={wagerAmount}
                  onChange={e => setWagerAmount(e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="input-field text-2xl font-bold pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 font-medium">MON</span>
              </div>
            </div>

            {/* Prize breakdown */}
            <div className="glass-light rounded-xl p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Prize Breakdown</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Pool</span>
                  <span className="text-white font-medium">{(parseFloat(wagerAmount) * 2).toFixed(4)} MON</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform Fee (5%)</span>
                  <span className="text-red-400">-{(parseFloat(wagerAmount) * 2 * 0.05).toFixed(4)} MON</span>
                </div>
                <div className="border-t border-white/10 my-2" />
                <div className="flex justify-between">
                  <span className="text-white font-medium">Winner Takes</span>
                  <span className="text-emerald-400 font-bold">{(parseFloat(wagerAmount) * 2 * 0.95).toFixed(4)} MON</span>
                </div>
              </div>
            </div>

            <button
              onClick={createBattle}
              disabled={myCards.length < 3}
              className="w-full btn-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {myCards.length < 3 ? (
                <span className="flex items-center justify-center gap-2">
                  <span>⚠️</span>
                  <span>Need at least 3 cards</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>⚔️</span>
                  <span>Create Battle</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Battle list view
  return (
    <div className="page-container page-transition">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Battle Arena
          </h1>
          <p className="text-gray-400">Challenge players and win rewards</p>
        </div>
        <button
          onClick={() => setView('create')}
          className="btn-primary"
        >
          <span className="flex items-center gap-2">
            <span>⚔️</span>
            <span>Create Battle</span>
          </span>
        </button>
      </div>

      {error && (
        <div className="glass border border-red-500/30 rounded-2xl p-4 mb-6 animate-scale-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Open battles */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold text-white">Open Battles</h2>
          {openBattles.length > 0 && (
            <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
              {openBattles.length} available
            </div>
          )}
        </div>

        {openBattles.length === 0 ? (
          <div className="section-card text-center py-12">
            <div className="text-5xl mb-4 opacity-50">🏟️</div>
            <h3 className="text-lg font-semibold text-white mb-2">No open battles</h3>
            <p className="text-gray-400">Create one or wait for other players!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {openBattles.map((battle, index) => (
              <div
                key={battle.battleId}
                className="section-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up opacity-0"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl">
                    👤
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {battle.player1.address.slice(0, 6)}...{battle.player1.address.slice(-4)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-yellow-400">💰</span>
                      <span className="text-sm text-gray-400">Wager: <span className="text-white font-medium">{battle.wager} MON</span></span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => joinBattle(battle.battleId)}
                  disabled={myCards.length < 3}
                  className="btn-success disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {myCards.length < 3 ? 'Need 3 cards' : 'Join Battle'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All recent battles */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold text-white">Recent Battles</h2>
          {allBattles.length > 0 && (
            <div className="bg-white/10 text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
              {allBattles.length}
            </div>
          )}
        </div>

        {allBattles.length === 0 ? (
          <div className="section-card text-center py-8">
            <div className="text-4xl mb-3 opacity-50">📺</div>
            <p className="text-gray-400">No battles to show yet</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {allBattles.map((battle, index) => {
              const p1 = battle.player1.address;
              const p2 = battle.player2?.address;
              const p1Short = `${p1.slice(0, 6)}...${p1.slice(-4)}`;
              const p2Short = p2 ? `${p2.slice(0, 6)}...${p2.slice(-4)}` : 'waiting...';
              const isActive = battle.status === 'active';

              return (
                <div
                  key={battle.battleId}
                  className="section-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in-up opacity-0"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isActive ? 'bg-yellow-500/20' : 'bg-purple-500/20'}`}>
                      {isActive ? '⚡' : '🏆'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-cyan-400 font-medium">{p1Short}</span>
                        <span className="text-xs text-gray-500">vs</span>
                        <span className="text-sm text-cyan-400 font-medium">{p2Short}</span>
                        {isActive && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-medium animate-pulse">LIVE</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">💰 {battle.wager} MON</span>
                        {battle.winner && (
                          <span className="text-xs text-emerald-400">🏆 {battle.winner.slice(0, 6)}...{battle.winner.slice(-4)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {battle.status === 'complete' && (
                    <button
                      onClick={() => watchReplay(battle.battleId)}
                      className="btn-secondary text-sm w-full sm:w-auto"
                    >
                      📺 Watch Replay
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My battles */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold text-white">My Battles</h2>
          {myBattles.length > 0 && (
            <div className="bg-white/10 text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
              {myBattles.length}
            </div>
          )}
        </div>

        {myBattles.length === 0 ? (
          <div className="section-card text-center py-12">
            <div className="text-5xl mb-4 opacity-50">⚔️</div>
            <h3 className="text-lg font-semibold text-white mb-2">No battles yet</h3>
            <p className="text-gray-400">Create or join a battle to get started!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myBattles.map((battle, index) => {
              const isMyBattle = battle.player1.address.toLowerCase() === address?.toLowerCase();
              const opponent = isMyBattle ? battle.player2 : battle.player1;
              const isWinner = battle.winner?.toLowerCase() === address?.toLowerCase();

              const statusConfig = {
                complete: isWinner
                  ? { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Victory' }
                  : { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Defeat' },
                active: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Progress' },
                pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Waiting' },
                selecting: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Selecting' },
              };

              const status = statusConfig[battle.status as keyof typeof statusConfig] || statusConfig.pending;

              return (
                <div
                  key={battle.battleId}
                  className="section-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up opacity-0"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${status.bg}`}>
                      {battle.status === 'complete' ? (isWinner ? '🏆' : '💀') : battle.status === 'active' ? '⚔️' : '⏳'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`${status.bg} ${status.text} px-2 py-0.5 rounded text-xs font-medium`}>
                          {status.label}
                        </span>
                        <span className="text-sm text-gray-400">
                          vs {opponent ? `${opponent.address.slice(0, 6)}...${opponent.address.slice(-4)}` : 'Waiting...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-yellow-400">💰</span>
                        <span className="text-sm text-gray-400">Wager: <span className="text-white font-medium">{battle.wager} MON</span></span>
                      </div>
                    </div>
                  </div>

                  {battle.status === 'complete' && (
                    <button
                      onClick={() => watchReplay(battle.battleId)}
                      className="btn-secondary w-full sm:w-auto"
                    >
                      <span className="flex items-center gap-2">
                        <span>📺</span>
                        <span>Watch Replay</span>
                      </span>
                    </button>
                  )}

                  {battle.status === 'active' && (
                    <button
                      onClick={() => {
                        setCurrentBattle(battle);
                        setView('battle');
                      }}
                      className="btn-primary w-full sm:w-auto"
                    >
                      Continue Battle
                    </button>
                  )}

                  {(battle.status === 'selecting' || (battle.status === 'pending' && isMyBattle)) && (
                    <button
                      onClick={() => {
                        setCurrentBattle(battle);
                        setView('select-cards');
                      }}
                      className="btn-primary w-full sm:w-auto"
                    >
                      Select Cards
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
