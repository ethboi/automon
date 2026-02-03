import { SiweMessage } from 'siwe';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getDb } from './mongodb';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');

export async function generateNonce(address: string): Promise<string> {
  const db = await getDb();
  const nonce = uuidv4();

  await db.collection('users').updateOne(
    { address: address.toLowerCase() },
    {
      $set: {
        nonce,
        lastLoginAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return nonce;
}

export async function verifySignature(
  message: string,
  signature: string
): Promise<{ address: string; valid: boolean }> {
  try {
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (!fields.success) {
      return { address: '', valid: false };
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({
      address: siweMessage.address.toLowerCase()
    });

    if (!user || user.nonce !== siweMessage.nonce) {
      return { address: '', valid: false };
    }

    // Invalidate nonce after use
    await db.collection('users').updateOne(
      { address: siweMessage.address.toLowerCase() },
      { $set: { nonce: uuidv4() } }
    );

    return { address: siweMessage.address, valid: true };
  } catch (error) {
    console.error('Signature verification error:', error);
    return { address: '', valid: false };
  }
}

export async function createToken(address: string): Promise<string> {
  const token = await new SignJWT({ address: address.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<{ address: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { address: payload.address as string };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ address: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function requireAuth(): Promise<string> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session.address;
}
