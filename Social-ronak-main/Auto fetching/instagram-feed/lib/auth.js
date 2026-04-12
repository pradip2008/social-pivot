import { getIronSession } from 'iron-session';

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex-password-at-least-32-characters-long-for-security',
  cookieName: 'spvot-auth',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(req, res) {
  return await getIronSession(req, res, sessionOptions);
}

export async function getSessionFromCookies(cookies) {
  return await getIronSession(cookies, sessionOptions);
}
