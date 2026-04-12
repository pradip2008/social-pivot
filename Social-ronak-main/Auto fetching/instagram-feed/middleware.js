import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex-password-at-least-32-characters-long-for-security',
  cookieName: 'spvot-auth',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
};

// Routes that DON'T need login
const publicPaths = ['/login', '/api/login', '/api/add-account'];

// Admin-only API paths
const adminPaths = ['/api/admin'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow static files, Next.js internals, and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.next();
  }

  // Check session
  try {
    const session = await getIronSession(request.cookies, sessionOptions);

    if (!session.isLoggedIn) {
      // Not logged in → redirect to login (for pages) or return 401 (for APIs)
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check admin-only paths
    if (adminPaths.some(p => pathname.startsWith(p))) {
      if (session.role !== 'admin') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
      }
    }

    // Logged in → allow through
    return NextResponse.next();
  } catch (error) {
    // Session error → redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session error' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
