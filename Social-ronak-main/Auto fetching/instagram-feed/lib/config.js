export const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex-password-at-least-32-characters-long-for-security',
  cookieName: 'social-pvot-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

// Platform definitions
export const PLATFORMS = {
  INSTAGRAM: 'instagram',
  TWITTER: 'twitter',
  FACEBOOK: 'facebook',
};

export const PLATFORM_COLORS = {
  instagram: '#E1306C',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
};

export const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
