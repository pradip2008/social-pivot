'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import FeedGrid from '@/components/FeedGrid';
import PostDetail from '@/components/PostDetail';
import SearchModal from '@/components/SearchModal';
import TrendingPanel from '@/components/TrendingPanel';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]); // unfiltered for search/trending
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [platformCounts, setPlatformCounts] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);

  // UI state
  const [activePlatform, setActivePlatform] = useState('all');
  const [columns, setColumns] = useState(4);
  const [theme, setTheme] = useState('dark');
  const [selectedPost, setSelectedPost] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [activeHashtag, setActiveHashtag] = useState('');
  const [activeView, setActiveView] = useState('grid');
  // Load theme from localStorage and check admin role
  useEffect(() => {
    const savedTheme = localStorage.getItem('spvot-theme') || 'dark';
    const savedCols = localStorage.getItem('spvot-columns') || '4';
    setTheme(savedTheme);
    setColumns(parseInt(savedCols));
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Check if user is admin
    fetch('/api/login').then(r => r.json()).then(data => {
      if (data.role === 'admin') setIsAdmin(true);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      let url = '/api/feed?limit=50';
      if (activePlatform !== 'all') url += `&platform=${activePlatform}`;
      if (activeHashtag) url += `&hashtag=${encodeURIComponent(activeHashtag)}`;

      const feedRes = await fetch(url);
      const feedData = await feedRes.json();

      if (feedData.connected) {
        setConnected(true);
        setPosts(feedData.posts || []);
        setAccounts(feedData.accounts || []);
        setPlatformCounts(feedData.platformCounts || {});
        
        // Also fetch all posts for search/trending (no platform filter)
        if (activePlatform !== 'all' || activeHashtag) {
          const allRes = await fetch('/api/feed?limit=200');
          const allData = await allRes.json();
          setAllPosts(allData.posts || []);
        } else {
          setAllPosts(feedData.posts || []);
        }
      } else {
        setConnected(false);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [activePlatform, activeHashtag]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      handleSync();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [connected]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const syncRes = await fetch('/api/feed/sync', { method: 'POST' });
      const syncData = await syncRes.json();
      if (syncData.success) {
        await fetchData();
      }
    } catch (error) {
      console.error('Sync failed', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePlatformChange = (platform) => {
    setActivePlatform(platform);
    setActiveHashtag(''); // clear hashtag when switching platform
  };

  const handleColumnsChange = (cols) => {
    setColumns(cols);
    localStorage.setItem('spvot-columns', cols.toString());
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('spvot-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleHashtagSelect = (hashtag) => {
    setActiveHashtag(hashtag);
  };

  if (loading) return <div className="loader-overlay"><div className="spinner"></div></div>;

  return (
    <main className="main-content">
      <Header
        connected={connected}
        accounts={accounts}
        onSync={handleSync}
        isSyncing={isSyncing}
        activePlatform={activePlatform}
        onPlatformChange={handlePlatformChange}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onSearchOpen={() => setShowSearch(true)}
        onTrendingOpen={() => setShowTrending(true)}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        platformCounts={platformCounts}
      />

      <div className="feed-container">
        {/* Pending accounts banner */}
        {accounts.some(a => a.status === 'pending') && (
          <div className="pending-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Some accounts are pending admin approval. Their feed will appear once approved.</span>
            {isAdmin && <Link href="/admin" style={{ marginLeft: 'auto', fontWeight: 600, color: '#818cf8' }}>Review →</Link>}
          </div>
        )}

        {!connected ? (
          <div className="onboarding-state">
            <h1>Your Social Feed,{'\n'}Unified.</h1>
            <p>Connect your Instagram, Twitter, and Facebook accounts to aggregate all your posts in one beautiful feed.</p>
            <Link href="/connect" className="btn-primary huge">Connect Your Accounts</Link>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <h3>No posts found{activeHashtag ? ` for #${activeHashtag}` : activePlatform !== 'all' ? ` on ${activePlatform}` : ''}.</h3>
            <p>Try syncing your feed or switching the platform filter.</p>
          </div>
        ) : (
          <>
            {/* Connected accounts bar */}
            <div className="connected-bar">
              {accounts.filter(a => a.status === 'approved').map((acc) => (
                <div key={`${acc.platform}-${acc.username}`} className="connected-chip">
                  <span className="dot" />
                  @{acc.username} · {acc.platform}
                </div>
              ))}
              {isAdmin && (
                <Link href="/admin" className="connected-chip" style={{ color: '#818cf8', borderColor: 'rgba(129,140,248,0.2)', cursor: 'pointer' }}>
                  🛡️ Admin
                </Link>
              )}
              {activeHashtag && (
                <div className="connected-chip" style={{ color: '#7850FF', borderColor: 'rgba(120,80,255,0.2)' }}>
                  #{activeHashtag}
                  <button 
                    onClick={() => setActiveHashtag('')}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, marginLeft: 4, fontSize: 14 }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <FeedGrid 
              posts={posts} 
              columns={columns}
              onReadMore={(post) => setSelectedPost(post)}
            />
          </>
        )}
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      {/* Search Modal */}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          posts={allPosts}
          onPostSelect={(post) => setSelectedPost(post)}
        />
      )}

      {/* Trending Panel */}
      {showTrending && (
        <TrendingPanel
          onClose={() => setShowTrending(false)}
          posts={allPosts}
          onHashtagSelect={handleHashtagSelect}
          activeHashtag={activeHashtag}
        />
      )}
    </main>
  );
}
