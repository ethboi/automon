'use client';

import { useEffect, useState } from 'react';
import AgentProfileModal from '@/components/AgentProfileModal';

interface WorldUIProps {
  nearbyBuilding: string | null;
  onEnterBuilding?: () => void;
}

interface Stats {
  totalCards: number;
  totalBattles: number;
  wins: number;
  losses: number;
}

interface OnlineAgent {
  address: string;
  name: string;
  isAI: boolean;
}

export function WorldUI({ nearbyBuilding, onEnterBuilding }: WorldUIProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monBalance, setMonBalance] = useState<string>('--');
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchBalance();
  }, []);

  // Fetch online agents periodically
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents/online');
        if (res.ok) {
          const data = await res.json();
          setOnlineAgents(data.agents || []);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const [cardsRes, battlesRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/battle/list?type=my'),
      ]);

      if (!cardsRes.ok || !battlesRes.ok) {
        setStats({ totalCards: 0, totalBattles: 0, wins: 0, losses: 0 });
        return;
      }

      const cardsData = await cardsRes.json();
      const battlesData = await battlesRes.json();

      const completeBattles = (battlesData.battles || []).filter(
        (b: { status: string }) => b.status === 'complete'
      );

      setStats({
        totalCards: cardsData.cards?.length || 0,
        totalBattles: completeBattles.length,
        wins: 0,
        losses: 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats({ totalCards: 0, totalBattles: 0, wins: 0, losses: 0 });
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/balance');
      if (!res.ok) {
        setMonBalance('--');
        return;
      }
      const data = await res.json();
      setMonBalance(data.balance || '0');
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setMonBalance('--');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && nearbyBuilding && onEnterBuilding) {
        onEnterBuilding();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearbyBuilding, onEnterBuilding]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top stats bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-4">
        {/* Stats pills */}
        <div className="flex flex-wrap gap-2 pointer-events-auto">
          {/* Balance */}
          <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-lg shadow-black/20">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
              <span className="text-base">💰</span>
            </div>
            <div>
              <div className="text-yellow-400 font-bold text-lg leading-tight">
                {parseFloat(monBalance).toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">MON</div>
            </div>
          </div>

          {stats && (
            <>
              {/* Cards */}
              <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-lg shadow-black/20">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-base">🎴</span>
                </div>
                <div>
                  <div className="text-purple-400 font-bold text-lg leading-tight">{stats.totalCards}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">Cards</div>
                </div>
              </div>

              {/* Win/Loss */}
              <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-lg shadow-black/20">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <span className="text-base">⚔️</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-lg leading-tight">
                    <span className="text-emerald-400">{stats.wins}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-red-400">{stats.losses}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">W/L</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controls hint */}
        <div className="glass rounded-xl px-4 py-3 shadow-lg shadow-black/20 hidden sm:block">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['W', 'A', 'S', 'D'].map((key) => (
                  <kbd key={key} className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold text-white border border-white/20">
                    {key}
                  </kbd>
                ))}
              </div>
              <span className="text-gray-400">Move</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 bg-white/10 rounded flex items-center justify-center border border-white/20">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.414 1.415l.708-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-400">Click</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="glass rounded-2xl p-3 shadow-lg shadow-black/30">
          <div className="relative w-36 h-36 rounded-xl overflow-hidden">
            {/* Map background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-green-900/50" />

            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '18px 18px'
              }}
            />

            {/* Path indicators */}
            <div className="absolute inset-0">
              <div className="absolute left-1/2 top-[30%] bottom-[20%] w-3 bg-gray-600/40 -translate-x-1/2 rounded-full" />
              <div className="absolute top-[65%] left-[20%] right-[20%] h-3 bg-gray-600/40 -translate-y-1/2 rounded-full" />
            </div>

            {/* Arena marker */}
            <div
              className="absolute w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{ left: '50%', top: '25%', transform: 'translate(-50%, -50%)' }}
              title="Battle Arena"
            >
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-30" />
              <div className="relative w-full h-full bg-gradient-to-br from-red-400 to-red-600 rounded-full border-2 border-white shadow-lg shadow-red-500/50 flex items-center justify-center">
                <span className="text-[8px]">⚔️</span>
              </div>
            </div>

            {/* Home marker */}
            <div
              className="absolute w-4 h-4 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
              style={{ left: '25%', top: '65%', transform: 'translate(-50%, -50%)' }}
              title="Collection"
            >
              <div className="relative w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg border-2 border-white shadow-lg shadow-blue-500/50 flex items-center justify-center">
                <span className="text-[8px]">🏠</span>
              </div>
            </div>

            {/* Bank marker */}
            <div
              className="absolute w-4 h-4 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
              style={{ left: '75%', top: '65%', transform: 'translate(-50%, -50%)' }}
              title="Shop"
            >
              <div className="relative w-full h-full bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg border-2 border-white shadow-lg shadow-yellow-500/50 flex items-center justify-center">
                <span className="text-[8px]">🏦</span>
              </div>
            </div>

            {/* Player position */}
            <div
              className="absolute w-3 h-3 rounded-full transition-transform"
              style={{ left: '50%', top: '75%', transform: 'translate(-50%, -50%)' }}
            >
              <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping" />
              <div className="relative w-full h-full bg-purple-500 rounded-full border-2 border-white shadow-lg" />
            </div>

            {/* Labels */}
            <div className="absolute text-[9px] text-white font-bold drop-shadow-lg" style={{ left: '50%', top: '12%', transform: 'translateX(-50%)' }}>
              Arena
            </div>
            <div className="absolute text-[8px] text-white font-medium drop-shadow-lg" style={{ left: '25%', top: '80%', transform: 'translateX(-50%)' }}>
              Home
            </div>
            <div className="absolute text-[8px] text-white font-medium drop-shadow-lg" style={{ left: '75%', top: '80%', transform: 'translateX(-50%)' }}>
              Shop
            </div>
          </div>
        </div>
      </div>

      {/* Online Agents Panel */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <div className="glass rounded-2xl p-3 shadow-lg shadow-black/30 min-w-[160px]">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
              Online ({onlineAgents.length})
            </span>
          </div>

          {onlineAgents.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-2">
              No agents online
            </div>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {onlineAgents.map((agent) => (
                <button
                  key={agent.address}
                  onClick={() => setSelectedAgent(agent.address)}
                  className="flex items-center gap-2 text-sm w-full hover:bg-white/10 rounded-lg p-1 -m-1 transition-colors"
                >
                  <span className="text-base">
                    {agent.isAI ? '🤖' : '👤'}
                  </span>
                  <span className={`${agent.isAI ? 'text-cyan-400' : 'text-purple-400'} hover:underline`}>
                    {agent.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interaction prompt */}
      {nearbyBuilding && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-auto animate-bounce-subtle">
          <button
            onClick={onEnterBuilding}
            className="relative group"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-purple-500/30 blur-xl rounded-2xl" />

            {/* Button */}
            <div className="relative glass-purple rounded-2xl px-8 py-4 flex items-center gap-4 border border-purple-500/30 shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 group-hover:scale-105">
              <div className="flex items-center gap-2">
                <kbd className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm font-bold text-white border border-purple-400 shadow-lg">
                  E
                </kbd>
                <span className="text-gray-400">or</span>
                <span className="text-white font-medium">Click</span>
              </div>

              <div className="w-px h-6 bg-white/20" />

              <span className="text-white font-semibold text-lg">
                Enter {nearbyBuilding}
              </span>

              <svg className="w-5 h-5 text-purple-300 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Agent Profile Modal */}
      {selectedAgent && (
        <AgentProfileModal
          address={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
