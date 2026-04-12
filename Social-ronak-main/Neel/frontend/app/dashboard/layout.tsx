'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import api from '@/lib/api';
import { FiHome, FiEdit3, FiList, FiSettings, FiUser, FiBarChart2, FiUsers, FiShield, FiMenu, FiCpu } from 'react-icons/fi';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const path = usePathname();
    const [user, setUser] = useState<any>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const token = Cookies.get('token');
        if (!token) {
            router.push('/login');
            return;
        }

        api.get('/auth/profile').then(({ data }) => {
            setUser(data);
        }).catch(() => {
            Cookies.remove('token');
            router.push('/login');
        });
    }, [router]);

    const handleLogout = () => {
        Cookies.remove('token');
        router.push('/login');
    };

    const menu = [
        { name: 'Overview', href: '/dashboard', icon: <FiHome size={18} /> },
        { name: 'AI Generator', href: '/dashboard/ai', icon: <FiCpu size={18} /> },
        { name: 'Create & Schedule', href: '/dashboard/create', icon: <FiEdit3 size={18} /> },
        { name: 'Posts', href: '/dashboard/posts', icon: <FiList size={18} /> },
        { name: 'Settings', href: '/dashboard/settings', icon: <FiSettings size={18} /> },
        { name: 'Profile', href: '/dashboard/profile', icon: <FiUser size={18} /> },
        { name: 'Analytics', href: '/dashboard/analytics', icon: <FiBarChart2 size={18} /> },
        { name: 'Fan Details', href: '/dashboard/fans', icon: <FiUsers size={18} /> },
    ];

    if (user?.isSuperAdmin) {
        menu.push({ name: 'Users', href: '/dashboard/admin', icon: <FiShield size={18} /> });
    }

    if (!user) return <div className="min-h-screen bg-background text-primary flex items-center justify-center">Loading SaaS Platform...</div>;

    return (
        <div className="flex h-screen bg-background text-white font-sans overflow-hidden">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center p-4 border-b border-border bg-black z-40 fixed w-full top-0">
                <button onClick={() => setIsSidebarOpen(true)} className="text-white hover:text-cyan-400 focus:outline-none">
                    <FiMenu size={24} />
                </button>
                <h1 className="ml-4 text-xl font-bold bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">Social Pivot</h1>
            </div>

            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed md:static inset-y-0 left-0 w-64 border-r border-border bg-black z-50 h-screen flex flex-col p-6 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent mb-10 hidden md:block">
                    Social Pivot
                </h1>

                <nav className="space-y-2 flex-1 overflow-y-auto pr-2">
                    {menu.map((item) => {
                        const isActive = path === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-all transform hover:translate-x-1 ${isActive ? 'bg-primary text-black font-semibold shadow-lg shadow-cyan-500/20' : 'text-gray-400 hover:bg-surface hover:text-white'}`}
                            >
                                {item.icon}
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto pt-6 border-t border-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary font-bold">
                            {user.name[0]}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.company.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left text-sm text-red-400 hover:text-red-300 transition"
                    >
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-background/95 p-6 md:p-8 mt-16 md:mt-0 relative w-full">
                <div className="max-w-7xl mx-auto animate-fade-in relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
