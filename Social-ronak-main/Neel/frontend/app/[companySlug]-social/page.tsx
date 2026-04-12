'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getImgSrc(url: string | null) {
    if (!url) return '';
    return url.startsWith('http') ? url : BACKEND_URL + url;
}

interface PostInteraction {
    likeCount: number;
    shareCount: number;
    comments: { id: string; userName: string; content: string; createdAt: string }[];
    userLiked: boolean;
}

export default function PublicProfilePage() {
    const params = useParams();
    const slug = params?.slug as string;

    const [profile, setProfile] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [authUserId, setAuthUserId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // Interaction state
    const [interactions, setInteractions] = useState<Record<string, PostInteraction>>({});
    const [commentText, setCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);
    const commentInputRef = useRef<HTMLInputElement>(null);

    // Theme state
    const [themeColors, setThemeColors] = useState<any>(null);

    // Check for existing auth on mount
    useEffect(() => {
        const token = localStorage.getItem('social_pivot_public_token');
        const userId = localStorage.getItem('social_pivot_public_userId');
        if (token && userId) {
            setAuthToken(token);
            setAuthUserId(userId);
            setIsAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        if (!slug) return;
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${API_BASE}/public/profile/${slug}`);
                if (!res.ok) throw new Error('Not found');
                const data = await res.json();
                setProfile(data.company);
                setPosts(data.posts);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [slug]);

    // Fetch interactions for all posts
    useEffect(() => {
        if (posts.length === 0) return;
        posts.forEach(post => fetchInteractions(post.id));
    }, [posts, authUserId]);

    const fetchInteractions = async (postId: string) => {
        try {
            const url = `${API_BASE}/social/posts/${postId}/interactions${authUserId ? `?userId=${authUserId}` : ''}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setInteractions(prev => ({ ...prev, [postId]: data }));
            }
        } catch { /* silent */ }
    };

    useEffect(() => {
        if (profile?.themeJson) {
            try {
                const parsed = JSON.parse(profile.themeJson);
                setThemeColors(parsed);
            } catch (e) {
                console.error("Failed to parse Public Theme JSON:", e);
            }
        }
    }, [profile?.themeJson]);

    // Apply CSS Variables on load
    useEffect(() => {
        const root = document.documentElement;
        if (themeColors?.colors) {
            const { primary, accent, background, surface, text_primary, text_muted, primary_contrast } = themeColors.colors;
            root.style.setProperty('--theme-primary', primary);
            root.style.setProperty('--theme-accent', accent);
            root.style.setProperty('--theme-bg', background);
            root.style.setProperty('--theme-surface', surface);
            root.style.setProperty('--theme-text', text_primary);
            root.style.setProperty('--theme-text-muted', text_muted);
            root.style.setProperty('--theme-primary-contrast', primary_contrast);
            root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${primary}, ${accent})`);
        }
        return () => {
            root.style.removeProperty('--theme-primary');
            root.style.removeProperty('--theme-accent');
            root.style.removeProperty('--theme-bg');
            root.style.removeProperty('--theme-surface');
            root.style.removeProperty('--theme-text');
            root.style.removeProperty('--theme-text-muted');
            root.style.removeProperty('--theme-primary-contrast');
            root.style.removeProperty('--theme-gradient');
        }
    }, [themeColors]);

    const handleProtectedAction = (actionLabel: string, actionCallback: () => void) => {
        if (isAuthenticated) {
            actionCallback();
        } else {
            setPendingAction(() => actionCallback);
            setShowAuthModal(true);
        }
    };

    const handleGoogleSignIn = async () => {
        const toastId = toast.loading('Signing in with Google...');
        try {
            const endpoint = `${API_BASE}/auth/google`;
            const name = `Guest ${Math.floor(Math.random() * 100)}`;
            const email = `guest${Math.floor(Math.random() * 10000)}@gmail.com`;
            
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name })
            });
            
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            
            if (data.token) {
                localStorage.setItem('social_pivot_public_token', data.token);
                localStorage.setItem('social_pivot_public_userId', data.userId || data.user?.id || '');
                setAuthToken(data.token);
                setAuthUserId(data.userId || data.user?.id || '');
                setIsAuthenticated(true);
                setShowAuthModal(false);
                toast.success(`Signed in as ${name}!`, { id: toastId });
                
                if (pendingAction) {
                    setTimeout(() => pendingAction(), 500);
                    setPendingAction(null);
                }
            } else {
                throw new Error('No token returned');
            }
        } catch (error) {
            console.error(error);
            toast.error('Sign in failed', { id: toastId });
        }
    };

    // ─── Real Social Interactions ───

    const handleLike = (postId: string) => {
        handleProtectedAction('Like', async () => {
            // Optimistic update
            setInteractions(prev => {
                const current = prev[postId] || { likeCount: 0, shareCount: 0, comments: [], userLiked: false };
                return {
                    ...prev,
                    [postId]: {
                        ...current,
                        userLiked: !current.userLiked,
                        likeCount: current.userLiked ? current.likeCount - 1 : current.likeCount + 1,
                    }
                };
            });

            try {
                const res = await fetch(`${API_BASE}/social/posts/${postId}/like`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                });
                if (res.ok) {
                    const data = await res.json();
                    setInteractions(prev => ({
                        ...prev,
                        [postId]: { ...prev[postId], likeCount: data.count, userLiked: data.liked }
                    }));
                }
            } catch {
                // Revert on failure
                fetchInteractions(postId);
                toast.error('Failed to like post');
            }
        });
    };

    const handleComment = (postId: string) => {
        handleProtectedAction('Comment', () => {
            setShowComments(true);
            setTimeout(() => commentInputRef.current?.focus(), 200);
        });
    };

    const handleSubmitComment = async (postId: string) => {
        if (!commentText.trim() || commentText.length > 500) {
            toast.error(commentText.length > 500 ? 'Max 500 characters' : 'Enter a comment');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/social/posts/${postId}/comment`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: commentText.trim() }),
            });
            if (res.ok) {
                const newComment = await res.json();
                setInteractions(prev => ({
                    ...prev,
                    [postId]: {
                        ...prev[postId],
                        comments: [newComment, ...(prev[postId]?.comments || [])],
                    }
                }));
                setCommentText('');
                toast.success('Comment posted!');
            }
        } catch { toast.error('Failed to post comment'); }
    };

    const handleShare = (postId: string) => {
        handleProtectedAction('Share', async () => {
            const shareUrl = window.location.href;
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied to clipboard! 🔗');
                // Log share in backend
                fetch(`${API_BASE}/social/posts/${postId}/share`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                }).catch(() => {});
            } catch {
                toast.success('Share link ready');
            }
        });
    };

    if (loading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
            <p className="text-gray-400">The page you're looking for doesn't exist.</p>
        </div>
    );

    const themePrimary = themeColors?.colors ? themeColors.colors.primary : '#06b6d4';
    const themeGradient = themeColors?.colors ? `linear-gradient(135deg, ${themeColors.colors.primary}, ${themeColors.colors.accent})` : 'linear-gradient(135deg, #06b6d4, #3b82f6)';

    const getPostInteraction = (postId: string): PostInteraction => {
        return interactions[postId] || { likeCount: 0, shareCount: 0, comments: [], userLiked: false };
    };

    return (
        <div className="min-h-screen bg-background text-white pb-20">
            {/* Navbar */}
            <nav className="border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">
                        {profile.name}
                    </span>
                    <button onClick={() => handleProtectedAction('Sign In', () => toast.success('You are already signed in!'))} className="text-sm font-semibold bg-white text-black px-5 py-2 rounded-full hover:bg-gray-200 transition">
                        {isAuthenticated ? '✅ Signed In' : 'Sign In'}
                    </button>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 pt-10">
                {/* ─── Profile Header ─── */}
                <div className="flex flex-col md:flex-row items-center gap-8 pb-10 mb-8 border-b border-border">
                    {/* Avatar */}
                    <div className="w-32 h-32 md:w-44 md:h-44 rounded-full flex-shrink-0 overflow-hidden" style={{ border: `3px solid ${themePrimary}`, boxShadow: `0 0 30px ${themePrimary}40` }}>
                        {profile.logoUrl ? (
                            <img src={getImgSrc(profile.logoUrl)} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-surface text-6xl text-gray-500 font-bold">{profile.name.charAt(0)}</div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left">
                        <h1 className="text-3xl font-bold mb-4">{profile.name}</h1>
                        <div className="flex justify-center md:justify-start gap-8 mb-6">
                            <div className="text-center"><span className="font-bold text-xl">{posts.length}</span> <span className="text-gray-400">posts</span></div>
                            <div className="text-center"><span className="font-bold text-xl">0</span> <span className="text-gray-400">followers</span></div>
                            <div className="text-center"><span className="font-bold text-xl">0</span> <span className="text-gray-400">following</span></div>
                        </div>
                        <div className="text-base text-gray-200 whitespace-pre-line max-w-lg">{profile.bio || 'Welcome to our official page!'}</div>
                        <button onClick={() => handleProtectedAction('Follow', () => toast.success(`You are now following ${profile.name}!`))} className="mt-6 px-8 py-2.5 rounded-lg text-sm font-bold text-black w-full md:w-auto" style={{ background: themePrimary }}>
                            Follow
                        </button>
                    </div>
                </div>

                {/* ─── Post Grid ─── */}
                <div className="grid grid-cols-3 gap-1 md:gap-3">
                    {posts.length === 0 ? (
                        <div className="col-span-3 text-center py-20 text-gray-500">
                            <div className="text-5xl mb-4">📷</div>
                            <p className="text-lg font-medium">No posts yet</p>
                        </div>
                    ) : (
                        posts.map(post => {
                            const pi = getPostInteraction(post.id);
                            return (
                                <div key={post.id} onClick={() => { setSelectedPost(post); setShowComments(false); setCommentText(''); }} className="aspect-square bg-[#1a1a1a] relative group cursor-pointer overflow-hidden rounded-none">
                                    {post.mediaUrl ? (
                                        <img src={getImgSrc(post.mediaUrl)} alt="Post" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                                            <p className="text-[13px] text-gray-300 font-medium leading-relaxed max-w-[90%]">
                                                {(post.content || '').replace(/<[^>]*>/g, '').substring(0, 80)}
                                                {post.content?.length > 80 ? '...' : ''}
                                            </p>
                                            <div className="absolute bottom-3 left-3 opacity-60 flex items-center gap-1">
                                                {post.platform === 'facebook' && <span className="text-blue-500 font-bold text-lg">f</span>}
                                                {post.platform === 'instagram' && <span className="text-pink-500 font-bold text-lg">ig</span>}
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 transition-opacity duration-200">
                                        <span className="text-white font-bold flex items-center gap-1.5"><span className="text-xl">♥</span> {pi.likeCount}</span>
                                        <span className="text-white font-bold flex items-center gap-1.5"><span className="text-xl">💬</span> {pi.comments.length}</span>
                                        <span className="text-white font-bold flex items-center gap-1.5"><span className="text-xl">↗</span> {pi.shareCount || 0}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>

            {/* ─── Post Detail Modal ─── */}
            {selectedPost && (() => {
                const pi = getPostInteraction(selectedPost.id);
                return (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 md:p-4" onClick={() => setSelectedPost(null)}>
                        <div className="bg-surface rounded-xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden border border-border max-h-[95vh] md:max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="w-full md:w-3/5 bg-black flex items-center justify-center min-h-[300px] md:min-h-0 relative">
                                {selectedPost.mediaUrl ? (
                                    <img src={getImgSrc(selectedPost.mediaUrl)} alt="Post" className="max-w-full max-h-[50vh] md:max-h-[90vh] object-contain" />
                                ) : (
                                    <div className="p-8 text-center text-gray-500 text-lg">No media</div>
                                )}
                            </div>
                            <div className="w-full md:w-2/5 flex flex-col h-[40vh] md:h-[90vh]">
                                {/* Header */}
                                <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-surface">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full overflow-hidden" style={{ border: `2px solid ${themePrimary}` }}>
                                            {profile.logoUrl ? <img src={getImgSrc(profile.logoUrl)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs font-bold">{profile.name[0]}</div>}
                                        </div>
                                        <span className="font-semibold text-sm">{profile.name}</span>
                                    </div>
                                    <button className="text-gray-400 hover:text-white" onClick={() => setSelectedPost(null)}>✕</button>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex-1 overflow-y-auto">
                                    <div className="text-sm whitespace-pre-line text-gray-200 leading-relaxed mb-4">
                                        {(selectedPost.content || '').replace(/<[^>]*>/g, '')}
                                    </div>

                                    {/* Comments Section */}
                                    {showComments && pi.comments.length > 0 && (
                                        <div className="border-t border-border pt-4 space-y-3">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Comments ({pi.comments.length})</h4>
                                            <div className="space-y-3 max-h-48 overflow-y-auto">
                                                {pi.comments.map((c: any) => (
                                                    <div key={c.id} className="flex items-start gap-2.5">
                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: `${themePrimary}25`, color: themePrimary }}>
                                                            {(c.userName || 'G')[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-semibold text-white">{c.userName}</span>
                                                                <span className="text-[10px] text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-300 mt-0.5">{c.content}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="p-4 border-t border-border bg-surface">
                                    <div className="flex gap-4 mb-3">
                                        <button 
                                            onClick={() => handleLike(selectedPost.id)} 
                                            className="group flex items-center gap-2 hover:text-white transition"
                                            style={{ color: pi.userLiked ? '#ef4444' : 'var(--theme-text-muted, #9ca3af)' }}
                                        >
                                            <span className={`transition ${pi.userLiked ? 'scale-110' : 'group-hover:scale-110'}`}>{pi.userLiked ? '❤️' : '🤍'}</span>
                                            <span className="text-sm font-semibold">{pi.likeCount}</span>
                                        </button>
                                        <button 
                                            onClick={() => handleComment(selectedPost.id)} 
                                            className="group flex items-center gap-2 hover:text-white transition"
                                            style={{ color: 'var(--theme-text-muted, #9ca3af)' }}
                                        >
                                            <span className="group-hover:text-blue-400 transition">💬</span>
                                            <span className="text-sm font-semibold">{pi.comments.length}</span>
                                        </button>
                                        <button 
                                            onClick={() => handleShare(selectedPost.id)} 
                                            className="group flex items-center gap-2 hover:text-white transition ml-auto"
                                            style={{ color: 'var(--theme-text-muted, #9ca3af)' }}
                                        >
                                            <span className="group-hover:text-green-400 transition">🔄</span> Share
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium mb-3">
                                        {pi.likeCount} likes • {new Date(selectedPost.publishedAt || selectedPost.createdAt).toLocaleDateString()}
                                    </div>

                                    {/* Comment Input */}
                                    {showComments && isAuthenticated && (
                                        <div className="flex gap-2 mt-2">
                                            <input
                                                ref={commentInputRef}
                                                type="text"
                                                placeholder="Add a comment..."
                                                value={commentText}
                                                onChange={e => setCommentText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSubmitComment(selectedPost.id)}
                                                maxLength={500}
                                                className="flex-1 bg-black border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-600"
                                            />
                                            <button
                                                onClick={() => handleSubmitComment(selectedPost.id)}
                                                disabled={!commentText.trim()}
                                                className="px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40 transition"
                                                style={{ background: themePrimary }}
                                            >
                                                Post
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ─── Google Sign-In Gating Modal ─── */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                    <div className="bg-surface p-8 rounded-2xl w-full max-w-sm border border-border text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: themeGradient || themePrimary }} />
                        <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">✕</button>
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">🔒</span>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-white">Sign in to interact</h3>
                        <p className="text-gray-400 text-sm mb-6">Like, comment, and share posts by signing in with Google.</p>
                        
                        <button 
                            onClick={handleGoogleSignIn}
                            className="w-full bg-white text-black hover:bg-gray-100 font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-3 mb-3"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>
                        <button
                            onClick={() => { setShowAuthModal(false); setPendingAction(null); }}
                            className="w-full text-gray-400 hover:text-white py-2.5 text-sm font-medium transition"
                        >
                            Maybe Later
                        </button>
                        <p className="text-xs text-gray-500 mt-4">
                            By continuing, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
