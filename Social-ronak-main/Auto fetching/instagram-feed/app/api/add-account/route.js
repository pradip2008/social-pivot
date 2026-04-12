import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(request) {
  try {
    const { username, platform } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const platformName = (platform || 'instagram').toLowerCase();
    if (!['instagram', 'facebook', 'twitter'].includes(platformName)) {
      return NextResponse.json({ error: 'Invalid platform. Must be instagram, facebook, or twitter.' }, { status: 400 });
    }

    const db = getDb();

    // Check if account already exists
    const existing = db.prepare(
      'SELECT * FROM accounts WHERE platform = ? AND username = ?'
    ).get(platformName, username.toLowerCase().replace('@', ''));

    if (existing) {
      return NextResponse.json({
        success: false,
        error: `Account @${username} on ${platformName} already exists (status: ${existing.status}).`,
        account: {
          id: existing.id,
          username: existing.username,
          platform: existing.platform,
          status: existing.status,
          mode: existing.mode,
        },
      }, { status: 409 });
    }

    // Create the account in scraping mode with pending status
    const cleanUsername = username.toLowerCase().replace('@', '').trim();
    const result = db.prepare(`
      INSERT INTO accounts (platform, platform_user_id, username, mode, status)
      VALUES (?, ?, ?, 'scraping', 'pending')
    `).run(platformName, `scrape_${platformName}_${cleanUsername}`, cleanUsername);

    const newAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);

    // In production, this would queue a scraping job:
    // await queueScrapingJob({ accountId: newAccount.id, platform: platformName, username: cleanUsername });

    return NextResponse.json({
      success: true,
      message: `Account @${cleanUsername} added for demo preview. It is pending admin approval.`,
      account: {
        id: newAccount.id,
        username: newAccount.username,
        platform: newAccount.platform,
        status: newAccount.status,
        mode: newAccount.mode,
      },
    });
  } catch (error) {
    console.error('Add account error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
