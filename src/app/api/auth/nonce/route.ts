import { NextRequest, NextResponse } from 'next/server';
import { generateNonce } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const nonce = await generateNonce(address);

    return NextResponse.json({ nonce });
  } catch (error) {
    console.error('Nonce generation error:', error);
    return NextResponse.json({ error: 'Failed to generate nonce' }, { status: 500 });
  }
}
