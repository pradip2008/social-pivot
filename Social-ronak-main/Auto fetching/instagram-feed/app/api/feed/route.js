import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { fetchInstagramPosts, fetchFacebookPosts } from '@/lib/instagram';
import { fetchTweets } from '@/lib/twitter';
import { decryptToken } from '@/lib/crypto';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 24;
    const platform = searchParams.get('platform') || 'all';
    const search = searchParams.get('search') || '';
    const hashtag = searchParams.get('hashtag') || '';

    const db = getDb();

    // Only fetch APPROVED accounts
    const accounts = db.prepare('SELECT * FROM accounts WHERE status = ?').all('approved');

    if (!accounts || accounts.length === 0) {
      // Check if there are pending accounts
      const pendingCount = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE status = ?').get('pending');
      const rejectedCount = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE status = ?').get('rejected');

      return NextResponse.json({
        posts: [],
        connected: false,
        accounts: [],
        pendingCount: pendingCount?.count || 0,
        rejectedCount: rejectedCount?.count || 0,
      });
    }

    // Auto-sync check (30 min cache TTL)
    const CACHE_TTL = 30 * 60 * 1000;
    const now = Date.now();

    for (const account of accounts) {
      const lastFetch = new Date(account.last_fetched_at).getTime();
      if (now - lastFetch > CACHE_TTL) {
        try {
          await syncAccountPosts(db, account, limit);
          db.prepare('UPDATE accounts SET last_fetched_at = datetime("now") WHERE id = ?').run(account.id);
        } catch (e) {
          console.error(`Auto-sync failed for ${account.platform}:${account.username}`, e);
        }
      }
    }

    // Build query — only posts from approved accounts
    const approvedIds = accounts.map(a => a.id);
    let query = 'SELECT * FROM posts WHERE account_id IN (' + approvedIds.map(() => '?').join(',') + ')';
    const params = [...approvedIds];

    if (platform !== 'all') {
      query += ' AND platform = ?';
      params.push(platform);
    }

    if (search) {
      query += ' AND caption LIKE ?';
      params.push(`%${search}%`);
    }

    if (hashtag) {
      query += ' AND caption LIKE ?';
      params.push(`%#${hashtag}%`);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const posts = db.prepare(query).all(...params);

    // Get platform counts (only from approved accounts)
    const countQuery = 'SELECT platform, COUNT(*) as count FROM posts WHERE account_id IN (' + approvedIds.map(() => '?').join(',') + ') GROUP BY platform';
    const counts = db.prepare(countQuery).all(...approvedIds);

    const platformCounts = {};
    for (const c of counts) {
      platformCounts[c.platform] = c.count;
    }

    // Get connected account info (include status/mode)
    const allAccounts = db.prepare('SELECT * FROM accounts').all();
    const connectedAccounts = allAccounts.map(a => ({
      id: a.id,
      platform: a.platform,
      username: a.username,
      profile_picture: a.profile_picture,
      mode: a.mode || 'oauth',
      status: a.status || 'pending',
    }));

    return NextResponse.json({
      posts,
      connected: true,
      accounts: connectedAccounts,
      platformCounts,
      totalPosts: Object.values(platformCounts).reduce((a, b) => a + b, 0),
    });

  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function syncAccountPosts(db, account, limit) {
  let freshPosts = [];
  const accessToken = decryptToken(account.access_token);

  if (account.mode === 'scraping') {
    // Scraping mode — skip auto-sync (handled by scheduled scraper)
    return;
  }

  if (account.platform === 'instagram') {
    freshPosts = await fetchInstagramPosts(accessToken, account.platform_user_id, limit);
    // Also try to get Facebook posts with same token
    const fbPosts = await fetchFacebookPosts(accessToken, limit);
    if (fbPosts.length > 0) {
      const fbAccount = db.prepare('SELECT * FROM accounts WHERE platform = ? AND status = ?').get('facebook', 'approved');
      if (!fbAccount) {
        db.prepare(`
          INSERT OR IGNORE INTO accounts (platform, platform_user_id, username, access_token, token_expires_at, mode, status)
          VALUES ('facebook', ?, ?, ?, ?, 'oauth', 'approved')
        `).run('fb_' + account.platform_user_id, account.username, account.access_token, account.token_expires_at);
      }
      const fbAcc = db.prepare('SELECT * FROM accounts WHERE platform = ? AND status = ?').get('facebook', 'approved');
      if (fbAcc) {
        upsertPosts(db, fbPosts, fbAcc.id, 'facebook', 'api');
      }
    }
  } else if (account.platform === 'twitter') {
    freshPosts = await fetchTweets(accessToken, account.platform_user_id, limit);
  } else if (account.platform === 'facebook') {
    freshPosts = await fetchFacebookPosts(accessToken, limit);
  }

  if (freshPosts.length > 0) {
    upsertPosts(db, freshPosts, account.id, account.platform, 'api');
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
