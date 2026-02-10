'use client';

import { useState, useEffect, useCallback } from 'react';
import { BattleLog, BattleTurnLog, BattleEvent } from '@/lib/types';
import { AUTOMONS } from '@/lib/automons';
import { getCardArtDataUri } from '@/lib/cardArt';

function getCardImage(cardName: string, element?: string): string {
  const mon = AUTOMONS.find(a => a.name === cardName);
  return getCardArtDataUri(mon?.id ?? 1, element || mon?.element || 'fire', 'common');
}

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
      <div className="bg-gray-900/95 backdrop-blur border-b border-gray-700/50 px-3 py-2 sm:p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Title — hidden on mobile, just show turn counter */}
          <div className="hidden sm:block min-w-0">
            <h2 className="text-lg font-bold truncate">Battle Replay</h2>
            <p className="text-xs text-gray-400 truncate">
              {battleLog.player1.address.slice(0, 8)}… vs {battleLog.player2.address.slice(0, 8)}…
            </p>
          </div>
          <span className="sm:hidden text-xs text-gray-400 font-medium shrink-0">
            Turn {Math.max(0, currentTurnIndex + 1)}/{battleLog.turns.length}
          </span>

          {/* Playback controls — compact strip */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={restart}
              className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition text-sm sm:text-base"
              title="Restart"
            >
              ⏮️
            </button>

            <button
              onClick={togglePlay}
              className="px-3 py-1.5 sm:px-5 sm:py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            <button
              onClick={skipToEnd}
              className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition text-sm sm:text-base"
              title="Skip to end"
            >
              ⏭️
            </button>

            <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
              {([1, 2, 4] as PlaybackSpeed[]).map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium transition ${
                    playbackSpeed === speed
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <label className="hidden sm:flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showReasoning}
                onChange={e => setShowReasoning(e.target.checked)}
                className="rounded w-3.5 h-3.5"
              />
              AI
            </label>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg transition text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        <div className="max-w-4xl mx-auto">
          {/* Turn indicator */}
          <div className="text-center mb-3 sm:mb-6">
            <span className="bg-purple-600 px-3 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium">
              {currentTurnIndex === -1
                ? 'Battle Starting...'
                : `Turn ${currentTurnIndex + 1} / ${battleLog.turns.length}`
              }
            </span>
          </div>

          {/* Battle arena — always side by side */}
          {currentTurn && (
            <div className="grid grid-cols-2 gap-2 sm:gap-6 mb-3 sm:mb-8">
              {/* Player 1 */}
              <div className="bg-gray-800/50 rounded-xl p-2.5 sm:p-5">
                <div className="mb-2 sm:mb-4">
                  <p className="text-[10px] sm:text-sm text-gray-500">P1</p>
                  <p className="text-xs sm:text-base font-medium truncate">{battleLog.player1.address.slice(0, 8)}...</p>
                </div>

                <div className="text-center mb-2 sm:mb-4">
                  <div className="relative w-16 h-16 sm:w-28 sm:h-28 mx-auto mb-1 sm:mb-2">
                    <img src={getCardImage(currentTurn.player1.activeCard)} alt={currentTurn.player1.activeCard} className="w-full h-full rounded-lg sm:rounded-xl object-cover border-2 border-blue-500/50 shadow-lg shadow-blue-500/20" />
                    {currentTurn.triangleResult && (
                      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2">
                        {getTriangleDisplay(currentTurn.player1.action, currentTurn.triangleResult.player1Result)}
                      </div>
                    )}
                  </div>
                  <div className="text-sm sm:text-lg font-bold truncate">{currentTurn.player1.activeCard}</div>
                  <div className="w-full bg-gray-700 rounded-full h-2 sm:h-3 mt-1">
                    <div className="bg-green-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, (currentTurn.player1.cardHp / 150) * 100))}%` }} />
                  </div>
                  <div className="text-[10px] sm:text-sm text-gray-400 mt-0.5">
                    {currentTurn.player1.cardHp} HP · {currentTurn.player1.action}
                  </div>
                </div>

                {showReasoning && currentTurn.player1.reasoning && (
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-2 sm:p-3">
                    <p className="text-[10px] sm:text-sm text-gray-300">{currentTurn.player1.reasoning}</p>
                  </div>
                )}
              </div>

              {/* VS divider (hidden on mobile, implied by layout) */}

              {/* Player 2 */}
              <div className="bg-gray-800/50 rounded-xl p-2.5 sm:p-5">
                <div className="mb-2 sm:mb-4">
                  <p className="text-[10px] sm:text-sm text-gray-500">P2</p>
                  <p className="text-xs sm:text-base font-medium truncate">{battleLog.player2.address.slice(0, 8)}...</p>
                </div>

                <div className="text-center mb-2 sm:mb-4">
                  <div className="relative w-16 h-16 sm:w-28 sm:h-28 mx-auto mb-1 sm:mb-2">
                    <img src={getCardImage(currentTurn.player2.activeCard)} alt={currentTurn.player2.activeCard} className="w-full h-full rounded-lg sm:rounded-xl object-cover border-2 border-green-500/50 shadow-lg shadow-green-500/20" />
                    {currentTurn.triangleResult && (
                      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2">
                        {getTriangleDisplay(currentTurn.player2.action, currentTurn.triangleResult.player2Result)}
                      </div>
                    )}
                  </div>
                  <div className="text-sm sm:text-lg font-bold truncate">{currentTurn.player2.activeCard}</div>
                  <div className="w-full bg-gray-700 rounded-full h-2 sm:h-3 mt-1">
                    <div className="bg-green-500 h-2 sm:h-3 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, (currentTurn.player2.cardHp / 150) * 100))}%` }} />
                  </div>
                  <div className="text-[10px] sm:text-sm text-gray-400 mt-0.5">
                    {currentTurn.player2.cardHp} HP · {currentTurn.player2.action}
                  </div>
                </div>

                {showReasoning && currentTurn.player2.reasoning && (
                  <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-2 sm:p-3">
                    <p className="text-[10px] sm:text-sm text-gray-300">{currentTurn.player2.reasoning}</p>
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
            <div className="mt-4 sm:mt-8 text-center">
              <div className="inline-block bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl p-4 sm:p-8">
                <h2 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">🏆 Battle Complete!</h2>
                <p className="text-sm sm:text-xl">
                  Winner: {battleLog.winner.slice(0, 10)}...
                </p>
                <div className="mt-2 sm:mt-4 grid grid-cols-2 gap-4 sm:gap-8 text-xs sm:text-sm">
                  <div>
                    <p className="text-gray-300">P1 Damage</p>
                    <p className="text-lg sm:text-2xl font-bold">{battleLog.totalDamageDealt.player1}</p>
                  </div>
                  <div>
                    <p className="text-gray-300">P2 Damage</p>
                    <p className="text-lg sm:text-2xl font-bold">{battleLog.totalDamageDealt.player2}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-900 border-t border-gray-700 p-2 sm:p-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative h-1.5 sm:h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-purple-600 transition-all duration-300"
              style={{
                width: `${((currentTurnIndex + 1) / battleLog.turns.length) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-500">
            <span>Start</span>
            <span>💰 {battleLog.wager} MON</span>
            <span>End</span>
          </div>
        </div>
      </div>
    </div>
  );
}
