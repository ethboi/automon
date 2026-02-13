import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
export const dynamic = 'force-dynamic';

const TOKEN_ADDRESS = (
  process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS_MAINNET ||
  process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS ||
  '0xCdc26F8b74b9FE1A3B07C5e87C0EF4b3fD0E7777'
).trim();

const RPC = process.env.MONAD_RPC_URL_MAINNET || process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ balance: '0' });

  try {
    const provider = new ethers.JsonRpcProvider(RPC, { name: 'monad', chainId: 143 }, { staticNetwork: true });
    const token = new ethers.Contract(TOKEN_ADDRESS, [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ], provider);

    const [raw, decimalsRaw] = await Promise.all([
      token.balanceOf(address),
      token.decimals().catch(() => 18),
    ]);
    const decimals = Number(decimalsRaw) || 18;
    return NextResponse.json({ balance: ethers.formatUnits(raw, decimals) });
  } catch (error) {
    console.error('Token balance error:', error);
    return NextResponse.json({ balance: '0' });
  }
}
