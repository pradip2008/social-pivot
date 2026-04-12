'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import Link from 'next/link';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/auth/login', { email, password });
            Cookies.set('token', data.token);
            toast.success('Logged in successfully');
            router.push('/dashboard');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden font-sans selection:bg-cyan-500/30">
            {/* Dynamic Background Elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-cyan-600/20 blur-[120px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/20 blur-[100px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />

            <div className="relative z-10 w-full max-w-lg p-10">
                <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
                    <div className="flex justify-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] transform hover:scale-105 transition duration-300">
                            <span className="text-3xl font-extrabold text-white">S</span>
                        </div>
                    </div>

                    <div className="text-center mb-10">
                        <h2 className="text-4xl font-extrabold text-white tracking-tight mb-2">Welcome Back</h2>
                        <p className="text-gray-400 font-medium tracking-wide">Enter your credentials to access Social Pivot.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300 ml-1">Email Address</label>
                            <input
                                type="email"
                                placeholder="you@company.com"
                                className="w-full px-5 py-4 bg-black/40 border border-white/[0.1] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all duration-300"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300 ml-1">Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full px-5 py-4 bg-black/40 border border-white/[0.1] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all duration-300"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:from-cyan-400 hover:to-blue-500 transform hover:-translate-y-1 transition-all duration-300"
                        >
                            Sign In to Portal
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/[0.08] text-center">
                        <p className="text-sm text-gray-500 font-medium">
                            Need an account? <span className="text-cyan-500">Contact your administrator.</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
