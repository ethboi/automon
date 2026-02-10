import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { generateCardFromAutoMon } from '@/lib/cards';
import { AUTOMONS } from '@/lib/automons';
import { v4 as uuidv4 } from 'uuid';
export const dynamic = 'force-dynamic';

// Map wild species names to elements for matching
const WILD_ELEMENT_MAP: Record<string, string> = {
  Emberfox: 'fire',
  Aquafin: 'water',
  Thornvine: 'earth',
  Zephyrix: 'air',
  Shadewisp: 'dark',
  Lumiflare: 'light',
};

export async function POST(request: NextRequest) {
  try {
    const { address, speciesName } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const element = WILD_ELEMENT_MAP[speciesName];
    if (!element) {
      return NextResponse.json({ error: 'Unknown species' }, { status: 400 });
    }

    // Pick a random AutoMon of matching element
    const candidates = AUTOMONS.filter(a => a.element === element);
    const automon = candidates[Math.floor(Math.random() * candidates.length)];

    const packId = `tame_${uuidv4()}`;
    const card = generateCardFromAutoMon(
      address.toLowerCase(),
      packId,
      automon.id,
      undefined,
      'uncommon', // Tamed creatures are uncommon rarity
    );

    const db = await getDb();
    await db.collection('cards').insertOne(card);

    return NextResponse.json({ card, message: `Tamed a wild ${speciesName}!` });
  } catch (error) {
    console.error('Tame error:', error);
    return NextResponse.json({ error: 'Failed to tame' }, { status: 500 });
  }
}
