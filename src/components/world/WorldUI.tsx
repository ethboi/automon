'use client';

import { useEffect, useState } from 'react';

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

export function WorldUI({ nearbyBuilding, onEnterBuilding }: WorldUIProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monBalance, setMonBalance] = useState<string>('--');

  useEffect(() => {
    fetchStats();
    fetchBalance();
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

  // Handle keyboard input for entering buildings
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
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        {/* Stats */}
        <div className="flex gap-3 pointer-events-auto">
          <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700">
            <div className="text-yellow-400 font-bold text-lg">
              {parseFloat(monBalance).toFixed(2)} MON
            </div>
          </div>
          {stats && (
            <>
              <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700">
                <div className="text-purple-400 font-bold">{stats.totalCards} Cards</div>
              </div>
              <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700">
                <div className="text-green-400 font-bold">{stats.wins}W / {stats.losses}L</div>
              </div>
            </>
          )}
        </div>

        {/* Controls hint */}
        <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">
            <span className="text-white font-bold">WASD</span> or <span className="text-white font-bold">Click</span> to move
          </div>
        </div>
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="bg-gray-900/80 backdrop-blur-sm p-2 rounded-lg border border-gray-700">
          <div className="relative w-32 h-32 bg-gray-800 rounded">
            {/* Map background */}
            <div className="absolute inset-2 bg-green-900/50 rounded" />

            {/* Arena marker */}
            <div
              className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white"
              style={{ left: '50%', top: '25%', transform: 'translate(-50%, -50%)' }}
              title="Battle Arena"
            />

            {/* Home marker */}
            <div
              className="absolute w-3 h-3 bg-blue-500 rounded border-2 border-white"
              style={{ left: '25%', top: '65%', transform: 'translate(-50%, -50%)' }}
              title="Collection"
            />

            {/* Bank marker */}
            <div
              className="absolute w-3 h-3 bg-yellow-500 rounded border-2 border-white"
              style={{ left: '75%', top: '65%', transform: 'translate(-50%, -50%)' }}
              title="Shop"
            />

            {/* Player position indicator */}
            <div
              className="absolute w-2 h-2 bg-purple-500 rounded-full border border-white animate-pulse"
              style={{ left: '50%', top: '75%', transform: 'translate(-50%, -50%)' }}
            />

            {/* Labels */}
            <div className="absolute text-[8px] text-white font-bold" style={{ left: '50%', top: '15%', transform: 'translateX(-50%)' }}>
              Arena
            </div>
            <div className="absolute text-[8px] text-white font-bold" style={{ left: '15%', top: '75%' }}>
              Home
            </div>
            <div className="absolute text-[8px] text-white font-bold" style={{ right: '10%', top: '75%' }}>
              Shop
            </div>
          </div>
        </div>
      </div>

      {/* Interaction prompt */}
      {nearbyBuilding && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
          <button
            onClick={onEnterBuilding}
            className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg font-bold text-lg shadow-lg border-2 border-purple-400 animate-pulse"
          >
            Press <span className="bg-purple-800 px-2 py-1 rounded mx-1">E</span> or Click to Enter {nearbyBuilding}
          </button>
        </div>
      )}

    </div>
  );
}
