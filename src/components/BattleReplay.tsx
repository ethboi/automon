'use client';

import { useState, useEffect, useCallback } from 'react';
import { BattleLog, BattleTurnLog, BattleEvent } from '@/lib/types';

interface BattleReplayProps {
  battleLog: BattleLog;
  onClose?: () => void;
}

type PlaybackSpeed = 1 | 2 | 4;

export default function BattleReplay({ battleLog, onClose }: BattleReplayProps) {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(-1); // -1 = intro
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [showReasoning, setShowReasoning] = useState(true);

  const currentTurn: BattleTurnLog | null = currentTurnIndex >= 0 && currentTurnIndex < battleLog.turns.length
    ? battleLog.turns[currentTurnIndex]
    : null;

  const currentEvents: BattleEvent[] = currentTurn?.events.slice(0, currentEventIndex + 1) || [];

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying) return;

    const delay = 2000 / playbackSpeed;

    const timer = setTimeout(() => {
      if (currentTurnIndex === -1) {
        // Start with turn 0
        setCurrentTurnIndex(0);
        setCurrentEventIndex(0);
      } else if (currentTurn) {
        if (currentEventIndex < currentTurn.events.length - 1) {
          // More events in this turn
          setCurrentEventIndex(prev => prev + 1);
        } else if (currentTurnIndex < battleLog.turns.length - 1) {
          // Move to next turn
          setCurrentTurnIndex(prev => prev + 1);
          setCurrentEventIndex(0);
        } else {
          // Battle finished
          setIsPlaying(false);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isPlaying, currentTurnIndex, currentEventIndex, currentTurn, battleLog.turns.length, playbackSpeed]);

  const skipToEnd = useCallback(() => {
    setCurrentTurnIndex(battleLog.turns.length - 1);
    const lastTurn = battleLog.turns[battleLog.turns.length - 1];
    setCurrentEventIndex(lastTurn.events.length - 1);
    setIsPlaying(false);
  }, [battleLog.turns]);

  const restart = useCallback(() => {
    setCurrentTurnIndex(-1);
    setCurrentEventIndex(0);
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (currentTurnIndex === -1) {
      setCurrentTurnIndex(0);
      setCurrentEventIndex(0);
    }
    setIsPlaying(prev => !prev);
  }, [currentTurnIndex]);

  // Get action triangle result display
  const getTriangleDisplay = (action: string, result: 'win' | 'lose' | 'neutral') => {
    const colors = {
      win: 'text-green-400 bg-green-900/30',
      lose: 'text-red-400 bg-red-900/30',
      neutral: 'text-yellow-400 bg-yellow-900/30',
    };

    const icons = {
      strike: '⚔️',
      skill: '✨',
      guard: '🛡️',
      switch: '🔄',
    };

    return (
      <div className={`px-3 py-1 rounded-full text-sm font-medium ${colors[result]}`}>
        {icons[action as keyof typeof icons] || '?'} {action.toUpperCase()}
      </div>
    );
  };

  // Get event type color
  const getEventColor = (type: string) => {
    switch (type) {
      case 'damage': return 'text-red-400';
      case 'heal': return 'text-green-400';
      case 'faint': return 'text-gray-400';
      case 'element_advantage': return 'text-yellow-400';
      case 'triangle_result': return 'text-purple-400';
      case 'interrupt': return 'text-orange-400';
      case 'guard_counter': return 'text-blue-400';
      case 'skill_pierce': return 'text-pink-400';
      case 'status_applied': return 'text-cyan-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Battle Replay</h2>
            <p className="text-sm text-gray-400">
              {battleLog.player1.address.slice(0, 8)}... vs {battleLog.player2.address.slice(0, 8)}...
            </p>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={restart}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Restart"
            >
              ⏮️
            </button>

            <button
              onClick={togglePlay}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>

            <button
              onClick={skipToEnd}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Skip to end"
            >
              ⏭️
            </button>

            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
              {([1, 2, 4] as PlaybackSpeed[]).map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-3 py-1 rounded text-sm transition ${
                    playbackSpeed === speed
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showReasoning}
                onChange={e => setShowReasoning(e.target.checked)}
                className="rounded"
              />
              Show AI Reasoning
            </label>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto">
          {/* Turn indicator */}
          <div className="text-center mb-6">
            <span className="bg-purple-600 px-4 py-2 rounded-full text-sm font-medium">
              {currentTurnIndex === -1
                ? 'Battle Starting...'
                : `Turn ${currentTurnIndex + 1} of ${battleLog.turns.length}`
              }
            </span>
          </div>

          {/* Battle arena */}
          {currentTurn && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Player 1 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Player 1 (AI)</p>
                    <p className="font-medium">{battleLog.player1.address.slice(0, 10)}...</p>
                  </div>
                  {currentTurn.triangleResult && (
                    getTriangleDisplay(currentTurn.player1.action, currentTurn.triangleResult.player1Result)
                  )}
                </div>

                <div className="text-center mb-4">
                  <div className="text-lg font-bold">{currentTurn.player1.activeCard}</div>
                  <div className="text-sm text-gray-400">
                    HP: {currentTurn.player1.cardHp}
                  </div>
                </div>

                {showReasoning && currentTurn.player1.reasoning && (
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mt-4">
                    <p className="text-xs text-blue-400 mb-1">AI Reasoning:</p>
                    <p className="text-sm text-gray-300">{currentTurn.player1.reasoning}</p>
                    {currentTurn.player1.prediction && (
                      <p className="text-xs text-gray-500 mt-2">
                        Predicted: {currentTurn.player1.prediction}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Player 2 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Player 2 (AI)</p>
                    <p className="font-medium">{battleLog.player2.address.slice(0, 10)}...</p>
                  </div>
                  {currentTurn.triangleResult && (
                    getTriangleDisplay(currentTurn.player2.action, currentTurn.triangleResult.player2Result)
                  )}
                </div>

                <div className="text-center mb-4">
                  <div className="text-lg font-bold">{currentTurn.player2.activeCard}</div>
                  <div className="text-sm text-gray-400">
                    HP: {currentTurn.player2.cardHp}
                  </div>
                </div>

                {showReasoning && currentTurn.player2.reasoning && (
                  <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 mt-4">
                    <p className="text-xs text-green-400 mb-1">AI Reasoning:</p>
                    <p className="text-sm text-gray-300">{currentTurn.player2.reasoning}</p>
                    {currentTurn.player2.prediction && (
                      <p className="text-xs text-gray-500 mt-2">
                        Predicted: {currentTurn.player2.prediction}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event log for current turn */}
          <div className="bg-gray-800/30 rounded-xl p-4">
            <h3 className="text-lg font-medium mb-3">Battle Events</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {currentEvents.map((event, index) => (
                <div
                  key={index}
                  className={`text-sm p-2 rounded ${getEventColor(event.type)} bg-gray-900/50 animate-fade-in`}
                >
                  {event.message}
                </div>
              ))}
            </div>
          </div>

          {/* Battle result (if complete) */}
          {currentTurnIndex === battleLog.turns.length - 1 && !isPlaying && (
            <div className="mt-8 text-center">
              <div className="inline-block bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl p-8">
                <h2 className="text-3xl font-bold mb-2">Battle Complete!</h2>
                <p className="text-xl">
                  Winner: {battleLog.winner.slice(0, 10)}...
                </p>
                <div className="mt-4 grid grid-cols-2 gap-8 text-sm">
                  <div>
                    <p className="text-gray-300">Player 1 Damage</p>
                    <p className="text-2xl font-bold">{battleLog.totalDamageDealt.player1}</p>
                  </div>
                  <div>
                    <p className="text-gray-300">Player 2 Damage</p>
                    <p className="text-2xl font-bold">{battleLog.totalDamageDealt.player2}</p>
                  </div>
                </div>
                <p className="text-gray-400 mt-4">
                  Duration: {(battleLog.duration / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-900 border-t border-gray-700 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-purple-600 transition-all duration-300"
              style={{
                width: `${((currentTurnIndex + 1) / battleLog.turns.length) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Start</span>
            <span>Wager: {battleLog.wager} MON</span>
            <span>End</span>
          </div>
        </div>
      </div>
    </div>
  );
}
