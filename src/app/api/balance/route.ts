import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getBalance } from '@/lib/blockchain';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const balance = await getBalance(session.address);
    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Get balance error:', error);
    return NextResponse.json({ error: 'Failed to get balance' }, { status: 500 });
  }
}
