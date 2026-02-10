import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const address =
    process.env.NEXT_PUBLIC_AUTOMON_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
    process.env.AUTOMON_NFT_ADDRESS;

  if (!address) {
    return NextResponse.json(
      { error: 'NFT contract not configured (set AUTOMON_NFT_ADDRESS or NEXT_PUBLIC_AUTOMON_NFT_ADDRESS)' },
      { status: 500 }
    );
  }

  return NextResponse.json({ address });
}
