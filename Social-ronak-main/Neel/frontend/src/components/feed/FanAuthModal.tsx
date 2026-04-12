'use client';
import { useState } from 'react';
import { useFanAuth } from '@/src/context/FanAuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface FanAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId?: string;
}

export default function FanAuthModal({ isOpen, onClose, onSuccess, companyId }: FanAuthModalProps) {
  const [view, setView] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useFanAuth();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      if (view === 'login' || view === 'signup') {
        const endpoint = view === 'login' ? '/feed/auth/login' : '/feed/auth/signup';
        const payload = view === 'login'
          ? { email, password, ...(companyId && { companyId }) }
          : { name, email, password, ...(companyId && { companyId }) };

        const { data } = await api.post(endpoint, payload);
        login(data.token, data.fan);
        toast.success(view === 'login' ? 'Logged in successfully' : 'Account created');
        onSuccess();
        onClose();
      } else if (view === 'forgot') {
        await api.post('/feed/auth/forgot-password', { email, companyId });
        setMessage('If an account exists, a reset link/token has been sent.');
        toast.success('Reset request sent');
        setView('reset');
      } else if (view === 'reset') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        await api.post('/feed/auth/reset-password', { token, newPassword: password });
        toast.success('Password reset successfully! You can now log in.');
        setView('login');
        resetForm();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setToken('');
    setError('');
    setMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-[#0a0a0a] border border-[#262626] rounded-2xl p-8 shadow-2xl overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#888888] hover:text-white transition-colors cursor-pointer">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-[#06b6d4] font-bold text-2xl text-center mb-1">Social Pivot</h2>
        <p className="text-[#888888] text-sm text-center mb-6">
          {view === 'login' ? 'Welcome back' : view === 'signup' ? 'Create your account' : view === 'forgot' ? 'Recover access' : 'Reset password'}
        </p>

        {(view === 'login' || view === 'signup') && (
          <div className="flex bg-[#171717] rounded-xl p-1 mb-6 gap-1">
            <button
              type="button"
              onClick={() => { setView('login'); resetForm(); }}
              className={view === 'login' 
                ? "flex-1 bg-[#06b6d4] text-black font-semibold rounded-lg py-2 text-sm text-center cursor-pointer transition-all duration-200" 
                : "flex-1 text-[#888888] py-2 text-sm text-center cursor-pointer hover:text-white rounded-lg transition-all duration-200"}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setView('signup'); resetForm(); }}
              className={view === 'signup' 
                ? "flex-1 bg-[#06b6d4] text-black font-semibold rounded-lg py-2 text-sm text-center cursor-pointer transition-all duration-200" 
                : "flex-1 text-[#888888] py-2 text-sm text-center cursor-pointer hover:text-white rounded-lg transition-all duration-200"}
            >
              Sign Up
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {view === 'signup' && (
            <div className="mb-4">
              <label className="block text-[#888888] text-xs font-medium mb-1.5 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                required
                placeholder="Full Name"
                className="w-full bg-[#171717] border border-[#262626] text-white placeholder-[#555555] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] transition-all duration-200"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {view === 'reset' && (
            <div className="mb-4">
              <label className="block text-[#888888] text-xs font-medium mb-1.5 uppercase tracking-wide">Reset Token</label>
              <input
                type="text"
                required
                placeholder="Enter token from your email"
                className="w-full bg-[#171717] border border-[#262626] text-white placeholder-[#555555] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] transition-all duration-200"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          )}

          {(view !== 'reset') && (
            <div className="mb-4">
              <label className="block text-[#888888] text-xs font-medium mb-1.5 uppercase tracking-wide">Email address</label>
              <input
                type="email"
                required
                placeholder="Email address"
                className="w-full bg-[#171717] border border-[#262626] text-white placeholder-[#555555] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] transition-all duration-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          {(view === 'login' || view === 'signup' || view === 'reset') && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[#888888] text-xs font-medium uppercase tracking-wide">
                  {view === 'reset' ? 'New Password' : 'Password'}
                </label>
                {view === 'login' && (
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-[#06b6d4] text-[10px] uppercase font-bold tracking-tight hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                placeholder={view === 'reset' ? 'New Password' : 'Password'}
                className="w-full bg-[#171717] border border-[#262626] text-white placeholder-[#555555] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] transition-all duration-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          {(view === 'signup' || view === 'reset') && (
            <div className="mb-4">
              <label className="block text-[#888888] text-xs font-medium mb-1.5 uppercase tracking-wide">Confirm password</label>
              <input
                type="password"
                required
                placeholder="Confirm password"
                className="w-full bg-[#171717] border border-[#262626] text-white placeholder-[#555555] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#06b6d4] focus:ring-1 focus:ring-[#06b6d4] transition-all duration-200"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg px-4 py-2 text-sm mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] rounded-lg px-4 py-3 text-xs mb-4 flex items-start gap-2.5">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#06b6d4] hover:bg-cyan-400 text-black font-bold rounded-xl py-3 text-sm mt-4 cursor-pointer transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : view === 'login' ? 'Log in' : view === 'signup' ? 'Sign up' : view === 'forgot' ? 'Send Reset Request' : 'Reset Password'}
          </button>
          
          {(view === 'forgot' || view === 'reset') && (
            <button
              type="button"
              onClick={() => { setView('login'); resetForm(); }}
              className="w-full text-[#888888] text-xs font-medium mt-4 hover:text-white transition-colors cursor-pointer"
            >
              Back to Login
            </button>
          )}
        </form>

        {(view === 'login' || view === 'signup') && (
          <div className="text-center mt-4 text-sm text-[#888888]">
            <span>
              {view === 'login' ? "Don't have an account? " : "Already have an account? "}
            </span>
            <span
              className="text-[#06b6d4] font-semibold cursor-pointer hover:underline"
              onClick={() => {
                setView(view === 'login' ? 'signup' : 'login');
                resetForm();
              }}
            >
              {view === 'login' ? 'Sign up' : 'Log in'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
