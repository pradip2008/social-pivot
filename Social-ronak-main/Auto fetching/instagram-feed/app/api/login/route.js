import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/auth';

// Admin credentials from environment
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'neel@gmail.com';
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$12$YwkqrxTeNqrd2ed82D7OfO8RMC7Mfqyz9whOUai8f8Rb1TliRwnb6';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Check email (case-insensitive)
    if (email.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Check password against bcrypt hash
    const isValid = await bcrypt.compare(password, ADMIN_HASH);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Create session with admin role
    const cookieStore = await cookies();
    const session = await getSessionFromCookies(cookieStore);
    session.isLoggedIn = true;
    session.email = ADMIN_EMAIL;
    session.role = 'admin';
    session.loginAt = Date.now();
    await session.save();

    return NextResponse.json({ success: true, role: 'admin' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getSessionFromCookies(cookieStore);
    return NextResponse.json({
      isLoggedIn: !!session.isLoggedIn,
      role: session.role || 'user',
    });
  } catch {
    return NextResponse.json({ isLoggedIn: false, role: 'user' });
  }
}
