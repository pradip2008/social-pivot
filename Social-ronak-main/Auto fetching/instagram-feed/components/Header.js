'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Header({ 
  connected, accounts, onSync, isSyncing,
  activePlatform, onPlatformChange,
  columns, onColumnsChange,
  onSearchOpen, onTrendingOpen,
  theme, onThemeToggle,
  platformCounts
}) {

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo-area">
          <Link href="/" className="logo-text">Social <span>Pvot</span></Link>
        </div>

        {connected && (
          <>
            <div className="filter-area">
              <span className="now-showing-label">Now Showing :</span>
              <div className="platform-filters">
                {/* All */}
                <button
                  className={`platform-btn ${activePlatform === 'all' ? 'active all-platforms' : ''}`}
                  onClick={() => onPlatformChange('all')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <span className="platform-tooltip">
                    All Posts ({platformCounts ? Object.values(platformCounts).reduce((a,b) => a+b, 0) : 0})
                  </span>
                </button>

                {/* Facebook */}
                <button
                  className={`platform-btn ${activePlatform === 'facebook' ? 'active facebook' : ''}`}
                  onClick={() => onPlatformChange('facebook')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="platform-tooltip">
                    Facebook ({platformCounts?.facebook || 0})
                  </span>
                </button>

                {/* Twitter / X */}
                <button
                  className={`platform-btn ${activePlatform === 'twitter' ? 'active twitter' : ''}`}
                  onClick={() => onPlatformChange('twitter')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span className="platform-tooltip">
                    Twitter ({platformCounts?.twitter || 0})
                  </span>
                </button>

                {/* Instagram */}
                <button
                  className={`platform-btn ${activePlatform === 'instagram' ? 'active instagram' : ''}`}
                  onClick={() => onPlatformChange('instagram')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="5"/>
                    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
                  </svg>
                  <span className="platform-tooltip">
                    Instagram ({platformCounts?.instagram || 0})
                  </span>
                </button>
              </div>
            </div>

            <div className="header-divider" />

            {/* Column Toggle */}
            <div className="column-toggle">
              <button
                className={`col-btn ${columns === 2 ? 'active' : ''}`}
                onClick={() => onColumnsChange(2)}
                title="2 Columns"
              >
                ║
              </button>
              <button
                className={`col-btn ${columns === 3 ? 'active' : ''}`}
                onClick={() => onColumnsChange(3)}
                title="3 Columns"
              >
                ║║
              </button>
              <button
                className={`col-btn ${columns === 4 ? 'active' : ''}`}
                onClick={() => onColumnsChange(4)}
                title="4 Columns"
              >
                ║║║
              </button>
            </div>

            <div className="header-divider" />
          </>
        )}
        
        <div className="header-actions">
          {connected && (
            <>
              <button
                className={`header-btn ${isSyncing ? 'sync-spinning' : ''}`}
                onClick={onSync}
                disabled={isSyncing}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M8 16H3v5"/>
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M16 8h5V3"/>
                </svg>
                {isSyncing ? 'Syncing...' : 'Sync'}
              </button>

              <button className="header-btn" onClick={onTrendingOpen}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Trending
              </button>

              <button className="header-btn" onClick={onSearchOpen}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                Search
              </button>
            </>
          )}

          <button className="theme-toggle" onClick={onThemeToggle} title="Toggle Theme">
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {connected ? (
            <Link href="/connect" className="header-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <path d="M20 8v6M23 11h-6"/>
              </svg>
              Accounts
            </Link>
          ) : (
            <Link href="/connect" className="btn-primary">Connect Accounts</Link>
          )}

          <button
            className="logout-btn"
            onClick={async () => {
              await fetch('/api/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
