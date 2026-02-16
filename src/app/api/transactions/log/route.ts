import { NextRequest, NextResponse } from 'next/server';
import { logTransaction } from '@/lib/transactions';
import { getAgentAuth } from '@/lib/agentAuth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAgentAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { txHash, type, from, amount, description, metadata } = body;

    if (!txHash || !type || !from) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await logTransaction({
      txHash,
      type,
      from,
      amount: amount || '0',
      description: description || '',
      metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log transaction error:', error);
    return NextResponse.json({ error: 'Failed to log transaction' }, { status: 500 });
  }
}
