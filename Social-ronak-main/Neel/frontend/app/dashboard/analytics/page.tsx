'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7'];

export default function AnalyticsPage() {
    const [overviewData, setOverviewData] = useState<any>(null);
    const [engagementData, setEngagementData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchAnalytics();
    }, [startDate, endDate]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const queryString = params.toString() ? `?${params.toString()}` : '';

            // Fetch overview (stats, pie chart, top posts)
            const overviewRes = await api.get(`/analytics/overview${queryString}`);
            setOverviewData(overviewRes.data);

            // Fetch engagement history (line chart)
            const { data } = await api.get(`/analytics/engagement${queryString}`);
            const normalized = (data || []).map((item: any) => ({
                date: item.date || (item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Unknown'),
                engagement: item.engagement ?? item._sum?.engagementCount ?? 0,
            }));
            setEngagementData(normalized);
        } catch (error) {
            toast.error('Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const handleExportCsv = async () => {
        try {
            const { data } = await api.get('/analytics/export');
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'analytics_export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('Failed to export analytics');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">
                    Advanced Analytics Dashboard 📈
                </h1>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-[#171717] border border-[#262626] rounded-xl px-3 py-1.5 focus-within:border-[#06b6d4] transition-all">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">From</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 w-28 [color-scheme:dark]"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-[#171717] border border-[#262626] rounded-xl px-3 py-1.5 focus-within:border-[#06b6d4] transition-all">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">To</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 w-28 [color-scheme:dark]"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button 
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            className="text-[#888] hover:text-white text-xs font-semibold px-2 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                    <button onClick={handleExportCsv} className="bg-primary hover:bg-cyan-400 text-black font-bold py-2 px-5 rounded-xl text-sm transition-all shadow-lg active:scale-95 leading-none h-[38px]">
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Posts" value={overviewData?.totalPosts || 0} icon="📝" />
                <StatCard title="Scheduled Posts" value={overviewData?.scheduledPosts || 0} icon="⏳" />
                <StatCard title="Total Engagement" value={overviewData?.totalEngagement || 0} icon="🔥" />
                <StatCard title="Avg Engagement Rate" value={`${Math.round(overviewData?.engagementRate || 0)}%`} icon="🚀" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Line Chart */}
                <div className="bg-surface rounded-xl border border-border p-6 shadow-lg lg:col-span-2 h-[400px]">
                    <h3 className="text-lg font-bold text-white mb-6">Engagement History (30 Days)</h3>
                    {engagementData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500 pb-12">
                            Not enough data to display.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="80%">
                            <LineChart data={engagementData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="date" stroke="#888" />
                                <YAxis stroke="#888" />
                                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} itemStyle={{ color: '#00e5ff' }} />
                                <Line type="monotone" dataKey="engagement" stroke="#00e5ff" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pie Chart (Platform Distribution) */}
                <div className="bg-surface rounded-xl border border-border p-6 shadow-lg h-[400px]">
                    <h3 className="text-lg font-bold text-white mb-6">Platform Distribution</h3>
                    {(!overviewData?.platformBreakdown || overviewData.platformBreakdown.length === 0) ? (
                        <div className="flex items-center justify-center h-full text-gray-500 pb-12">
                            No platforms found.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                                <Pie
                                    data={overviewData.platformBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="count"
                                    nameKey="platform"
                                >
                                    {overviewData.platformBreakdown.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Top Posts Table */}
            <div className="bg-surface rounded-xl border border-border p-6 shadow-lg">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">🏆 Top Performing Posts</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="text-xs uppercase bg-black/40 text-gray-400 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-lg">Content</th>
                                <th className="px-6 py-4">Platform</th>
                                <th className="px-6 py-4">Engagement</th>
                                <th className="px-6 py-4 rounded-tr-lg">Published</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overviewData?.topPosts?.length > 0 ? (
                                overviewData.topPosts.map((post: any) => (
                                    <tr key={post.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                        <td className="px-6 py-4 text-white max-w-sm truncate">
                                            {post.content.replace(/<[^>]*>?/gm, '')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-cyan-400">
                                                {post.platform}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-green-400 font-bold">
                                            {post.engagementCount} 🔥
                                        </td>
                                        <td className="px-6 py-4">
                                            {post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : 'N/A'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        No top posts found yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: string }) {
    return (
        <div className="bg-surface rounded-xl border border-border p-6 shadow-lg flex items-center justify-between group hover:border-primary/50 transition-all">
            <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
                <h4 className="text-3xl font-bold text-white">{value}</h4>
            </div>
            <div className="text-4xl opacity-80 bg-white/5 p-3 rounded-xl group-hover:scale-110 transition-transform">
                {icon}
            </div>
        </div>
    );
}
