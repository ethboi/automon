'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useRouter } from 'next/navigation';
import { Battle, Card as CardType, AgentDecision } from '@/lib/types';

interface AgentLog {
  timestamp: Date;
  type: 'decision' | 'action' | 'info' | 'error';
  message: string;
  decision?: AgentDecision;
}

export default function AgentPage() {
  const { address, isAuthenticated, balance } = useWallet();
  const router = useRouter();
  const [autoMode, setAutoMode] = useState(false);
  const [cards, setCards] = useState<CardType[]>([]);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (autoMode && activeBattle?.status === 'active') {
      const interval = setInterval(() => runAgentTurn(), 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, activeBattle]);

  const addLog = (type: AgentLog['type'], message: string, decision?: AgentDecision) => {
    setLogs(prev => [
      { timestamp: new Date(), type, message, decision },
      ...prev.slice(0, 49),
    ]);
  };

  const fetchData = async () => {
    try {
      const [cardsRes, battlesRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/battle/list?type=my'),
      ]);

      const cardsData = await cardsRes.json();
      const battlesData = await battlesRes.json();

      setCards(cardsData.cards || []);

      const active = (battlesData.battles || []).find(
        (b: Battle) => b.status === 'active'
      );
      setActiveBattle(active || null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      addLog('error', 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const runAgentTurn = async () => {
    if (!activeBattle || processing) return;
    setProcessing(true);

    try {
      addLog('info', 'Analyzing battle state...');

      const res = await fetch('/api/agent/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId: activeBattle.battleId }),
      });

      if (!res.ok) {
        throw new Error('Failed to get AI decision');
      }

      const { decision } = await res.json();
      addLog('decision', `AI chose: ${decision.action}`, decision);

      // Submit the move
      const moveRes = await fetch('/api/battle/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId: activeBattle.battleId,
          move: { action: decision.action, targetIndex: decision.targetIndex },
        }),
      });

      if (!moveRes.ok) {
        throw new Error('Failed to submit move');
      }

      const { battle } = await moveRes.json();
      setActiveBattle(battle);

      if (battle.status === 'complete') {
        const won = battle.winner?.toLowerCase() === address?.toLowerCase();
        addLog('info', won ? 'Victory!' : 'Defeat');
        setAutoMode(false);
      } else {
        addLog('action', 'Move submitted, waiting for opponent...');
      }
    } catch (error) {
      addLog('error', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const runFullAutoBattle = async () => {
    if (!activeBattle) return;
    setProcessing(true);

    try {
      addLog('info', 'Starting full auto battle...');

      const res = await fetch('/api/agent/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId: activeBattle.battleId }),
      });

      if (!res.ok) {
        throw new Error('Auto battle failed');
      }

      const { battle, decisions } = await res.json();

      for (const decision of decisions) {
        addLog('decision', `Turn ${decision.turn}: ${decision.action}`, decision);
      }

      setActiveBattle(battle);

      if (battle.status === 'complete') {
        const won = battle.winner?.toLowerCase() === address?.toLowerCase();
        addLog('info', won ? 'Victory!' : 'Defeat');
      }
    } catch (error) {
      addLog('error', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const getPackDecision = async () => {
    setProcessing(true);
    try {
      addLog('info', 'Asking AI about buying packs...');

      const res = await fetch('/api/agent/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pack',
          balance: balance || '0',
          cardCount: cards.length,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get pack decision');
      }

      const { decision } = await res.json();
      addLog(
        'decision',
        `Should buy pack: ${decision.shouldBuy ? 'Yes' : 'No'} - ${decision.reason}`
      );
    } catch (error) {
      addLog('error', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading AI Agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">AI Agent</h1>
      <p className="text-gray-400 mb-8">
        Let Claude AI make strategic decisions for you
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          {/* Auto mode toggle */}
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Auto-Play Mode</h2>
                <p className="text-sm text-gray-400">
                  AI plays your battles automatically
                </p>
              </div>
              <button
                onClick={() => setAutoMode(!autoMode)}
                disabled={!activeBattle}
                className={`relative w-14 h-8 rounded-full transition ${
                  autoMode ? 'bg-green-500' : 'bg-gray-600'
                } ${!activeBattle ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    autoMode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {!activeBattle && (
              <p className="text-yellow-400 text-sm">
                No active battle. Start a battle first!
              </p>
            )}
          </div>

          {/* Manual actions */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Manual Actions</h2>

            <div className="space-y-3">
              <button
                onClick={runAgentTurn}
                disabled={!activeBattle || processing || autoMode}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition"
              >
                {processing ? 'Processing...' : 'AI Make One Move'}
              </button>

              <button
                onClick={runFullAutoBattle}
                disabled={!activeBattle || processing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition"
              >
                AI Play Full Battle
              </button>

              <button
                onClick={getPackDecision}
                disabled={processing}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition"
              >
                Ask AI: Should I Buy Packs?
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cards Owned</span>
                <span>{cards.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Battle</span>
                <span className={activeBattle ? 'text-green-400' : 'text-gray-500'}>
                  {activeBattle ? 'Yes' : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Auto Mode</span>
                <span className={autoMode ? 'text-green-400' : 'text-gray-500'}>
                  {autoMode ? 'Active' : 'Off'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Decision log */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Decision Log</h2>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🤖</div>
              <p>No decisions yet. Run an action to see AI reasoning.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-sm ${
                    log.type === 'decision'
                      ? 'bg-purple-500/20 border border-purple-500/30'
                      : log.type === 'error'
                      ? 'bg-red-500/20 border border-red-500/30'
                      : log.type === 'action'
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium ${
                        log.type === 'decision'
                          ? 'text-purple-400'
                          : log.type === 'error'
                          ? 'text-red-400'
                          : log.type === 'action'
                          ? 'text-blue-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {log.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p>{log.message}</p>
                  {log.decision?.reasoning && (
                    <p className="text-xs text-gray-400 mt-1 italic">
                      Reasoning: {log.decision.reasoning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
