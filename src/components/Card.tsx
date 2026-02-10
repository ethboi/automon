'use client';

import { Card as CardType, BattleCard, Element, Rarity } from '@/lib/types';
import { getCardArtDataUri } from '@/lib/cardArt';

interface CardProps {
  card: CardType | BattleCard;
  selected?: boolean;
  onClick?: () => void;
  showStats?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const elementStyles: Record<Element, { bg: string; accent: string; icon: string; glow: string }> = {
  fire: {
    bg: 'from-orange-600 via-red-600 to-rose-700',
    accent: 'bg-orange-500',
    icon: '🔥',
    glow: 'shadow-orange-500/40',
  },
  water: {
    bg: 'from-blue-500 via-blue-600 to-cyan-700',
    accent: 'bg-blue-500',
    icon: '💧',
    glow: 'shadow-blue-500/40',
  },
  earth: {
    bg: 'from-amber-600 via-yellow-700 to-orange-800',
    accent: 'bg-amber-500',
    icon: '🌍',
    glow: 'shadow-amber-500/40',
  },
  air: {
    bg: 'from-slate-400 via-sky-500 to-blue-400',
    accent: 'bg-sky-400',
    icon: '💨',
    glow: 'shadow-sky-400/40',
  },
  dark: {
    bg: 'from-purple-900 via-violet-900 to-slate-900',
    accent: 'bg-purple-600',
    icon: '🌑',
    glow: 'shadow-purple-600/40',
  },
  light: {
    bg: 'from-yellow-300 via-amber-200 to-orange-200',
    accent: 'bg-yellow-400',
    icon: '✨',
    glow: 'shadow-yellow-400/40',
  },
};

const rarityStyles: Record<Rarity, { border: string; badge: string; glow: string; animation: string }> = {
  common: {
    border: 'border-gray-500/30',
    badge: 'bg-gray-600/80 text-gray-200',
    glow: '',
    animation: '',
  },
  uncommon: {
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-600/80 text-emerald-100',
    glow: 'shadow-lg shadow-emerald-500/20',
    animation: '',
  },
  rare: {
    border: 'border-blue-500/50',
    badge: 'bg-blue-600/80 text-blue-100',
    glow: 'shadow-lg shadow-blue-500/30',
    animation: '',
  },
  epic: {
    border: 'border-purple-500/60',
    badge: 'bg-purple-600/80 text-purple-100',
    glow: 'shadow-xl shadow-purple-500/40',
    animation: 'animate-pulse-glow',
  },
  legendary: {
    border: 'border-yellow-400/70',
    badge: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-yellow-900',
    glow: 'shadow-xl shadow-yellow-500/50',
    animation: 'animate-pulse-glow',
  },
};

export default function Card({ card, selected, onClick, showStats = true, size = 'md' }: CardProps) {
  const element = elementStyles[card.element];
  const rarity = rarityStyles[card.rarity];
  const isBattleCard = 'currentHp' in card;
  const isLightElement = card.element === 'light';

  const sizeConfig = {
    sm: {
      container: 'w-32',
      padding: 'p-2.5',
      title: 'text-xs',
      badge: 'text-[10px] px-1.5 py-0.5',
      stats: 'text-[10px]',
      ability: 'text-[10px]',
      icon: 'text-sm',
    },
    md: {
      container: 'w-48',
      padding: 'p-3.5',
      title: 'text-sm',
      badge: 'text-xs px-2 py-0.5',
      stats: 'text-xs',
      ability: 'text-xs',
      icon: 'text-lg',
    },
    lg: {
      container: 'w-64',
      padding: 'p-5',
      title: 'text-base',
      badge: 'text-sm px-2.5 py-1',
      stats: 'text-sm',
      ability: 'text-sm',
      icon: 'text-xl',
    },
  };

  const s = sizeConfig[size];
  const hpPercent = isBattleCard ? ((card as BattleCard).currentHp / card.stats.maxHp) * 100 : 100;
  const hpColor = hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div
      onClick={onClick}
      className={`
        ${s.container} ${s.padding}
        relative overflow-hidden
        bg-gradient-to-br ${element.bg}
        rounded-2xl
        border-2 ${selected ? 'border-white ring-2 ring-white/50' : rarity.border}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        transition-all duration-300 ease-out
        hover:scale-105 hover:-translate-y-1
        ${rarity.glow}
        ${rarity.animation}
        card-shine
        group
      `}
    >
      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2)_0%,transparent_70%)]" />
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className={`${s.title} font-bold ${isLightElement ? 'text-gray-900' : 'text-white'} truncate flex-1 drop-shadow-sm`}>
            {card.name}
          </h3>
          <div className={`${s.icon} flex-shrink-0 drop-shadow-md`}>
            {element.icon}
          </div>
        </div>

        {/* Card Art */}
        <div className="mb-2 flex justify-center">
          <img
            src={getCardArtDataUri(card.automonId ?? 1, card.element, card.rarity)}
            alt={card.name}
            className={`${size === 'sm' ? 'w-20 h-20' : size === 'md' ? 'w-28 h-28' : 'w-36 h-36'} rounded-xl border border-white/10`}
            draggable={false}
          />
        </div>

        {/* Rarity badge */}
        <div className="mb-2">
          <span className={`${s.badge} ${rarity.badge} rounded-full font-semibold uppercase tracking-wide inline-block`}>
            {card.rarity}
          </span>
        </div>

        {/* HP Bar (for battle cards) */}
        {isBattleCard && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className={`${s.stats} font-medium ${isLightElement ? 'text-gray-800' : 'text-white/90'}`}>HP</span>
              <span className={`${s.stats} font-bold ${isLightElement ? 'text-gray-900' : 'text-white'}`}>
                {(card as BattleCard).currentHp}/{card.stats.maxHp}
              </span>
            </div>
            <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className={`h-full ${hpColor} rounded-full transition-all duration-500 ease-out relative overflow-hidden`}
                style={{ width: `${hpPercent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        {showStats && (
          <div className={`grid grid-cols-2 gap-1.5 ${s.stats} mb-3`}>
            {[
              { icon: '⚔️', value: card.stats.attack, label: 'ATK' },
              { icon: '🛡️', value: card.stats.defense, label: 'DEF' },
              { icon: '💨', value: card.stats.speed, label: 'SPD' },
              { icon: '❤️', value: card.stats.hp, label: 'HP' },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`flex items-center gap-1.5 ${isLightElement ? 'bg-black/10' : 'bg-black/20'} rounded-lg px-2 py-1`}
              >
                <span className="text-sm">{stat.icon}</span>
                <span className={`font-bold ${isLightElement ? 'text-gray-900' : 'text-white'}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Ability section */}
        <div className={`border-t ${isLightElement ? 'border-black/10' : 'border-white/10'} pt-2`}>
          <div className={`${s.ability} font-semibold ${isLightElement ? 'text-gray-900' : 'text-white'} mb-0.5`}>
            {card.ability.name}
          </div>
          <div className={`${s.ability} ${isLightElement ? 'text-gray-700' : 'text-white/70'} line-clamp-2`}>
            {card.ability.description}
          </div>
          {isBattleCard && card.ability.currentCooldown !== undefined && card.ability.currentCooldown > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-yellow-300 text-xs">⏱️</span>
              <span className={`${s.ability} text-yellow-300 font-medium`}>
                Cooldown: {card.ability.currentCooldown}
              </span>
            </div>
          )}
        </div>

        {/* Buffs/Debuffs (for battle cards) */}
        {isBattleCard && ((card as BattleCard).buffs.length > 0 || (card as BattleCard).debuffs.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(card as BattleCard).buffs.map((buff, i) => (
              <span
                key={`buff-${i}`}
                className="text-[10px] bg-emerald-500/40 text-emerald-100 px-1.5 py-0.5 rounded-full font-medium border border-emerald-500/50"
              >
                ↑{buff.stat}
              </span>
            ))}
            {(card as BattleCard).debuffs.map((debuff, i) => (
              <span
                key={`debuff-${i}`}
                className="text-[10px] bg-red-500/40 text-red-100 px-1.5 py-0.5 rounded-full font-medium border border-red-500/50"
              >
                ↓{debuff.type}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Legendary shimmer border */}
      {card.rarity === 'legendary' && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none">
          <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400/50 animate-pulse" />
        </div>
      )}
    </div>
  );
}
