'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// Real SVG logos for social platforms
const FacebookIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const InstagramIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
);

const TwitterXIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const LinkedInIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
);

const PLATFORMS = [
    {
        key: 'facebook',
        name: 'Facebook',
        icon: <FacebookIcon />,
        color: 'from-[#1877F2] to-[#0C5DC7]',
        borderColor: 'border-[#1877F2]',
        bgColor: 'bg-[#1877F2]/10',
        textColor: 'text-[#1877F2]',
        description: 'Post to your Facebook Pages via Meta Graph API.',
        fields: [
            { key: 'accessToken', label: 'User Access Token (from Graph Explorer)', placeholder: 'EAAxxxxxxx...', type: 'password' },
            { key: 'pageId', label: 'Facebook Page ID', placeholder: '123456789012345', type: 'text' },
            { key: 'appId', label: 'App ID (optional)', placeholder: 'Your Meta App ID', type: 'text' },
            { key: 'appSecret', label: 'App Secret (optional)', placeholder: 'Your Meta App Secret', type: 'password' },
        ],
        helpUrl: 'https://developers.facebook.com/docs/pages/getting-started',
    },
    {
        key: 'instagram',
        name: 'Instagram',
        icon: <InstagramIcon />,
        color: 'from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
        borderColor: 'border-[#DD2A7B]',
        bgColor: 'bg-[#DD2A7B]/10',
        textColor: 'text-[#DD2A7B]',
        description: 'Publish photos and reels via Meta Graph API.',
        fields: [
            { key: 'accessToken', label: 'User Access Token (from Graph Explorer)', placeholder: 'EAAxxxxxxx...', type: 'password' },
            { key: 'igAccountId', label: 'Instagram Account ID', placeholder: '17841xxxxxxxxx', type: 'text' },
            { key: 'appId', label: 'App ID (optional)', placeholder: 'Your Meta App ID', type: 'text' },
            { key: 'appSecret', label: 'App Secret (optional)', placeholder: 'Your Meta App Secret', type: 'password' },
        ],
        helpUrl: 'https://developers.facebook.com/docs/instagram-api',
    },
    {
        key: 'twitter',
        name: 'Twitter / X',
        icon: <TwitterXIcon />,
        color: 'from-[#14171A] to-[#333639]',
        borderColor: 'border-[#536471]',
        bgColor: 'bg-[#14171A]/20',
        textColor: 'text-gray-300',
        description: 'Tweet automatically to your X account using OAuth 1.0a.',
        fields: [
            { key: 'apiKey', label: 'API Key', placeholder: 'Your API Key', type: 'password' },
            { key: 'apiSecret', label: 'API Secret', placeholder: 'Your API Secret', type: 'password' },
            { key: 'accessToken', label: 'Access Token', placeholder: 'Your Access Token', type: 'password' },
            { key: 'accessTokenSecret', label: 'Access Token Secret', placeholder: 'Your Access Token Secret', type: 'password' },
        ],
        helpUrl: 'https://developer.twitter.com/en/docs/authentication/oauth-1-0a',
    },
    {
        key: 'linkedin',
        name: 'LinkedIn',
        icon: <LinkedInIcon />,
        color: 'from-[#0A66C2] to-[#004182]',
        borderColor: 'border-[#0A66C2]',
        bgColor: 'bg-[#0A66C2]/10',
        textColor: 'text-[#0A66C2]',
        description: 'Share posts on your LinkedIn profile or company page.',
        fields: [
            { key: 'accessToken', label: 'OAuth 2.0 Access Token', placeholder: 'AQXxxxxxx...', type: 'password' },
            { key: 'authorUrn', label: 'Author URN (Person or Organization)', placeholder: 'urn:li:person:xxxxxx', type: 'text' },
        ],
        helpUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/',
    },
];

