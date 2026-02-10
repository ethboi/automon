import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { generatePack } from '@/lib/cards';

export async function POST(request: NextRequest) {
  try {
    const { packId, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!packId) {
      return NextResponse.json({ error: 'Pack ID required' }, { status: 400 });
    }

    const db = await getDb();

    // Find the pack
    const pack = await db.collection('packs').findOne({
      packId,
      owner: address.toLowerCase(),
    });

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }

    if (pack.opened) {
      // Return already opened cards
      const cards = await db
        .collection('cards')
        .find({ packId })
        .toArray();

      return NextResponse.json({ cards, alreadyOpened: true });
    }

    // Generate 5 new cards
    const cards = generatePack(address.toLowerCase(), packId);

    // Insert cards into database
    const result = await db.collection('cards').insertMany(cards);

    // Update pack as opened
    const cardIds = Object.values(result.insertedIds).map(id => id.toString());
    await db.collection('packs').updateOne(
      { packId },
      {
        $set: {
          opened: true,
          cards: cardIds,
          openedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Open pack error:', error);
    return NextResponse.json({ error: 'Failed to open pack' }, { status: 500 });
  }
}
