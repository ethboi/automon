import { NextRequest, NextResponse } from 'next/server';
import { getBalance } from '@/lib/wallet';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }
    const balance = await getBalance(address);
    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Balance error:', error);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
