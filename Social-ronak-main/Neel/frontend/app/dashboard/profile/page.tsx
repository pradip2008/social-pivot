'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001';

function getImgSrc(url: string) {
    if (!url) return '';
    return url.startsWith('http') ? url : BACKEND_URL + url;
}

type ProfileTab = 'posts' | 'scheduled' | 'failed';

export default function CompanyProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', logoUrl: '', bio: '' });
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [postEditForm, setPostEditForm] = useState({ content: '', mediaUrl: '' });
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    
    // Bio editing state
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioCache, setBioCache] = useState('');

    // Interactions
    const [interactions, setInteractions] = useState<Record<string, any>>({});

    // Logo theme state
    const [useLogoTheme, setUseLogoTheme] = useState(false);
    const [themeColors, setThemeColors] = useState<any>(null);
    const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/auth/profile');
            setUser(data);
            setProfile(data.company);
            setEditForm({ name: data.company.name || '', logoUrl: data.company.logoUrl || '', bio: data.company.bio || '' });
            setBioCache(data.company.bio || '');
        } catch { toast.error('Failed to load profile'); }
    };

    const fetchInteractions = async (postId: string) => {
        try {
            const { data } = await api.get(`/feed/posts/${postId}`);
            setInteractions(prev => ({ ...prev, [postId]: data }));
        } catch {}
    };

    const fetchPosts = async () => {
        try { 
            const { data } = await api.get('/posts'); 
            setPosts(data.data || data);
            (data.data || data).forEach((p: any) => fetchInteractions(p.id));
        }
        catch { toast.error('Failed to load posts'); }
    };

    const fetchScheduledPosts = async () => {
        try { const { data } = await api.get('/scheduler/jobs'); setScheduledPosts(data); }
        catch { /* silent — scheduler may have no jobs */ }
    };

    useEffect(() => { fetchProfile(); fetchPosts(); fetchScheduledPosts(); }, []);

    // Load saved theme on mount if exists
    useEffect(() => {
        if (profile?.themeJson) {
            try {
                const parsed = JSON.parse(profile.themeJson);
                setThemeColors(parsed);
                setUseLogoTheme(true);
            } catch (e) { console.error('Failed to parse theme', e); }
        }
    }, [profile?.themeJson]);

    // Apply/remove dynamic theme via CSS variables on root
    useEffect(() => {
        const root = document.documentElement;
        if (useLogoTheme && themeColors?.colors) {
            const { primary, accent, background, surface, text_primary, text_muted, primary_contrast } = themeColors.colors;
            root.style.setProperty('--theme-primary', primary);
            root.style.setProperty('--theme-accent', accent);
            root.style.setProperty('--theme-bg', background);
            root.style.setProperty('--theme-surface', surface);
            root.style.setProperty('--theme-text', text_primary);
            root.style.setProperty('--theme-text-muted', text_muted);
            root.style.setProperty('--theme-primary-contrast', primary_contrast);
            root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${primary}, ${accent})`);
        } else {
            root.style.removeProperty('--theme-primary');
            root.style.removeProperty('--theme-accent');
            root.style.removeProperty('--theme-bg');
            root.style.removeProperty('--theme-surface');
            root.style.removeProperty('--theme-text');
            root.style.removeProperty('--theme-text-muted');
            root.style.removeProperty('--theme-primary-contrast');
            root.style.removeProperty('--theme-gradient');
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
        };
    }, [useLogoTheme, themeColors]);

    const themePrimary = useLogoTheme && themeColors?.colors ? themeColors.colors.primary : '#06b6d4';
    const themeGradient = useLogoTheme && themeColors?.colors ? `linear-gradient(135deg, ${themeColors.colors.primary}, ${themeColors.colors.accent})` : 'linear-gradient(135deg, #06b6d4, #3b82f6)';

    const handleGenerateTheme = async () => {
        if (!profile?.logoUrl) { toast.error('Please upload a logo first'); return; }
        setIsGeneratingTheme(true);
        const toastId = toast.loading('AI is analyzing your logo and generating an accessible theme...');
        try {
            const { data } = await api.post('/ai/theme/generate', { logoUrl: profile.logoUrl });
            setThemeColors(data);
            setUseLogoTheme(true);
            toast.success('Theme generated successfully! Preview it now.', { id: toastId });
        } catch (error: any) {
            console.error(error);
            const status = error.response?.status;
            if (status >= 400 && status < 600) {
                toast.error('Theme generation unavailable — check your AI API key in Settings', { id: toastId });
            } else {
                toast.error('Failed to generate theme. Please try again.', { id: toastId });
            }
        } finally { setIsGeneratingTheme(false); }
    };

    const handleApplyTheme = async () => {
        if (!themeColors) return;
        const toastId = toast.loading('Applying theme globally...');
        try {
            await api.post('/ai/theme/apply', { theme: themeColors });
            toast.success('Theme applied to public profile!', { id: toastId });
            setProfile({ ...profile, themeJson: JSON.stringify(themeColors) });
        } catch { toast.error('Failed to apply theme', { id: toastId }); }
    };

    const handleSaveBio = async () => {
        setIsEditingBio(false);
        if (bioCache === profile.bio) return;
        try {
            await api.put('/auth/company', { ...editForm, bio: bioCache });
            setProfile({ ...profile, bio: bioCache });
            toast.success('Bio updated');
        } catch {
            setBioCache(profile.bio || '');
            toast.error('Failed to update bio');
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put('/auth/company', editForm);
            toast.success('Profile updated!');
            setIsEditingProfile(false);
            fetchProfile();
        } catch { toast.error('Failed to update profile'); }
    };

    const handleDeletePost = async (postId: string) => {
        if (!confirm('Delete this post?')) return;
        try {
            await api.delete(`/posts/${postId}`);
            toast.success('Post deleted');
            setSelectedPost(null);
            fetchPosts();
        } catch { toast.error('Failed to delete post'); }
    };

    const handleUpdatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put(`/posts/${selectedPost.id}`, postEditForm);
            toast.success('Post updated!');
            setIsEditingPost(false);
            setSelectedPost(null);
            fetchPosts();
        } catch { toast.error('Failed to update post'); }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingLogo(true);
        const toastId = toast.loading('Uploading logo...');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            await api.put('/auth/company', { name: profile.name, bio: profile.bio || '', logoUrl: uploadRes.data.url });
            toast.success('Logo updated!', { id: toastId });
            setProfile({ ...profile, logoUrl: uploadRes.data.url });
            setEditForm({ ...editForm, logoUrl: uploadRes.data.url });
        } catch { toast.error('Failed to upload logo', { id: toastId }); }
        finally { setIsUploadingLogo(false); }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match'); return; }
        try {
            await api.put('/auth/password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
            toast.success('Password updated!');
            setIsChangingPassword(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to update password'); }
    };

    const handleShareProfile = () => {
        const slug = profile?.slug;
        if (!slug) { toast.error('No profile slug found'); return; }
        const url = `${window.location.origin}/feed/${slug}`;
        navigator.clipboard.writeText(url);
        toast.success('Feed link copied to clipboard!');
        window.open(url, '_blank');
    };

    // ─── Social Interactions ───
    const handleLike = async (postId: string) => {
        try {
            await api.post(`/social/posts/${postId}/like`);
            fetchInteractions(postId);
        } catch { toast.error('Failed to like post'); }
    };

    const handleShare = async (postId: string) => {
        const url = `${window.location.origin}/post/${postId}`;
        try {
            await navigator.clipboard.writeText(url);
            toast.success('Post link copied! 🔗');
            await api.post(`/social/posts/${postId}/share`);
            fetchInteractions(postId);
        } catch {}
    };

    const [commentText, setCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);

    const handleCommentSubmit = async (postId: string) => {
        if (!commentText.trim()) return;
        try {
            await api.post(`/social/posts/${postId}/comment`, { content: commentText.trim() });
            fetchInteractions(postId);
            setCommentText('');
            toast.success('Comment added');
        } catch { toast.error('Failed to add comment'); }
    };

    // ─── Derive grid items based on active tab ───
    const getGridItems = () => {
        if (activeTab === 'posts') return posts;
        if (activeTab === 'scheduled') return scheduledPosts.filter((j: any) => j.status?.toLowerCase() === 'scheduled');
        if (activeTab === 'failed') return scheduledPosts.filter((j: any) => j.status?.toLowerCase() === 'failed');
        return posts;
    };

    const getPostStatusBadge = (post: any) => {
        if (activeTab === 'posts') return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">PUBLISHED</span>;
        const s = (post.status || '').toLowerCase();
        if (s === 'scheduled') return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">SCHEDULED</span>;
        if (s === 'failed') return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">FAILED</span>;
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">{(post.status || 'PENDING').toUpperCase()}</span>;
    };

    const gridItems = getGridItems();

    const tabs: { key: ProfileTab; label: string; count: number }[] = [
        { key: 'posts', label: 'Posts', count: posts.length },
        { key: 'scheduled', label: 'Scheduled', count: scheduledPosts.filter((j: any) => j.status?.toLowerCase() === 'scheduled').length },
        { key: 'failed', label: 'Failed', count: scheduledPosts.filter((j: any) => j.status?.toLowerCase() === 'failed').length },
    ];

    if (!profile) return (
        <div className="flex items-center justify-center h-[50vh]">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto pb-20 mt-8">

            {/* ─── Profile Header ─── */}
            <div className="flex flex-col md:flex-row items-center gap-8 pb-8 mb-6 border-b border-border">
                {/* Avatar */}
                <div className="relative w-36 h-36 md:w-40 md:h-40 rounded-full flex-shrink-0 group overflow-hidden" style={{ border: `3px solid ${themePrimary}`, boxShadow: `0 0 20px ${themePrimary}30` }}>
                    {profile.logoUrl ? (
                        <img src={getImgSrc(profile.logoUrl)} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface text-5xl text-gray-500 font-bold">{profile.name.charAt(0)}</div>
                    )}
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <svg className="w-6 h-6 text-white mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-xs text-white font-medium">Change Photo</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                        <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
                        <div className="flex gap-2 justify-center md:justify-start">
                            <button onClick={() => setIsEditingProfile(true)} className="px-4 py-1.5 rounded-lg text-sm font-semibold border border-border bg-surface hover:bg-gray-800 transition">Edit Profile</button>
                            <button onClick={handleShareProfile} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-black" style={{ background: themePrimary }}>Share Profile</button>
                            <button onClick={() => setIsChangingPassword(true)} className="px-4 py-1.5 rounded-lg text-sm font-semibold border border-border bg-surface hover:bg-gray-800 transition">🔒 Password</button>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex justify-center md:justify-start gap-8 mb-4">
                        <div className="text-center"><span className="text-xl font-bold text-white">{posts.length}</span><p className="text-xs text-gray-400">posts</p></div>
                        <div className="text-center"><span className="text-xl font-bold text-white">0</span><p className="text-xs text-gray-400">followers</p></div>
                        <div className="text-center"><span className="text-xl font-bold text-white">0</span><p className="text-xs text-gray-400">following</p></div>
                    </div>

                    {/* Bio */}
                    <div className="flex items-start gap-2 mb-2 group max-w-md">
                        {isEditingBio ? (
                            <textarea
                                autoFocus
                                value={bioCache}
                                onChange={e => setBioCache(e.target.value)}
                                onBlur={handleSaveBio}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSaveBio()}
                                className="w-full bg-black/50 border border-primary/50 rounded p-2 text-sm text-white focus:outline-none focus:border-primary resize-none"
                                rows={3}
                            />
                        ) : (
                            <>
                                <div className="text-sm text-gray-300 whitespace-pre-line flex-1">
                                    {profile.bio || 'No bio yet. Add one.'}
                                </div>
                                <button
                                    onClick={() => setIsEditingBio(true)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition"
                                >
                                    ✏️
                                </button>
                            </>
                        )}
                    </div>

                    {/* Theme Controls */}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        {profile.logoUrl && (
                            <button
                                onClick={handleGenerateTheme}
                                disabled={isGeneratingTheme}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/80 transition disabled:opacity-50 text-black flex items-center gap-2"
                            >
                                {isGeneratingTheme ? '✨ Generating...' : '✨ Generate AI Theme'}
                            </button>
                        )}
                        
                        {themeColors && (
                            <>
                                <button
                                    onClick={() => setUseLogoTheme(!useLogoTheme)}
                                    className="text-sm font-semibold px-4 py-2 rounded-lg border transition"
                                    style={useLogoTheme ? { borderColor: themePrimary, color: themePrimary, background: `${themePrimary}15` } : { borderColor: '#404040', color: '#9ca3af' }}
                                >
                                    {useLogoTheme ? '👁️ Previewing Theme' : 'Preview Theme'}
                                </button>
                                {useLogoTheme && (
                                    <button 
                                        onClick={handleApplyTheme} 
                                        className="text-sm font-semibold px-4 py-2 rounded-lg transition text-black"
                                        style={{ background: themePrimary }}
                                    >
                                        Save & Apply Publicly
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Tab Navigation ─── */}
            <div className="flex border-b border-border mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-3 text-sm font-semibold tracking-wide uppercase transition relative ${
                            activeTab === tab.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {tab.label}
                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                            activeTab === tab.key ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
                        }`}>{tab.count}</span>
                        {activeTab === tab.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: themePrimary }} />
                        )}
                    </button>
                ))}
            </div>

            {/* ─── Post Grid ─── */}
            <div className="grid grid-cols-3 gap-1 md:gap-3">
                {gridItems.length === 0 ? (
                    <div className="col-span-3 text-center py-20 text-gray-500">
                        <div className="text-5xl mb-4">{activeTab === 'posts' ? '📸' : activeTab === 'scheduled' ? '📅' : '⚠️'}</div>
                        <p className="text-lg font-medium">
                            {activeTab === 'posts' && 'No posts yet'}
                            {activeTab === 'scheduled' && 'No scheduled posts'}
                            {activeTab === 'failed' && 'No failed posts'}
                        </p>
                        <p className="text-sm">
                            {activeTab === 'posts' && 'Start sharing content to see it here.'}
                            {activeTab === 'scheduled' && 'Schedule posts from the Create & Schedule page.'}
                            {activeTab === 'failed' && 'No failed posts — great job! 🎉'}
                        </p>
                    </div>
                ) : (
                    gridItems.map((post: any) => {
                        const pi = interactions[post.id] || { likeCount: 0, shareCount: 0, comments: [], userLiked: false };
                        return (
                        <div
                            key={post.id}
                            onClick={() => { setSelectedPost(post); setPostEditForm({ content: post.content, mediaUrl: post.mediaUrl || '' }); }}
                            className="aspect-square bg-[#1a1a1a] relative group cursor-pointer overflow-hidden"
                        >
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
                    )})
                )}
            </div>

            {/* ─── Profile Edit Modal ─── */}
            {isEditingProfile && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface p-6 rounded-xl w-full max-w-md border border-border">
                        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Company Name</label>
                                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-black border border-border rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Logo URL</label>
                                <input type="text" value={editForm.logoUrl} onChange={e => setEditForm({ ...editForm, logoUrl: e.target.value })} className="w-full bg-black border border-border rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Bio</label>
                                <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} className="w-full bg-black border border-border rounded-lg p-2.5 text-white focus:border-primary focus:outline-none h-24 resize-none" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsEditingProfile(false)} className="px-4 py-2 rounded-lg hover:bg-gray-800 text-sm text-gray-300">Cancel</button>
                                <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: themePrimary }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Password Modal ─── */}
            {isChangingPassword && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface p-6 rounded-xl w-full max-w-md border border-border">
                        <h2 className="text-xl font-bold mb-4">Change Password</h2>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div><label className="block text-sm text-gray-400 mb-1">Current Password</label><input type="password" required value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="w-full bg-black border border-border rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" /></div>
                            <div><label className="block text-sm text-gray-400 mb-1">New Password</label><input type="password" required value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full bg-black border border-border rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" /></div>
                            <div><label className="block text-sm text-gray-400 mb-1">Confirm New Password</label><input type="password" required value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="w-full bg-black border border-border rounded-lg p-2.5 text-white focus:border-primary focus:outline-none" /></div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsChangingPassword(false)} className="px-4 py-2 rounded-lg hover:bg-gray-800 text-sm text-gray-300">Cancel</button>
                                <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: themePrimary }}>Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Post Detail Modal (Instagram Style) ─── */}
            {selectedPost && (() => {
                const pi = interactions[selectedPost.id] || { likeCount: 0, shareCount: 0, comments: [], userLiked: false };
                return (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedPost(null); setIsEditingPost(false); }}>
                    <div className="bg-surface rounded-xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden border border-border max-h-[95vh] md:max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        {/* Media Side */}
                        <div className="w-full md:w-3/5 bg-black flex items-center justify-center min-h-[300px] md:min-h-0 relative">
                            {selectedPost.mediaUrl ? (
                                <img src={getImgSrc(selectedPost.mediaUrl)} alt="Post" className="max-w-full max-h-[50vh] md:max-h-[90vh] object-contain" />
                            ) : (
                                <div className="p-8 text-center flex flex-col items-center justify-center w-full h-full">
                                    <div className="text-6xl text-gray-700 mb-6">❝</div>
                                    <p className="text-xl md:text-2xl text-gray-200 font-medium leading-relaxed max-w-md italic">
                                        {(selectedPost.content || '').replace(/<[^>]*>/g, '')}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Content Side */}
                        <div className="w-full md:w-2/5 flex flex-col h-[40vh] md:h-[90vh] bg-[#1f1f1f]">
                            {/* Header */}
                            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-[#1f1f1f] z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden" style={{ border: `2px solid ${themePrimary}` }}>
                                        {profile.logoUrl ? <img src={getImgSrc(profile.logoUrl)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs font-bold">{profile.name[0]}</div>}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm text-white">{profile.name}</span>
                                        <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                                            {selectedPost.platform === 'facebook' && <span className="text-blue-500 font-bold">f</span>}
                                            {selectedPost.platform === 'instagram' && <span className="text-pink-500 font-bold">ig</span>}
                                            {selectedPost.platform}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {getPostStatusBadge(selectedPost)}
                                    <button className="text-gray-400 hover:text-white" onClick={() => { setSelectedPost(null); setIsEditingPost(false); }}>✕</button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 overflow-y-auto">
                                {isEditingPost ? (
                                    <form onSubmit={handleUpdatePost} className="space-y-4">
                                        <textarea value={postEditForm.content} onChange={e => setPostEditForm({ ...postEditForm, content: e.target.value })} className="w-full bg-black border border-border rounded-lg p-3 text-white focus:border-primary focus:outline-none h-32 resize-none text-sm" />
                                        <input type="text" value={postEditForm.mediaUrl} onChange={e => setPostEditForm({ ...postEditForm, mediaUrl: e.target.value })} className="w-full bg-black border border-border rounded-lg p-2.5 text-white focus:border-primary focus:outline-none text-sm" placeholder="Media URL" />
                                        <div className="flex gap-2">
                                            <button type="submit" className="flex-1 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: themePrimary }}>Save</button>
                                            <button type="button" onClick={() => setIsEditingPost(false)} className="flex-1 bg-gray-800 text-white py-2 rounded-lg text-sm">Cancel</button>
                                        </div>
                                    </form>
                                ) : (
                                    <>
                                        <div className="text-sm whitespace-pre-line text-gray-200 leading-relaxed mb-4">
                                            {(selectedPost.content || '').replace(/<[^>]*>/g, '')}
                                        </div>
                                        
                                        {/* Comments Section */}
                                        {showComments && pi.comments.length > 0 && (
                                            <div className="border-t border-border pt-4 space-y-3 mt-4">
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
                                    </>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="p-4 border-t border-border bg-[#1f1f1f]">
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
                                        onClick={() => setShowComments(!showComments)} 
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
                                    {new Date(selectedPost.publishedAt || selectedPost.createdAt).toLocaleDateString()}
                                </div>
                                
                                {activeTab === 'posts' && (
                                    <div className="flex justify-between text-xs mt-3 pt-3 border-t border-border/50">
                                        <button onClick={() => setIsEditingPost(true)} className="text-gray-400 hover:text-white font-medium transition">Edit Post</button>
                                        <button onClick={() => handleDeletePost(selectedPost.id)} className="text-red-500 hover:text-red-400 font-medium transition">Delete Post</button>
                                    </div>
                                )}

                                {/* Comment Input */}
                                {showComments && (
                                    <div className="flex gap-2 mt-4">
                                        <input
                                            type="text"
                                            placeholder="Write a comment..."
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCommentSubmit(selectedPost.id)}
                                            maxLength={500}
                                            className="flex-1 bg-black border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-600"
                                        />
                                        <button
                                            onClick={() => handleCommentSubmit(selectedPost.id)}
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
        </div>
    );
}
