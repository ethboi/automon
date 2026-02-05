'use client';

import { useEffect, useState } from 'react';

interface CardInfo {
  id: string;
  tokenId?: number;
  automonId?: number;
  name: string;
  element: string;
  rarity: string;
  stats?: {
    attack: number;
    defense: number;
    speed: number;
    hp: number;
  };
  ability?: {
    name: string;
    effect: string;
  };
}

interface AgentDetails {
  agent: {
    address: string;
    name: string;
    personality: string;
    isAI: boolean;
    position: { x: number; y: number; z: number };
    lastSeen: string;
    createdAt?: string;
  };
  stats: {
    balance: string;
    cards: number;
    battles: number;
    wins: number;
    losses: number;
    winRate: number;
  };
  cards: CardInfo[];
  actions: Array<{
    action: string;
    reason: string;
    timestamp: string;
    location?: string;
  }>;
}

interface AgentProfileModalProps {
  address: string;
  onClose: () => void;
}

const ELEMENT_COLORS: Record<string, string> = {
  fire: 'from-red-500 to-orange-500',
  water: 'from-blue-500 to-cyan-500',
  earth: 'from-amber-600 to-yellow-700',
  air: 'from-gray-300 to-blue-200',
  dark: 'from-purple-800 to-gray-800',
  light: 'from-yellow-300 to-amber-200',
};

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400 border-gray-500',
  uncommon: 'text-green-400 border-green-500',
  rare: 'text-blue-400 border-blue-500',
  epic: 'text-purple-400 border-purple-500',
  legendary: 'text-yellow-400 border-yellow-500',
};

export default function AgentProfileModal({ address, onClose }: AgentProfileModalProps) {
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'activity'>('cards');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/agents/${address}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setDetails(data);
      } catch (err) {
        setError('Failed to load agent details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [address]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/30">
                🤖
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {loading ? 'Loading...' : details?.agent.name || 'Unknown Agent'}
                </h2>
                <p className="text-sm text-gray-400 font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin text-4xl">🔄</div>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">{error}</div>
        ) : details && (
          <div className="overflow-y-auto max-h-[calc(80vh-100px)]">
            {/* Stats Grid */}
            <div className="p-6 grid grid-cols-3 gap-4">
              <div className="glass-light rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {parseFloat(details.stats.balance).toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">MON</div>
              </div>
              <div className="glass-light rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {details.stats.cards}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">Cards</div>
              </div>
              <div className="glass-light rounded-xl p-4 text-center">
                <div className="text-2xl font-bold">
                  <span className="text-emerald-400">{details.stats.wins}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-red-400">{details.stats.losses}</span>
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">W/L</div>
              </div>
            </div>

            {/* Win Rate Bar */}
            {details.stats.battles > 0 && (
              <div className="px-6 pb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="text-white font-medium">{details.stats.winRate}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${details.stats.winRate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="px-6 pt-4 border-t border-white/10">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('cards')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'cards'
                      ? 'bg-purple-500/30 text-purple-300'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  🎴 Cards ({details.cards.length})
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'activity'
                      ? 'bg-cyan-500/30 text-cyan-300'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  📝 Activity
                </button>
              </div>
            </div>

            {/* Cards Tab */}
            {activeTab === 'cards' && (
              <div className="p-6">
                {details.cards.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">🎴</div>
                    <p>No cards yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {details.cards.map((card) => (
                      <div
                        key={card.id}
                        className={`rounded-xl p-3 bg-gradient-to-br ${ELEMENT_COLORS[card.element] || 'from-gray-600 to-gray-800'} bg-opacity-20 border ${RARITY_COLORS[card.rarity]?.split(' ')[1] || 'border-gray-600'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold uppercase ${RARITY_COLORS[card.rarity]?.split(' ')[0] || 'text-gray-400'}`}>
                            {card.rarity}
                          </span>
                          {card.tokenId && (
                            <span className="text-xs text-gray-400">#{card.tokenId}</span>
                          )}
                        </div>
                        <div className="text-white font-bold truncate">{card.name}</div>
                        <div className="text-xs text-gray-300 capitalize mb-2">{card.element}</div>
                        {card.stats && (
                          <div className="grid grid-cols-4 gap-1 text-xs">
                            <div className="text-center">
                              <div className="text-red-400 font-bold">{card.stats.attack}</div>
                              <div className="text-gray-500">ATK</div>
                            </div>
                            <div className="text-center">
                              <div className="text-blue-400 font-bold">{card.stats.defense}</div>
                              <div className="text-gray-500">DEF</div>
                            </div>
                            <div className="text-center">
                              <div className="text-green-400 font-bold">{card.stats.speed}</div>
                              <div className="text-gray-500">SPD</div>
                            </div>
                            <div className="text-center">
                              <div className="text-pink-400 font-bold">{card.stats.hp}</div>
                              <div className="text-gray-500">HP</div>
                            </div>
                          </div>
                        )}
                        {card.ability && (
                          <div className="mt-2 text-xs text-yellow-300">
                            ⚡ {card.ability.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="p-6">
                {details.actions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">📝</div>
                    <p>No activity recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {details.actions.map((action, index) => (
                      <div
                        key={index}
                        className="glass-light rounded-xl p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{action.action}</p>
                            {action.reason && (
                              <p className="text-sm text-gray-400 mt-1">{action.reason}</p>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            <div>{formatTime(action.timestamp)}</div>
                            <div>{formatDate(action.timestamp)}</div>
                          </div>
                        </div>
                        {action.location && (
                          <div className="mt-2 text-xs text-cyan-400">
                            📍 {action.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
