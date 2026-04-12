import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/auth';
import getDb from '@/lib/db';

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

    db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run('approved', accountId);

    return NextResponse.json({
      success: true,
      message: `Account @${account.username} (${account.platform}) has been approved.`,
    });
  } catch (error) {
    console.error('Admin approve error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
