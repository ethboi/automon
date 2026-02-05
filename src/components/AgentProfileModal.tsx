'use client';

import { useEffect, useState } from 'react';

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

export default function AgentProfileModal({ address, onClose }: AgentProfileModalProps) {
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

            {/* Action History */}
            <div className="p-6 border-t border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
                Recent Activity
              </h3>

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
          </div>
        )}
      </div>
    </div>
  );
}
