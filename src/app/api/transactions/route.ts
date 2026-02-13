import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, type, amount, txHash, details, agentName } = body;

    if (!address || !type) {
      return NextResponse.json({ error: 'address and type required' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection('transactions').insertOne({
      address: address.toLowerCase(),
      agentName: agentName || null,
      type,
      amount: amount || '0',
      txHash: txHash || null,
      details: details || {},
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Transaction log error:', error);
    return NextResponse.json({ error: 'Failed to log transaction' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (address) query.address = address.toLowerCase();
    if (type) query.type = type.includes(',') ? { $in: type.split(',') } : type;

    const txs = await db.collection('transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({ transactions: txs });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
