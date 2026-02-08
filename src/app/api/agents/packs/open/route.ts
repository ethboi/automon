import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { generatePack } from '@/lib/cards';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, packId } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const db = await getDb();

    // If packId provided, open specific pack
    // Otherwise, open the oldest unopened pack
    let pack;
    if (packId) {
      pack = await db.collection('packs').findOne({
        packId,
        owner: address.toLowerCase(),
      });
    } else {
      pack = await db.collection('packs').findOne({
        owner: address.toLowerCase(),
        opened: false,
      }, { sort: { createdAt: 1 } });
    }

    if (!pack) {
      return NextResponse.json({ error: 'No unopened packs found' }, { status: 404 });
    }

    if (pack.opened) {
      // Return already opened cards
      const cards = await db
        .collection('cards')
        .find({ packId: pack.packId })
        .toArray();

      return NextResponse.json({ cards, alreadyOpened: true });
    }

    // Generate 5 new cards
    const cards = generatePack(address.toLowerCase(), pack.packId);

    // Insert cards into database
    const result = await db.collection('cards').insertMany(cards);

    // Update pack as opened
    const cardIds = Object.values(result.insertedIds).map(id => id.toString());
    await db.collection('packs').updateOne(
      { packId: pack.packId },
      {
        $set: {
          opened: true,
          cards: cardIds,
          openedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ cards, packId: pack.packId });
  } catch (error) {
    console.error('Open pack error:', error);
    return NextResponse.json({ error: 'Failed to open pack' }, { status: 500 });
  }
}
