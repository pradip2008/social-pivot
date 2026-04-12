import { NextResponse } from 'next/server';
import { exchangeTwitterCode, getTwitterUser } from '@/lib/twitter';
import getDb from '@/lib/db';
import { pkceStore } from '../connect/route';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/connect?error=twitter_denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/connect?error=twitter_no_code', request.url));
    }

    // Get PKCE verifier
    const verifier = pkceStore.get(state);
    if (!verifier) {
      return NextResponse.redirect(new URL('/connect?error=twitter_expired', request.url));
    }
    pkceStore.delete(state);

    // Exchange code for tokens
    const tokenData = await exchangeTwitterCode(code, verifier);

    // Get Twitter user info
    const twitterUser = await getTwitterUser(tokenData.access_token);

    // Save to database
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO accounts (platform, platform_user_id, username, profile_picture, access_token, refresh_token, token_expires_at)
      VALUES ('twitter', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, platform_user_id) DO UPDATE SET
        username = excluded.username,
        profile_picture = excluded.profile_picture,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        connected_at = datetime('now')
    `);

    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    stmt.run(twitterUser.id, twitterUser.username, twitterUser.profile_picture, tokenData.access_token, tokenData.refresh_token, expiresAt);

    return NextResponse.redirect(new URL('/?success=twitter_connected', request.url));
  } catch (error) {
    console.error('Twitter auth callback error:', error);
    return NextResponse.redirect(new URL(`/connect?error=${encodeURIComponent(error.message)}`, request.url));
  }
}
