'use client';
import { useState } from 'react';

export default function PostCard({ post, onReadMore }) {
  const mediaUrl = post.media_type === 'VIDEO' 
    ? (post.thumbnail_url || post.media_url) 
    : post.media_url;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatLikes = (count) => {
    if (!count) return '0';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const platformLabel = (post.platform || 'instagram').toUpperCase();
  const platformClass = post.platform || 'instagram';

  const truncatedCaption = post.caption 
    ? (post.caption.length > 160 ? post.caption.substring(0, 160) + '...' : post.caption)
    : 'No caption';

  return (
    <div className="post-card" onClick={() => onReadMore && onReadMore(post)}>
      {/* Card Inner: Text Left + Image Right */}
      <div className="post-card-inner">
        <div className="post-text-area">
          <span className={`post-platform-badge ${platformClass}`}>
            {platformClass === 'instagram' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              </svg>
            )}
            {platformClass === 'twitter' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            )}
            {platformClass === 'facebook' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
            {platformLabel}
          </span>

          <p className="post-caption-text">{truncatedCaption}</p>

          <button className="post-read-more" onClick={(e) => { e.stopPropagation(); onReadMore && onReadMore(post); }}>
            Read More
          </button>
        </div>

        {mediaUrl && (
          <div className="post-image-area">
            <img src={mediaUrl} alt={post.caption || 'Social media post'} loading="lazy" />
            {post.media_type === 'VIDEO' && (
              <div className="media-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            )}
            {post.media_type === 'CAROUSEL_ALBUM' && (
              <div className="media-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="2" y="2" width="13" height="13" rx="2"/>
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                </svg>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Date + Stats */}
      <div className="post-footer">
        <span className="post-date">{formatDate(post.timestamp)}</span>
        <div className="post-stats">
          <span className="stat-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {formatLikes(post.likes_count)}
          </span>
          <span 
            className="stat-item" 
            onClick={(e) => {
              e.stopPropagation();
              if (post.permalink) window.open(post.permalink, '_blank');
            }}
            title="Open original post"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
