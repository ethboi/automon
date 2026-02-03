'use client';

import { useState } from 'react';
import { Card as CardType } from '@/lib/types';
import Card from './Card';

interface PackOpeningProps {
  cards: CardType[];
  onComplete: () => void;
}

export default function PackOpening({ cards, onComplete }: PackOpeningProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [, setIsAnimating] = useState(true);

  const revealNext = () => {
    if (revealedCount < cards.length) {
      setRevealedCount(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const revealAll = () => {
    setRevealedCount(cards.length);
    setIsAnimating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-8">Pack Opening!</h2>

        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {cards.map((card, index) => (
            <div
              key={card.id || index}
              className={`transition-all duration-500 ${
                index < revealedCount
                  ? 'opacity-100 transform scale-100'
                  : 'opacity-0 transform scale-50'
              }`}
            >
              {index < revealedCount ? (
                <Card card={card} size="md" />
              ) : (
                <div className="w-48 h-64 bg-gray-800 rounded-xl border-2 border-gray-700 flex items-center justify-center">
                  <span className="text-4xl">❓</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          {revealedCount < cards.length ? (
            <>
              <button
                onClick={revealNext}
                className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded-lg font-bold text-lg transition"
              >
                Reveal Card ({revealedCount + 1}/{cards.length})
              </button>
              <button
                onClick={revealAll}
                className="bg-gray-700 hover:bg-gray-600 px-8 py-3 rounded-lg font-medium transition"
              >
                Reveal All
              </button>
            </>
          ) : (
            <button
              onClick={onComplete}
              className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg font-bold text-lg transition"
            >
              Collect Cards
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
