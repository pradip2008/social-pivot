'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        api.get('/analytics/overview').then(({ data }) => setStats(data));
    }, []);

    if (!stats) return <div className="text-primary italic">Loading analytics...</div>;

    return (
        <div>
            <h2 className="text-4xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-gray-400 mb-8">Here is your automated social media performance.</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <StatCard title="Total Posts" value={stats.totalPosts} color="text-blue-400" />
                <StatCard title="Scheduled" value={stats.scheduledPosts} color="text-yellow-400" />
                <StatCard title="Engagement Rate" value={`${stats.engagementRate.toFixed(1)}%`} color="text-green-400" />
                <StatCard title="Total Likes" value={stats.totalEngagement} color="text-pink-400" />
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <ActionCard 
                    title="Create New Post" 
                    desc="Use AI to generate content in seconds." 
                    href="/dashboard/create" 
                    cta="Generate AI Post" 
                />
                <ActionCard 
                    title="Schedule Content" 
                    desc="Plan your week ahead with the calendar." 
                    href="/dashboard/create?tab=scheduled" 
                    cta="View Scheduler" 
                />
                <ActionCard 
                    title="Connect Accounts" 
                    desc="Link your social media accounts to start publishing." 
                    href="/dashboard/settings" 
                    cta="Setup Connections" 
                />
            </div>

            {/* Admin Frontend Feed Button */}
            <div className="mt-10">
                <button
                    onClick={async () => {
                        try {
                            const { data: tokenData } = await api.get('/feed/admin/frontend-token');
                            const { data: profileData } = await api.get('/auth/profile');
                            const slug = profileData.company.slug;
                            if (slug) {
                                window.open(`/feed/${slug}?adminToken=${tokenData.token}`, '_blank');
                            } else {
                                import('react-hot-toast').then(m => m.toast.error('Failed to open feed. Please try again.'));
                            }
                        } catch (err) {
                            import('react-hot-toast').then(m => m.toast.error('Failed to open feed. Please try again.'));
                        }
                    }}
                    className="bg-[#06b6d4] text-black font-bold rounded-xl px-6 py-3"
                >
                    Open Frontend Feed
                </button>
            </div>
        </div>
    );
}

function StatCard({ title, value, color }: any) {
    return (
        <div className="p-6 bg-surface border border-border rounded-xl shadow-lg">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
            <p className={`text-4xl font-bold mt-2 ${color}`}>{value}</p>
        </div>
    );
}

function ActionCard({ title, desc, href, cta }: any) {
    return (
        <div className="p-6 bg-surface border border-border rounded-xl hover:border-primary transition-all group cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-xl font-bold text-white mb-2 relative z-10">{title}</h3>
            <p className="text-gray-400 mb-6 text-sm relative z-10">{desc}</p>
            <Link href={href} className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium hover:bg-primary hover:text-black transition relative z-10">
                {cta}
            </Link>
        </div>
    );
}
