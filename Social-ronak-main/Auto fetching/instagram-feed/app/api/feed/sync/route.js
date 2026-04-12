import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { fetchInstagramPosts, fetchFacebookPosts } from '@/lib/instagram';
import { fetchTweets } from '@/lib/twitter';
import { decryptToken } from '@/lib/crypto';

export async function POST() {
  try {
    const db = getDb();

    // Only sync APPROVED accounts
    const accounts = db.prepare('SELECT * FROM accounts WHERE status = ?').all('approved');

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'No approved accounts to sync' }, { status: 400 });
    }

    let totalSynced = 0;
    const syncResults = {};

    for (const account of accounts) {
      // Skip scraping accounts (they use the Python scraper on a different schedule)
      if (account.mode === 'scraping') {
        syncResults[`${account.platform}:${account.username}`] = { skipped: true, reason: 'scraping mode' };
        continue;
      }

      try {
        let freshPosts = [];
        const accessToken = decryptToken(account.access_token);

        if (account.platform === 'instagram') {
          freshPosts = await fetchInstagramPosts(accessToken, account.platform_user_id, 30);
          // Also sync Facebook posts with same token
          const fbPosts = await fetchFacebookPosts(accessToken, 30);
          if (fbPosts.length > 0) {
            let fbAccount = db.prepare('SELECT * FROM accounts WHERE platform = ? AND status = ?').get('facebook', 'approved');
            if (!fbAccount) {
              db.prepare(`
                INSERT OR IGNORE INTO accounts (platform, platform_user_id, username, access_token, token_expires_at, mode, status)
                VALUES ('facebook', ?, ?, ?, ?, 'oauth', 'approved')
              `).run('fb_' + account.platform_user_id, account.username, account.access_token, account.token_expires_at);
              fbAccount = db.prepare('SELECT * FROM accounts WHERE platform = ? AND status = ?').get('facebook', 'approved');
            }
            if (fbAccount) {
              upsertPosts(db, fbPosts, fbAccount.id, 'facebook', 'api');
              syncResults.facebook = fbPosts.length;
              totalSynced += fbPosts.length;
            }
          }
        } else if (account.platform === 'twitter') {
          freshPosts = await fetchTweets(accessToken, account.platform_user_id, 30);
        } else if (account.platform === 'facebook') {
          freshPosts = await fetchFacebookPosts(accessToken, 30);
        }

        if (freshPosts.length > 0) {
          upsertPosts(db, freshPosts, account.id, account.platform, 'api');
          syncResults[account.platform] = (syncResults[account.platform] || 0) + freshPosts.length;
          totalSynced += freshPosts.length;
        }

        db.prepare('UPDATE accounts SET last_fetched_at = datetime("now") WHERE id = ?').run(account.id);
      } catch (e) {
        console.error(`Sync failed for ${account.platform}:${account.username}`, e);
        syncResults[account.platform] = { error: e.message };
      }
    }

    // Return only approved account posts
    const approvedIds = accounts.map(a => a.id);
    const allPosts = approvedIds.length > 0
      ? db.prepare('SELECT * FROM posts WHERE account_id IN (' + approvedIds.map(() => '?').join(',') + ') ORDER BY timestamp DESC').all(...approvedIds)
      : [];

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      results: syncResults,
      posts: allPosts,
    });
  } catch (error) {
    console.error('Feed sync error:', error);
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
