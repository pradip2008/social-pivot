import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { fetchInstagramPosts } from '@/lib/instagram';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, username, accessToken } = body;

    if (!userId || !accessToken) {
      return NextResponse.json({ success: false, error: 'User ID and Access Token are required.' }, { status: 400 });
    }

    const db = getDb();

    // Verify the token
    try {
      await fetchInstagramPosts(accessToken, userId, 1);
    } catch (apiError) {
      return NextResponse.json({ success: false, error: 'Invalid Token or User ID. Error: ' + apiError.message }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO accounts (platform, platform_user_id, username, access_token, token_expires_at, connected_at, last_fetched_at)
      VALUES ('instagram', ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(platform, platform_user_id) DO UPDATE SET
        username = excluded.username,
        access_token = excluded.access_token,
        token_expires_at = excluded.token_expires_at
    `);

    const expiresAt = Date.now() + 60 * 24 * 60 * 60 * 1000;
    stmt.run(userId, username || 'manual_user', accessToken, expiresAt);

    // Force initial sync
    const account = db.prepare('SELECT id FROM accounts WHERE platform = ? AND platform_user_id = ?').get('instagram', userId);
    const freshPosts = await fetchInstagramPosts(accessToken, userId, 24);

    const insertStmt = db.prepare(`
      INSERT INTO posts (platform, platform_post_id, account_id, post_type, media_type, media_url, thumbnail_url, caption, permalink, likes_count, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, platform_post_id) DO UPDATE SET
        media_url = excluded.media_url,
        caption = excluded.caption,
        likes_count = excluded.likes_count,
        cached_at = datetime('now')
    `);

    db.transaction((posts) => {
      for (const post of posts) {
        insertStmt.run(
          'instagram', post.id, account.id,
          post.post_type || 'post', post.media_type,
          post.media_url, post.thumbnail_url || null,
          post.caption || '', post.permalink,
          post.likes_count || 0, post.timestamp
        );
      }
    })(freshPosts);

    return NextResponse.json({ success: true, message: 'Account connected manually.' });
  } catch (error) {
    console.error('Manual connection error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
