'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { format } from 'date-fns';

interface Fan {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  createdAt: string;
  totalLikes: number;
  totalComments: number;
}

export default function FansPageContent() {
  const [fans, setFans] = useState<Fan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFans, setTotalFans] = useState(0);

  const fetchFans = async (pageNum: number, search: string = '') => {
    setLoading(true);
    try {
      const { data } = await api.get(`/feed/admin/fans?page=${pageNum}&limit=10&search=${encodeURIComponent(search)}`);
      setFans(data.data);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotalFans(data.total);
    } catch (error) {
      console.error('Failed to load fans', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchFans(1, searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const filteredFans = fans;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">
            Fan Details
          </h1>
          <p className="text-gray-400 mt-1">Manage and view your public feed fans.</p>
        </div>
        <div className="bg-surface/50 border border-border px-4 py-2 rounded-xl flex items-center gap-3">
          <div className="text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Fans</div>
            <div className="text-lg font-bold text-white">{totalFans}</div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-black/40">
          <div className="relative w-full max-w-md text-gray-400 focus-within:text-primary transition-colors">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search fans by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-shadow"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/60 text-xs uppercase text-gray-500 font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Fan</th>
                <th className="px-6 py-4">Total Likes</th>
                <th className="px-6 py-4">Total Comments</th>
                <th className="px-6 py-4 hidden md:table-cell">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse bg-surface/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-border" />
                        <div className="space-y-2">
                          <div className="h-4 w-24 bg-border rounded" />
                          <div className="h-3 w-32 bg-border rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 w-8 bg-border rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 bg-border rounded" /></td>
                    <td className="px-6 py-4 hidden md:table-cell"><div className="h-4 w-24 bg-border rounded" /></td>
                  </tr>
                ))
              ) : filteredFans.length > 0 ? (
                filteredFans.map((fan) => (
                  <tr key={fan.id} className="hover:bg-black/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0 overflow-hidden text-gray-400 font-bold">
                          {fan.profileImage ? (
                            <img src={fan.profileImage} alt={fan.name} className="w-full h-full object-cover" />
                          ) : (
                            fan.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white group-hover:text-primary transition-colors">
                            {fan.name}
                          </div>
                          <div className="text-xs text-gray-500">{fan.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                        {fan.totalLikes}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1 bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {fan.totalComments}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 hidden md:table-cell">
                      {format(new Date(fan.createdAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p>No fans found matching your criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Details */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-black/40">
            <span className="text-sm text-gray-400">
              Showing page <span className="text-white font-medium">{page}</span> of <span className="text-white font-medium">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchFans(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 bg-surface border border-border rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-surface transition-colors"
              >
                Prev
              </button>
              <button
                onClick={() => fetchFans(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 bg-surface border border-border rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-surface transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
