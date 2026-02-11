'use client';

import { useState, useEffect } from 'react';
import { Battle, BattleMove, BattleEvent } from '@/lib/types';
import { useWallet } from '@/context/WalletContext';
import Card from './Card';

interface BattleArenaProps {
  battle: Battle;
  onMove: (move: BattleMove) => Promise<void>;
  onAIDecide?: () => Promise<BattleMove>;
}

export default function BattleArena({ battle, onMove, onAIDecide }: BattleArenaProps) {
  const { address } = useWallet();
  const [selectedMove, setSelectedMove] = useState<BattleMove | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [showAIThinking, setShowAIThinking] = useState(false);

  const isPlayer1 = battle.player1.address.toLowerCase() === address?.toLowerCase();
  const isPlayer2 = battle.player2?.address.toLowerCase() === address?.toLowerCase();
  const isParticipant = !!address && (isPlayer1 || isPlayer2);
  const perspectiveIsPlayer1 = isParticipant ? isPlayer1 : true;
  const myState = perspectiveIsPlayer1 ? battle.player1 : battle.player2!;
  const opponentState = perspectiveIsPlayer1 ? battle.player2! : battle.player1;

  const myActiveCard = myState?.cards?.[myState?.activeCardIndex ?? 0];
  const opponentActiveCard = opponentState?.cards?.[opponentState?.activeCardIndex ?? 0];

  // Guard: if cards not loaded yet, show loading state
  if (!myActiveCard || !opponentActiveCard) {
    return (
      <div className="section-card text-center py-12">
        <div className="spinner mb-4 mx-auto" />
        <p className="text-gray-400">Waiting for battle to start...</p>
        <p className="text-xs text-gray-600 mt-2">Both players need to select cards</p>
      </div>
    );
  }

  const currentRound = battle.rounds.find(r => r.turn === battle.currentTurn);
  const hasSubmittedMove = isParticipant && currentRound && (isPlayer1 ? currentRound.player1Move : currentRound.player2Move);

  useEffect(() => {
    if (battle.rounds.length > 0) {
      const lastRound = battle.rounds[battle.rounds.length - 1];
      if (lastRound.events.length > 0) {
        setEvents(lastRound.events);
      }
    }
  }, [battle.rounds]);

  const handleSubmitMove = async () => {
    if (!selectedMove || isSubmitting || !isParticipant) return;

    setIsSubmitting(true);
    try {
      await onMove(selectedMove);
      setSelectedMove(null);
    } catch (error) {
      console.error('Failed to submit move:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAIMove = async () => {
    if (!onAIDecide || isSubmitting || !isParticipant) return;

    setShowAIThinking(true);
    setIsSubmitting(true);
    try {
      const decision = await onAIDecide();
      setSelectedMove(decision);
    } catch (error) {
      console.error('AI decision failed:', error);
    } finally {
      setShowAIThinking(false);
      setIsSubmitting(false);
    }
  };

  if (battle.status === 'complete') {
    const isWinner = battle.winner?.toLowerCase() === address?.toLowerCase();
    return (
      <div className="text-center py-8 sm:py-12">
        <h2 className={`text-2xl sm:text-4xl font-bold mb-2 sm:mb-4 ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
          {isWinner ? '🏆 Victory!' : '💀 Defeat'}
        </h2>
        <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-8">
          Winner: {battle.winner?.slice(0, 6)}...{battle.winner?.slice(-4)}
        </p>
        {battle.settleTxHash && (
          <p className="text-sm text-gray-500">
            Settlement TX: {battle.settleTxHash.slice(0, 10)}...
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Turn indicator */}
      <div className="text-center mb-3 sm:mb-6">
        <span className="bg-purple-600 px-3 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium">
          Turn {battle.currentTurn}
        </span>
        {hasSubmittedMove && (
          <span className="ml-2 sm:ml-4 text-yellow-400 text-xs sm:text-sm">
            Waiting for opponent...
          </span>
        )}
      </div>

        {/* Battle field — side by side */}
      <div className="grid grid-cols-2 gap-2 sm:gap-6 mb-4 sm:mb-8">
        {/* Opponent side */}
        <div className="text-center">
          <p className="text-[10px] sm:text-sm text-gray-400 mb-1 sm:mb-2 truncate">
            {opponentState.address.slice(0, 6)}...{opponentState.address.slice(-4)}
          </p>
          <Card card={opponentActiveCard} size="sm" />
        </div>

        {/* Your side */}
        <div className="text-center">
          <p className="text-[10px] sm:text-sm text-cyan-400 mb-1 sm:mb-2">{isParticipant ? 'You' : 'Spectator View'}</p>
          <Card card={myActiveCard} size="sm" />
        </div>
      </div>

      {/* Your bench */}
      <div className="mb-4 sm:mb-8">
        <h3 className="text-sm sm:text-lg font-medium text-gray-300 mb-2 sm:mb-3">Your Bench</h3>
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1">
          {myState.cards.map((card, index) => (
            <div
              key={index}
              className={`${index === myState.activeCardIndex ? 'opacity-50' : ''}`}
            >
              <Card
                card={card}
                size="sm"
                selected={selectedMove?.action === 'switch' && selectedMove.targetIndex === index}
                onClick={() => {
                  if (index !== myState.activeCardIndex && card.currentHp > 0) {
                    setSelectedMove({ action: 'switch', targetIndex: index });
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {isParticipant && !hasSubmittedMove && (
        <div className="bg-gray-800 rounded-xl p-3 sm:p-6">
          <h3 className="text-sm sm:text-lg font-medium mb-2 sm:mb-4">Choose Action</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {/* STRIKE - beats SKILL */}
            <button
              onClick={() => setSelectedMove({ action: 'strike' })}
              className={`p-2 sm:p-4 rounded-lg border-2 transition ${
                selectedMove?.action === 'strike'
                  ? 'border-red-500 bg-red-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <span className="text-lg sm:text-2xl mb-1 sm:mb-2 block">⚔️</span>
              <span className="font-medium">Strike</span>
              <span className="text-[10px] sm:text-xs text-gray-400 block">Beats SKILL</span>
              <span className="text-[10px] sm:text-xs text-red-400 hidden sm:block">Loses to GUARD</span>
            </button>

            {/* SKILL - beats GUARD */}
            <button
              onClick={() => setSelectedMove({ action: 'skill' })}
              disabled={myActiveCard?.ability?.currentCooldown !== undefined && myActiveCard?.ability?.currentCooldown > 0}
              className={`p-2 sm:p-4 rounded-lg border-2 transition ${
                selectedMove?.action === 'skill'
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              } ${myActiveCard?.ability?.currentCooldown ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-lg sm:text-2xl mb-1 sm:mb-2 block">✨</span>
              <span className="text-xs sm:text-sm font-medium truncate block">{myActiveCard?.ability?.name || "Attack"}</span>
              <span className="text-[10px] sm:text-xs text-gray-400 block">
                {myActiveCard?.ability?.currentCooldown
                  ? `Cooldown: ${myActiveCard?.ability?.currentCooldown}`
                  : 'Beats GUARD'}
              </span>
              <span className="text-[10px] sm:text-xs text-red-400 hidden sm:block">Loses to STRIKE</span>
            </button>

            {/* GUARD - beats STRIKE */}
            <button
              onClick={() => setSelectedMove({ action: 'guard' })}
              className={`p-2 sm:p-4 rounded-lg border-2 transition ${
                selectedMove?.action === 'guard'
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <span className="text-lg sm:text-2xl mb-1 sm:mb-2 block">🛡️</span>
              <span className="font-medium">Guard</span>
              <span className="text-[10px] sm:text-xs text-gray-400 block">Beats STRIKE</span>
              <span className="text-[10px] sm:text-xs text-red-400 hidden sm:block">Loses to SKILL</span>
            </button>

            {/* SWITCH */}
            <button
              onClick={() => {
                const nextAlive = myState.cards.findIndex(
                  (c, i) => i !== myState.activeCardIndex && c.currentHp > 0
                );
                if (nextAlive !== -1) {
                  setSelectedMove({ action: 'switch', targetIndex: nextAlive });
                }
              }}
              disabled={!myState.cards.some((c, i) => i !== myState.activeCardIndex && c.currentHp > 0)}
              className={`p-2 sm:p-4 rounded-lg border-2 transition ${
                selectedMove?.action === 'switch'
                  ? 'border-yellow-500 bg-yellow-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <span className="text-lg sm:text-2xl mb-1 sm:mb-2 block">🔄</span>
              <span className="font-medium">Switch</span>
              <span className="text-[10px] sm:text-xs text-gray-400 block">Always first</span>
            </button>

            {onAIDecide && (
              <button
                onClick={handleAIMove}
                disabled={isSubmitting}
                className="p-2 sm:p-4 rounded-lg border-2 border-blue-600 hover:border-blue-500 bg-blue-500/10 transition"
              >
                <span className="text-lg sm:text-2xl mb-1 sm:mb-2 block">🤖</span>
                <span className="font-medium">AI Suggest</span>
                <span className="text-[10px] sm:text-xs text-gray-400 block">
                  {showAIThinking ? 'Thinking...' : 'Get AI move'}
                </span>
              </button>
            )}
          </div>

          {selectedMove && (
            <div className="flex items-center justify-between bg-gray-700 rounded-lg p-2 sm:p-4 gap-2">
              <span className="text-xs sm:text-base truncate">
                <strong className="text-purple-400 capitalize">{selectedMove.action}</strong>
                {selectedMove.targetIndex !== undefined && (
                  <span className="text-gray-400"> → {myState.cards[selectedMove.targetIndex].name}</span>
                )}
              </span>
              <button
                onClick={handleSubmitMove}
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 px-3 py-1.5 sm:px-6 sm:py-2 rounded-lg text-xs sm:text-base font-medium transition flex-shrink-0"
              >
                {isSubmitting ? '...' : 'Confirm'}
              </button>
            </div>
          )}
        </div>
      )}

      {!isParticipant && (
        <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-blue-200 mb-4 sm:mb-8">
          👁️ Spectating live battle. Actions are disabled for non-participants.
        </div>
      )}

      {/* Battle log */}
      {events.length > 0 && (
        <div className="mt-4 sm:mt-8 bg-gray-800 rounded-xl p-3 sm:p-4">
          <h3 className="text-sm sm:text-lg font-medium mb-2 sm:mb-3">Battle Log</h3>
          <div className="space-y-1.5 sm:space-y-2 max-h-36 sm:max-h-48 overflow-y-auto">
            {events.map((event, index) => (
              <div key={index} className="text-xs sm:text-sm text-gray-300">
                {event.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
