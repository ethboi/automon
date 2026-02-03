'use client';

import { Card as CardType, BattleCard, Element, Rarity } from '@/lib/types';

interface CardProps {
  card: CardType | BattleCard;
  selected?: boolean;
  onClick?: () => void;
  showStats?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const elementColors: Record<Element, { bg: string; border: string; icon: string }> = {
  fire: { bg: 'from-red-600 to-orange-500', border: 'border-red-500', icon: '🔥' },
  water: { bg: 'from-blue-600 to-cyan-500', border: 'border-blue-500', icon: '💧' },
  earth: { bg: 'from-amber-700 to-yellow-600', border: 'border-amber-500', icon: '🌍' },
  air: { bg: 'from-gray-400 to-blue-300', border: 'border-gray-300', icon: '💨' },
  dark: { bg: 'from-purple-900 to-gray-800', border: 'border-purple-500', icon: '🌑' },
  light: { bg: 'from-yellow-300 to-white', border: 'border-yellow-300', icon: '✨' },
};

const rarityColors: Record<Rarity, { text: string; glow: string }> = {
  common: { text: 'text-gray-400', glow: '' },
  uncommon: { text: 'text-green-400', glow: 'shadow-green-500/20' },
  rare: { text: 'text-blue-400', glow: 'shadow-blue-500/30' },
  epic: { text: 'text-purple-400', glow: 'shadow-purple-500/40' },
  legendary: { text: 'text-yellow-400', glow: 'shadow-yellow-500/50 animate-pulse' },
};

export default function Card({ card, selected, onClick, showStats = true, size = 'md' }: CardProps) {
  const element = elementColors[card.element];
  const rarity = rarityColors[card.rarity];
  const isBattleCard = 'currentHp' in card;

  const sizeClasses = {
    sm: 'w-32 p-2',
    md: 'w-48 p-3',
    lg: 'w-64 p-4',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div
      onClick={onClick}
      className={`
        ${sizeClasses[size]}
        bg-gradient-to-br ${element.bg}
        border-2 ${selected ? 'border-white ring-2 ring-white' : element.border}
        rounded-xl cursor-pointer transition-all duration-200
        hover:scale-105 hover:shadow-lg ${rarity.glow}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <span className={`${textSizes[size]} font-bold text-white truncate flex-1`}>
          {card.name}
        </span>
        <span className="text-lg">{element.icon}</span>
      </div>

      {/* Rarity badge */}
      <div className={`${textSizes[size]} ${rarity.text} font-medium capitalize mb-2`}>
        {card.rarity}
      </div>

      {/* HP Bar (for battle cards) */}
      {isBattleCard && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-white mb-1">
            <span>HP</span>
            <span>{(card as BattleCard).currentHp}/{card.stats.maxHp}</span>
          </div>
          <div className="w-full bg-black/30 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((card as BattleCard).currentHp / card.stats.maxHp) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      {showStats && (
        <div className={`grid grid-cols-2 gap-1 ${textSizes[size]} text-white/90`}>
          <div className="flex items-center gap-1">
            <span>⚔️</span>
            <span>{card.stats.attack}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🛡️</span>
            <span>{card.stats.defense}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>💨</span>
            <span>{card.stats.speed}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>❤️</span>
            <span>{card.stats.hp}</span>
          </div>
        </div>
      )}

      {/* Ability */}
      <div className={`mt-2 pt-2 border-t border-white/20 ${textSizes[size]}`}>
        <div className="text-white font-medium">{card.ability.name}</div>
        <div className="text-white/70 text-xs truncate">{card.ability.description}</div>
        {isBattleCard && card.ability.currentCooldown !== undefined && card.ability.currentCooldown > 0 && (
          <div className="text-yellow-300 text-xs mt-1">
            Cooldown: {card.ability.currentCooldown} turns
          </div>
        )}
      </div>

      {/* Buffs/Debuffs (for battle cards) */}
      {isBattleCard && ((card as BattleCard).buffs.length > 0 || (card as BattleCard).debuffs.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(card as BattleCard).buffs.map((buff, i) => (
            <span key={`buff-${i}`} className="text-xs bg-green-500/30 px-1 rounded">
              +{buff.stat}
            </span>
          ))}
          {(card as BattleCard).debuffs.map((debuff, i) => (
            <span key={`debuff-${i}`} className="text-xs bg-red-500/30 px-1 rounded">
              {debuff.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
