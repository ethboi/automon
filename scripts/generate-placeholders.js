const fs = require('fs');
const path = require('path');

const AUTOMONS = [
  { id: 1, name: 'Blazeon', element: 'fire', color: '#FF4500' },
  { id: 2, name: 'Emberwing', element: 'fire', color: '#FF6347' },
  { id: 3, name: 'Magmor', element: 'fire', color: '#DC143C' },
  { id: 4, name: 'Cindercat', element: 'fire', color: '#FF8C00' },
  { id: 5, name: 'Aquaris', element: 'water', color: '#1E90FF' },
  { id: 6, name: 'Tidalon', element: 'water', color: '#00CED1' },
  { id: 7, name: 'Coralix', element: 'water', color: '#4169E1' },
  { id: 8, name: 'Frostfin', element: 'water', color: '#87CEEB' },
  { id: 9, name: 'Terrox', element: 'earth', color: '#8B4513' },
  { id: 10, name: 'Bouldern', element: 'earth', color: '#A0522D' },
  { id: 11, name: 'Crysthorn', element: 'earth', color: '#DAA520' },
  { id: 12, name: 'Zephyrix', element: 'air', color: '#87CEEB' },
  { id: 13, name: 'Stormwing', element: 'air', color: '#708090' },
  { id: 14, name: 'Gustal', element: 'air', color: '#B0C4DE' },
  { id: 15, name: 'Shadowmere', element: 'dark', color: '#4B0082' },
  { id: 16, name: 'Voidling', element: 'dark', color: '#2F0080' },
  { id: 17, name: 'Noxfang', element: 'dark', color: '#1A0033' },
  { id: 18, name: 'Luxara', element: 'light', color: '#FFD700' },
  { id: 19, name: 'Solaris', element: 'light', color: '#FFA500' },
  { id: 20, name: 'Aurorix', element: 'light', color: '#FFEC8B' },
];

const ELEMENT_SYMBOLS = {
  fire: '🔥',
  water: '💧',
  earth: '⛰️',
  air: '💨',
  dark: '🌑',
  light: '✨',
};

function generateSVG(automon) {
  const symbol = ELEMENT_SYMBOLS[automon.element];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg${automon.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${automon.color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
    <filter id="glow${automon.id}">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" fill="url(#bg${automon.id})"/>

  <!-- Decorative circle -->
  <circle cx="256" cy="220" r="120" fill="none" stroke="${automon.color}" stroke-width="4" opacity="0.6"/>
  <circle cx="256" cy="220" r="100" fill="none" stroke="${automon.color}" stroke-width="2" opacity="0.4"/>

  <!-- Placeholder creature silhouette -->
  <ellipse cx="256" cy="230" rx="80" ry="60" fill="${automon.color}" opacity="0.3"/>
  <circle cx="256" cy="190" r="50" fill="${automon.color}" opacity="0.4"/>

  <!-- Element indicator -->
  <circle cx="256" cy="380" r="40" fill="${automon.color}" opacity="0.8" filter="url(#glow${automon.id})"/>

  <!-- Name -->
  <text x="256" y="470" font-family="Arial, sans-serif" font-size="32" font-weight="bold"
        fill="white" text-anchor="middle" filter="url(#glow${automon.id})">${automon.name}</text>

  <!-- ID badge -->
  <rect x="20" y="20" width="60" height="40" rx="8" fill="rgba(0,0,0,0.5)"/>
  <text x="50" y="48" font-family="Arial, sans-serif" font-size="20" font-weight="bold"
        fill="white" text-anchor="middle">#${automon.id}</text>
</svg>`;
}

// Create directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'public', 'images', 'automons');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate SVGs for all automons
AUTOMONS.forEach(automon => {
  const svg = generateSVG(automon);
  const filename = path.join(outputDir, `${automon.id}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Generated: ${automon.id}.svg (${automon.name})`);
});

console.log(`\nGenerated ${AUTOMONS.length} placeholder images in ${outputDir}`);
console.log('\nNote: Replace these with AI-generated PNG images later.');
