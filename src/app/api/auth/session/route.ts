import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, address: session.address });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