interface PlatformConnection {
    platform: string;
    isConnected: boolean;
    isActive: boolean;
    pageId: string;
    igAccountId: string;
    appId: string;
    authorUrn: string;
    expiresAt: string | null;
    lastUpdated: string | null;
    lastFetchAt: string | null;
    health?: {
        lastSuccessfulPost: string | null;
        lastSync: string | null;
        totalPosts: number;
    };
}

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const oauthHandledRef = useRef(false);
    const [connections, setConnections] = useState<PlatformConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [testing, setTesting] = useState<Record<string, boolean>>({});
    const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
    const [fetchingMetadata, setFetchingMetadata] = useState<Record<string, boolean>>({});
    const [metadata, setMetadata] = useState<Record<string, any[]>>({});
    const [showMetaWarning, setShowMetaWarning] = useState<boolean>(true);
    const [connectErrors, setConnectErrors] = useState<Record<string, string>>({});

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordChanging, setPasswordChanging] = useState(false);

    useEffect(() => {
        fetchConnections();
        if (sessionStorage.getItem('hideMetaWarning')) {
            setShowMetaWarning(false);
        }

        const processOAuthCallback = async () => {
            if (typeof window === 'undefined' || oauthHandledRef.current) return;

            // Meta implicit token callback
            const tokenFromUrl = searchParams?.get('token');
            let tokenFromHash: string | null = null;
            if (window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                tokenFromHash = hashParams.get('access_token');
            }
            const oauthToken = tokenFromUrl || tokenFromHash;
            if (oauthToken) {
                oauthHandledRef.current = true;
                setInputs(prev => ({
                    ...prev,
                    facebook: { ...(prev.facebook || {}), accessToken: oauthToken },
                    instagram: { ...(prev.instagram || {}), accessToken: oauthToken },
                }));
                toast.success('Meta token received. Click Validate Token to connect.', {
                    duration: 6000,
                    icon: '??',
                });
                window.history.replaceState({}, '', `${window.location.origin}/dashboard/settings`);
                return;
            }

            // LinkedIn auth code callback
            const linkedInCode = searchParams?.get('code');
            const linkedInState = searchParams?.get('state') || '';
            if (linkedInCode && linkedInState.startsWith('linkedin_')) {
                oauthHandledRef.current = true;
                try {
                    const redirectUri = `${window.location.origin}/dashboard/settings`;
                    const { data } = await api.post('/meta/linkedin/exchange-code', {
                        code: linkedInCode,
                        redirectUri,
                    });

                    setInputs(prev => ({
                        ...prev,
                        linkedin: {
                            ...(prev.linkedin || {}),
                            accessToken: data?.accessToken || '',
                            authorUrn: data?.authorUrn || prev?.linkedin?.authorUrn || '',
                        },
                    }));

                    toast.success('LinkedIn token fetched via OAuth. Click Connect LinkedIn to save it.', {
                        duration: 7000,
                    });
                } catch (error: any) {
                    const msg = error?.response?.data?.message || 'LinkedIn OAuth code exchange failed';
                    toast.error(msg, { duration: 7000 });
                } finally {
                    window.history.replaceState({}, '', `${window.location.origin}/dashboard/settings`);
                }
            }
        };

        processOAuthCallback();
    }, [searchParams]);

    const fetchConnections = async () => {
        try {
            const { data } = await api.get('/meta/platforms');
            setConnections(data);

            // Initialize inputs only for platforms that don't have them yet
            setInputs(prev => {
                const next = { ...prev };
                PLATFORMS.forEach(p => {
                    if (!next[p.key]) {
                        next[p.key] = {};
                        p.fields.forEach(f => { next[p.key][f.key] = ''; });
                    }

                    // Pre-fill existing IDs if connected
                    const conn = data.find((c: any) => c.platform === p.key);
                    if (conn) {
                        if (conn.pageId) next[p.key].pageId = conn.pageId;
                        if (conn.igAccountId) next[p.key].igAccountId = conn.igAccountId;
                    }
                });
                return next;
            });
        } catch {
            toast.error('Failed to load connections');
        } finally {
            setLoading(false);
        }
    };

    const setField = (platform: string, field: string, value: string) => {
        setInputs(prev => ({
            ...prev,
            [platform]: { ...prev[platform], [field]: value },
        }));
    };

    const handleConnect = async (platformKey: string) => {
        const vals = inputs[platformKey] || {};
        if (!vals.accessToken) {
            toast.error('Access Token is required');
            return;
        }

        const platform = PLATFORMS.find(p => p.key === platformKey);

        // Allow proceeding without ID if we want the backend to try auto-discovery
        if (platformKey === 'facebook' && !vals.pageId) {
            // Frontend permits proceeding; Backend will attempt discovery.
        }

        // Clear previous error for this platform
        setConnectErrors(prev => ({ ...prev, [platformKey]: '' }));

        setSaving(prev => ({ ...prev, [platformKey]: true }));
        try {
            const { data } = await api.post('/meta/test-and-save', {
                platform: platformKey,
                accessToken: vals.accessToken,
                pageId: vals.pageId || undefined,
                igAccountId: vals.igAccountId || undefined,
                appId: vals.appId || undefined,
                appSecret: vals.appSecret || undefined,
            });

            if (data.success) {
                toast.success(`✅ ${data.message}`);
                setConnectErrors(prev => ({ ...prev, [platformKey]: '' }));
                fetchConnections();
                setMetadata(prev => ({ ...prev, [platformKey]: [] }));

                // Partially clear sensitive fields
                setField(platformKey, 'accessToken', '');
            } else {
                const msg = data.message || 'Connection failed';
                toast.error(`❌ ${msg}`);
                setConnectErrors(prev => ({ ...prev, [platformKey]: msg }));
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Connection failed';
            toast.error(`❌ ${msg}`);
            setConnectErrors(prev => ({ ...prev, [platformKey]: msg }));
        } finally {
            setSaving(prev => ({ ...prev, [platformKey]: false }));
        }
    };

    const handleDisconnect = async (platformKey: string) => {
        const platform = PLATFORMS.find(p => p.key === platformKey);
        if (!confirm(`Disconnect ${platform?.name || platformKey}? Scheduled posts using this connection will be paused until reconnected.`)) return;
        setSaving(prev => ({ ...prev, [platformKey]: true }));
        try {
            await api.delete(`/meta/platform/${platformKey}`);
            toast.success(`${platform?.name || platformKey} disconnected`);
            fetchConnections();
        } catch {
            toast.error('Failed to disconnect');
        } finally {
            setSaving(prev => ({ ...prev, [platformKey]: false }));
        }
    };

    const handleOAuthConnect = async (platformKey: string) => {
        try {
            const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/settings` : '';
            const { data } = await api.get(`/meta/oauth-url?platform=${platformKey}&redirectUri=${encodeURIComponent(redirectUri)}`);
            if (data.url) {
                window.location.href = data.url;
            } else {
                if (platformKey === 'linkedin') {
                    toast.error('LinkedIn OAuth is not available. Configure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET on backend first.', { duration: 7000 });
                } else {
                    toast.error('Meta OAuth is not available. Configure META_APP_ID on backend first.', { duration: 7000 });
                }
            }
        } catch (error: any) {
            const msg = error?.response?.data?.message || 'Failed to generate OAuth URL.';
            toast.error(msg);
        }
    };
    const handleFetchMetadata = async (platformKey: string) => {
        const token = inputs[platformKey]?.accessToken;
        if (!token) return toast.error('Enter an Access Token first');

        setFetchingMetadata(prev => ({ ...prev, [platformKey]: true }));
        try {
            const endpoint = platformKey === 'facebook' ? '/meta/fetch-pages' : '/meta/fetch-ig-accounts';
            const { data } = await api.post(endpoint, { accessToken: token });
            setMetadata(prev => ({ ...prev, [platformKey]: data }));

            if (data.length === 0) {
                toast.error(`No ${platformKey === 'facebook' ? 'Pages' : 'Instagram accounts'} found for this token. Check your permissions.`);
            } else {
                toast.success(`Found ${data.length} accounts!`);
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || `Failed to fetch ${platformKey} accounts`;
            // Check for common error codes/messages to be more specific
            if (msg.includes('expired') || msg.includes('Error validating access token')) {
                toast.error('❌ Token Error: Your token is expired or invalid. Please generate a new one.');
            } else if (msg.includes('permission')) {
                toast.error(`❌ Permission Error: ${msg}`, { duration: 8000 });
                if (platformKey === 'instagram') {
                    setConnectErrors(prev => ({ ...prev, [platformKey]: `${msg}\nFor Instagram, ensure you have: instagram_basic, instagram_content_publish, pages_show_list, and pages_read_engagement.` }));
                } else {
                    setConnectErrors(prev => ({ ...prev, [platformKey]: `${msg}\nFor Facebook, ensure you have: pages_show_list, pages_read_engagement, and pages_manage_posts.` }));
                }
            } else {
                toast.error(msg);
            }
        } finally {
            setFetchingMetadata(prev => ({ ...prev, [platformKey]: false }));
        }
    };

    const handleSelectAccount = (platformKey: string, account: any) => {
        if (platformKey === 'facebook') {
            setField(platformKey, 'pageId', account.id);
            // DO NOT replace accessToken — the backend needs the original User Token
            // for permission checks and long-lived token exchange
            // Pre-fill IG if found
            if (account.instagramAccount) {
                setField('instagram', 'igAccountId', account.instagramAccount.id);
                toast.success(`Selected Page: ${account.name} (IG auto-linked: ${account.instagramAccount.name || account.instagramAccount.id})`);
            } else {
                toast.success(`Selected Page: ${account.name} — Page ID auto-filled`);
            }
        } else {
            setField(platformKey, 'igAccountId', account.id);
            if (account.pageId) {
                setField(platformKey, 'pageId', account.pageId);
            }
            toast.success(`Selected IG Account: ${account.name}`);
        }
        // Clear any previous errors for this platform
        setConnectErrors(prev => ({ ...prev, [platformKey]: '' }));
        // Don't auto-save — let the user review and click Validate Token
    };


    const getConnection = (key: string) => connections.find(c => c.platform === key);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="animate-pulse space-y-6">
                    <div className="h-10 bg-surface rounded w-64"></div>
                    <div className="h-4 bg-surface rounded w-96"></div>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-48 bg-surface rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <span className="text-3xl">⚙️</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">Settings</span>
                </h1>
                <p className="text-gray-400 mt-2">
                    Connect your social media accounts via <strong className="text-white">Meta Graph API</strong>. We use direct API calls to ensure maximum reliability and permanent connections.
                </p>
            </div>

            {/* How it works */}
            <div className="bg-surface border border-border rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-3">🔗 How Direct API Connect Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                    <div className="flex gap-3 items-start">
                        <span className="bg-primary/20 text-primary rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                        <span>Create a <strong className="text-white">Meta App</strong> and add <code className="text-xs bg-black/30 px-1 rounded">pages_manage_posts</code>, <code className="text-xs bg-black/30 px-1 rounded">pages_read_engagement</code>, <code className="text-xs bg-black/30 px-1 rounded">instagram_basic</code> and <code className="text-xs bg-black/30 px-1 rounded">instagram_content_publish</code> permissions.</span>
                    </div>
                    <div className="flex gap-3 items-start">
                        <span className="bg-primary/20 text-primary rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                        <span>Generate a <strong className="text-white">User Access Token</strong> in the Graph Explorer with all required scopes.</span>
                    </div>
                    <div className="flex gap-3 items-start">
                        <span className="bg-primary/20 text-primary rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                        <span>Enter your token below and click <strong className="text-white">Fetch Accounts</strong> to automatically discover and link your pages.</span>
                    </div>
                </div>
            </div>

            {/* Platform Cards */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Social Accounts</h2>
                    {showMetaWarning && (
                        <div className="flex items-center gap-2 text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg shadow-sm">
                            ⚠️ Meta API requires publicly accessible image URLs
                            <button
                                onClick={() => {
                                    sessionStorage.setItem('hideMetaWarning', 'true');
                                    setShowMetaWarning(false);
                                }}
                                className="ml-2 hover:bg-yellow-500/20 rounded-full p-0.5 transition"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {PLATFORMS.map(p => {
                    const conn = getConnection(p.key);
                    const isConnected = conn?.isConnected || false;
                    const isActive = conn?.isActive || false;
                    const vals = inputs[p.key] || {};
                    const platformMetadata = metadata[p.key] || [];

                    return (
                        <div
                            key={p.key}
                            className={`bg-surface border rounded-xl p-6 transition-all ${isConnected ? (isActive ? p.borderColor : 'border-red-500/50') : 'border-border'}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
                                        {p.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{p.name}</h3>
                                        <p className="text-sm text-gray-500">{p.description}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isConnected
                                        ? (isActive ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30')
                                        : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
                                        }`}>
                                        {isConnected ? (isActive ? '✅ Connected' : '❌ Token Invalid/Expired') : '🔌 Disconnected'}
                                    </span>
                                    {isConnected && !isActive && (
                                        <span className="text-[9px] text-red-500 font-bold uppercase tracking-widest">Action Required</span>
                                    )}
                                </div>
                            </div>

                            {/* Input fields - only show when not connected or expired */}
                            {(!isConnected || !isActive) && (
                                <div className="space-y-4 mb-4">
                                    {p.fields.map(field => (
                                        <div key={field.key}>
                                            <label className="block text-xs font-medium text-gray-400 mb-1">{field.label}</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type={field.type === 'password' && !showTokens[`${p.key}-${field.key}`] ? 'password' : 'text'}
                                                        placeholder={field.placeholder}
                                                        className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition pr-10"
                                                        value={vals[field.key] || ''}
                                                        onChange={e => setField(p.key, field.key, e.target.value)}
                                                    />
                                                    {field.type === 'password' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowTokens(prev => ({ ...prev, [`${p.key}-${field.key}`]: !prev[`${p.key}-${field.key}`] }))}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                                                        >
                                                            {showTokens[`${p.key}-${field.key}`] ? '🙈' : '👁️'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Issue 4 — Helper tips for Facebook and Instagram */}
                                            {p.key === 'facebook' && field.key === 'pageId' && (
                                                <p className="text-[11px] text-gray-500 mt-1 ml-0.5">💡 Tip: Leave Page ID blank to auto-discover your Facebook Page.</p>
                                            )}
                                            {p.key === 'instagram' && field.key === 'accessToken' && (
                                                <p className="text-[11px] text-gray-500 mt-1 ml-0.5">💡 Tip: Your Instagram Business account must be linked to a Facebook Page. The Page ID will be auto-discovered if not provided.</p>
                                            )}
                                        </div>
                                    ))}

                                    {/* Issue 5 — Fetch Pages / Fetch Accounts buttons */}
                                    {p.key === 'facebook' && vals.accessToken && (
                                        <button
                                            onClick={() => handleFetchMetadata(p.key)}
                                            disabled={fetchingMetadata[p.key]}
                                            className="text-xs text-primary font-bold bg-primary/10 px-3 py-2 rounded-lg border border-primary/20 hover:bg-primary/20 transition flex items-center gap-2"
                                        >
                                            {fetchingMetadata[p.key] && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
                                            {fetchingMetadata[p.key] ? 'Searching...' : '🔍 Fetch Pages'}
                                        </button>
                                    )}
                                    {p.key === 'instagram' && vals.accessToken && (
                                        <button
                                            onClick={() => handleFetchMetadata(p.key)}
                                            disabled={fetchingMetadata[p.key]}
                                            className="text-xs text-primary font-bold bg-primary/10 px-3 py-2 rounded-lg border border-primary/20 hover:bg-primary/20 transition flex items-center gap-2"
                                        >
                                            {fetchingMetadata[p.key] && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
                                            {fetchingMetadata[p.key] ? 'Searching...' : '🔍 Fetch Accounts'}
                                        </button>
                                    )}

                                    {/* Account Selection from Metadata */}
                                    {platformMetadata.length > 0 && (
                                        <div className="bg-black/20 border border-gray-800 rounded-lg p-3 space-y-2">
                                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Select Account to Link:</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {platformMetadata.map((account: any) => (
                                                    <button
                                                        key={account.id}
                                                        onClick={() => handleSelectAccount(p.key, account)}
                                                        className="flex items-center gap-3 p-2 rounded bg-surface border border-border hover:border-primary transition group text-left w-full"
                                                    >
                                                        {account.picture && (
                                                            <img src={account.picture} alt="" className="w-8 h-8 rounded-full border border-border" />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-white group-hover:text-primary transition truncate">{account.name}</div>
                                                            <div className="text-[10px] text-gray-500">{account.category || 'Business Account'} • {account.id}</div>
                                                        </div>
                                                        {account.isValid && (
                                                            <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">VALID</span>
                                                        )}
                                                        <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition whitespace-nowrap">Select →</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Issue 3 — Full error message box */}
                                    {connectErrors[p.key] && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                                            <div className="flex items-start gap-2">
                                                <span className="text-red-400 flex-shrink-0 mt-0.5">⚠️</span>
                                                <div>
                                                    <p className="font-bold text-red-300 mb-1">Connection Error</p>
                                                    <p className="text-red-400/90 break-words whitespace-pre-wrap">{connectErrors[p.key]}</p>
                                                </div>
                                                <button
                                                    onClick={() => setConnectErrors(prev => ({ ...prev, [p.key]: '' }))}
                                                    className="text-red-500 hover:text-red-300 text-xs ml-auto flex-shrink-0"
                                                >✕</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Connected info */}
                            {isConnected && isActive && (
                                <div className="bg-black/30 rounded-lg p-3 mb-4 text-xs text-gray-400 space-y-1">
                                    {conn?.pageId && <div>📄 Linked Page ID: <span className="text-white font-mono">{conn.pageId}</span></div>}
                                    {conn?.igAccountId && <div>📸 Linked IG ID: <span className="text-white font-mono">{conn.igAccountId}</span></div>}
                                    {conn?.expiresAt && (() => {
                                        const expiryDate = new Date(conn.expiresAt);
                                        const now = new Date();
                                        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                        const isExpired = daysLeft <= 0;
                                        const isWarning = daysLeft > 0 && daysLeft <= 7;
                                        const isLongLived = daysLeft > 30;
                                        return (
                                            <div className={`flex items-center gap-2 ${isExpired ? 'text-red-400 font-bold' : isWarning ? 'text-yellow-400 font-semibold' : ''}`}>
                                                🔑 Token Expires: {expiryDate.toLocaleString()}
                                                {isExpired ? (
                                                    <span className="bg-red-500/20 text-red-400 text-[9px] px-2 py-0.5 rounded-full border border-red-500/30 font-bold">EXPIRED</span>
                                                ) : isWarning ? (
                                                    <span className="bg-yellow-500/20 text-yellow-400 text-[9px] px-2 py-0.5 rounded-full border border-yellow-500/30">{daysLeft}d left ⚠️</span>
                                                ) : isLongLived ? (
                                                    <span className="bg-green-500/15 text-green-400 text-[9px] px-2 py-0.5 rounded-full border border-green-500/30">{daysLeft}d left • Long-lived ✅</span>
                                                ) : (
                                                    <span className="text-gray-500 text-[9px]">{daysLeft}d remaining</span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {conn?.lastUpdated && <div>🕐 Last metadata refresh: {new Date(conn.lastUpdated).toLocaleString()}</div>}
                                    {conn?.lastFetchAt && <div>🔄 Last polled for direct posts: {new Date(conn.lastFetchAt).toLocaleString()}</div>}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 items-center flex-wrap">
                                {isConnected && isActive && !vals.accessToken ? (
                                    <>
                                        <button
                                            disabled={true}
                                            className="bg-green-500/20 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-bold shadow-lg"
                                        >
                                            Valid ✅
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setTesting(prev => ({ ...prev, [p.key]: true }));
                                                try {
                                                    const { data } = await api.get(`/meta/test/${p.key}`);
                                                    if (data.success) {
                                                        toast.success(`✅ ${p.name} connection is healthy!`);
                                                    } else {
                                                        toast.error(`❌ ${p.name} test failed: ${data.message}`);
                                                    }
                                                } catch { toast.error(`Test failed for ${p.name}`); }
                                                finally { setTesting(prev => ({ ...prev, [p.key]: false })); }
                                            }}
                                            disabled={testing[p.key]}
                                            className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-500/20 transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {testing[p.key] && <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>}
                                            {testing[p.key] ? 'Testing...' : '🔌 Test Connection'}
                                        </button>
                                        <button
                                            onClick={() => handleDisconnect(p.key)}
                                            disabled={saving[p.key]}
                                            className="bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {saving[p.key] && <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>}
                                            {saving[p.key] ? 'Disconnecting...' : 'Disconnect'}
                                        </button>
                                    </>
                                ) : isConnected && isActive && vals.accessToken ? (
                                    <>
                                        <button
                                            onClick={() => handleConnect(p.key)}
                                            disabled={saving[p.key]}
                                            className={`${p.bgColor} ${p.textColor} border ${p.borderColor}/30 px-6 py-2 rounded-lg text-sm font-bold hover:opacity-80 transition disabled:opacity-30 shadow-lg flex items-center gap-2`}
                                        >
                                            {saving[p.key] && <div className={`w-3 h-3 border-2 ${p.textColor} border-t-transparent rounded-full animate-spin`}></div>}
                                            {saving[p.key] ? 'Updating...' : 'Update & Sync Connection'}
                                        </button>
                                        <button
                                            onClick={() => handleDisconnect(p.key)}
                                            disabled={saving[p.key]}
                                            className="bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {saving[p.key] && <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>}
                                            {saving[p.key] ? 'Disconnecting...' : 'Disconnect'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleConnect(p.key)}
                                            disabled={saving[p.key] || !vals.accessToken}
                                            className={`bg-gradient-to-r ${p.color} text-white px-8 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50 shadow-lg flex items-center gap-2`}
                                        >
                                            {saving[p.key] && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                            {saving[p.key] ? 'Validating...' : (p.key === 'facebook' || p.key === 'instagram' || p.key === 'linkedin' ? 'Validate Token' : `Connect ${p.name}`)}
                                        </button>
                                        {(p.key === 'facebook' || p.key === 'instagram' || p.key === 'linkedin') && (
                                            <button
                                                onClick={() => handleOAuthConnect(p.key)}
                                                className={`${p.key === 'linkedin' ? 'bg-[#0A66C2] hover:bg-[#0A66C2]/90' : 'bg-[#1877F2] hover:bg-[#1877F2]/90'} text-white px-6 py-2 rounded-lg text-sm font-bold transition shadow-lg flex items-center gap-2`}
                                            >
                                                {p.key === 'linkedin' ? <LinkedInIcon /> : <FacebookIcon />}
                                                {p.key === 'linkedin' ? 'Connect with LinkedIn OAuth' : 'Connect with Meta OAuth'}
                                            </button>
                                        )}
                                        {/* Fetch Pages/Accounts buttons moved into the form area above (Issue 5) */}
                                    </>
                                )}
                                <a
                                    href={p.helpUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-gray-500 hover:text-primary transition ml-auto"
                                >
                                    📖 API Guide →
                                </a>
                            </div>

                            {/* Connection Health Row */}
                            {isConnected && conn?.health && (
                                <div className="mt-5 pt-4 border-t border-border/50 text-xs text-gray-400 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-gray-500 uppercase text-[9px] font-bold tracking-wider">Last successful post</span>
                                        <span className="text-gray-300 font-medium">{conn.health.lastSuccessfulPost ? new Date(conn.health.lastSuccessfulPost).toLocaleString() : 'Never'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-gray-500 uppercase text-[9px] font-bold tracking-wider">Last sync</span>
                                        <span className="text-gray-300 font-medium">{conn.health.lastSync ? new Date(conn.health.lastSync).toLocaleString() : 'Never'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-gray-500 uppercase text-[9px] font-bold tracking-wider">Total posts via connection</span>
                                        <span className="text-gray-300 font-medium">{conn.health.totalPosts || 0} posts</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>



            {/* Password Change Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">🔒 Change Password</h2>
                <div className="bg-surface border border-border rounded-xl p-6">
                    <div className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Current Password</label>
                            <input
                                type="password"
                                placeholder="Enter current password"
                                className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">New Password</label>
                            <input
                                type="password"
                                placeholder="Enter new password (min 8 characters)"
                                className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Confirm New Password</label>
                            <input
                                type="password"
                                placeholder="Re-enter new password"
                                className={`w-full bg-background border rounded-lg p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition ${
                                    confirmPassword && confirmPassword !== newPassword
                                        ? 'border-red-500 focus:border-red-400'
                                        : 'border-gray-700 focus:border-cyan-400'
                                }`}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                            {confirmPassword && confirmPassword !== newPassword && (
                                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                            )}
                        </div>
                        <button
                            onClick={async () => {
                                if (!currentPassword || !newPassword) {
                                    return toast.error('All password fields are required');
                                }
                                if (newPassword.length < 8) {
                                    return toast.error('New password must be at least 8 characters');
                                }
                                if (newPassword !== confirmPassword) {
                                    return toast.error('New password and confirmation do not match');
                                }
                                setPasswordChanging(true);
                                try {
                                    await api.put('/auth/password', { currentPassword, newPassword });
                                    toast.success('Password updated successfully ✅');
                                    setCurrentPassword('');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                } catch (err: any) {
                                    toast.error(err.response?.data?.message || 'Failed to change password');
                                } finally {
                                    setPasswordChanging(false);
                                }
                            }}
                            disabled={passwordChanging || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                            className="px-6 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 transition disabled:opacity-50 shadow-lg flex items-center gap-2"
                        >
                            {passwordChanging && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            {passwordChanging ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Info Footer */}
            <div className="bg-surface border border-border rounded-xl p-6 text-sm text-gray-400">
                <h3 className="font-bold text-white mb-2">💡 Tips for Reliability</h3>
                <ul className="space-y-2 list-disc list-inside">
                    <li><strong className="text-white">Localhost Warning</strong>: Meta cannot fetch images from your computer. If you are running locally, use public image URLs or <code className="text-xs bg-black/30 px-1 rounded">ngrok</code> to expose your server.</li>
                    <li><strong className="text-white">Permanent Connections</strong>: We store refresh tokens when available. Your account will stay connected until you manually revoke permissions in Meta Business Suite.</li>
                    <li><strong className="text-white">Automatic Retries</strong>: If a post fails due to a temporary Meta server issue, our scheduler will automatically retry up to 3 times over the next 15 minutes.</li>
                    <li><strong className="text-white">Instagram Media</strong>: Instagram posting involves a 2-step process. We automatically poll the media container until it's ready before publishing.</li>
                </ul>
            </div>
        </div>
    );
}


