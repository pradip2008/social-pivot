import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/auth';
import getDb from '@/lib/db';

export async function GET() {
  try {
    // Check admin session
    const cookieStore = await cookies();
    const session = await getSessionFromCookies(cookieStore);
    if (!session.isLoggedIn || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = getDb();

    // Get all accounts with post counts
    const accounts = db.prepare(`
      SELECT 
        a.*,
        COUNT(p.id) as post_count,
        MAX(p.cached_at) as last_post_cached
      FROM accounts a
      LEFT JOIN posts p ON p.account_id = a.id
      GROUP BY a.id
      ORDER BY a.connected_at DESC
    `).all();

    // Strip access tokens from response
    const sanitized = accounts.map(a => ({
      id: a.id,
      platform: a.platform,
      platform_user_id: a.platform_user_id,
      username: a.username,
      profile_picture: a.profile_picture,
      mode: a.mode || 'oauth',
      status: a.status || 'pending',
      connected_at: a.connected_at,
      last_fetched_at: a.last_fetched_at,
      post_count: a.post_count || 0,
      last_post_cached: a.last_post_cached,
      has_token: !!a.access_token,
    }));

    // Get counts by status
    const statusCounts = {
      total: sanitized.length,
      pending: sanitized.filter(a => a.status === 'pending').length,
      approved: sanitized.filter(a => a.status === 'approved').length,
      rejected: sanitized.filter(a => a.status === 'rejected').length,
    };

    return NextResponse.json({ accounts: sanitized, statusCounts });
  } catch (error) {
    console.error('Admin accounts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
