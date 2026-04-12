'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [accounts, setAccounts] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/admin/accounts');
      const data = await res.json();
      if (data.accounts) {
        setAccounts(data.accounts);
        setStatusCounts(data.statusCounts || {});
      }
    } catch (e) {
      console.error('Failed to fetch accounts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (accountId, username) => {
    if (!confirm(`Approve account @${username}? This will allow their feed to go live.`)) return;
    setActionLoading(`approve-${accountId}`);
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: 'success', message: data.message });
        await fetchAccounts();
      } else {
        setToast({ type: 'error', message: data.error });
      }
    } catch (e) {
      setToast({ type: 'error', message: 'Failed to approve' });
    }
    setActionLoading('');
  };

  const handleReject = async (accountId, username) => {
    if (!confirm(`Reject account @${username}? Their feed will be disabled.`)) return;
    setActionLoading(`reject-${accountId}`);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: 'success', message: data.message });
        await fetchAccounts();
      } else {
        setToast({ type: 'error', message: data.error });
      }
    } catch (e) {
      setToast({ type: 'error', message: 'Failed to reject' });
    }
    setActionLoading('');
  };

  const handleSync = async (accountId, username) => {
    setActionLoading(`sync-${accountId}`);
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: 'success', message: data.message });
        await fetchAccounts();
      } else {
        setToast({ type: 'error', message: data.error });
      }
    } catch (e) {
      setToast({ type: 'error', message: 'Sync failed' });
    }
    setActionLoading('');
  };

  const filteredAccounts = activeTab === 'all'
    ? accounts
    : accounts.filter(a => a.status === activeTab);

  const tabs = [
    { id: 'all', label: 'All', count: statusCounts.total || 0 },
    { id: 'pending', label: 'Pending', count: statusCounts.pending || 0 },
    { id: 'approved', label: 'Approved', count: statusCounts.approved || 0 },
    { id: 'rejected', label: 'Rejected', count: statusCounts.rejected || 0 },
  ];

  const platformIcon = (platform) => {
    switch (platform) {
      case 'instagram':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <circle cx="12" cy="12" r="5"/>
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        );
      case 'twitter':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const statusBadge = (status) => {
    const config = {
      pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Pending' },
      approved: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Approved' },
      rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Rejected' },
    };
    const c = config[status] || config.pending;
    return (
      <span className="admin-badge" style={{ color: c.color, background: c.bg, border: `1px solid ${c.color}25` }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
        {c.label}
      </span>
    );
  };

  const modeBadge = (mode) => {
    const isOAuth = mode === 'oauth';
    return (
      <span className="admin-badge" style={{
        color: isOAuth ? '#818cf8' : '#fb923c',
        background: isOAuth ? 'rgba(129,140,248,0.12)' : 'rgba(251,146,60,0.12)',
        border: `1px solid ${isOAuth ? '#818cf8' : '#fb923c'}25`,
      }}>
        {isOAuth ? '🔑 OAuth' : '🕷️ Scraping'}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="loader-overlay"><div className="spinner"></div></div>;

  return (
    <div className="admin-wrapper">
      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <Link href="/" className="admin-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Feed
          </Link>
          <h1 className="admin-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#818cf8' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin Dashboard
          </h1>
        </div>
        <p className="admin-subtitle">Manage connected accounts, approve/reject, and control sync.</p>
      </header>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-value">{statusCounts.total || 0}</span>
          <span className="admin-stat-label">Total Accounts</span>
        </div>
        <div className="admin-stat-card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
          <span className="admin-stat-value" style={{ color: '#f59e0b' }}>{statusCounts.pending || 0}</span>
          <span className="admin-stat-label">Pending Review</span>
        </div>
        <div className="admin-stat-card" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
          <span className="admin-stat-value" style={{ color: '#22c55e' }}>{statusCounts.approved || 0}</span>
          <span className="admin-stat-label">Approved</span>
        </div>
        <div className="admin-stat-card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
          <span className="admin-stat-value" style={{ color: '#ef4444' }}>{statusCounts.rejected || 0}</span>
          <span className="admin-stat-label">Rejected</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="admin-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Accounts List */}
      <div className="admin-accounts">
        {filteredAccounts.length === 0 ? (
          <div className="admin-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>No {activeTab !== 'all' ? activeTab : ''} accounts found.</p>
          </div>
        ) : (
          filteredAccounts.map(account => (
            <div key={account.id} className="admin-account-card">
              <div className="admin-account-main">
                <div className="admin-account-avatar">
                  {account.profile_picture ? (
                    <img src={account.profile_picture} alt={account.username} />
                  ) : (
                    <div className="admin-avatar-placeholder">
                      {platformIcon(account.platform)}
                    </div>
                  )}
                </div>
                <div className="admin-account-info">
                  <div className="admin-account-name">
                    <strong>@{account.username}</strong>
                    <span className="admin-platform-chip" style={{
                      color: account.platform === 'instagram' ? '#E1306C' :
                             account.platform === 'twitter' ? '#1DA1F2' : '#1877F2'
                    }}>
                      {platformIcon(account.platform)}
                      {account.platform}
                    </span>
                  </div>
                  <div className="admin-account-meta">
                    {statusBadge(account.status)}
                    {modeBadge(account.mode)}
                    <span className="admin-meta-item">
                      📊 {account.post_count} posts
                    </span>
                    <span className="admin-meta-item">
                      🕐 {formatDate(account.last_fetched_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-account-actions">
                {account.status === 'pending' && (
                  <>
                    <button
                      className="admin-btn approve"
                      onClick={() => handleApprove(account.id, account.username)}
                      disabled={actionLoading === `approve-${account.id}`}
                    >
                      {actionLoading === `approve-${account.id}` ? '...' : '✓ Approve'}
                    </button>
                    <button
                      className="admin-btn reject"
                      onClick={() => handleReject(account.id, account.username)}
                      disabled={actionLoading === `reject-${account.id}`}
                    >
                      {actionLoading === `reject-${account.id}` ? '...' : '✕ Reject'}
                    </button>
                  </>
                )}
                {account.status === 'approved' && (
                  <>
                    <button
                      className="admin-btn sync"
                      onClick={() => handleSync(account.id, account.username)}
                      disabled={actionLoading === `sync-${account.id}`}
                    >
                      {actionLoading === `sync-${account.id}` ? (
                        <><span className="admin-spin">↻</span> Syncing...</>
                      ) : '↻ Sync Now'}
                    </button>
                    <button
                      className="admin-btn reject"
                      onClick={() => handleReject(account.id, account.username)}
                      disabled={actionLoading === `reject-${account.id}`}
                    >
                      ✕ Revoke
                    </button>
                  </>
                )}
                {account.status === 'rejected' && (
                  <button
                    className="admin-btn approve"
                    onClick={() => handleApprove(account.id, account.username)}
                    disabled={actionLoading === `approve-${account.id}`}
                  >
                    {actionLoading === `approve-${account.id}` ? '...' : '↩ Re-approve'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
