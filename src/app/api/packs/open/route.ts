import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ethers } from 'ethers';
import { AUTOMONS, RARITY_MULTIPLIERS } from '@/lib/automons';
import { Rarity, Card } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { generatePack } from '@/lib/cards';
export const dynamic = 'force-dynamic';

const NFT_ABI = [
  'function getCard(uint256 tokenId) view returns (uint8 automonId, uint8 rarity)',
  'function getCardsOf(address owner) view returns (uint256[])',
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

    const newCards: Card[] = [];
    const contractAddress = process.env.AUTOMON_NFT_ADDRESS;
    const rpcUrl = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

    // Best effort: sync missing cards from chain if configured.
    if (contractAddress) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, NFT_ABI, provider);
        const tokenIds: bigint[] = await contract.getCardsOf(address);

        for (const tokenId of tokenIds) {
          const tid = Number(tokenId);
          const existing = await db.collection('cards').findOne({ tokenId: tid });
          if (existing) continue;

          const [automonId, rarityIndex] = await contract.getCard(tid);
          const automonIdNum = Number(automonId);
          const rarityNum = Number(rarityIndex);
          const automon = AUTOMONS.find(a => a.id === automonIdNum);
          if (!automon) continue;

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
        }
      } catch (syncError) {
        console.warn('On-chain card sync failed, falling back to generated cards:', syncError);
      }
    }

    // Fallback for local/dev and partial chain config: generate cards to ensure pack can open.
    if (newCards.length === 0) {
      const generatedCards = generatePack(owner, packId);
      await db.collection('cards').insertMany(generatedCards);
      newCards.push(...generatedCards);
    }

    // Mark pack as opened
    await db.collection('packs').updateOne(
      { packId },
      { $set: { opened: true, cards: newCards.map(c => c.id), openedAt: new Date() } }
    );

    return NextResponse.json({ cards: newCards });
  } catch (error) {
    console.error('Open pack error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to open pack', detail: msg }, { status: 500 });
  }
}
