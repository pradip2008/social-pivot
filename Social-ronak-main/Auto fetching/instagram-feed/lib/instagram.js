const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI;

export function getAuthUrl() {
  const scopes = 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement';
  return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&response_type=code`;
}

export async function exchangeCodeForToken(code) {
  const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error.message);

  // Exchange for long-lived token
  const longLivedRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${INSTAGRAM_APP_ID}&client_secret=${INSTAGRAM_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
  );
  const longLivedData = await longLivedRes.json();
  if (longLivedData.error) throw new Error(longLivedData.error.message);

  return {
    access_token: longLivedData.access_token,
    expires_in: longLivedData.expires_in || 5184000,
  };
}

export async function getInstagramAccount(accessToken) {
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`
  );
  const pagesData = await pagesRes.json();
  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('No Facebook Pages found. Your Instagram must be connected to a Facebook Page.');
  }

  const pageId = pagesData.data[0].id;
  const igRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
  );
  const igData = await igRes.json();
  if (!igData.instagram_business_account) {
    throw new Error('No Instagram Business account linked to this Facebook Page.');
  }

  const igUserId = igData.instagram_business_account.id;

  const userRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}?fields=username,profile_picture_url&access_token=${accessToken}`
  );
  const userData = await userRes.json();

  return {
    ig_user_id: igUserId,
    username: userData.username,
    profile_picture: userData.profile_picture_url || '',
  };
}

export async function fetchInstagramPosts(accessToken, igUserId, limit = 25) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count&limit=${limit}&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.data || []).map(post => ({
    ...post,
    platform: 'instagram',
    post_type: post.media_type === 'VIDEO' ? 'reel' : 'post',
    likes_count: post.like_count || 0,
  }));
}

// Fetch Facebook Page Posts using same Graph API token
export async function fetchFacebookPosts(accessToken, limit = 25) {
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    if (!pagesData.data || pagesData.data.length === 0) return [];

    const page = pagesData.data[0];
    const pageToken = page.access_token;
    const pageId = page.id;

    const postsRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time,likes.summary(true)&limit=${limit}&access_token=${pageToken}`
    );
    const postsData = await postsRes.json();
    if (postsData.error) return [];

    return (postsData.data || []).map(post => ({
      id: post.id,
      caption: post.message || '',
      media_type: post.full_picture ? 'IMAGE' : 'TEXT',
      media_url: post.full_picture || '',
      thumbnail_url: null,
      permalink: post.permalink_url || `https://facebook.com/${post.id}`,
      timestamp: post.created_time,
      platform: 'facebook',
      post_type: 'post',
      likes_count: post.likes?.summary?.total_count || 0,
    }));
  } catch (e) {
    console.error('Facebook fetch error:', e);
    return [];
  }
}
