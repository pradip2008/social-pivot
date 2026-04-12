'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FanAuthProvider, useFanAuth } from '@/src/context/FanAuthContext';
import FanAuthModal from '@/src/components/feed/FanAuthModal';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ───
interface Comment {
  id: string;
  text: string;
  createdAt: string;
  fan: { id: string; name: string; profileImage: string | null };
}

interface FeedItem {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  caption: string | null;
  type: 'post' | 'reel';
  createdAt: string;
  likeCount: number;
  commentCount: number;
  hasLiked?: boolean;
  isPending?: boolean;
  comments?: Comment[];
}

// ─── Helper ───
const getImgSrc = (url: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001';
  return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
};

// ─── Skeleton Card ───
function SkeletonCard() {
  return (
    <div className="aspect-square rounded-2xl overflow-hidden bg-[#171717] animate-pulse">
      <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#222]" />
    </div>
  );
}

// ─── Empty State ───
function EmptyState({ type }: { type: string }) {
  return (
    <div className="col-span-3 flex flex-col items-center justify-center py-24 text-center">
      <div className="w-24 h-24 rounded-full bg-[#171717] border border-[#262626] flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          {type === 'posts' ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25c0 .828.672 1.5 1.5 1.5z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          )}
        </svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No {type} yet</h3>
      <p className="text-gray-500 text-sm max-w-xs">
        {type === 'posts'
          ? 'When posts are shared, they will appear here in a beautiful grid.'
          : 'Short-form video content will be displayed here.'}
      </p>
    </div>
  );
}

