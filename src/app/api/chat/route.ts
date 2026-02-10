import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST — agent sends a chat message
export async function POST(request: NextRequest) {
  try {
    const agentSession = await getAgentAuth(request);
    const walletSession = await getSession();
    const { from, fromName, to, toName, message, location, address } = await request.json();
    if (!from || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const fromLower = String(from).toLowerCase();
    const addressLower = address ? String(address).toLowerCase() : null;
    const isAgent = !!agentSession;
    const isWalletUser = !!walletSession && (
      walletSession.address.toLowerCase() === fromLower ||
      (addressLower !== null && walletSession.address.toLowerCase() === addressLower)
    );
    if (!isAgent && !isWalletUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    await db.collection('chat').insertOne({
      from: fromLower,
      fromName: fromName || `${fromLower.slice(0, 6)}...${fromLower.slice(-4)}`,
      to: to?.toLowerCase() || null,
      toName: toName || null,
      message,
      location,
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// GET — fetch recent chat messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const location = searchParams.get('location');

    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (location) query.location = location;

    const messages = await db.collection('chat')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Chat fetch error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
