/**
 * Generates deterministic SVG art for each AutoMon based on its id and element.
 * Each species gets a unique silhouette/pattern.
 */

const ELEMENT_PALETTES: Record<string, { primary: string; secondary: string; accent: string; bg: string }> = {
  fire: { primary: '#ff6b35', secondary: '#ff4444', accent: '#ffaa00', bg: '#2a0a00' },
  water: { primary: '#4488ff', secondary: '#22ccff', accent: '#88ddff', bg: '#001a33' },
  earth: { primary: '#bb8844', secondary: '#886633', accent: '#ddaa55', bg: '#1a1100' },
  air: { primary: '#88bbee', secondary: '#aaddff', accent: '#cceeFF', bg: '#0a1520' },
  dark: { primary: '#9944cc', secondary: '#6622aa', accent: '#cc66ff', bg: '#0a0015' },
  light: { primary: '#ffdd44', secondary: '#ffcc00', accent: '#fff4aa', bg: '#1a1500' },
};

// Each AutoMon gets a unique creature shape via SVG path
const AUTOMON_SHAPES: Record<number, { body: string; detail: string; label: string }> = {
  // Fire types
  1: { body: 'M50,80 Q30,50 40,30 Q50,10 60,30 Q70,50 50,80Z', detail: 'M45,45 L55,25 L65,45', label: 'Blazeon' },
  2: { body: 'M30,75 Q25,50 40,35 L50,20 L60,35 Q75,50 70,75Z', detail: 'M35,40 Q50,15 65,40 M40,55 L60,55', label: 'Emberwing' },
  3: { body: 'M35,80 Q25,60 30,40 Q35,25 50,20 Q65,25 70,40 Q75,60 65,80Z', detail: 'M40,50 L50,35 L60,50 M42,65 L58,65', label: 'Magmor' },
  4: { body: 'M40,78 Q30,65 35,50 Q25,40 40,30 Q50,20 60,30 Q65,40 60,50 Q70,65 60,78Z', detail: 'M42,38 L48,28 M52,38 L58,28 M45,50 Q50,55 55,50', label: 'Cindercat' },
  // Water types
  5: { body: 'M30,75 Q20,55 35,35 Q50,15 65,35 Q80,55 70,75Z', detail: 'M35,50 Q50,30 65,50 M40,62 Q50,70 60,62', label: 'Aquaris' },
  6: { body: 'M35,80 Q30,55 40,40 Q50,25 60,40 Q70,55 65,80Z', detail: 'M38,48 Q50,32 62,48 M30,60 Q50,75 70,60', label: 'Tidalon' },
  7: { body: 'M25,70 Q20,50 30,35 Q50,10 70,35 Q80,50 75,70Z', detail: 'M30,45 Q50,20 70,45 M35,55 L45,50 L55,50 L65,55', label: 'Coralix' },
  8: { body: 'M35,78 Q25,60 30,45 Q40,25 50,20 Q60,25 70,45 Q75,60 65,78Z', detail: 'M38,40 L45,28 M55,28 L62,40 M40,55 Q50,65 60,55', label: 'Frostfin' },
  // Earth types
  9: { body: 'M25,80 L30,40 Q40,20 50,25 Q60,20 70,40 L75,80Z', detail: 'M35,50 L40,35 M60,35 L65,50 M40,65 L60,65', label: 'Terrox' },
  10: { body: 'M30,80 Q25,55 35,40 Q45,25 55,25 Q65,25 75,40 Q80,55 70,80Z', detail: 'M38,45 Q50,30 62,45 M35,60 Q50,72 65,60', label: 'Bouldern' },
  11: { body: 'M30,80 L35,50 L45,30 L50,15 L55,30 L65,50 L70,80Z', detail: 'M40,45 L50,25 L60,45 M38,60 L50,50 L62,60', label: 'Crysthorn' },
  // Air types
  12: { body: 'M40,78 Q25,55 35,40 Q45,20 55,20 Q65,40 75,55 Q60,78 40,78Z', detail: 'M30,50 Q50,25 70,50 M35,40 L40,30 M60,30 L65,40', label: 'Zephyrix' },
  13: { body: 'M35,80 Q20,55 30,35 L50,15 L70,35 Q80,55 65,80Z', detail: 'M25,45 L50,20 L75,45 M40,55 L50,45 L60,55', label: 'Stormwing' },
  14: { body: 'M38,78 Q28,58 35,42 Q45,22 55,22 Q65,42 72,58 Q62,78 38,78Z', detail: 'M35,48 Q50,28 65,48 M42,38 Q50,30 58,38', label: 'Gustal' },
  // Dark types
  15: { body: 'M35,80 Q20,60 30,40 Q40,20 50,15 Q60,20 70,40 Q80,60 65,80Z', detail: 'M38,40 L45,25 M55,25 L62,40 M40,55 L50,48 L60,55 M45,68 L55,68', label: 'Shadowmere' },
  16: { body: 'M40,78 Q30,55 38,38 Q48,18 52,18 Q62,38 70,55 Q60,78 40,78Z', detail: 'M42,35 Q50,22 58,35 M38,50 Q50,58 62,50', label: 'Voidling' },
  17: { body: 'M30,80 Q22,55 35,35 Q45,18 55,18 Q65,35 78,55 Q70,80 30,80Z', detail: 'M38,38 L48,22 M52,22 L62,38 M35,52 L42,45 M58,45 L65,52 M42,65 Q50,72 58,65', label: 'Noxfang' },
  // Light types
  18: { body: 'M35,80 Q25,55 38,35 Q50,15 62,35 Q75,55 65,80Z', detail: 'M40,42 Q50,25 60,42 M35,55 Q50,68 65,55 M50,30 L50,20', label: 'Luxara' },
  19: { body: 'M30,78 Q22,50 40,30 Q50,15 60,30 Q78,50 70,78Z', detail: 'M35,45 Q50,22 65,45 M50,15 L50,8 M30,40 L25,35 M70,40 L75,35', label: 'Solaris' },
  20: { body: 'M32,80 Q25,55 35,38 Q50,15 65,38 Q75,55 68,80Z', detail: 'M38,42 Q50,25 62,42 M42,58 Q50,52 58,58 M35,48 Q50,65 65,48', label: 'Aurorix' },
};

