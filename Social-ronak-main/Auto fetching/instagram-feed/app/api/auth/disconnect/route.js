import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json().catch(() => ({}));
    const platform = body.platform || 'all';

    if (platform === 'all') {
      db.prepare('DELETE FROM posts').run();
      db.prepare('DELETE FROM accounts').run();
    } else {
      const account = db.prepare('SELECT * FROM accounts WHERE platform = ?').get(platform);
      if (account) {
        db.prepare('DELETE FROM posts WHERE account_id = ?').run(account.id);
        db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id);
      }
    }

    return NextResponse.json({ success: true, message: `Disconnected ${platform}` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
