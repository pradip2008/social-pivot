'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FiTrash2, FiRefreshCw } from 'react-icons/fi';

type StatusFilter = 'all' | 'draft' | 'pending' | 'processing' | 'sent' | 'failed' | 'fetched';

const STATUS_FILTERS: { key: StatusFilter; label: string; color: string; activeColor: string }[] = [
    { key: 'all', label: 'All', color: 'text-gray-400 border-gray-600 hover:border-gray-400', activeColor: 'text-white border-white bg-white/10' },
    { key: 'draft', label: '🟡 Draft', color: 'text-yellow-500 border-yellow-500/30 hover:border-yellow-500', activeColor: 'text-yellow-400 border-yellow-500 bg-yellow-500/10' },
    { key: 'pending', label: '🟠 Scheduled', color: 'text-orange-400 border-orange-500/30 hover:border-orange-400', activeColor: 'text-orange-400 border-orange-500 bg-orange-500/10' },
    { key: 'processing', label: '🔵 Publishing', color: 'text-blue-400 border-blue-500/30 hover:border-blue-400', activeColor: 'text-blue-400 border-blue-500 bg-blue-500/10' },
    { key: 'sent', label: '🟢 Sent ✓', color: 'text-green-500 border-green-500/30 hover:border-green-500', activeColor: 'text-green-400 border-green-500 bg-green-500/10' },
    { key: 'failed', label: '🔴 Failed ✗', color: 'text-red-500 border-red-500/30 hover:border-red-500', activeColor: 'text-red-400 border-red-500 bg-red-500/10' },
    { key: 'fetched', label: '📥 Fetched', color: 'text-purple-400 border-purple-500/30 hover:border-purple-400', activeColor: 'text-purple-400 border-purple-500 bg-purple-500/10' },
];

// Strip HTML tags for accurate content comparison
function stripHtml(html: string): string {
    return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().toLowerCase();
}

