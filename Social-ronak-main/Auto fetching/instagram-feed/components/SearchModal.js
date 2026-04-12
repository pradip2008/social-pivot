'use client';
import { useState, useEffect, useRef } from 'react';

export default function SearchModal({ onClose, posts, onPostSelect }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();

    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const results = query.length > 1
    ? posts.filter(p => 
        (p.caption || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)
    : [];

  const platformIcon = (platform) => {
    switch (platform) {
      case 'instagram': return '📷';
      case 'twitter': return '🐦';
      case 'facebook': return '📘';
      default: return '📄';
    }
  };

  const truncate = (text, len = 80) => {
    if (!text) return 'No caption';
    return text.length > len ? text.substring(0, len) + '...' : text;
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <button className="search-close" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Search across all your posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {results.length > 0 && (
        <div className="search-results" onClick={(e) => e.stopPropagation()}>
          {results.map((post) => (
            <button
              key={post.platform_post_id || post.id}
              className="search-result-item"
              onClick={() => { onPostSelect(post); onClose(); }}
            >
              <span>{platformIcon(post.platform)}</span>
              <span>{truncate(post.caption)}</span>
            </button>
          ))}
        </div>
      )}

      {query.length > 1 && results.length === 0 && (
        <div style={{ marginTop: 24, color: 'var(--text-muted)', fontSize: 14 }}>
          No posts found matching &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
