'use client';

import { useEffect, useState } from 'react';
import { Card as CardType, Element, Rarity } from '@/lib/types';
import Card from '@/components/Card';
import { useWallet } from '@/context/WalletContext';
import { AUTOMONS } from '@/lib/automons';
import { getCardArtDataUri } from '@/lib/cardArt';

const ELEMENT_ICONS: Record<string, string> = {
  fire: '🔥', water: '💧', earth: '🌍', air: '💨', dark: '🌑', light: '✨',
};

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ef4444', water: '#3b82f6', earth: '#84cc16', air: '#a78bfa', dark: '#6b21a8', light: '#fbbf24',
};

export default function CollectionPage() {
  const { address } = useWallet();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dex' | 'cards'>('dex');
  const [filter, setFilter] = useState<{ element: Element | 'all'; rarity: Rarity | 'all' }>({ element: 'all', rarity: 'all' });
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'attack' | 'defense'>('rarity');

  useEffect(() => {
    if (address) fetchCards();
    else setLoading(false);
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

  const rarityOrder: Record<Rarity, number> = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

  const filteredCards = cards
    .filter(card => filter.element === 'all' || card.element === filter.element)
    .filter(card => filter.rarity === 'all' || card.rarity === filter.rarity)
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'rarity': return rarityOrder[b.rarity] - rarityOrder[a.rarity];
        case 'attack': return b.stats.attack - a.stats.attack;
        case 'defense': return b.stats.defense - a.stats.defense;
        default: return 0;
      }
    });

  // Which automonIds does the player own?
  const ownedIds = new Set(cards.map(c => c.automonId));
  const discoveredCount = ownedIds.size;

  const elements: { value: Element | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '🌟' },
    { value: 'fire', label: 'Fire', icon: '🔥' },
    { value: 'water', label: 'Water', icon: '💧' },
    { value: 'earth', label: 'Earth', icon: '🌍' },
    { value: 'air', label: 'Air', icon: '💨' },
    { value: 'dark', label: 'Dark', icon: '🌑' },
    { value: 'light', label: 'Light', icon: '✨' },
  ];

  const rarities: { value: Rarity | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'legendary', label: 'Legendary' },
    { value: 'epic', label: 'Epic' },
    { value: 'rare', label: 'Rare' },
    { value: 'uncommon', label: 'Uncommon' },
    { value: 'common', label: 'Common' },
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
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-3 py-1 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-emerald-200 uppercase">Vault</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white via-emerald-100 to-cyan-100 bg-clip-text text-transparent">
              My Collection
            </h1>
          </div>
          {/* View toggle */}
          <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
            <button onClick={() => setView('dex')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view === 'dex' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              📖 Dex
            </button>
            <button onClick={() => setView('cards')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view === 'cards' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              🎴 Cards
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span><span className="text-white font-bold">{discoveredCount}</span>/{AUTOMONS.length} discovered</span>
          <span><span className="text-white font-bold">{cards.length}</span> cards owned</span>
          {cards.length > 0 && (
            <span className="text-yellow-400">{cards.filter(c => c.rarity === 'legendary').length} ✦ legendary</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${(discoveredCount / AUTOMONS.length) * 100}%` }}
          />
        </div>
      </div>

      {view === 'dex' ? (
        /* ═══ DEX VIEW ═══ */
        <div>
          {/* Group by element */}
          {(['fire', 'water', 'earth', 'air', 'dark', 'light'] as Element[]).map(element => {
            const monsOfElement = AUTOMONS.filter(m => m.element === element);
            if (monsOfElement.length === 0) return null;
            return (
              <div key={element} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{ELEMENT_ICONS[element]}</span>
                  <span className="text-sm font-bold text-white capitalize">{element}</span>
                  <span className="text-xs text-gray-500">
                    {monsOfElement.filter(m => ownedIds.has(m.id)).length}/{monsOfElement.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                  {monsOfElement.map((mon, idx) => {
                    const owned = ownedIds.has(mon.id);
                    const ownedCards = cards.filter(c => c.automonId === mon.id);
                    const bestRarity = ownedCards.length > 0
                      ? ownedCards.reduce((best, c) => rarityOrder[c.rarity] > rarityOrder[best.rarity] ? c : best).rarity
                      : null;

                    return (
                      <div
                        key={mon.id}
                        className={`
                          relative rounded-xl overflow-hidden border transition-all duration-300
                          animate-fade-in-up opacity-0
                          ${owned
                            ? 'border-white/15 hover:border-cyan-400/40 bg-gradient-to-b from-white/[0.06] to-transparent'
                            : 'border-white/5 bg-white/[0.02]'
                          }
                        `}
                        style={{ animationDelay: `${Math.min(idx * 0.05, 0.3)}s` }}
                      >
                        {/* Card art or silhouette */}
                        <div className="relative aspect-square">
                          <img
                            src={getCardArtDataUri(mon.id, mon.element, bestRarity || 'common')}
                            alt={owned ? mon.name : '???'}
                            className={`w-full h-full object-cover ${owned ? '' : 'brightness-0 opacity-20'}`}
                          />
                          {/* Element color strip */}
                          <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: ELEMENT_COLORS[element] }} />

                          {/* Number badge */}
                          <div className="absolute top-2 left-2 bg-black/60 rounded-full px-1.5 py-0.5 text-[10px] font-mono text-gray-300">
                            #{String(mon.id).padStart(2, '0')}
                          </div>

                          {/* Owned count */}
                          {ownedCards.length > 1 && (
                            <div className="absolute top-2 right-2 bg-cyan-500/80 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white">
                              ×{ownedCards.length}
                            </div>
                          )}

                          {/* Best rarity badge */}
                          {bestRarity && bestRarity !== 'common' && (
                            <div className={`absolute bottom-2 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider
                              ${bestRarity === 'legendary' ? 'bg-yellow-500/80 text-black' :
                                bestRarity === 'epic' ? 'bg-purple-500/80 text-white' :
                                bestRarity === 'rare' ? 'bg-blue-500/80 text-white' :
                                'bg-emerald-500/80 text-white'}`}
                            >
                              {bestRarity}
                            </div>
                          )}

                          {/* Question mark for undiscovered */}
                          {!owned && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-4xl text-white/10 font-black">?</span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-2">
                          <div className="text-xs font-bold text-white truncate">
                            {owned ? mon.name : '???'}
                          </div>
                          {owned ? (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] text-gray-500">⚔️{mon.baseAttack}</span>
                              <span className="text-[10px] text-gray-500">🛡️{mon.baseDefense}</span>
                              <span className="text-[10px] text-gray-500">💨{mon.baseSpeed}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-600 mt-1">Not discovered</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ═══ CARDS VIEW ═══ */
        <div>
          {/* Filters */}
          <div className="section-card mb-4 border border-cyan-400/15 bg-gradient-to-br from-cyan-950/20 via-transparent to-emerald-950/20">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1">Element</label>
                <select value={filter.element} onChange={e => setFilter(f => ({ ...f, element: e.target.value as Element | 'all' }))} className="select-field w-full text-xs">
                  {elements.map(el => <option key={el.value} value={el.value}>{el.icon} {el.label}</option>)}
                </select>
              </div>
              <div className="min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1">Rarity</label>
                <select value={filter.rarity} onChange={e => setFilter(f => ({ ...f, rarity: e.target.value as Rarity | 'all' }))} className="select-field w-full text-xs">
                  {rarities.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1">Sort</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="select-field w-full text-xs">
                  <option value="rarity">Rarity</option>
                  <option value="name">Name</option>
                  <option value="attack">Attack</option>
                  <option value="defense">Defense</option>
                </select>
              </div>
              <div className="flex items-center gap-2 glass-light border border-white/10 rounded-xl px-3 py-2">
                <span className="text-lg">🎴</span>
                <span className="text-sm text-white font-semibold">{filteredCards.length}</span>
                <span className="text-xs text-gray-400">/ {cards.length}</span>
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
                {cards.length === 0 ? 'Start your collection by purchasing card packs from the shop.' : 'Try adjusting your filters.'}
              </p>
              {cards.length === 0 && (
                <a href="/shop" className="btn-primary inline-block">
                  <span className="flex items-center gap-2">🛒 Visit Shop</span>
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
              {filteredCards.map((card, index) => (
                <div
                  key={card._id?.toString() || card.id || index}
                  className="animate-fade-in-up opacity-0 rounded-xl p-1 bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/10 hover:border-cyan-300/40 transition-colors"
                  style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
                >
                  <Card card={card} size="md" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collection stats */}
      {cards.length > 0 && (
        <div className="section-card mt-6 border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-xl">📊</span> Collection Stats
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {(['common', 'uncommon', 'rare', 'epic', 'legendary'] as Rarity[]).map((rarity, index) => {
              const count = cards.filter(c => c.rarity === rarity).length;
              const colors: Record<string, string> = {
                common: 'from-gray-600 to-gray-500',
                uncommon: 'from-emerald-600 to-emerald-500',
                rare: 'from-blue-600 to-blue-500',
                epic: 'from-purple-600 to-purple-500',
                legendary: 'from-yellow-500 to-amber-500',
              };
              return (
                <div key={rarity}
                  className={`rounded-xl p-2 sm:p-3 text-center bg-gradient-to-br ${colors[rarity]} animate-fade-in-up opacity-0`}
                  style={{ animationDelay: `${0.1 + index * 0.1}s` }}
                >
                  <div className="text-lg sm:text-2xl font-bold text-white">{count}</div>
                  <div className="text-[10px] sm:text-xs text-white/80 capitalize">{rarity}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex flex-wrap gap-2">
              {(['fire', 'water', 'earth', 'air', 'dark', 'light'] as Element[]).map(el => {
                const count = cards.filter(c => c.element === el).length;
                return (
                  <div key={el} className="flex items-center gap-1.5 glass-light rounded-full px-3 py-1.5">
                    <span>{ELEMENT_ICONS[el]}</span>
                    <span className="text-sm text-white font-semibold">{count}</span>
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