function PostsContent() {
    const searchParams = useSearchParams();
    const urlFilter = searchParams?.get('filter') as StatusFilter;

    const [allPosts, setAllPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<StatusFilter>(
        (urlFilter && ['all', 'draft', 'pending', 'processing', 'sent', 'failed', 'fetched'].includes(urlFilter)) 
        ? urlFilter 
        : 'all'
    );
    const [deleteConfirmPost, setDeleteConfirmPost] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const knownPostIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (urlFilter && ['all', 'draft', 'pending', 'processing', 'sent', 'failed', 'fetched'].includes(urlFilter)) {
            setActiveFilter(urlFilter);
        }
    }, [urlFilter]);

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncLog, setLastSyncLog] = useState<any>(null);

    useEffect(() => {
        fetchAllPosts();
        fetchLastSyncLog();

        // Auto-refresh every 30 seconds to pick up newly fetched posts
        const pollInterval = setInterval(() => {
            fetchAllPosts(true); // silent refresh (no loading spinner)
        }, 30000);

        return () => clearInterval(pollInterval);
    }, []);

    const fetchLastSyncLog = async () => {
        try {
            const { data } = await api.get('/sync/last-log');
            setLastSyncLog(data);
        } catch { /* silent */ }
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            const { data } = await api.post('/sync/manual-external');
            if (data.success) {
                toast.success(`📥 ${data.message}`, { duration: 5000 });
            } else {
                toast.error(data.message || 'Sync completed with errors', { duration: 5000 });
            }
            // Refresh posts and sync log
            await Promise.all([fetchAllPosts(), fetchLastSyncLog()]);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Sync failed');
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchAllPosts = async (silent = false) => {
        try {
            // Fetch ALL 3 data sources
            const [draftsRes, scheduledRes, publishedRes] = await Promise.all([
                api.get('/posts/drafts'),
                api.get('/scheduler/jobs'),
                api.get('/posts'),
            ]);

            // 1. Scheduled posts (pending, processing, sent, failed)
            const scheduledPosts = (scheduledRes.data || []).map((s: any) => {
                let status = (s.status || '').toLowerCase();
                // Map backend Title-Case/Specific names to frontend filter keys
                if (status === 'scheduled') status = 'pending';
                if (status === 'publishing') status = 'processing';
                
                return {
                    id: s.id,
                    _type: 'scheduled',
                    platform: s.platform,
                    content: s.content,
                    mediaUrl: s.mediaUrl,
                    status: status,
                    displayDate: s.scheduledAt || s.createdAt,
                };
            });

            // 2. Published posts (from Post table - already on public feed)
            // These may overlap with "sent" scheduled posts, so dedup by externalPostId
            const sentScheduledIds = new Set(scheduledPosts.filter((s: any) => s.status === 'sent').map((s: any) => s.id));
            
            const rawPublishedData = publishedRes.data?.data || publishedRes.data || [];
            
            const publishedPosts = [];
            
            for (const p of rawPublishedData) {
                // If it was already rendered as a Sent scheduled job, ignore it
                if (p.externalPostId && sentScheduledIds.has(p.externalPostId)) continue;
                
                publishedPosts.push({
                    id: p.id,
                    _type: 'published',
                    platform: p.platform,
                    content: p.content,
                    mediaUrl: p.mediaUrl,
                    status: p.source === 'external' ? 'fetched' : 'sent',
                    displayDate: p.publishedAt || p.createdAt,
                    source: p.source,
                });
            }

            // 3. Drafts - remove any that have been scheduled already
            // Use stripped HTML for comparison since ReactQuill adds HTML tags
            const scheduledContentSet = new Set(
                scheduledPosts.map((s: any) => stripHtml(s.content))
            );
            const publishedContentSet = new Set(
                rawPublishedData.map((p: any) => stripHtml(p.content))
            );

            const now = new Date();
            const drafts = (draftsRes.data || [])
                .filter((d: any) => {
                    const stripped = stripHtml(d.content);
                    return !scheduledContentSet.has(stripped) && !publishedContentSet.has(stripped);
                })
                .map((d: any) => {
                    return {
                        id: d.id,
                        _type: 'draft',
                        platform: d.platform,
                        content: d.content,
                        mediaUrl: d.mediaUrl,
                        status: 'draft',
                        displayDate: d.createdAt,
                    };
                });

            // Combine and sort newest first
            const combined = [...drafts, ...scheduledPosts, ...publishedPosts].sort(
                (a, b) => new Date(b.displayDate).getTime() - new Date(a.displayDate).getTime()
            );

            // Detect new fetched posts and show notification
            if (silent && knownPostIds.current.size > 0) {
                const newFetchedPosts = combined.filter(
                    p => (p.source === 'fetched' || p.source === 'external') && !knownPostIds.current.has(p.id)
                );
                if (newFetchedPosts.length > 0) {
                    toast.success(
                        `📥 ${newFetchedPosts.length} new post${newFetchedPosts.length > 1 ? 's' : ''} fetched from social media!`,
                        { duration: 5000, icon: '🔔' }
                    );
                }
            }

            // Update known post IDs
            knownPostIds.current = new Set(combined.map(p => p.id));

            setAllPosts(combined);
        } catch (error) {
            if (!silent) toast.error('Failed to load posts');
        } finally {
            setLoading(false);
        }
    };

    const executeDelete = async (force = false) => {
        if (!deleteConfirmPost) return;
        setIsDeleting(true);
        setDeleteError(null);
        const { id, _type } = deleteConfirmPost;
        
        try {
            if (_type === 'draft') {
                await api.delete(`/posts/drafts/${id}`);
                toast.success('Draft deleted successfully');
                setAllPosts(prev => prev.filter(p => p.id !== id));
                setDeleteConfirmPost(null);
            } else {
                const endpoint = force ? `/posts/${id}/force` : `/posts/${id}`;
                const { data } = await api.delete(endpoint);
                
                if (data.softDeleted) {
                    // Post was soft-deleted successfully
                    toast.success(data.metaDeleteFailed 
                        ? 'Post hidden from Social Pivot. Meta API delete may have failed.' 
                        : 'Post deleted from social media and hidden from Social Pivot.');
                    setAllPosts(prev => prev.filter(p => p.id !== id));
                    setDeleteConfirmPost(null);
                } else if (data.metaDeleteFailed && !force) {
                    // Meta API failed, offer admin option to force-delete
                    setDeleteError(data.metaError || 'Failed to delete from social media.');
                } else {
                    // Generic success fallback
                    toast.success('Post deleted successfully');
                    setAllPosts(prev => prev.filter(p => p.id !== id));
                    setDeleteConfirmPost(null);
                }
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete post');
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
            case 'pending': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
            case 'processing': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'sent': return 'bg-green-500/10 text-green-500 border-green-500/30';
            case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/30';
            case 'expired': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft': return 'Draft';
            case 'pending': return 'Scheduled';
            case 'processing': return 'Publishing...';
            case 'sent': return 'Sent ✓';
            case 'failed': return 'Failed ✗';
            case 'expired': return 'Expired';
            default: return status;
        }
    };

    const filteredPosts = activeFilter === 'all'
        ? allPosts
        : allPosts.filter(p => p.status === activeFilter);

    const getCountForStatus = (status: StatusFilter) => {
        if (status === 'all') return allPosts.length;
        return allPosts.filter(p => p.status === status).length;
    };

    // Clean content for display (strip HTML tags from ReactQuill output)
    const cleanContent = (content: string) => {
        return (content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    };

    if (loading) {
        return <div className="text-gray-400 flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            Loading Posts...
        </div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">
                    Posts & Drafts
                </h1>

                {/* Sync Now Button */}
                <div className="flex items-center gap-4">
                    {lastSyncLog && (
                        <div className="text-xs text-gray-500 text-right hidden md:block">
                            <div>Last sync: {new Date(lastSyncLog.createdAt).toLocaleString()}</div>
                            <div className={lastSyncLog.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                                {lastSyncLog.status === 'success'
                                    ? `${lastSyncLog.newPosts} new, ${lastSyncLog.duplicatesSkipped || 0} duplicates skipped`
                                    : `Failed: ${(lastSyncLog.message || '').substring(0, 50)}`
                                }
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-purple-500/20"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map(filter => {
                    const count = getCountForStatus(filter.key);
                    const isActive = activeFilter === filter.key;
                    return (
                        <button
                            key={filter.key}
                            onClick={() => setActiveFilter(filter.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${isActive ? filter.activeColor : filter.color}`}
                        >
                            {filter.label}
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Posts Table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                {filteredPosts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        {activeFilter === 'all'
                            ? 'No posts found. Start by generating a post using AI.'
                            : `No ${getStatusLabel(activeFilter).toLowerCase()} posts found.`
                        }
                    </div>
                ) : (
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-background/50 border-b border-border text-gray-400">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Platform</th>
                                <th className="px-6 py-4 font-semibold">Content</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredPosts.map((post: any) => (
                                <tr key={`${post._type}-${post.id}`} className="hover:bg-background/30 transition">
                                    <td className="px-6 py-4 font-medium text-white">{post.platform}</td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="line-clamp-2">{cleanContent(post.content)}</div>
                                        {(post.source === 'direct' || post.source === 'fetched' || post.source === 'external') && (
                                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] items-center font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                📥 Fetched from Social Media
                                            </span>
                                        )}
                                        {post.source === 'platform' && (
                                             <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] items-center font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                             🚀 From Social Pivot
                                         </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(post.status)}`}>
                                            {getStatusLabel(post.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                                        <div className="text-gray-500 mb-0.5">
                                            {post._type === 'draft' ? 'Created' : post.status === 'sent' ? 'Published' : 'Scheduled for'}
                                        </div>
                                        <div className="text-gray-300">
                                            {new Date(post.displayDate).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 flex items-center gap-3">
                                        <div className="flex flex-col items-start gap-1">
                                            {post.status === 'sent' && (
                                                <span className="text-green-500 text-xs font-bold">✓ Published</span>
                                            )}
                                            {post.status === 'failed' && (
                                                <span className="text-red-500 text-xs font-bold">⚠ Error</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => { setDeleteConfirmPost(post); setDeleteError(null); }}
                                            className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                                            title="Delete Post"
                                        >
                                            <FiTrash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteConfirmPost(null)} />
                    <div className="relative bg-[#111] border border-border p-6 rounded-xl w-full max-w-md shadow-2xl text-center space-y-5">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <FiTrash2 className="text-red-500 text-2xl" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Delete this post?</h2>
                        
                        {!deleteError ? (
                            <p className="text-gray-400 text-sm leading-relaxed">
                                This will permanently delete the post from Facebook/Instagram and hide it from your feed. This cannot be undone.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-left">
                                    <p className="text-red-400 text-xs font-bold mb-1">⚠ Social Media Delete Failed</p>
                                    <p className="text-gray-400 text-xs">{deleteError}</p>
                                </div>
                                <p className="text-gray-400 text-sm">
                                    Would you like to hide this post from Social Pivot anyway? The post may still be visible on the social media platform.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center mt-6">
                            <button
                                onClick={() => { setDeleteConfirmPost(null); setDeleteError(null); }}
                                disabled={isDeleting}
                                className="px-6 py-2 rounded-lg font-bold text-gray-400 border border-gray-600 hover:bg-white/5 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            {!deleteError ? (
                                <button
                                    onClick={() => executeDelete(false)}
                                    disabled={isDeleting}
                                    className="px-6 py-2 rounded-lg font-bold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => executeDelete(true)}
                                    disabled={isDeleting}
                                    className="px-6 py-2 rounded-lg font-bold bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete from Social Pivot Anyway'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PostsPage() {
    return (
        <Suspense fallback={<div className="text-center p-10 text-gray-500">Loading Posts...</div>}>
            <PostsContent />
        </Suspense>
    );
}
