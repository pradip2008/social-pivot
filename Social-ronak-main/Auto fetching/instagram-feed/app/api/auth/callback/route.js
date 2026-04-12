import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { exchangeCodeForToken, getInstagramAccount } from '@/lib/instagram';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/connect?error=auth_denied', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/connect?error=no_code', request.url));
    }

    const tokenData = await exchangeCodeForToken(code);
    const igAccount = await getInstagramAccount(tokenData.access_token);

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO accounts (platform, platform_user_id, username, profile_picture, access_token, token_expires_at)
      VALUES ('instagram', ?, ?, ?, ?, ?)
      ON CONFLICT(platform, platform_user_id) DO UPDATE SET
        username = excluded.username,
        profile_picture = excluded.profile_picture,
        access_token = excluded.access_token,
        token_expires_at = excluded.token_expires_at,
        connected_at = datetime('now')
    `);

    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    stmt.run(igAccount.ig_user_id, igAccount.username, igAccount.profile_picture, tokenData.access_token, expiresAt);

    return NextResponse.redirect(new URL('/?success=connected', request.url));
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL(`/connect?error=${encodeURIComponent(error.message)}`, request.url));
  }
}
