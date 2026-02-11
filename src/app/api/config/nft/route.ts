import { NextResponse } from 'next/server';
import { getNftContractAddress } from '@/lib/network';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ address: getNftContractAddress() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'NFT contract not configured' },
      { status: 500 }
    );
  }
}
