import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/auth';
import getDb from '@/lib/db';
import { fetchInstagramPosts, fetchFacebookPosts } from '@/lib/instagram';
import { fetchTweets } from '@/lib/twitter';
import { decryptToken } from '@/lib/crypto';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const session = await getSessionFromCookies(cookieStore);
    if (!session.isLoggedIn || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { accountId } = await request.json();
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved accounts can be synced' }, { status: 400 });
    }

    // Decrypt token
    const accessToken = decryptToken(account.access_token);
    let freshPosts = [];

    if (account.mode === 'oauth') {
      if (account.platform === 'instagram') {
        freshPosts = await fetchInstagramPosts(accessToken, account.platform_user_id, 30);
        // Also sync Facebook
        const fbPosts = await fetchFacebookPosts(accessToken, 30);
        if (fbPosts.length > 0) {
          let fbAccount = db.prepare('SELECT * FROM accounts WHERE platform = ?').get('facebook');
          if (fbAccount) {
            upsertPosts(db, fbPosts, fbAccount.id, 'facebook', 'api');
          }
        }
      } else if (account.platform === 'twitter') {
        freshPosts = await fetchTweets(accessToken, account.platform_user_id, 30);
      } else if (account.platform === 'facebook') {
        freshPosts = await fetchFacebookPosts(accessToken, 30);
      }
    }
    // For scraping mode, we'd call the Python scraper here
    // (Will be implemented in Phase 4)

    if (freshPosts.length > 0) {
      upsertPosts(db, freshPosts, account.id, account.platform, 'api');
    }

    db.prepare('UPDATE accounts SET last_fetched_at = datetime("now") WHERE id = ?').run(account.id);

    return NextResponse.json({
      success: true,
      message: `Synced ${freshPosts.length} posts for @${account.username}`,
      synced: freshPosts.length,
    });
  } catch (error) {
    console.error('Admin sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function upsertPosts(db, posts, accountId, platform, source) {
  const insertStmt = db.prepare(`
    INSERT INTO posts (platform, platform_post_id, account_id, post_type, media_type, media_url, thumbnail_url, caption, permalink, likes_count, timestamp, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, platform_post_id) DO UPDATE SET
      media_url = excluded.media_url,
      caption = excluded.caption,
      likes_count = excluded.likes_count,
      source = excluded.source,
      cached_at = datetime('now')
  `);

  db.transaction((items) => {
    for (const post of items) {
      insertStmt.run(
        platform,
        post.id,
        accountId,
        post.post_type || 'post',
        post.media_type,
        post.media_url,
        post.thumbnail_url || null,
        post.caption || '',
        post.permalink,
        post.likes_count || 0,
        post.timestamp,
        source
      );
    }
  })(posts);
}
