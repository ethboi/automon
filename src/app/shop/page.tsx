'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Card as CardType, Pack } from '@/lib/types';
import PackOpening from '@/components/PackOpening';
import { ethers } from 'ethers';
import { buyPackOnChain } from '@/lib/wallet';

const PACK_PRICE = process.env.NEXT_PUBLIC_PACK_PRICE || '100000000000000000'; // 0.1 MON

export default function ShopPage() {
  const { refreshBalance, address } = useWallet();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [opening, setOpening] = useState<{ packId: string; cards: CardType[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) fetchPacks();
    else setLoading(false);
  }, [address]);

  const fetchPacks = async () => {
    try {
      const res = await fetch(`/api/packs?address=${address}`);
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
    if (!address) {
      setError('Please connect your wallet first.');
      return;
    }
    setError(null);
    setBuying(true);
    
    try {
      const txHash = await buyPackOnChain(PACK_PRICE);

      const res = await fetch('/api/packs/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          txHash,
          price: PACK_PRICE,
          address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to buy pack');
      }

      const { pack } = data;
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
    if (!address) {
      setError('Please connect your wallet first.');
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ packId, address }),
      });

      const openData = await res.json();
      if (!res.ok) {
        throw new Error(openData.error || 'Failed to open pack');
      }

      const { cards } = openData;
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
      <div className="mb-4 sm:mb-8">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/20 rounded-full px-3 py-1 mb-3">
          <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide text-cyan-200 uppercase">Pack Market</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
          Card Shop
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-gray-300">Purchase and open card packs to expand your collection</p>
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
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-4 sm:mb-8 border border-purple-400/20 shadow-[0_20px_60px_rgba(58,8,90,0.45)]">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-violet-800 to-purple-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.2),transparent_50%)]" />

        <div className="relative p-4 sm:p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 sm:px-4 py-1.5 mb-3 sm:mb-4">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm text-white/80 font-medium">Available Now</span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-2 sm:mb-3">
                Monster Card Pack
              </h2>
              <p className="text-purple-200 mb-4 sm:mb-6 text-sm sm:text-lg">
                Contains 5 random monster cards
              </p>

              {/* Rarity odds */}
              <div className="flex flex-wrap gap-1.5 sm:gap-3 justify-center lg:justify-start">
                {[
                  { label: 'Common', chance: '60%', color: 'bg-gray-500/30 text-gray-300' },
                  { label: 'Uncommon', chance: '25%', color: 'bg-emerald-500/30 text-emerald-300' },
                  { label: 'Rare', chance: '10%', color: 'bg-blue-500/30 text-blue-300' },
                  { label: 'Epic', chance: '4%', color: 'bg-purple-500/30 text-purple-300' },
                  { label: 'Legendary', chance: '1%', color: 'bg-yellow-500/30 text-yellow-300' },
                ].map((item) => (
                  <div key={item.label} className={`${item.color} rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium`}>
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
                <div className="flex items-baseline justify-center gap-2 mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-black text-white">{ethers.formatEther(PACK_PRICE)}</span>
                  <span className="text-lg sm:text-xl text-purple-200 font-semibold">MON</span>
                </div>

                <button
                  onClick={buyPack}
                  disabled={buying}
                  className="btn-primary px-6 sm:px-10 py-3 sm:py-4 text-sm sm:text-lg shadow-lg shadow-cyan-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <h2 className="text-2xl font-black text-white">Unopened Packs</h2>
            <div className="bg-purple-500/20 text-purple-200 px-3 py-1 rounded-full text-sm font-semibold border border-purple-400/20">
              {unopenedPacks.length}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {unopenedPacks.map((pack, index) => (
              <div
                key={pack.packId}
                className="section-card relative overflow-hidden animate-fade-in-up opacity-0 border border-purple-400/20"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-700/30 via-indigo-700/20 to-cyan-900/20 pointer-events-none" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-purple-900/40">
                      🎁
                    </div>
                    <span className="text-[11px] uppercase tracking-wide text-purple-200 bg-purple-500/20 border border-purple-400/20 px-2 py-1 rounded-full">
                      Ready
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">Pack ID</p>
                  <p className="font-mono text-sm text-cyan-200 mb-3">
                    {pack.packId.slice(0, 10)}...{pack.packId.slice(-6)}
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    Purchased {new Date(pack.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <button
                    onClick={() => openPack(pack.packId)}
                    className="btn-primary w-full"
                  >
                    Open Pack
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase history */}
      {openedPacks.length > 0 && (
        <div className="section-card">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <h2 className="text-2xl font-black text-white">Opened Packs</h2>
            <div className="bg-white/10 border border-white/10 text-gray-200 px-3 py-1 rounded-full text-sm font-semibold">
              {openedPacks.length}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {openedPacks.slice(0, 9).map((pack, index) => (
              <div
                key={pack.packId}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 animate-fade-in-up opacity-0"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/20 flex items-center justify-center text-lg">
                    ✅
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-400/20">
                    Opened
                  </span>
                </div>

                <p className="text-xs text-gray-400 mb-1">Pack</p>
                <p className="font-mono text-sm text-cyan-200 mb-3">
                  {pack.packId.slice(0, 10)}...{pack.packId.slice(-6)}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Cards</span>
                  <span className="text-white font-semibold">{pack.cards?.length || 5}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-300">Opened</span>
                  <span className="text-white font-medium">
                    {pack.openedAt
                      ? new Date(pack.openedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {openedPacks.length > 9 && (
            <div className="text-center mt-6 text-gray-400 text-sm">
              Showing 9 of {openedPacks.length} opened packs
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
