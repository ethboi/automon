import { NextRequest } from 'next/server';
import { getSession } from './auth';

function normalizeAddress(input: string | null): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(value) ? value : null;
}

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
    // For secret-based auth, require explicit agent address header.
    const agentAddress = normalizeAddress(request.headers.get('x-agent-address'));
    if (agentAddress) {
      return { address: agentAddress };
    }
  }

  return null;
}
