// Twitter API v2 — OAuth 2.0 with PKCE
// Requires Twitter Developer Account with Basic tier ($100/month) for read access

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_REDIRECT_URI = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI || 
  (process.env.NEXT_PUBLIC_BASE_URL + '/api/auth/twitter/callback');

import crypto from 'crypto';

// Generate PKCE code verifier and challenge
export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function getTwitterAuthUrl(codeChallenge, state) {
  const scopes = 'tweet.read users.read offline.access';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: TWITTER_REDIRECT_URI,
    scope: scopes,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeTwitterCode(code, codeVerifier) {
  const credentials = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64');

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: TWITTER_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 7200,
  };
}

export async function refreshTwitterToken(refreshToken) {
  const credentials = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64');

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 7200,
  };
}

export async function getTwitterUser(accessToken) {
  const res = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,username', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return {
    id: data.data.id,
    username: data.data.username,
    profile_picture: data.data.profile_image_url || '',
  };
}

export async function fetchTweets(accessToken, userId, limit = 25) {
  try {
    const res = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=${Math.min(limit, 100)}&tweet.fields=created_at,public_metrics,text,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    if (data.errors && !data.data) throw new Error(data.errors[0].message);

    const mediaMap = {};
    if (data.includes?.media) {
      for (const m of data.includes.media) {
        mediaMap[m.media_key] = m;
      }
    }

    return (data.data || []).map(tweet => {
      const mediaKeys = tweet.attachments?.media_keys || [];
      const firstMedia = mediaKeys.length > 0 ? mediaMap[mediaKeys[0]] : null;

      return {
        id: tweet.id,
        caption: tweet.text || '',
        media_type: firstMedia?.type === 'video' ? 'VIDEO' : (firstMedia ? 'IMAGE' : 'TEXT'),
        media_url: firstMedia?.url || firstMedia?.preview_image_url || '',
        thumbnail_url: firstMedia?.preview_image_url || null,
        permalink: `https://twitter.com/i/status/${tweet.id}`,
        timestamp: tweet.created_at,
        platform: 'twitter',
        post_type: 'tweet',
        likes_count: tweet.public_metrics?.like_count || 0,
      };
    });
  } catch (e) {
    console.error('Twitter fetch error:', e);
    return [];
  }
}

export function isTwitterConfigured() {
  return !!(TWITTER_CLIENT_ID && TWITTER_CLIENT_SECRET && 
    TWITTER_CLIENT_ID !== 'YOUR_TWITTER_CLIENT_ID' && 
    TWITTER_CLIENT_SECRET !== 'YOUR_TWITTER_CLIENT_SECRET');
}
