import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({
      columns: 4, theme: 'dark', posts_per_page: 24,
    });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();

    const stmt = db.prepare(`
      UPDATE settings SET columns = ?, theme = ?, posts_per_page = ?
      WHERE id = 1
    `);

    stmt.run(
      body.columns || 4,
      body.theme || 'dark',
      body.posts_per_page || 24
    );

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
