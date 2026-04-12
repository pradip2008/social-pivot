'use client';
import { useMemo } from 'react';

export default function TrendingPanel({ onClose, posts, onHashtagSelect, activeHashtag }) {
  // Extract hashtags from all post captions and count them
  const trendingHashtags = useMemo(() => {
    const tagMap = {};
    
    for (const post of posts) {
      if (!post.caption) continue;
      const tags = post.caption.match(/#[\w\u0900-\u097F]+/g);
      if (tags) {
        for (const tag of tags) {
          const normalized = tag.toLowerCase();
          tagMap[normalized] = (tagMap[normalized] || 0) + 1;
        }
      }
    }

    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => ({ tag, count }));
  }, [posts]);

  return (
    <>
      <div className="trending-overlay" onClick={onClose} />
      <div className="trending-panel">
        <div className="trending-header">
          <h2>Trending</h2>
          <button className="trending-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="trending-list">
          {activeHashtag && (
            <button
              className="trending-item"
              onClick={() => onHashtagSelect('')}
              style={{ color: 'var(--danger)', fontSize: 13 }}
            >
              ✕ Clear filter: #{activeHashtag}
            </button>
          )}

          {trendingHashtags.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No hashtags found in your posts yet.
            </div>
          ) : (
            trendingHashtags.map(({ tag, count }) => (
              <button
                key={tag}
                className="trending-item"
                onClick={() => { onHashtagSelect(tag.replace('#', '')); onClose(); }}
                style={activeHashtag === tag.replace('#', '') ? { background: 'rgba(120,80,255,0.08)' } : {}}
              >
                <span className="trending-tag">{tag}</span>
                <span className="trending-count">{count} {count === 1 ? 'post' : 'posts'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
