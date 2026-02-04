'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Card as CardType, Pack } from '@/lib/types';
import PackOpening from '@/components/PackOpening';
import { ethers } from 'ethers';

const PACK_PRICE = process.env.NEXT_PUBLIC_PACK_PRICE || '100000000000000000'; // 0.1 MON

export default function ShopPage() {
  const { refreshBalance } = useWallet();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [opening, setOpening] = useState<{ packId: string; cards: CardType[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const res = await fetch('/api/packs');
      const data = await res.json();
      setPacks(data.packs || []);
    } catch (error) {
      console.error('Failed to fetch packs:', error);
    } finally {
      setLoading(false);
    }
  };

  const buyPack = async () => {
    if (buying) return;
    setError(null);
    setBuying(true);

    try {
      const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

      const res = await fetch('/api/packs/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          price: PACK_PRICE,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to buy pack');
      }

      const { pack } = await res.json();
      setPacks(prev => [pack, ...prev]);
      refreshBalance();
    } catch (error) {
      console.error('Buy pack error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setBuying(false);
    }
  };

  const openPack = async (packId: string) => {
    setError(null);
    try {
      const res = await fetch('/api/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to open pack');
      }

      const { cards } = await res.json();
      setOpening({ packId, cards });
    } catch (error) {
      console.error('Open pack error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleOpenComplete = () => {
    if (opening) {
      setPacks(prev =>
        prev.map(p =>
          p.packId === opening.packId ? { ...p, opened: true, cards: opening.cards.map(c => c.id || '') } : p
        )
      );
      setOpening(null);
    }
  };

  const unopenedPacks = packs.filter(p => !p.opened);
  const openedPacks = packs.filter(p => p.opened);

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="spinner mb-4" />
          <p className="text-gray-400 animate-pulse">Loading shop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-transition">
      {/* Pack opening modal */}
      {opening && (
        <PackOpening cards={opening.cards} onComplete={handleOpenComplete} />
      )}

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Card Shop
        </h1>
        <p className="text-gray-400">Purchase and open card packs to expand your collection</p>
      </div>

      {/* Error display */}
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

      {/* Buy pack section */}
      <div className="relative overflow-hidden rounded-3xl mb-8">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-violet-800 to-purple-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.2),transparent_50%)]" />

        <div className="relative p-8 sm:p-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-4">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Available Now</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                Monster Card Pack
              </h2>
              <p className="text-purple-200 mb-6 text-lg">
                Contains 5 random monster cards
              </p>

              {/* Rarity odds */}
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                {[
                  { label: 'Common', chance: '60%', color: 'bg-gray-500/30 text-gray-300' },
                  { label: 'Uncommon', chance: '25%', color: 'bg-emerald-500/30 text-emerald-300' },
                  { label: 'Rare', chance: '10%', color: 'bg-blue-500/30 text-blue-300' },
                  { label: 'Epic', chance: '4%', color: 'bg-purple-500/30 text-purple-300' },
                  { label: 'Legendary', chance: '1%', color: 'bg-yellow-500/30 text-yellow-300' },
                ].map((item) => (
                  <div key={item.label} className={`${item.color} rounded-lg px-3 py-1.5 text-sm font-medium`}>
                    {item.label}: {item.chance}
                  </div>
                ))}
              </div>
            </div>

            {/* Pack visual and buy button */}
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-purple-500/30 blur-3xl rounded-full" />

                {/* Pack box */}
                <div className="relative w-40 h-48 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-2xl shadow-purple-500/30 flex items-center justify-center transform hover:scale-105 transition-transform duration-300 cursor-pointer group">
                  <div className="absolute inset-2 border-2 border-white/20 rounded-xl" />
                  <div className="text-7xl group-hover:animate-bounce-subtle">🎁</div>

                  {/* Sparkles */}
                  <div className="absolute -top-2 -right-2 text-2xl animate-bounce-subtle" style={{ animationDelay: '0.1s' }}>✨</div>
                  <div className="absolute -bottom-2 -left-2 text-xl animate-bounce-subtle" style={{ animationDelay: '0.3s' }}>⭐</div>
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-4xl font-bold text-white">{ethers.formatEther(PACK_PRICE)}</span>
                  <span className="text-xl text-purple-300 font-medium">MON</span>
                </div>

                <button
                  onClick={buyPack}
                  disabled={buying}
                  className="btn-primary px-10 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    {buying ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Purchasing...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">🛒</span>
                        <span>Buy Pack</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unopened packs */}
      {unopenedPacks.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-white">Unopened Packs</h2>
            <div className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm font-medium">
              {unopenedPacks.length}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {unopenedPacks.map((pack, index) => (
              <button
                key={pack.packId}
                onClick={() => openPack(pack.packId)}
                className="group relative overflow-hidden rounded-2xl animate-fade-in-up opacity-0"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-indigo-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                {/* Content */}
                <div className="relative p-6 text-center">
                  <div className="text-5xl mb-3 group-hover:scale-110 group-hover:animate-bounce transition-transform duration-300">
                    🎁
                  </div>
                  <span className="text-white font-medium text-sm opacity-80 group-hover:opacity-100 transition-opacity">
                    Tap to Open
                  </span>
                </div>

                {/* Hover glow */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                <div className="absolute inset-0 border-2 border-white/0 group-hover:border-white/30 rounded-2xl transition-colors duration-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Purchase history */}
      {openedPacks.length > 0 && (
        <div className="section-card">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-white">Opened Packs</h2>
            <div className="bg-white/10 text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
              {openedPacks.length}
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 sm:-mx-8 px-6 sm:px-8">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-sm font-medium text-gray-400 pb-4">Pack ID</th>
                  <th className="text-left text-sm font-medium text-gray-400 pb-4">Cards</th>
                  <th className="text-left text-sm font-medium text-gray-400 pb-4">Opened</th>
                </tr>
              </thead>
              <tbody>
                {openedPacks.slice(0, 10).map((pack) => (
                  <tr
                    key={pack.packId}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4">
                      <span className="font-mono text-sm text-purple-300 bg-purple-500/10 px-2 py-1 rounded">
                        {pack.packId.slice(0, 8)}...{pack.packId.slice(-4)}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className="flex items-center gap-2">
                        <span className="text-lg">🎴</span>
                        <span className="text-white">{pack.cards?.length || 5} cards</span>
                      </span>
                    </td>
                    <td className="py-4 text-gray-400 text-sm">
                      {pack.openedAt
                        ? new Date(pack.openedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {openedPacks.length > 10 && (
            <div className="text-center mt-6 text-gray-400 text-sm">
              Showing 10 of {openedPacks.length} opened packs
            </div>
          )}
        </div>
      )}

      {/* Empty state for new users */}
      {packs.length === 0 && (
        <div className="section-card text-center py-12">
          <div className="text-6xl mb-4 opacity-50">📦</div>
          <h3 className="text-xl font-semibold text-white mb-2">No packs yet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Purchase your first card pack above to start building your collection!
          </p>
        </div>
      )}
    </div>
  );
}
