"""
Instagram Public Profile Scraper using Playwright.

Usage:
    python instagram_scraper.py <username> [--max-posts 30]

Output:
    JSON array of posts to stdout, matching the Meta Graph API format.
"""

import asyncio
import json
import sys
import random
import time
import re
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print(json.dumps({"error": "Playwright not installed. Run: pip install playwright && playwright install chromium"}), file=sys.stderr)
    sys.exit(1)

from config import (
    PROXIES, MIN_DELAY, MAX_DELAY, MAX_RETRIES, RETRY_BACKOFF,
    HEADLESS, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, USER_AGENT, MAX_POSTS,
)


def get_proxy():
    """Get a random proxy from the pool, or None if no proxies configured."""
    if not PROXIES:
        return None
    proxy_url = random.choice(PROXIES)
    return {"server": proxy_url}


def random_delay():
    """Sleep for a random duration to avoid detection."""
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    time.sleep(delay)


async def scrape_instagram_profile(username, max_posts=None):
    """
    Scrape public Instagram profile for posts.
    Returns a list of post dicts matching the Graph API format.
    """
    if max_posts is None:
        max_posts = MAX_POSTS

    posts = []
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with async_playwright() as p:
                proxy = get_proxy()
                browser_args = {
                    "headless": HEADLESS,
                }
                if proxy:
                    browser_args["proxy"] = proxy

                browser = await p.chromium.launch(**browser_args)
                context = await browser.new_context(
                    viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                    user_agent=USER_AGENT,
                )

                page = await context.new_page()

                # Block unnecessary resources for speed
                await page.route("**/*.{png,jpg,jpeg,gif,svg,mp4,woff,woff2,ttf}", lambda route: route.abort())

                # Navigate to profile
                url = f"https://www.instagram.com/{username}/"
                response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                if response and response.status == 404:
                    await browser.close()
                    return {"error": f"Profile @{username} not found (404)"}

                # Wait for content to load
                await page.wait_for_timeout(3000)

                # Check if page loaded properly
                page_content = await page.content()
                if "Page Not Found" in page_content or "Sorry, this page isn't available" in page_content:
                    await browser.close()
                    return {"error": f"Profile @{username} not found"}

                # Try to extract data from the page's embedded JSON (shared_data or __NEXT_DATA__)
                profile_data = await page.evaluate("""
                    () => {
                        // Try window._sharedData
                        if (window._sharedData && window._sharedData.entry_data && 
                            window._sharedData.entry_data.ProfilePage) {
                            return window._sharedData.entry_data.ProfilePage[0].graphql.user;
                        }
                        
                        // Try __NEXT_DATA__
                        const nextData = document.querySelector('#__next');
                        if (nextData) {
                            const scripts = document.querySelectorAll('script[type="application/json"]');
                            for (const script of scripts) {
                                try {
                                    const data = JSON.parse(script.textContent);
                                    if (data && data.props) return data;
                                } catch(e) {}
                            }
                        }
                        
                        return null;
                    }
                """)

                # Fallback: scrape from visible DOM elements
                if not profile_data:
                    # Scroll to load more posts
                    for _ in range(3):
                        await page.evaluate("window.scrollBy(0, window.innerHeight)")
                        await page.wait_for_timeout(1500)

                    # Extract posts from article elements / links
                    post_links = await page.evaluate("""
                        () => {
                            const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
                            const results = [];
                            for (const link of links) {
                                const href = link.getAttribute('href');
                                const img = link.querySelector('img');
                                const video = link.querySelector('video');
                                
                                results.push({
                                    permalink: 'https://www.instagram.com' + href,
                                    media_url: img ? img.src : (video ? video.src : ''),
                                    is_video: !!video || href.includes('/reel/'),
                                    alt_text: img ? (img.alt || '') : '',
                                });
                            }
                            return results;
                        }
                    """)

                    # Extract profile info
                    profile_info = await page.evaluate("""
                        () => {
                            const metaDesc = document.querySelector('meta[name="description"]');
                            const title = document.querySelector('title');
                            return {
                                description: metaDesc ? metaDesc.content : '',
                                title: title ? title.textContent : '',
                            };
                        }
                    """)

                    for i, post_data in enumerate(post_links[:max_posts]):
                        # Extract post ID from permalink
                        post_id_match = re.search(r'/(?:p|reel)/([A-Za-z0-9_-]+)', post_data.get('permalink', ''))
                        post_id = post_id_match.group(1) if post_id_match else f"scraped_{username}_{i}"

                        # Parse caption from alt text
                        caption = post_data.get('alt_text', '')
                        if caption and ' by ' in caption:
                            caption = caption.split(' by ')[0]

                        posts.append({
                            "id": post_id,
                            "caption": caption,
                            "media_type": "VIDEO" if post_data.get('is_video') else "IMAGE",
                            "media_url": post_data.get('media_url', ''),
                            "thumbnail_url": post_data.get('media_url', '') if post_data.get('is_video') else None,
                            "permalink": post_data.get('permalink', ''),
                            "timestamp": datetime.utcnow().isoformat() + "+0000",
                            "platform": "instagram",
                            "post_type": "reel" if post_data.get('is_video') else "post",
                            "likes_count": 0,
                        })

                await browser.close()
                break  # Success, exit retry loop

        except Exception as e:
            last_error = str(e)
            if attempt < MAX_RETRIES:
                wait_time = RETRY_BACKOFF ** attempt
                time.sleep(wait_time)
            continue

    if not posts and last_error:
        return {"error": f"Scraping failed after {MAX_RETRIES} attempts: {last_error}"}

    return {
        "success": True,
        "username": username,
        "posts": posts,
        "scraped_at": datetime.utcnow().isoformat(),
        "post_count": len(posts),
    }


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python instagram_scraper.py <username> [--max-posts 30]"}))
        sys.exit(1)

    username = sys.argv[1].lstrip('@').lower()
    max_posts = MAX_POSTS

    if '--max-posts' in sys.argv:
        idx = sys.argv.index('--max-posts')
        if idx + 1 < len(sys.argv):
            max_posts = int(sys.argv[idx + 1])

    result = await scrape_instagram_profile(username, max_posts)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
