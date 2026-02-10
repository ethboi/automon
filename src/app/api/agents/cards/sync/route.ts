import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
import { ethers } from 'ethers';
import { AUTOMONS, RARITY_MULTIPLIERS } from '@/lib/automons';
import { Rarity, Card } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
export const dynamic = 'force-dynamic';

const NFT_ABI = [
  'function getCard(uint256 tokenId) view returns (uint8 automonId, uint8 rarity)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

const RARITY_NAMES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const ABILITY_DEFINITIONS: Record<string, { effect: 'damage' | 'heal' | 'buff' | 'debuff' | 'dot'; power: number; cooldown: number; description: string }> = {
  Inferno: { effect: 'damage', power: 40, cooldown: 3, description: 'Deals heavy fire damage' },
  Burn: { effect: 'dot', power: 10, cooldown: 4, description: 'Burns target for 3 turns' },
  Tsunami: { effect: 'damage', power: 35, cooldown: 3, description: 'Crashes a wave of water' },
  Heal: { effect: 'heal', power: 30, cooldown: 4, description: 'Restores HP' },
  Earthquake: { effect: 'damage', power: 38, cooldown: 3, description: 'Shakes the ground violently' },
  Fortify: { effect: 'buff', power: 20, cooldown: 4, description: 'Increases defense' },
  Cyclone: { effect: 'damage', power: 32, cooldown: 2, description: 'Summons a devastating cyclone' },
  Haste: { effect: 'buff', power: 15, cooldown: 3, description: 'Increases speed' },
  'Void Strike': { effect: 'damage', power: 45, cooldown: 4, description: 'Strikes from the void' },
  Curse: { effect: 'debuff', power: 15, cooldown: 4, description: 'Curses target, reducing stats' },
  Radiance: { effect: 'damage', power: 36, cooldown: 3, description: 'Blasts with pure light' },
  Purify: { effect: 'heal', power: 20, cooldown: 3, description: 'Removes debuffs and heals' },
};

export async function POST(request: NextRequest) {
  try {
    const session = await getAgentAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tokenIds, address: _address } = await request.json();

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json({ error: 'tokenIds array required' }, { status: 400 });
    }

    const contractAddress = process.env.AUTOMON_NFT_ADDRESS;
    const rpcUrl = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

    if (!contractAddress) {
      return NextResponse.json({ error: 'NFT contract not configured' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, NFT_ABI, provider);

    const db = await getDb();
    const cards: Card[] = [];

    for (const tokenId of tokenIds) {
      // Check if card already exists in DB
      const existing = await db.collection('cards').findOne({ tokenId: Number(tokenId) });
      if (existing) {
        cards.push(existing as unknown as Card);
        continue;
      }

      // Fetch from contract
      const [automonId, rarityIndex] = await contract.getCard(tokenId);
      const owner = await contract.ownerOf(tokenId);

      const automonIdNum = Number(automonId);
      const rarityNum = Number(rarityIndex);

      const automon = AUTOMONS.find(a => a.id === automonIdNum);
      if (!automon) {
        console.error(`AutoMon ID ${automonIdNum} not found`);
        continue;
      }

      const rarity = RARITY_NAMES[rarityNum] || 'common';
      const multiplier = RARITY_MULTIPLIERS[rarity];

      const hp = Math.floor(automon.baseHp * multiplier);
      const abilityDef = ABILITY_DEFINITIONS[automon.ability] || {
        effect: 'damage' as const,
        power: 30,
        cooldown: 3,
        description: `${automon.name}'s special ability`,
      };

      const card: Card = {
        id: uuidv4(),
        tokenId: Number(tokenId),
        automonId: automonIdNum,
        owner: owner.toLowerCase(),
        name: automon.name,
        element: automon.element,
        rarity,
        stats: {
          attack: Math.floor(automon.baseAttack * multiplier),
          defense: Math.floor(automon.baseDefense * multiplier),
          speed: Math.floor(automon.baseSpeed * multiplier),
          hp,
          maxHp: hp,
        },
        ability: {
          name: automon.ability,
          effect: abilityDef.effect,
          power: Math.floor(abilityDef.power * multiplier),
          cooldown: abilityDef.cooldown,
          description: abilityDef.description,
          currentCooldown: 0,
        },
        level: 1,
        xp: 0,
        packId: `nft-${tokenId}`,
        createdAt: new Date(),
      };

      await db.collection('cards').insertOne(card);
      cards.push(card);
    }

    return NextResponse.json({ cards, synced: cards.length });
  } catch (error) {
    console.error('Sync NFT cards error:', error);
    return NextResponse.json({ error: 'Failed to sync cards' }, { status: 500 });
  }
}
