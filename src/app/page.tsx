'use client';

import { useWallet } from '@/context/WalletContext';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Stats {
  totalCards: number;
  totalBattles: number;
  wins: number;
  losses: number;
}

export default function Home() {
  const { address, isAuthenticated, connect, isConnecting } = useWallet();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [cardsRes, battlesRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/battle/list?type=my'),
      ]);

      const cardsData = await cardsRes.json();
      const battlesData = await battlesRes.json();

      const completeBattles = (battlesData.battles || []).filter(
        (b: { status: string }) => b.status === 'complete'
      );
      const wins = completeBattles.filter(
        (b: { winner?: string }) => b.winner?.toLowerCase() === address?.toLowerCase()
      ).length;

      setStats({
        totalCards: cardsData.cards?.length || 0,
        totalBattles: completeBattles.length,
        wins,
        losses: completeBattles.length - wins,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-6xl font-bold mb-4">
            Auto<span className="text-purple-500">Mon</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Collect monster cards, battle for MON wagers, and let AI play for you
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-4xl mb-3">🎴</div>
              <h3 className="font-bold mb-2">Collect Cards</h3>
              <p className="text-sm text-gray-400">
                Buy packs to get random monster cards with unique abilities
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-4xl mb-3">⚔️</div>
              <h3 className="font-bold mb-2">Battle & Win</h3>
              <p className="text-sm text-gray-400">
                Wager MON in battles. Winner takes all from escrow
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-4xl mb-3">🤖</div>
              <h3 className="font-bold mb-2">AI Agent</h3>
              <p className="text-sm text-gray-400">
                Let Claude AI make strategic decisions for you
              </p>
            </div>
          </div>

          <button
            onClick={connect}
            disabled={isConnecting}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-bold text-lg transition"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet to Start'}
          </button>

          <p className="text-sm text-gray-500 mt-4">
            Built on Monad for the Moltiverse Hackathon
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2">Welcome back, Trainer!</h1>
        <p className="text-gray-400">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin text-4xl">⏳</div>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-purple-400">{stats.totalCards}</div>
            <div className="text-gray-400">Cards Owned</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-blue-400">{stats.totalBattles}</div>
            <div className="text-gray-400">Battles Fought</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-400">{stats.wins}</div>
            <div className="text-gray-400">Victories</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-red-400">{stats.losses}</div>
            <div className="text-gray-400">Defeats</div>
          </div>
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/shop"
          className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 hover:scale-105 transition"
        >
          <div className="text-4xl mb-3">🎁</div>
          <h3 className="text-xl font-bold mb-2">Buy Packs</h3>
          <p className="text-sm text-purple-200">
            Get new cards to strengthen your deck
          </p>
        </Link>

        <Link
          href="/collection"
          className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 hover:scale-105 transition"
        >
          <div className="text-4xl mb-3">🎴</div>
          <h3 className="text-xl font-bold mb-2">Collection</h3>
          <p className="text-sm text-blue-200">
            View and manage your monster cards
          </p>
        </Link>

        <Link
          href="/battle"
          className="bg-gradient-to-br from-red-600 to-red-800 rounded-xl p-6 hover:scale-105 transition"
        >
          <div className="text-4xl mb-3">⚔️</div>
          <h3 className="text-xl font-bold mb-2">Battle</h3>
          <p className="text-sm text-red-200">
            Challenge others and win MON
          </p>
        </Link>

        <Link
          href="/agent"
          className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6 hover:scale-105 transition"
        >
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="text-xl font-bold mb-2">AI Agent</h3>
          <p className="text-sm text-green-200">
            Let AI play battles for you
          </p>
        </Link>
      </div>

      {stats && stats.totalCards < 3 && (
        <div className="mt-8 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 text-center">
          <p className="text-yellow-300">
            You need at least 3 cards to battle! Visit the shop to buy some packs.
          </p>
        </div>
      )}
    </div>
  );
}
