import { NextRequest } from 'next/server';
import { getSession } from './auth';

/**
 * Check auth for agent routes — accepts either:
 * 1. Regular session cookie (SIWE)
 * 2. x-agent-secret header matching JWT_SECRET (for CLI agents)
 */
export async function getAgentAuth(request: NextRequest): Promise<{ address: string } | null> {
  // Try session first
  try {
    const session = await getSession();
    if (session) return session;
  } catch {
    // Session check failed, try agent secret
  }

  // Try agent secret header
  const agentSecret = request.headers.get('x-agent-secret');
  const jwtSecret = process.env.JWT_SECRET;
  if (agentSecret && jwtSecret && agentSecret === jwtSecret) {
    // Trust the address from the request body
    try {
      const body = await request.clone().json();
      const claimedAddress = body.address || body.from;
      if (claimedAddress) {
        return { address: String(claimedAddress).toLowerCase() };
      }
    } catch {
      // Can't parse body
    }
  }

  return null;
}
