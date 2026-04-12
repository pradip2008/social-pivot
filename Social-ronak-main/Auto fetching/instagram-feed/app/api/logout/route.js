import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = await getSessionFromCookies(cookieStore);
    session.destroy();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