export function generateCardArt(automonId: number, element: string, rarity: string): string {
  const palette = ELEMENT_PALETTES[element] || ELEMENT_PALETTES.fire;
  const shape = AUTOMON_SHAPES[automonId] || AUTOMON_SHAPES[1];
  
  const isLegendary = rarity === 'legendary';
  const isEpic = rarity === 'epic';
  const isRare = rarity === 'rare';

  // Particle effects for higher rarities
  let particles = '';
  const particleCount = isLegendary ? 12 : isEpic ? 8 : isRare ? 5 : 0;
  for (let i = 0; i < particleCount; i++) {
    const x = 10 + (i * 73) % 80;
    const y = 10 + (i * 47) % 80;
    const r = isLegendary ? 2 : 1.5;
    const opacity = 0.3 + (i % 3) * 0.2;
    particles += `<circle cx="${x}" cy="${y}" r="${r}" fill="${palette.accent}" opacity="${opacity}">
      <animate attributeName="opacity" values="${opacity};${opacity * 0.3};${opacity}" dur="${1.5 + i * 0.3}s" repeatCount="indefinite"/>
    </circle>`;
  }

  // Glow filter for epic/legendary
  const glowFilter = (isEpic || isLegendary) ? `
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>` : '';
  const filterAttr = (isEpic || isLegendary) ? ' filter="url(#glow)"' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <radialGradient id="bg" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="${palette.bg}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${palette.bg}"/>
      </radialGradient>
      <radialGradient id="bodyGrad" cx="50%" cy="30%" r="50%">
        <stop offset="0%" stop-color="${palette.accent}"/>
        <stop offset="50%" stop-color="${palette.primary}"/>
        <stop offset="100%" stop-color="${palette.secondary}"/>
      </radialGradient>
      ${glowFilter}
    </defs>
    <rect width="100" height="100" fill="url(#bg)" rx="8"/>
    ${particles}
    <g${filterAttr}>
      <path d="${shape.body}" fill="url(#bodyGrad)" opacity="0.9"/>
      <path d="${shape.detail}" fill="none" stroke="${palette.accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
    </g>
    <circle cx="43" cy="38" r="2.5" fill="white" opacity="0.9"/>
    <circle cx="57" cy="38" r="2.5" fill="white" opacity="0.9"/>
    <circle cx="43" cy="38" r="1.2" fill="${palette.bg}"/>
    <circle cx="57" cy="38" r="1.2" fill="${palette.bg}"/>
  </svg>`;
}

/** Returns a data URI for use in <img> tags */
export function getCardArtDataUri(automonId: number, element: string, rarity: string): string {
  const svg = generateCardArt(automonId, element, rarity);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
