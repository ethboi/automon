import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ethers } from 'ethers';
import { AUTOMONS, RARITY_MULTIPLIERS } from '@/lib/automons';
import { Rarity, Card } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
export const dynamic = 'force-dynamic';

const NFT_ABI = [
  'function getCard(uint256 tokenId) view returns (uint8 automonId, uint8 rarity)',
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
    const { packId, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!packId) {
      return NextResponse.json({ error: 'Pack ID required' }, { status: 400 });
    }

    const owner = address.toLowerCase();
    const db = await getDb();

    const pack = await db.collection('packs').findOne({
      packId,
      owner,
    });

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }

    if (pack.opened) {
      const cards = await db.collection('cards').find({ packId }).toArray();
      return NextResponse.json({ cards, alreadyOpened: true });
    }

    const contractAddress = process.env.AUTOMON_NFT_ADDRESS;
    const rpcUrl = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
    if (!contractAddress) {
      return NextResponse.json({ error: 'NFT contract not configured' }, { status: 500 });
    }

    const tokenIds = Array.isArray(pack.onchainTokenIds)
      ? (pack.onchainTokenIds as number[])
      : [];
    if (tokenIds.length === 0) {
      return NextResponse.json({ error: 'Pack has no verified on-chain token IDs' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, NFT_ABI, provider);
    const newCards: Card[] = [];
    const cardIds: string[] = [];

    for (const tid of tokenIds) {
      const existing = await db.collection('cards').findOne({ tokenId: tid, owner });
      if (existing) {
        const existingId = typeof existing.id === 'string' ? existing.id : String(existing._id);
        cardIds.push(existingId);
        continue;
      }

      const [automonId, rarityIndex] = await contract.getCard(BigInt(tid));
      const automonIdNum = Number(automonId);
      const rarityNum = Number(rarityIndex);
      const automon = AUTOMONS.find(a => a.id === automonIdNum);
      if (!automon) {
        throw new Error(`Unknown automonId for token ${tid}`);
      }

      const rarity = RARITY_NAMES[rarityNum] || 'common';
      const multiplier = RARITY_MULTIPLIERS[rarity];
      const hp = Math.floor(automon.baseHp * multiplier);
      const abilityDef = ABILITY_DEFINITIONS[automon.ability] || {
        effect: 'damage' as const, power: 30, cooldown: 3,
        description: `${automon.name}'s special ability`,
      };

      const card: Card = {
        id: uuidv4(),
        tokenId: tid,
        automonId: automonIdNum,
        owner,
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
        packId,
        createdAt: new Date(),
      };

      await db.collection('cards').insertOne(card);
      newCards.push(card);
      cardIds.push(card.id!);
    }

    // Mark pack as opened
    await db.collection('packs').updateOne(
      { packId },
      { $set: { opened: true, cards: cardIds, openedAt: new Date() } }
    );

    const cards = newCards.length > 0
      ? newCards
      : await db.collection('cards').find({ packId, owner }).toArray();

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Open pack error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to open pack', detail: msg }, { status: 500 });
  }
}
