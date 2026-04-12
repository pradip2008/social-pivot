'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
    FiUsers, FiBriefcase, FiShield, FiPlus, FiSearch, FiX, FiTrash2,
    FiCheckCircle, FiEye, FiChevronLeft, FiChevronRight, FiExternalLink,
    FiHeart, FiMessageCircle, FiShare2, FiArrowLeft, FiSend, FiCalendar,
    FiActivity, FiMoreVertical
} from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getImgSrc(url: string | null) {
    if (!url) return '';
    return url.startsWith('http') ? url : BACKEND_URL + url;
}

const ROWS_PER_PAGE = 10;

// ─────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────
export default function AdminDashboard() {
    const [users, setUsers] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [roleUpdating, setRoleUpdating] = useState<string | null>(null);

    // Create-setup modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [creating, setCreating] = useState(false);

    // Profile Viewer state
    const [profilePanel, setProfilePanel] = useState<any>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [selectedPost, setSelectedPost] = useState<any>(null);

    // Google Auth Gate state (for social interactions)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [authUserId, setAuthUserId] = useState<string | null>(null);
    const [showAuthGate, setShowAuthGate] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // Comment input state
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    useEffect(() => {
        fetchData();
        const token = localStorage.getItem('social_pivot_public_token');
        const userId = localStorage.getItem('social_pivot_public_userId');
        if (token && userId) {
            setAuthToken(token);
            setAuthUserId(userId);
            setIsAuthenticated(true);
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, companiesRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/companies')
            ]);
            setUsers(usersRes.data);
            setCompanies(companiesRes.data);
        } catch (error) {
            toast.error('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string, userName: string) => {
        setRoleUpdating(userId);
        try {
            await api.put(`/admin/users/${userId}/role`, { role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            toast.success(`Role updated to ${newRole.toUpperCase()} for ${userName}`, { duration: 3000 });
        } catch (error) {
            toast.error('Update failed');
        } finally {
            setRoleUpdating(null);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('Are you sure you want to delete this user? This action is permanent.')) return;
        try {
            await api.post(`/admin/users/${userId}/delete`);
            setUsers(users.filter(u => u.id !== userId));
            if (profilePanel?.user?.id === userId) {
                setProfilePanel(null);
                setSelectedPost(null);
            }
            toast.success('User deleted');
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    const handleViewProfile = async (userId: string) => {
        setProfileLoading(true);
        setProfilePanel(null);
        setSelectedPost(null);
        try {
            const { data } = await api.get(`/admin/users/${userId}/profile`);
            setProfilePanel(data);
        } catch (error) {
            toast.error('Could not load profile');
        } finally {
            setProfileLoading(false);
        }
    };

    const handleCreateSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.post('/admin/users', { name, email, password, companyName });
            toast.success('New setup complete!');
            setIsModalOpen(false);
            setName(''); setEmail(''); setPassword(''); setCompanyName('');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Setup failed');
        } finally {
            setCreating(false);
        }
    };

    // ─── Filtering & Pagination ───
    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        return u.name.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            u.company?.name?.toLowerCase().includes(term) ||
            u.role?.toLowerCase().includes(term);
    });

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    // ─── Google Auth Gate ───
    const handleProtectedAction = (actionCallback: () => void) => {
        if (isAuthenticated) {
            actionCallback();
        } else {
            setPendingAction(() => actionCallback);
            setShowAuthGate(true);
        }
    };

    const handleGoogleSignIn = async () => {
        const toastId = toast.loading('Signing in with Google...');
        try {
            const guestName = `Guest ${Math.floor(Math.random() * 100)}`;
            const guestEmail = `guest${Math.floor(Math.random() * 10000)}@gmail.com`;
            const res = await fetch(`${API_BASE}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: guestEmail, name: guestName })
            });
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            if (data.token) {
                localStorage.setItem('social_pivot_public_token', data.token);
                localStorage.setItem('social_pivot_public_userId', data.userId || data.user?.id || '');
                setAuthToken(data.token);
                setAuthUserId(data.userId || data.user?.id || '');
                setIsAuthenticated(true);
                setShowAuthGate(false);
                toast.success(`Signed in as ${guestName}!`, { id: toastId });
                if (pendingAction) {
                    setTimeout(() => pendingAction(), 500);
                    setPendingAction(null);
                }
            } else {
                throw new Error('No token returned');
            }
        } catch (error) {
            toast.error('Sign in failed', { id: toastId });
        }
    };

    // ─── Social Interactions ───
    const handleLikePost = (postId: string) => {
        handleProtectedAction(async () => {
            try {
                await fetch(`${API_BASE}/social/posts/${postId}/like`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: authUserId }),
                });
                if (profilePanel) handleViewProfile(profilePanel.user.id);
                toast.success('Like toggled');
            } catch { toast.error('Like failed'); }
        });
    };

    const handleSharePost = (postId: string) => {
        handleProtectedAction(async () => {
            try {
                await fetch(`${API_BASE}/social/posts/${postId}/share`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: authUserId }),
                });
                toast.success('Shared!');
            } catch { toast.error('Share failed'); }
        });
    };

    const handleCommentPost = async (postId: string) => {
        if (!commentText.trim()) return;
        setSubmittingComment(true);
        try {
            await fetch(`${API_BASE}/social/posts/${postId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authUserId, content: commentText.trim(), userName: 'Admin' }),
            });
            setCommentText('');
            toast.success('Comment posted');
            if (profilePanel) {
                const { data } = await api.get(`/admin/users/${profilePanel.user.id}/profile`);
                setProfilePanel(data);
                if (selectedPost) {
                    const updated = data.recentPosts.find((p: any) => p.id === selectedPost.id);
                    if (updated) setSelectedPost(updated);
                }
            }
        } catch { toast.error('Comment failed'); }
        finally { setSubmittingComment(false); }
    };

    // ─── Render ───
    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="font-medium text-sm text-gray-500">Loading admin data...</p>
        </div>
    );

    const panelOpen = profilePanel !== null || profileLoading;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">

            {/* ─── HEADER ─── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center">
                            <FiShield className="text-black" size={20} />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            Admin Center
                        </h1>
                    </div>
                    <p className="text-gray-500 text-sm ml-[52px]">Manage users, companies and platform access</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-primary text-black font-bold py-2.5 px-6 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-cyan-500/20"
                >
                    <FiPlus size={18} />
                    New Setup
                </button>
            </div>

            {/* ─── STAT CARDS ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FiUsers size={22} />} title="Total Users" value={users.length} gradient="from-cyan-500/20 to-cyan-600/5" iconBg="bg-cyan-500/15 text-cyan-400" />
                <StatCard icon={<FiBriefcase size={22} />} title="Companies" value={companies.length} gradient="from-blue-500/20 to-blue-600/5" iconBg="bg-blue-500/15 text-blue-400" />
                <StatCard icon={<FiActivity size={22} />} title="Roles Active" value={3} gradient="from-purple-500/20 to-purple-600/5" iconBg="bg-purple-500/15 text-purple-400" />
                <StatCard icon={<FiCheckCircle size={22} />} title="Server Status" value="Online" isOnline gradient="from-green-500/20 to-green-600/5" iconBg="bg-green-500/15 text-green-400" />
            </div>

            {/* ─── USERS TABLE ─── */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/20">
                {/* Table Header */}
                <div className="p-5 border-b border-border flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FiUsers className="text-primary" size={16} />
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-base">Platform Users</h2>
                            <p className="text-xs text-gray-500">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found</p>
                        </div>
                    </div>
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="bg-background border border-border rounded-xl pl-9 pr-8 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all w-full md:w-72 placeholder-gray-600"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition">
                                <FiX size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider bg-black/30">
                            <tr>
                                <th className="px-6 py-3.5">User</th>
                                <th className="px-6 py-3.5">Company</th>
                                <th className="px-6 py-3.5">Role</th>
                                <th className="px-6 py-3.5">Joined</th>
                                <th className="px-6 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-500">
                                            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
                                                <FiSearch size={24} className="opacity-30" />
                                            </div>
                                            <p className="font-medium text-sm">No users match your search</p>
                                            <button onClick={() => setSearchTerm('')} className="text-xs text-primary hover:underline">Clear search</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedUsers.map(user => (
                                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-cyan-600/10 border border-border flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                                                {user.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-white text-sm truncate">{user.name}</div>
                                                <div className="text-[11px] text-gray-500 truncate">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-md bg-surface border border-border/50 flex items-center justify-center">
                                                <FiBriefcase size={11} className="text-gray-500" />
                                            </div>
                                            <span className="text-gray-300 text-sm">{user.company?.name || 'No Company'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="bg-background border border-border/60 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition disabled:opacity-50 cursor-pointer appearance-none"
                                                value={user.role}
                                                onChange={e => handleRoleChange(user.id, e.target.value, user.name)}
                                                disabled={roleUpdating === user.id}
                                            >
                                                <option value="member">Member</option>
                                                <option value="editor">Editor</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            {roleUpdating === user.id && (
                                                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-gray-400" title={format(new Date(user.createdAt), 'PPpp')}>
                                            {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleViewProfile(user.id)}
                                                className="text-gray-400 hover:text-primary hover:bg-primary/10 transition-all p-2 rounded-lg"
                                                title={`View ${user.name}'s Profile`}
                                            >
                                                <FiEye size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all p-2 rounded-lg"
                                                title="Delete User"
                                            >
                                                <FiTrash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredUsers.length > ROWS_PER_PAGE && (
                    <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-black/20 text-xs text-gray-500">
                        <span>Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}</span>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition disabled:opacity-30 disabled:hover:border-border disabled:hover:text-gray-500"
                            >
                                <FiChevronLeft size={12} /> Prev
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition disabled:opacity-30 disabled:hover:border-border disabled:hover:text-gray-500"
                            >
                                Next <FiChevronRight size={12} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── CREATE SETUP MODAL ─── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-surface border border-border p-8 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50 space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <FiBriefcase className="text-primary" size={18} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">New Setup</h2>
                                    <p className="text-xs text-gray-500">Create a company + admin account</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition p-1"><FiX size={18} /></button>
                        </div>
                        <form onSubmit={handleCreateSetup} className="space-y-3.5">
                            <div>
                                <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Company Name</label>
                                <input placeholder="Acme Inc." className="w-full bg-background border border-border p-3 rounded-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition text-sm" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Admin Name</label>
                                <input placeholder="John Doe" className="w-full bg-background border border-border p-3 rounded-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition text-sm" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Admin Email</label>
                                <input type="email" placeholder="john@acme.com" className="w-full bg-background border border-border p-3 rounded-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition text-sm" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Password</label>
                                <input type="password" placeholder="Min 6 characters" className="w-full bg-background border border-border p-3 rounded-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition text-sm" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                            </div>
                            <button disabled={creating} className="w-full bg-gradient-to-r from-primary to-cyan-600 text-black font-bold py-3 rounded-xl hover:brightness-110 disabled:opacity-50 mt-2 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition">
                                {creating && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                                {creating ? 'Creating...' : 'Create Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── PROFILE VIEWER SLIDE-IN ─── */}
            {panelOpen && (
                <div className="fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => { setProfilePanel(null); setSelectedPost(null); }}
                    />
                    <div className="absolute right-0 top-0 h-full w-full max-w-[500px] bg-background border-l border-border overflow-y-auto shadow-2xl shadow-black/50 animate-slideInRight">
                        {/* Close */}
                        <button
                            onClick={() => { setProfilePanel(null); setSelectedPost(null); }}
                            className="fixed top-5 right-5 z-50 text-gray-400 hover:text-white hover:bg-white/10 p-2.5 rounded-xl transition"
                        >
                            <FiX size={18} />
                        </button>

                        {profileLoading ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-4">
                                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <p className="text-sm text-gray-500">Loading profile...</p>
                            </div>
                        ) : profilePanel && !selectedPost ? (
                            /* ─── Profile View ─── */
                            <div className="p-7 space-y-6">
                                {/* User Header */}
                                <div className="flex items-center gap-4">
                                    <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center text-black text-2xl font-bold flex-shrink-0 shadow-lg shadow-cyan-500/20">
                                        {profilePanel.user.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xl font-bold text-white truncate">{profilePanel.user.name}</h3>
                                        <p className="text-sm text-gray-500 truncate">{profilePanel.user.email}</p>
                                        {profilePanel.user.company && (
                                            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                                                <FiBriefcase size={11} />
                                                {profilePanel.user.company.name}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    <RoleBadge role={profilePanel.user.role} />
                                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                        <FiCalendar size={10} />
                                        Member since {format(new Date(profilePanel.user.createdAt), 'MMM d, yyyy')}
                                    </span>
                                </div>

                                <button
                                    onClick={async () => {
                                        try {
                                            const { data } = await api.get(`/admin/users/${profilePanel.user.id}/profile-url`);
                                            window.open(data.profileUrl, '_blank');
                                        } catch { toast.error('Profile URL not available'); }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 text-sm text-primary border border-primary/30 rounded-xl py-3 hover:bg-primary/10 transition font-semibold bg-primary/5"
                                >
                                    Open Public Feed <FiExternalLink size={14} />
                                </button>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3">
                                    <MiniStat label="Total Posts" value={profilePanel.stats.totalPosts} color="text-cyan-400" bg="bg-cyan-500/5" />
                                    <MiniStat label="Scheduled" value={profilePanel.stats.scheduledPosts} color="text-blue-400" bg="bg-blue-500/5" />
                                    <MiniStat label="Failed" value={profilePanel.stats.failedPosts} color="text-red-400" bg="bg-red-500/5" />
                                </div>

                                {/* Recent Posts */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Recent Posts</h4>
                                    {profilePanel.recentPosts.length === 0 ? (
                                        <div className="text-center py-10 text-gray-600 text-sm bg-surface/50 rounded-xl border border-border/50">
                                            <p className="text-2xl mb-2">📝</p>
                                            No posts yet
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {profilePanel.recentPosts.map((post: any) => (
                                                <button
                                                    key={post.id}
                                                    onClick={() => { setSelectedPost(post); setCommentText(''); }}
                                                    className="relative aspect-square rounded-xl overflow-hidden bg-surface border border-border/50 hover:border-primary/50 transition-all group"
                                                >
                                                    {post.mediaUrl ? (
                                                        <img src={getImgSrc(post.mediaUrl)} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center p-2.5">
                                                            <p className="text-[10px] text-gray-400 line-clamp-4 leading-tight">{post.content?.slice(0, 60)}</p>
                                                        </div>
                                                    )}
                                                    <span className="absolute bottom-1 left-1 text-[8px] bg-black/80 text-white px-1.5 py-0.5 rounded-md font-bold uppercase backdrop-blur-sm">
                                                        {post.platform === 'facebook' ? 'FB' : post.platform === 'instagram' ? 'IG' : post.platform?.slice(0, 2).toUpperCase()}
                                                    </span>
                                                    <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-black/50 ${post.status === 'Published' ? 'bg-green-400' :
                                                        post.status === 'Scheduled' ? 'bg-blue-400' : 'bg-red-400'
                                                        }`} />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white gap-2 z-10">
                                                        <span className="font-semibold px-3 text-center text-[10px] truncate w-full max-w-[90%]">
                                                            {(post.caption || post.content || '').replace(/<[^>]*>/g, '').split('\n')[0] || 'View'}
                                                        </span>
                                                        <div className="flex gap-4 font-bold text-xs">
                                                            <span className="flex items-center gap-1"><FiHeart size={10} /> {post.likeCount}</span>
                                                            <span className="flex items-center gap-1"><FiMessageCircle size={10} /> {post.commentCount}</span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {profilePanel.recentPosts.length > 0 && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const { data } = await api.get(`/admin/users/${profilePanel.user.id}/profile-url`);
                                                    window.open(data.profileUrl, '_blank');
                                                } catch { toast.error('Profile URL not available'); }
                                            }}
                                            className="mt-3 text-xs text-primary hover:underline w-full text-center block"
                                        >
                                            View all {profilePanel.stats.totalPosts} posts →
                                        </button>
                                    )}
                                </div>

                                {/* Quick Actions */}
                                {profilePanel.recentPosts.length > 0 && (
                                    <div className="pt-4 border-t border-border">
                                        <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-3">Quick Actions</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleProtectedAction(() => handleLikePost(profilePanel.recentPosts[0].id))}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-gray-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition text-sm font-medium"
                                            >
                                                <FiHeart size={14} /> Like
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleProtectedAction(() => {
                                                        setSelectedPost(profilePanel.recentPosts[0]);
                                                        setCommentText('');
                                                    });
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-gray-400 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition text-sm font-medium"
                                            >
                                                <FiMessageCircle size={14} /> Comment
                                            </button>
                                            <button
                                                onClick={() => handleProtectedAction(() => handleSharePost(profilePanel.recentPosts[0].id))}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-gray-400 hover:text-green-400 hover:border-green-500/30 hover:bg-green-500/5 transition text-sm font-medium"
                                            >
                                                <FiShare2 size={14} /> Share
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : profilePanel && selectedPost ? (
                            /* ─── Post Detail View ─── */
                            <div className="p-7 space-y-5">
                                <button
                                    onClick={() => setSelectedPost(null)}
                                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
                                >
                                    <FiArrowLeft size={14} /> Back to profile
                                </button>

                                {selectedPost.mediaUrl && (
                                    <div className="rounded-2xl overflow-hidden max-h-[260px] border border-border/50">
                                        <img src={getImgSrc(selectedPost.mediaUrl)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                )}

                                <div className="text-sm text-gray-300 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                                    {selectedPost.content}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${selectedPost.platform === 'facebook' ? 'text-blue-400 bg-blue-500/10' :
                                        selectedPost.platform === 'instagram' ? 'text-pink-400 bg-pink-500/10' :
                                            'text-gray-400 bg-gray-500/10'
                                        }`}>
                                        {selectedPost.platform}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${selectedPost.status === 'Published' ? 'text-green-400 bg-green-500/10' :
                                        selectedPost.status === 'Scheduled' ? 'text-blue-400 bg-blue-500/10' :
                                            'text-red-400 bg-red-500/10'
                                        }`}>
                                        {selectedPost.status}
                                    </span>
                                    <span className="text-[10px] text-gray-500">
                                        {selectedPost.publishedAt ? format(new Date(selectedPost.publishedAt), 'PPpp') : format(new Date(selectedPost.createdAt), 'PPpp')}
                                    </span>
                                </div>

                                <div className="flex gap-5 text-xs text-gray-400">
                                    <span className="flex items-center gap-1.5"><FiHeart size={13} /> {selectedPost.likeCount} likes</span>
                                    <span className="flex items-center gap-1.5"><FiMessageCircle size={13} /> {selectedPost.commentCount} comments</span>
                                </div>

                                {selectedPost.comments && selectedPost.comments.length > 0 && (
                                    <div className="space-y-3 max-h-48 overflow-y-auto">
                                        <p className="text-[10px] uppercase font-bold text-gray-600 tracking-widest">Comments</p>
                                        {selectedPost.comments.map((c: any) => (
                                            <div key={c.id} className="flex gap-2.5 items-start">
                                                <div className="w-7 h-7 rounded-lg bg-surface border border-border/50 flex items-center justify-center text-[9px] text-gray-400 font-bold flex-shrink-0">
                                                    {c.userName?.[0]?.toUpperCase() || 'G'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-white">{c.userName}</span>
                                                        <span className="text-[9px] text-gray-600">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-0.5">{c.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 pt-3 border-t border-border">
                                    <button
                                        onClick={() => handleLikePost(selectedPost.id)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-gray-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition text-xs font-medium"
                                    >
                                        <FiHeart size={13} /> Like
                                    </button>
                                    <button
                                        onClick={() => handleSharePost(selectedPost.id)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-gray-400 hover:text-green-400 hover:border-green-500/30 hover:bg-green-500/5 transition text-xs font-medium"
                                    >
                                        <FiShare2 size={13} /> Share
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Add a comment..."
                                            maxLength={500}
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleProtectedAction(() => handleCommentPost(selectedPost.id));
                                                }
                                            }}
                                            className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition placeholder-gray-600"
                                        />
                                        <button
                                            onClick={() => handleProtectedAction(() => handleCommentPost(selectedPost.id))}
                                            disabled={!commentText.trim() || submittingComment}
                                            className="bg-primary text-black px-4 py-2.5 rounded-xl hover:brightness-110 transition disabled:opacity-40 flex items-center gap-1.5 text-sm font-bold shadow-lg shadow-cyan-500/10"
                                        >
                                            {submittingComment ? <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <FiSend size={13} />}
                                            Post
                                        </button>
                                    </div>
                                    <p className="text-right text-[10px] text-gray-600">{commentText.length}/500</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* ─── Google Auth Gate Modal ─── */}
            {showAuthGate && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowAuthGate(false); setPendingAction(null); }} />
                    <div className="relative bg-surface border border-border rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center space-y-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
                            <FiShield size={24} className="text-black" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Sign in to interact</h3>
                        <p className="text-sm text-gray-400">Like, comment, and share posts by signing in with your Google account.</p>
                        <button
                            onClick={handleGoogleSignIn}
                            className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-100 transition shadow-lg"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                            Continue with Google
                        </button>
                        <button
                            onClick={() => { setShowAuthGate(false); setPendingAction(null); }}
                            className="text-sm text-gray-500 hover:text-white transition"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            )}

            {/* Slide-in animation */}
            <style jsx>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slideInRight {
                    animation: slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────

function StatCard({ icon, title, value, isOnline, gradient, iconBg }: any) {
    return (
        <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} border border-border p-5 rounded-2xl hover:border-primary/30 transition-all group`}>
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center transition`}>
                    {icon}
                </div>
                <div>
                    <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest">{title}</p>
                    <div className="text-2xl font-black text-white flex items-center gap-2 mt-0.5">
                        {value}
                        {isOnline && (
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const config: Record<string, string> = {
        admin: 'text-red-400 bg-red-500/10 border-red-500/20',
        editor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        member: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${config[role] || config.member}`}>
            {role}
        </span>
    );
}

function MiniStat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
    return (
        <div className={`${bg} rounded-xl p-3.5 text-center border border-border/30`}>
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1">{label}</div>
        </div>
    );
}
