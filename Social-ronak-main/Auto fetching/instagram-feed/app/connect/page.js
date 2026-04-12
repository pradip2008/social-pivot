'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ConnectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [showManual, setShowManual] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [manualForm, setManualForm] = useState({
    userId: '', username: '', accessToken: ''
  });
  const [demoUsername, setDemoUsername] = useState('');
  const [demoMessage, setDemoMessage] = useState(null);

  useEffect(() => {
    // Fetch current connected accounts
    fetch('/api/feed?limit=1').then(r => r.json()).then(data => {
      if (data.accounts) setConnectedAccounts(data.accounts);
    });
  }, []);

  const isConnected = (platform) => {
    return connectedAccounts.some(a => a.platform === platform);
  };

  const getAccountStatus = (platform) => {
    const acc = connectedAccounts.find(a => a.platform === platform);
    return acc?.status || null;
  };

  const handleInstagramConnect = async () => {
    setLoading('instagram');
    const res = await fetch('/api/auth/connect');
    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert('Configuration Error: ' + data.error);
        setLoading('');
      }
    } else {
      setLoading('');
    }
  };

  const handleTwitterConnect = async () => {
    setLoading('twitter');
    const res = await fetch('/api/auth/twitter/connect');
    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert('Configuration Error: ' + data.error);
        setLoading('');
      }
    } else {
      setLoading('');
    }
  };

  const handleDisconnect = async (platform) => {
    if (!confirm(`Disconnect your ${platform} account? All cached posts from this platform will be removed.`)) return;
    setLoading(platform);
    try {
      await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });
      setConnectedAccounts(prev => prev.filter(a => a.platform !== platform));
    } catch (e) {
      console.error(e);
    }
    setLoading('');
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading('manual');
    try {
      const res = await fetch('/api/auth/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm)
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = '/';
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading('');
  };

  const handleDemoSubmit = async (e) => {
    e.preventDefault();
    if (!demoUsername.trim()) return;
    setLoading('demo');
    setDemoMessage(null);
    try {
      const res = await fetch('/api/add-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: demoUsername, platform: 'instagram' })
      });
      const data = await res.json();
      if (data.success) {
        setDemoMessage({ type: 'success', text: data.message });
        setDemoUsername('');
        // Refresh accounts
        const feedRes = await fetch('/api/feed?limit=1');
        const feedData = await feedRes.json();
        if (feedData.accounts) setConnectedAccounts(feedData.accounts);
      } else {
        setDemoMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setDemoMessage({ type: 'error', text: 'Something went wrong' });
    }
    setLoading('');
  };

  const statusLabel = (status) => {
    if (!status) return null;
    const config = {
      pending: { color: '#f59e0b', text: '⏳ Pending Review' },
      approved: { color: '#22c55e', text: '✓ Approved' },
      rejected: { color: '#ef4444', text: '✕ Rejected' },
    };
    const c = config[status] || config.pending;
    return <span style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.text}</span>;
  };

  const platforms = [
    {
      id: 'instagram',
      name: 'Instagram',
      desc: 'Connect via Meta Graph API to sync your posts, reels, and stories.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <circle cx="12" cy="12" r="5"/>
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
      ),
      action: handleInstagramConnect,
    },
    {
      id: 'twitter',
      name: 'Twitter / X',
      desc: 'Connect via Twitter API v2 to sync your tweets and media.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      action: handleTwitterConnect,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      desc: 'Automatically synced when you connect Instagram via Meta Graph API.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      action: null, // auto-connected with Instagram
    },
  ];

  return (
    <div className="connect-wrapper">
      <div className="connect-container">
        <Link href="/" className="back-link">← Back to Feed</Link>

        <h1 className="connect-page-title">Connect Accounts</h1>
        <p className="connect-subtitle">
          Link your social media platforms to aggregate all your content into one unified feed.
        </p>

        <div className="connect-grid">
          {platforms.map((platform) => {
            const connected = isConnected(platform.id);
            const connectedAcc = connectedAccounts.find(a => a.platform === platform.id);
            const status = getAccountStatus(platform.id);

            return (
              <div key={platform.id} className="connect-card">
                <div className={`connect-card-icon ${platform.id}`}>
                  {platform.icon}
                </div>
                <div className="connect-card-info">
                  <h3>{platform.name}</h3>
                  <p>
                    {connected 
                      ? `@${connectedAcc?.username || 'connected'}`
                      : platform.desc
                    }
                  </p>
                  {status && <div style={{ marginTop: 4 }}>{statusLabel(status)}</div>}
                </div>
                <div className="connect-card-actions">
                  {connected ? (
                    <>
                      <span className="connect-card-status connected">
                        <span style={{width:6,height:6,borderRadius:'50%',background:'var(--success)',display:'inline-block'}} />
                        Connected
                      </span>
                      <button 
                        className="btn-danger"
                        onClick={() => handleDisconnect(platform.id)}
                        disabled={loading === platform.id}
                      >
                        {loading === platform.id ? 'Removing...' : 'Disconnect'}
                      </button>
                    </>
                  ) : (
                    platform.action ? (
                      <button 
                        className="btn-primary"
                        onClick={platform.action}
                        disabled={loading === platform.id}
                      >
                        {loading === platform.id ? 'Connecting...' : 'Connect'}
                      </button>
                    ) : (
                      <span className="connect-card-status disconnected">
                        Auto via Instagram
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Demo Mode Section */}
        <div className="demo-section">
          <h3 style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => setShowDemo(!showDemo)}
          >
            <span>🕷️ Demo Mode — Preview Without Login</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: showDemo ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: showDemo ? 16 : 0 }}>
            Enter an Instagram username to preview their public feed. No OAuth needed.
          </p>

          {showDemo && (
            <form onSubmit={handleDemoSubmit} className="demo-form">
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  Instagram Username
                </label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. natgeo"
                  value={demoUsername}
                  onChange={e => setDemoUsername(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading === 'demo'} style={{ height: 44 }}>
                {loading === 'demo' ? 'Adding...' : '+ Add for Preview'}
              </button>
            </form>
          )}

          {demoMessage && (
            <div style={{
              marginTop: 12, padding: '10px 16px', borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              background: demoMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: demoMessage.type === 'success' ? '#22c55e' : '#ef4444',
              border: `1px solid ${demoMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {demoMessage.text}
            </div>
          )}
        </div>

        {/* Manual Token Section */}
        <div className="manual-section">
          <h3 style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => setShowManual(!showManual)}
          >
            Manual Instagram Connection (Access Token)
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: showManual ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </h3>

          {showManual && (
            <form onSubmit={handleManualSubmit} style={{ marginTop: 20 }}>
              <div className="form-group">
                <label>Instagram User ID</label>
                <input 
                  type="text" required className="form-control"
                  placeholder="e.g. 17841400000000000"
                  value={manualForm.userId}
                  onChange={e => setManualForm({...manualForm, userId: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Instagram Username</label>
                <input 
                  type="text" required className="form-control"
                  placeholder="e.g. socialpvot"
                  value={manualForm.username}
                  onChange={e => setManualForm({...manualForm, username: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Long-Lived Access Token</label>
                <input 
                  type="text" required className="form-control"
                  placeholder="Paste your API token here"
                  value={manualForm.accessToken}
                  onChange={e => setManualForm({...manualForm, accessToken: e.target.value})}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading === 'manual'} style={{width:'100%', marginTop: 8}}>
                {loading === 'manual' ? 'Saving...' : 'Save Manual Connection'}
              </button>
            </form>
          )}
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          We use official API tokens. Your passwords are never stored.
        </div>
      </div>
    </div>
  );
}
