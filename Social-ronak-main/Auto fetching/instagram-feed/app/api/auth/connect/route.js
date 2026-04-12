import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI;

  if (!appId || appId === 'YOUR_APP_ID_HERE') {
    return NextResponse.json({ 
      error: 'YOUR_APP_ID_HERE is configured in .env.local. You must provide a valid Meta App ID to use OAuth.' 
    });
  }

  const scope = 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement';
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`;

  return NextResponse.json({ url });
}
