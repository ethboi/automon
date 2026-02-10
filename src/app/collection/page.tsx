'use client';

import { useEffect, useState } from 'react';
import { Card as CardType, Element, Rarity } from '@/lib/types';
import Card from '@/components/Card';
import { useWallet } from '@/context/WalletContext';

export default function CollectionPage() {
  const { address } = useWallet();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    element: Element | 'all';
    rarity: Rarity | 'all';
  }>({ element: 'all', rarity: 'all' });
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'attack' | 'defense'>('rarity');

  useEffect(() => {
    if (address) fetchCards();
  }, [address]);

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/cards?address=${address}`);
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

  const elements: { value: Element | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'All Elements', icon: '🌟' },
    { value: 'fire', label: 'Fire', icon: '🔥' },
    { value: 'water', label: 'Water', icon: '💧' },
    { value: 'earth', label: 'Earth', icon: '🌍' },
    { value: 'air', label: 'Air', icon: '💨' },
    { value: 'dark', label: 'Dark', icon: '🌑' },
    { value: 'light', label: 'Light', icon: '✨' },
  ];

  const rarities: { value: Rarity | 'all'; label: string; color: string }[] = [
    { value: 'all', label: 'All Rarities', color: 'text-gray-300' },
    { value: 'legendary', label: 'Legendary', color: 'text-yellow-400' },
    { value: 'epic', label: 'Epic', color: 'text-purple-400' },
    { value: 'rare', label: 'Rare', color: 'text-blue-400' },
    { value: 'uncommon', label: 'Uncommon', color: 'text-emerald-400' },
    { value: 'common', label: 'Common', color: 'text-gray-400' },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="spinner mb-4" />
          <p className="text-gray-400 animate-pulse">Loading your collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-transition">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          My Collection
        </h1>
        <p className="text-gray-400">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'} collected
        </p>
      </div>

      {/* Filters section */}
      <div className="section-card mb-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Element filter */}
            <div className="min-w-[160px]">
              <label className="block text-sm text-gray-400 mb-2 font-medium">Element</label>
              <select
                value={filter.element}
                onChange={e => setFilter(f => ({ ...f, element: e.target.value as Element | 'all' }))}
                className="select-field w-full"
              >
                {elements.map(el => (
                  <option key={el.value} value={el.value}>
                    {el.icon} {el.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rarity filter */}
            <div className="min-w-[160px]">
              <label className="block text-sm text-gray-400 mb-2 font-medium">Rarity</label>
              <select
                value={filter.rarity}
                onChange={e => setFilter(f => ({ ...f, rarity: e.target.value as Rarity | 'all' }))}
                className="select-field w-full"
              >
                {rarities.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort by */}
            <div className="min-w-[160px]">
              <label className="block text-sm text-gray-400 mb-2 font-medium">Sort By</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="select-field w-full"
              >
                <option value="rarity">Rarity</option>
                <option value="name">Name</option>
                <option value="attack">Attack</option>
                <option value="defense">Defense</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center gap-2 glass-light rounded-xl px-4 py-2">
            <span className="text-2xl">🎴</span>
            <div>
              <div className="text-white font-semibold">{filteredCards.length}</div>
              <div className="text-xs text-gray-400">of {cards.length} cards</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {filteredCards.length === 0 ? (
        <div className="section-card text-center py-16">
          <div className="text-6xl mb-4 opacity-50">🎴</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {cards.length === 0 ? 'No cards yet' : 'No matches found'}
          </h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            {cards.length === 0
              ? "Start your collection by purchasing card packs from the shop."
              : "Try adjusting your filters to see more cards."}
          </p>
          {cards.length === 0 && (
            <a href="/shop" className="btn-primary inline-block">
              <span className="flex items-center gap-2">
                <span>🛒</span>
                <span>Visit Shop</span>
              </span>
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredCards.map((card, index) => (
            <div
              key={card._id?.toString() || card.id || index}
              className="animate-fade-in-up opacity-0"
              style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
            >
              <Card card={card} size="md" />
            </div>
          ))}
        </div>
      )}

      {/* Collection stats */}
      {cards.length > 0 && (
        <div className="section-card mt-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <span>Collection Stats</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {(['common', 'uncommon', 'rare', 'epic', 'legendary'] as Rarity[]).map((rarity, index) => {
              const count = cards.filter(c => c.rarity === rarity).length;
              const colors = {
                common: 'from-gray-600 to-gray-500',
                uncommon: 'from-emerald-600 to-emerald-500',
                rare: 'from-blue-600 to-blue-500',
                epic: 'from-purple-600 to-purple-500',
                legendary: 'from-yellow-500 to-amber-500',
              };
              const glows = {
                common: '',
                uncommon: 'shadow-emerald-500/20',
                rare: 'shadow-blue-500/20',
                epic: 'shadow-purple-500/30',
                legendary: 'shadow-yellow-500/40',
              };

              return (
                <div
                  key={rarity}
                  className={`
                    relative overflow-hidden rounded-xl p-4 text-center
                    bg-gradient-to-br ${colors[rarity]}
                    shadow-lg ${glows[rarity]}
                    transition-all duration-300 hover:scale-105
                    animate-fade-in-up opacity-0
                  `}
                  style={{ animationDelay: `${0.1 + index * 0.1}s` }}
                >
                  <div className="relative z-10">
                    <div className="text-3xl font-bold text-white mb-1">{count}</div>
                    <div className="text-sm text-white/80 capitalize font-medium">{rarity}</div>
                  </div>
                  <div className="absolute inset-0 bg-black/10" />
                </div>
              );
            })}
          </div>

          {/* Element distribution */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Elements</h3>
            <div className="flex flex-wrap gap-3">
              {elements.slice(1).map(({ value, icon }) => {
                const count = cards.filter(c => c.element === value).length;
                return (
                  <div
                    key={value}
                    className="flex items-center gap-2 glass-light rounded-full px-4 py-2"
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="text-white font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
