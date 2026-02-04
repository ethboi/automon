'use client';

import { useState, useEffect } from 'react';
import { Card as CardType } from '@/lib/types';
import Card from './Card';

interface PackOpeningProps {
  cards: CardType[];
  onComplete: () => void;
}

export default function PackOpening({ cards, onComplete }: PackOpeningProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Check for rare cards
  const hasLegendary = cards.some(c => c.rarity === 'legendary');
  const hasEpic = cards.some(c => c.rarity === 'epic');
  const hasRare = cards.some(c => c.rarity === 'rare');

  useEffect(() => {
    if (revealedCount === cards.length) {
      if (hasLegendary || hasEpic) {
        setShowConfetti(true);
      }
    }
  }, [revealedCount, cards.length, hasLegendary, hasEpic]);

  const revealNext = () => {
    if (revealedCount < cards.length) {
      setRevealedCount(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const revealAll = () => {
    setRevealedCount(cards.length);
  };

  const getRarityMessage = () => {
    if (hasLegendary) return { text: 'LEGENDARY PULL!', color: 'text-yellow-400', glow: 'drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]' };
    if (hasEpic) return { text: 'EPIC PULL!', color: 'text-purple-400', glow: 'drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]' };
    if (hasRare) return { text: 'Nice pull!', color: 'text-blue-400', glow: '' };
    return { text: 'Pack Opened!', color: 'text-white', glow: '' };
  };

  const rarityMessage = getRarityMessage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" />

      {/* Confetti effect for epic/legendary */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                backgroundColor: ['#fbbf24', '#a855f7', '#3b82f6', '#22c55e', '#ef4444', '#ec4899'][Math.floor(Math.random() * 6)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        {/* Title */}
        <div className="mb-8 animate-fade-in-up">
          {revealedCount === cards.length ? (
            <h2 className={`text-4xl sm:text-5xl font-black ${rarityMessage.color} ${rarityMessage.glow} animate-pulse`}>
              {rarityMessage.text}
            </h2>
          ) : (
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Opening Pack...
            </h2>
          )}
          <p className="text-gray-400 mt-2">
            {revealedCount < cards.length
              ? `${cards.length - revealedCount} cards remaining`
              : 'All cards revealed!'}
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-8">
          {cards.map((card, index) => (
            <div
              key={card.id || index}
              className={`transition-all duration-700 ease-out ${
                index < revealedCount
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-75 translate-y-8'
              }`}
              style={{
                transitionDelay: index < revealedCount ? `${(index - (revealedCount - 1)) * 0.1}s` : '0s',
              }}
            >
              {index < revealedCount ? (
                <div className={`
                  ${card.rarity === 'legendary' ? 'animate-pulse-glow' : ''}
                  ${card.rarity === 'epic' ? 'animate-pulse-glow' : ''}
                `}>
                  <Card card={card} size="md" />
                </div>
              ) : (
                <div className="w-48 h-72 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 flex flex-col items-center justify-center gap-4 shadow-xl group cursor-pointer hover:border-purple-500/50 transition-colors"
                  onClick={() => index === revealedCount && revealNext()}
                >
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-4xl group-hover:animate-bounce-subtle">❓</span>
                  </div>
                  <div className="text-gray-500 text-sm font-medium">
                    Card #{index + 1}
                  </div>
                  {index === revealedCount && (
                    <div className="text-purple-400 text-xs animate-pulse">
                      Click to reveal
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up">
          {revealedCount < cards.length ? (
            <>
              <button
                onClick={revealNext}
                className="btn-primary px-8 py-4 text-lg"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <span>Reveal Card ({revealedCount + 1}/{cards.length})</span>
                </span>
              </button>
              <button
                onClick={revealAll}
                className="btn-secondary px-8 py-4"
              >
                <span className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>Reveal All</span>
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={onComplete}
              className="btn-success px-10 py-4 text-lg"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🎴</span>
                <span>Collect Cards</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          )}
        </div>

        {/* Skip hint */}
        {revealedCount < cards.length && (
          <p className="text-gray-600 text-sm mt-6">
            Press <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 mx-1">Space</kbd> to reveal next
          </p>
        )}
      </div>
    </div>
  );
}
