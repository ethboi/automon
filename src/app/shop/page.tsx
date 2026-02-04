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
      // For demo/hackathon: skip actual blockchain transaction
      // In production, would call createPackOnChain() here
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
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading shop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Card Shop</h1>

      {/* Pack opening modal */}
      {opening && (
        <PackOpening cards={opening.cards} onComplete={handleOpenComplete} />
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Buy pack section */}
      <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-xl p-8 mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Card Pack</h2>
            <p className="text-purple-200 mb-4">Contains 5 random monster cards</p>
            <ul className="text-sm text-purple-300 space-y-1">
              <li>60% Common | 25% Uncommon | 10% Rare</li>
              <li>4% Epic | 1% Legendary</li>
            </ul>
          </div>

          <div className="text-center">
            <div className="text-6xl mb-4">🎁</div>
            <div className="text-2xl font-bold mb-2">
              {ethers.formatEther(PACK_PRICE)} MON
            </div>
            <button
              onClick={buyPack}
              disabled={buying}
              className="bg-white text-purple-900 hover:bg-gray-100 disabled:bg-gray-300 disabled:cursor-not-allowed px-8 py-3 rounded-lg font-bold transition"
            >
              {buying ? 'Buying...' : 'Buy Pack'}
            </button>
          </div>
        </div>
      </div>

      {/* Unopened packs */}
      {unopenedPacks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">
            Unopened Packs ({unopenedPacks.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {unopenedPacks.map(pack => (
              <button
                key={pack.packId}
                onClick={() => openPack(pack.packId)}
                className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 text-center hover:scale-105 transition group"
              >
                <div className="text-5xl mb-3 group-hover:animate-bounce">🎁</div>
                <span className="text-sm font-medium">Click to Open</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Purchase history */}
      {openedPacks.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Opened Packs ({openedPacks.length})</h2>
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-3">Pack ID</th>
                  <th className="text-left p-3">Cards</th>
                  <th className="text-left p-3">Opened</th>
                </tr>
              </thead>
              <tbody>
                {openedPacks.slice(0, 10).map(pack => (
                  <tr key={pack.packId} className="border-t border-gray-700">
                    <td className="p-3 font-mono text-xs">
                      {pack.packId.slice(0, 8)}...
                    </td>
                    <td className="p-3">{pack.cards?.length || 5} cards</td>
                    <td className="p-3 text-gray-400">
                      {pack.openedAt
                        ? new Date(pack.openedAt).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
