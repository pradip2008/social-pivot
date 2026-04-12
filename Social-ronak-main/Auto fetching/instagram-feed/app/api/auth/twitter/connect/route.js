import { NextResponse } from 'next/server';
import { getTwitterAuthUrl, generatePKCE, isTwitterConfigured } from '@/lib/twitter';
import { v4 as uuidv4 } from 'uuid';

// Store PKCE verifiers temporarily (in production use Redis/DB)
const pkceStore = new Map();

export async function GET() {
  if (!isTwitterConfigured()) {
    return NextResponse.json({
      error: 'Twitter API credentials not configured. Add TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET to .env.local'
    });
  }

  const { verifier, challenge } = generatePKCE();
  const state = uuidv4();

  // Store verifier for callback
  pkceStore.set(state, verifier);
  // Clean up after 10 minutes
  setTimeout(() => pkceStore.delete(state), 600000);

  const url = getTwitterAuthUrl(challenge, state);
  return NextResponse.json({ url });
}

// Export pkceStore for callback route
export { pkceStore };