// ─── Post/Reel Modal ───
function ContentModal({
  item,
  companyName,
  companyLogo,
  companyId,
  isAdminLoggedIn,
  adminToken,
  onClose,
  onLikeUpdate,
  onCommentUpdate,
}: {
  item: FeedItem;
  companyName: string;
  companyLogo: string | null;
  companyId: string;
  isAdminLoggedIn: boolean;
  adminToken: string | null;
  onClose: () => void;
  onLikeUpdate: (id: string, stats: any, isReel: boolean) => void;
  onCommentUpdate: (id: string, comment: Comment, isReel: boolean) => void;
}) {
  const { fan, isAuthenticated, token } = useFanAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const isReel = item.type === 'reel';

  const handleLike = async () => {
    if (!isAuthenticated && !isAdminLoggedIn) {
      setShowAuth(true);
      return;
    }
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 600);
    const newHasLiked = !item.hasLiked;
    const newLikeCount = newHasLiked ? item.likeCount + 1 : item.likeCount - 1;
    onLikeUpdate(item.id, { hasLiked: newHasLiked, likeCount: newLikeCount }, isReel);
    try {
      const endpoint = isReel ? `/feed/reel/${item.id}/like` : `/feed/post/${item.id}/like`;
      const res = await api.post(endpoint, {}, {
        headers: { Authorization: `Bearer ${isAdminLoggedIn ? adminToken : token}` }
      });
      onLikeUpdate(item.id, { hasLiked: res.data.liked, likeCount: res.data.likeCount }, isReel);
    } catch { }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!isAuthenticated && !isAdminLoggedIn) { setShowAuth(true); return; }
    setIsSubmitting(true);
    try {
      const endpoint = isReel ? `/feed/reel/${item.id}/comment` : `/feed/post/${item.id}/comment`;
      const res = await api.post(endpoint, { text: commentText }, {
        headers: { Authorization: `Bearer ${isAdminLoggedIn ? adminToken : token}` }
      });
      onCommentUpdate(item.id, res.data, isReel);
      setCommentText('');
    } catch { } finally { setIsSubmitting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-8 animate-fadeIn" onClick={onClose}>
        <div
          className="relative flex flex-col md:flex-row bg-[#0a0a0a] text-white w-full max-w-5xl h-full md:h-[88vh] rounded-2xl overflow-hidden border border-[#262626] shadow-[0_0_80px_rgba(6,182,212,0.08)] animate-scaleIn"
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 z-50 text-white/60 hover:text-white bg-black/60 hover:bg-[#262626] rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 backdrop-blur-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {/* Media Side */}
          <div className="w-full md:w-[60%] h-[45vh] md:h-full bg-black flex items-center justify-center border-r border-[#1a1a1a]">
            {isReel && item.videoUrl ? (
              <video src={item.videoUrl} className="max-w-full max-h-full object-contain" controls autoPlay loop playsInline />
            ) : item.imageUrl ? (
              <img src={item.imageUrl} alt="Post" className="max-w-full max-h-full object-contain" loading="lazy" />
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center w-full h-full">
                <div className="text-6xl text-gray-700 mb-6">❝</div>
                <p className="text-xl text-gray-200 font-medium leading-relaxed max-w-md italic">
                  {(item.caption || '').replace(/<[^>]*>/g, '')}
                </p>
              </div>
            )}
          </div>

          {/* Details Side */}
          <div className="w-full md:w-[40%] flex flex-col h-[45vh] md:h-full bg-[#0a0a0a]">
            {/* Header */}
            <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#06b6d4]/30 flex-shrink-0">
                {companyLogo ? (
                  <img src={getImgSrc(companyLogo)} alt={companyName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#171717] flex items-center justify-center text-sm font-bold text-cyan-400">{companyName?.charAt(0)}</div>
                )}
              </div>
              <div>
                <span className="font-semibold text-sm text-white">{companyName}</span>
                {item.createdAt && <p className="text-[10px] text-gray-500">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>}
              </div>

              {item.isPending && (
                <div className="ml-auto flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Scheduled</span>
                </div>
              )}
            </div>

            {item.isPending && (
              <div className="mx-4 mt-2 px-3 py-2 bg-black/40 border border-[#262626] rounded-xl flex items-start gap-2.5">
                <svg className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-gray-400 leading-normal">
                  Goes live on platform soon — not yet publicly visible there.
                </p>
              </div>
            )}

            {/* Comments scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {item.caption && (
                <div className="flex gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-[#171717] border border-[#262626] overflow-hidden shrink-0 flex items-center justify-center">
                    {companyLogo ? <img src={getImgSrc(companyLogo)} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-cyan-400">{companyName?.charAt(0)}</span>}
                  </div>
                  <div>
                    <span className="font-semibold mr-2 text-white">{companyName}</span>
                    <span className="text-gray-300 break-words whitespace-pre-wrap">{(item.caption || '').replace(/<[^>]*>/g, '')}</span>
                  </div>
                </div>
              )}
              {(item.comments || []).map((c) => (
                <div key={c.id} className="flex gap-3 text-sm animate-fadeIn">
                  <div className="w-8 h-8 rounded-full bg-[#171717] border border-[#262626] overflow-hidden shrink-0 flex items-center justify-center text-gray-400 text-xs font-semibold">
                    {c.fan.profileImage ? <img src={c.fan.profileImage} alt="" className="w-full h-full object-cover" /> : c.fan.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold mr-2 text-white">{c.fan.name}</span>
                    <span className="text-gray-300 break-words">{c.text}</span>
                    <div className="text-[10px] text-gray-600 mt-1">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</div>
                  </div>
                </div>
              ))}
              {(item.comments || []).length === 0 && !item.caption && (
                <div className="flex items-center justify-center h-full text-gray-600 text-sm">No comments yet. Be the first!</div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[#1a1a1a]">
              <div className="flex gap-4 mb-2">
                <button onClick={handleLike} className="group transition-transform">
                  <svg className={`w-7 h-7 transition-all duration-300 ${item.hasLiked ? 'fill-[#ED4956] text-[#ED4956]' : 'fill-transparent text-white hover:text-gray-300'} ${likeAnimating ? 'scale-125' : 'scale-100'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={item.hasLiked ? 0 : 2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                <button onClick={() => document.getElementById('modalCommentInput')?.focus()} className="hover:text-gray-300 transition">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </button>
              </div>
              <div className="font-semibold text-sm mb-1">{item.likeCount} {item.likeCount === 1 ? 'like' : 'likes'}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                {item.createdAt && formatDistanceToNow(new Date(item.createdAt))} AGO
              </div>
            </div>

            {/* Comment input */}
            <div className="p-4 border-t border-[#1a1a1a] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#171717] border border-[#262626] overflow-hidden shrink-0 flex items-center justify-center text-gray-400 text-xs font-semibold">
                {fan ? (fan.profileImage ? <img src={fan.profileImage} alt="" className="w-full h-full object-cover" /> : fan.name?.[0]) : '?'}
              </div>
              <form onSubmit={handleComment} className="flex-1 flex items-center relative">
                <input
                  id="modalCommentInput"
                  type="text"
                  placeholder="Add a comment..."
                  className="w-full bg-transparent border border-[#262626] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-[#06b6d4]/50 transition-colors placeholder-gray-600"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={500}
                />
                <button type="submit" disabled={!commentText.trim() || isSubmitting} className="absolute right-3 text-[#06b6d4] font-semibold text-sm disabled:opacity-30 transition-opacity">
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <FanAuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} companyId={companyId} />
    </>
  );
}

