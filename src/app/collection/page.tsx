'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Card as CardType, Element, Rarity } from '@/lib/types';
import Card from '@/components/Card';
import { useRouter } from 'next/navigation';

export default function CollectionPage() {
  const { isAuthenticated } = useWallet();
  const router = useRouter();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    element: Element | 'all';
    rarity: Rarity | 'all';
  }>({ element: 'all', rarity: 'all' });
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'attack' | 'defense'>('rarity');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    fetchCards();
  }, [isAuthenticated, router]);

  const fetchCards = async () => {
    try {
      const res = await fetch('/api/cards');
      const data = await res.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const rarityOrder: Record<Rarity, number> = {
    legendary: 5,
    epic: 4,
    rare: 3,
    uncommon: 2,
    common: 1,
  };

  const filteredCards = cards
    .filter(card => filter.element === 'all' || card.element === filter.element)
    .filter(card => filter.rarity === 'all' || card.rarity === filter.rarity)
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rarity':
          return rarityOrder[b.rarity] - rarityOrder[a.rarity];
        case 'attack':
          return b.stats.attack - a.stats.attack;
        case 'defense':
          return b.stats.defense - a.stats.defense;
        default:
          return 0;
      }
    });

  const elements: (Element | 'all')[] = ['all', 'fire', 'water', 'earth', 'air', 'dark', 'light'];
  const rarities: (Rarity | 'all')[] = ['all', 'legendary', 'epic', 'rare', 'uncommon', 'common'];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Collection</h1>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4 mb-8">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Element</label>
            <select
              value={filter.element}
              onChange={e => setFilter(f => ({ ...f, element: e.target.value as Element | 'all' }))}
              className="bg-gray-700 rounded px-3 py-2 text-sm"
            >
              {elements.map(el => (
                <option key={el} value={el}>
                  {el === 'all' ? 'All Elements' : el.charAt(0).toUpperCase() + el.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Rarity</label>
            <select
              value={filter.rarity}
              onChange={e => setFilter(f => ({ ...f, rarity: e.target.value as Rarity | 'all' }))}
              className="bg-gray-700 rounded px-3 py-2 text-sm"
            >
              {rarities.map(r => (
                <option key={r} value={r}>
                  {r === 'all' ? 'All Rarities' : r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-gray-700 rounded px-3 py-2 text-sm"
            >
              <option value="rarity">Rarity</option>
              <option value="name">Name</option>
              <option value="attack">Attack</option>
              <option value="defense">Defense</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-400">
            {filteredCards.length} of {cards.length} cards
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl">
          <div className="text-4xl mb-4">🎴</div>
          <p className="text-gray-400 mb-4">
            {cards.length === 0
              ? "You don't have any cards yet"
              : 'No cards match your filters'}
          </p>
          {cards.length === 0 && (
            <a
              href="/shop"
              className="inline-block bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition"
            >
              Buy Packs
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredCards.map((card, index) => (
            <Card key={card._id?.toString() || card.id || index} card={card} size="md" />
          ))}
        </div>
      )}

      {/* Stats summary */}
      {cards.length > 0 && (
        <div className="mt-8 bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Collection Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(['common', 'uncommon', 'rare', 'epic', 'legendary'] as Rarity[]).map(rarity => (
              <div key={rarity} className="text-center">
                <div className="text-2xl font-bold">
                  {cards.filter(c => c.rarity === rarity).length}
                </div>
                <div className="text-sm text-gray-400 capitalize">{rarity}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
