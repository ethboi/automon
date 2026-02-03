'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Battle, Card as CardType, BattleMove } from '@/lib/types';
import Card from '@/components/Card';
import BattleArena from '@/components/BattleArena';
import { useRouter } from 'next/navigation';

type View = 'list' | 'create' | 'select-cards' | 'battle';

export default function BattlePage() {
  const { address, isAuthenticated, refreshBalance } = useWallet();
  const router = useRouter();
  const [view, setView] = useState<View>('list');
  const [battles, setBattles] = useState<Battle[]>([]);
  const [myCards, setMyCards] = useState<CardType[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [currentBattle, setCurrentBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wagerAmount, setWagerAmount] = useState('0.01');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    fetchData();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (currentBattle && currentBattle.status === 'active') {
      const interval = setInterval(() => refreshBattle(), 3000);
      return () => clearInterval(interval);
    }
  }, [currentBattle]);

  const fetchData = async () => {
    try {
      const [battlesRes, cardsRes] = await Promise.all([
        fetch('/api/battle/list'),
        fetch('/api/cards'),
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
      // For demo: skip blockchain transaction
      const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

      const res = await fetch('/api/battle/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wager: wagerAmount, txHash }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create battle');
      }

      const { battle } = await res.json();
      setCurrentBattle(battle);
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
        body: JSON.stringify({ battleId, txHash }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join battle');
      }

      const { battle } = await res.json();
      setCurrentBattle(battle);
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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to select cards');
      }

      const { battle } = await res.json();
      setCurrentBattle(battle);

      if (battle.status === 'active') {
        setView('battle');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
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

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to submit move');
    }

    const { battle } = await res.json();
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading battles...</p>
        </div>
      </div>
    );
  }

  // Battle view
  if (view === 'battle' && currentBattle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => {
            setCurrentBattle(null);
            setView('list');
            fetchData();
          }}
          className="mb-6 text-gray-400 hover:text-white transition"
        >
          &larr; Back to battles
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
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Select Your Team</h1>
        <p className="text-gray-400 mb-8">Choose 3 cards for battle</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {myCards.map(card => (
            <Card
              key={card._id?.toString() || card.id}
              card={card}
              selected={selectedCards.includes(card._id?.toString() || card.id || '')}
              onClick={() => toggleCardSelection(card._id?.toString() || card.id || '')}
              size="md"
            />
          ))}
        </div>

        <div className="flex items-center justify-between bg-gray-800 rounded-xl p-4">
          <span className="text-gray-400">
            Selected: {selectedCards.length}/3 cards
          </span>
          <button
            onClick={selectCards}
            disabled={selectedCards.length !== 3}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    );
  }

  // Create battle view
  if (view === 'create') {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => setView('list')}
          className="mb-6 text-gray-400 hover:text-white transition"
        >
          &larr; Back
        </button>

        <h1 className="text-3xl font-bold mb-8">Create Battle</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="max-w-md bg-gray-800 rounded-xl p-6">
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Wager Amount (MON)</label>
            <input
              type="number"
              value={wagerAmount}
              onChange={e => setWagerAmount(e.target.value)}
              min="0.001"
              step="0.001"
              className="w-full bg-gray-700 rounded-lg px-4 py-3 text-lg"
            />
          </div>

          <p className="text-sm text-gray-400 mb-6">
            Winner takes {(parseFloat(wagerAmount) * 2 * 0.95).toFixed(4)} MON (5% fee)
          </p>

          <button
            onClick={createBattle}
            disabled={myCards.length < 3}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 rounded-lg font-bold transition"
          >
            {myCards.length < 3 ? 'Need at least 3 cards' : 'Create Battle'}
          </button>
        </div>
      </div>
    );
  }

  // Battle list view
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Battle Arena</h1>
        <button
          onClick={() => setView('create')}
          className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition"
        >
          Create Battle
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Open battles */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Open Battles</h2>
        {openBattles.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400">No open battles. Create one or wait for others!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {openBattles.map(battle => (
              <div
                key={battle.battleId}
                className="bg-gray-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">
                    {battle.player1.address.slice(0, 6)}...{battle.player1.address.slice(-4)}
                  </p>
                  <p className="text-sm text-gray-400">
                    Wager: {battle.wager} MON
                  </p>
                </div>
                <button
                  onClick={() => joinBattle(battle.battleId)}
                  disabled={myCards.length < 3}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition"
                >
                  {myCards.length < 3 ? 'Need 3 cards' : 'Join Battle'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My battles */}
      <div>
        <h2 className="text-xl font-bold mb-4">My Battles</h2>
        {myBattles.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400">You have not participated in any battles yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myBattles.map(battle => {
              const isMyBattle = battle.player1.address.toLowerCase() === address?.toLowerCase();
              const opponent = isMyBattle ? battle.player2 : battle.player1;
              const isWinner = battle.winner?.toLowerCase() === address?.toLowerCase();

              return (
                <div
                  key={battle.battleId}
                  className="bg-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          battle.status === 'complete'
                            ? isWinner
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                            : battle.status === 'active'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {battle.status === 'complete'
                          ? isWinner
                            ? 'Won'
                            : 'Lost'
                          : battle.status}
                      </span>
                      <span className="text-sm text-gray-400">
                        vs{' '}
                        {opponent
                          ? `${opponent.address.slice(0, 6)}...${opponent.address.slice(-4)}`
                          : 'Waiting...'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Wager: {battle.wager} MON
                    </p>
                  </div>

                  {battle.status === 'active' && (
                    <button
                      onClick={() => {
                        setCurrentBattle(battle);
                        setView('battle');
                      }}
                      className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition"
                    >
                      Continue
                    </button>
                  )}

                  {battle.status === 'selecting' && (
                    <button
                      onClick={() => {
                        setCurrentBattle(battle);
                        setView('select-cards');
                      }}
                      className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition"
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
