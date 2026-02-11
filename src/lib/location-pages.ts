export type LocationSlug =
  | 'community-farm'
  | 'old-pond'
  | 'dark-forest'
  | 'crystal-caves'
  | 'town-arena'
  | 'trading-post'
  | 'shop'
  | 'home';

export interface LocationPageData {
  slug: LocationSlug;
  name: string;
  icon: string;
  tagline: string;
  worldLabel: string;
  accent: string;
  description: string;
  highlights: string[];
  primaryHref?: string;
  primaryLabel?: string;
}

export const LOCATION_PAGES: Record<LocationSlug, LocationPageData> = {
  home: {
    slug: 'home',
    name: 'Home',
    icon: '🏠',
    tagline: 'Your collection hub',
    worldLabel: 'Home',
    accent: 'from-amber-500/20 via-orange-500/10 to-amber-900/20',
    description: 'Manage your cards, check your profile, and prepare your lineup before heading back into the world.',
    highlights: ['Review your collection', 'Track your cards and rarity spread', 'Plan your next battles'],
    primaryHref: '/collection',
    primaryLabel: 'Open Collection',
  },
  shop: {
    slug: 'shop',
    name: 'Shop',
    icon: '🏪',
    tagline: 'Mint-ready marketplace',
    worldLabel: 'Shop',
    accent: 'from-orange-500/20 via-yellow-500/10 to-orange-900/20',
    description: 'Buy real packs and open them into minted cards. Every valid pack should map to a real transaction.',
    highlights: ['Buy packs with MON', 'Open and reveal card pulls', 'Track opened pack history'],
    primaryHref: '/shop',
    primaryLabel: 'Go to Shop',
  },
  'town-arena': {
    slug: 'town-arena',
    name: 'Town Arena',
    icon: '⚔️',
    tagline: 'Wager battles, live outcomes',
    worldLabel: 'Town Arena',
    accent: 'from-red-500/20 via-rose-500/10 to-red-900/20',
    description: 'Create or join battles, lock wagers, choose cards, and settle outcomes with full logs and reasoning.',
    highlights: ['Open battle queue', 'Recent battle history', 'Replay complete fights'],
    primaryHref: '/battle',
    primaryLabel: 'Open Battle Arena',
  },
  'trading-post': {
    slug: 'trading-post',
    name: 'Trading Post',
    icon: '📈',
    tagline: 'Token market activity',
    worldLabel: 'Trading Post',
    accent: 'from-emerald-500/20 via-teal-500/10 to-emerald-900/20',
    description: 'Monitor token trades and agent holdings from the trading lane.',
    highlights: ['Recent buys and sells', 'Agent balances', 'On-chain tx visibility'],
    primaryHref: '/trading',
    primaryLabel: 'Open Trading',
  },
  'community-farm': {
    slug: 'community-farm',
    name: 'Community Farm',
    icon: '🌾',
    tagline: 'Steady growth zone',
    worldLabel: 'Community Farm',
    accent: 'from-lime-500/20 via-green-500/10 to-lime-900/20',
    description: 'A calm zone where agents often farm, recover, and rotate strategies before re-entering battles.',
    highlights: ['Common farming activity', 'Low-risk regrouping', 'Frequent movement crossroads'],
  },
  'old-pond': {
    slug: 'old-pond',
    name: 'Old Pond',
    icon: '🎣',
    tagline: 'Quiet waterline route',
    worldLabel: 'Old Pond',
    accent: 'from-blue-500/20 via-cyan-500/10 to-blue-900/20',
    description: 'A slower location where agents often fish, idle, and recover before rotating elsewhere.',
    highlights: ['Fishing actions', 'Cooldown spot between battles', 'Frequent west-side traffic'],
  },
  'dark-forest': {
    slug: 'dark-forest',
    name: 'Dark Forest',
    icon: '🌑',
    tagline: 'High-risk training ground',
    worldLabel: 'Dark Forest',
    accent: 'from-violet-500/20 via-purple-500/10 to-violet-900/20',
    description: 'Agents train and explore here for high-intensity runs and aggressive action cycles.',
    highlights: ['Training-heavy actions', 'Frequent route switching', 'Good place to observe behavior shifts'],
  },
  'crystal-caves': {
    slug: 'crystal-caves',
    name: 'Crystal Caves',
    icon: '💎',
    tagline: 'Rare-route exploration',
    worldLabel: 'Crystal Caves',
    accent: 'from-fuchsia-500/20 via-purple-500/10 to-fuchsia-900/20',
    description: 'The cave route attracts exploration loops and occasional high-value movement spikes.',
    highlights: ['Exploration actions', 'Intermittent high activity', 'Links east and south lanes'],
  },
};

export const LOCATION_SLUG_BY_LABEL: Record<string, LocationSlug> = {
  Home: 'home',
  Shop: 'shop',
  'Town Arena': 'town-arena',
  'Trading Post': 'trading-post',
  'Community Farm': 'community-farm',
  'Old Pond': 'old-pond',
  'Dark Forest': 'dark-forest',
  'Crystal Caves': 'crystal-caves',
};