// ─── Main Feed Page Content ───
function PublicFeedContent({ params }: { params: any }) {
  const searchParams = useSearchParams();
  const [slug, setSlug] = useState<string>('');
  const adminTokenUrl = searchParams?.get('adminToken');

  useEffect(() => {
    (async () => {
      if (params) {
        const resolved = await params;
        setSlug(resolved.slug);
      }
    })();
  }, [params]);

  const { fan, token: fanToken } = useFanAuth();
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [company, setCompany] = useState<any>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [reels, setReels] = useState<FeedItem[]>([]);
  const [fanCount, setFanCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Admin token verification
  useEffect(() => {
    const verifyToken = async () => {
      if (adminTokenUrl) {
        try {
          const { data } = await api.get(`/feed/admin/verify-token?token=${adminTokenUrl}`);
          if (data.valid) {
            setIsAdminLoggedIn(true);
            setAdminToken(adminTokenUrl);
            api.defaults.headers.common['Authorization'] = `Bearer ${adminTokenUrl}`;
          }
        } catch { }
      } else if (fanToken && !isAdminLoggedIn) {
        api.defaults.headers.common['Authorization'] = `Bearer ${fanToken}`;
      }
    };
    verifyToken();
  }, [adminTokenUrl, fanToken, isAdminLoggedIn]);

  // Load data
  useEffect(() => {
    if (!slug) return;
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/feed/slug/${slug}`);
        setCompany(data.company);
        setPosts(data.posts || []);
        setReels(data.reels || []);
        setFanCount(data.fanCount || 0);
      } catch { } finally { setLoading(false); }
    };
    fetchData();
  }, [slug]);

  const handleLikeUpdate = useCallback((id: string, newStats: any, isReel: boolean) => {
    if (isReel) {
      setReels(prev => prev.map(r => r.id === id ? { ...r, ...newStats } : r));
      setSelectedItem(prev => prev?.id === id ? { ...prev, ...newStats } : prev);
    } else {
      setPosts(prev => prev.map(p => p.id === id ? { ...p, ...newStats } : p));
      setSelectedItem(prev => prev?.id === id ? { ...prev, ...newStats } : prev);
    }
  }, []);

  const handleCommentUpdate = useCallback((id: string, newComment: Comment, isReel: boolean) => {
    const updater = (item: FeedItem) => item.id === id ? {
      ...item,
      commentCount: item.commentCount + 1,
      comments: [newComment, ...(item.comments || [])]
    } : item;
    if (isReel) {
      setReels(prev => prev.map(updater));
    } else {
      setPosts(prev => prev.map(updater));
    }
    setSelectedItem(prev => prev?.id === id ? { ...prev, commentCount: (prev.commentCount || 0) + 1, comments: [newComment, ...(prev.comments || [])] } : prev);
  }, []);

  const handleItemClick = async (item: FeedItem) => {
    const canInteract = isAdminLoggedIn || fanToken;
    try {
      const { data } = await api.get(`/feed/${item.type}/${item.id}`);
      const details = { ...item, ...data, imageUrl: item.imageUrl, videoUrl: item.videoUrl };
      setSelectedItem(details);
    } catch {
      setSelectedItem(item);
    }
  };

  const requireAuth = (action: () => void) => {
    if (isAdminLoggedIn || fanToken) { action(); } else { setShowAuthModal(true); }
  };

  // ─── Loading skeleton ───
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center"><div className="h-5 w-40 bg-[#171717] rounded animate-pulse" /></div>
      </nav>
      <main className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center gap-8 py-10">
          <div className="w-36 h-36 rounded-full bg-[#171717] animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-48 bg-[#171717] rounded animate-pulse" />
            <div className="flex gap-8"><div className="h-5 w-16 bg-[#171717] rounded animate-pulse" /><div className="h-5 w-20 bg-[#171717] rounded animate-pulse" /><div className="h-5 w-20 bg-[#171717] rounded animate-pulse" /></div>
            <div className="h-4 w-64 bg-[#171717] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 md:gap-4 mt-4">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </main>
    </div>
  );

  // ─── Not Found ───
  if (!company) return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white">
      <div className="w-24 h-24 rounded-full bg-[#171717] border border-[#262626] flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">Community Not Found</h1>
      <p className="text-gray-500">The page you're looking for doesn't exist.</p>
    </div>
  );

  const currentItems = activeTab === 'posts' ? posts : reels;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 font-sans">
      {/* ──── Navbar ──── */}
      <nav className="border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#06b6d4] to-[#3b82f6] flex items-center justify-center text-xs font-black text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              {company.name?.charAt(0)}
            </span>
            {company.name}
          </span>
          <div className="flex items-center gap-3">
            {isAdminLoggedIn && (
              <span className="text-[10px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/20 px-3 py-1 rounded-full tracking-wider uppercase">
                Admin Mode
              </span>
            )}
            {fan && !isAdminLoggedIn && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#171717] border border-[#262626] flex items-center justify-center text-xs font-semibold text-cyan-400 overflow-hidden">
                  {fan.profileImage ? <img src={fan.profileImage} alt="" className="w-full h-full object-cover" /> : fan.name?.[0]}
                </div>
                <span className="text-sm text-gray-300 hidden sm:inline">{fan.name}</span>
              </div>
            )}
            <button
              onClick={() => !isAdminLoggedIn && !fanToken && setShowAuthModal(true)}
              className={`text-sm font-semibold px-5 py-2 rounded-full transition-all duration-300 ${isAdminLoggedIn || fanToken
                  ? 'bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 cursor-default'
                  : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                }`}
            >
              {isAdminLoggedIn ? '✅ Admin' : fanToken ? '✅ Joined' : 'Join Community'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4">
        {/* ──── Profile Header ──── */}
        <div className="flex flex-col md:flex-row items-center gap-8 pb-8 mb-2 mt-8 border-b border-[#1a1a1a]">
          {/* Avatar with glowing ring */}
          <div className="relative w-36 h-36 md:w-40 md:h-40 rounded-full flex-shrink-0 group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#06b6d4] to-[#3b82f6] opacity-60 blur-sm group-hover:opacity-80 transition-opacity duration-500" />
            <div className="relative w-full h-full rounded-full overflow-hidden border-[3px] border-[#0a0a0a]" style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.2)' }}>
              {company.avatar ? (
                <img src={getImgSrc(company.avatar)} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#171717] text-5xl text-gray-500 font-bold">{company.name?.charAt(0)}</div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">{company.name}</h1>

            {/* Stats Row */}
            <div className="flex justify-center md:justify-start gap-8 mb-4">
              <div className="text-center group cursor-default">
                <span className="text-xl font-bold text-white group-hover:text-[#06b6d4] transition-colors">{posts.length}</span>
                <p className="text-xs text-gray-500 font-medium">posts</p>
              </div>
              <div className="text-center group cursor-default">
                <span className="text-xl font-bold text-white group-hover:text-[#06b6d4] transition-colors">{fanCount}</span>
                <p className="text-xs text-gray-500 font-medium">followers</p>
              </div>
              <div className="text-center group cursor-default">
                <span className="text-xl font-bold text-white group-hover:text-[#06b6d4] transition-colors">0</span>
                <p className="text-xs text-gray-500 font-medium">following</p>
              </div>
            </div>

            {/* Bio */}
            {company.bio && (
              <p className="text-sm text-gray-300 whitespace-pre-line max-w-md leading-relaxed">{company.bio}</p>
            )}
          </div>
        </div>

        {/* ──── Tabs ──── */}
        <div className="flex border-b border-[#1a1a1a] mt-2 relative">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-4 text-sm font-semibold uppercase tracking-wider transition-colors relative ${activeTab === 'posts' ? 'text-[#06b6d4]' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              Posts
            </div>
            {activeTab === 'posts' && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-[#06b6d4] rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]" style={{ animation: 'slideIn 0.3s ease-out' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('reels')}
            className={`flex-1 py-4 text-sm font-semibold uppercase tracking-wider transition-colors relative ${activeTab === 'reels' ? 'text-[#06b6d4]' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Reels
            </div>
            {activeTab === 'reels' && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-[#06b6d4] rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]" style={{ animation: 'slideIn 0.3s ease-out' }} />
            )}
          </button>
        </div>

        {/* ──── Content Grid ──── */}
        <div className="grid grid-cols-3 gap-1 md:gap-4 mt-1 md:mt-4">
          {currentItems.length === 0 ? (
            <EmptyState type={activeTab} />
          ) : (
            currentItems.map((item) => {
              const imgSrc = item.type === 'reel' ? getImgSrc(item.videoUrl || null) : getImgSrc(item.imageUrl || null);
              return (
                <div
                  key={item.id}
                  className={`aspect-square bg-[#171717] md:rounded-2xl overflow-hidden relative cursor-pointer group border border-transparent hover:border-[#262626] transition-all duration-300 ${item.isPending ? 'opacity-70' : ''}`}
                  onClick={() => requireAuth(() => handleItemClick(item))}
                >
                  {item.isPending && (
                    <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-md border border-cyan-500/30 px-2 py-1 rounded-md flex items-center gap-1.5 shadow-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                      <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest leading-none">Scheduled</span>
                    </div>
                  )}
                  {item.type === 'reel' && item.videoUrl ? (
                    <video src={imgSrc!} className="w-full h-full object-cover pointer-events-none" muted />
                  ) : item.imageUrl ? (
                    <img src={imgSrc!} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  ) : (
                    <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center bg-gradient-to-br from-[#171717] to-[#1a1a1a]">
                      <p className="text-sm text-gray-400 font-medium leading-relaxed max-w-[90%] break-words">
                        {(item.caption || '').replace(/<[^>]*>/g, '').substring(0, 80)}
                        {(item.caption?.length || 0) > 80 ? '...' : ''}
                      </p>
                    </div>
                  )}

                  {/* Reel icon */}
                  {item.type === 'reel' && (
                    <div className="absolute top-3 right-3 text-white drop-shadow-lg">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center text-white gap-2 z-10 backdrop-blur-[1px]">
                    <div className="font-medium px-4 text-center text-xs mb-1 truncate w-full max-w-[90%] text-gray-200">
                      {(item.caption || '').replace(/<[^>]*>/g, '').split('\n')[0] || 'View'}
                    </div>
                    <div className="flex gap-5 font-bold text-sm">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                        {item.likeCount}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {item.commentCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ──── Modal ──── */}
      {selectedItem && (
        <ContentModal
          item={selectedItem}
          companyName={company.name}
          companyLogo={company.avatar}
          companyId={company.id}
          isAdminLoggedIn={isAdminLoggedIn}
          adminToken={adminToken}
          onClose={() => setSelectedItem(null)}
          onLikeUpdate={handleLikeUpdate}
          onCommentUpdate={handleCommentUpdate}
        />
      )}

      {/* ──── Fan Auth Modal ──── */}
      <FanAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        companyId={company.id}
      />

      {/* ──── Inline Styles for animations ──── */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideIn {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #404040; }
      `}</style>
    </div>
  );
}

export default function PublicFeedPage(props: { params: any }) {
  return (
    <FanAuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
        <PublicFeedContent params={props.params} />
      </Suspense>
    </FanAuthProvider>
  );
}
