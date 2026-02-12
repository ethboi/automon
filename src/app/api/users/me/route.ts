import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function sanitizeName(input: unknown): string {
  return String(input ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
}

function normalizeAddress(input: unknown): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  try {
    return ethers.getAddress(raw).toLowerCase();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const addressFromQuery = normalizeAddress(new URL(request.url).searchParams.get('address'));
    const address = session?.address?.toLowerCase() || addressFromQuery;
    if (!address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ address });
    const name = (user?.name && String(user.name).trim()) || null;
    return NextResponse.json({ address, name });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json().catch(() => ({}));
    const address = session?.address?.toLowerCase() || normalizeAddress(body?.address);
    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 });
    }
    const name = sanitizeName(body?.name);
    if (name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection('users').updateOne(
      { address },
      {
        $set: { name, lastSeen: new Date(), lastLoginAt: new Date() },
        $setOnInsert: { createdAt: new Date(), address },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    console.error('Update user profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
