'use client';

export default function PostDetail({ post, onClose }) {
  if (!post) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatLikes = (count) => {
    if (!count) return '0';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const mediaUrl = post.media_type === 'VIDEO' ? post.media_url : (post.media_url || post.thumbnail_url);
  const platformClass = post.platform || 'instagram';
  const platformLabel = platformClass.toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {mediaUrl && (
          <div className="modal-media">
            {post.media_type === 'VIDEO' ? (
              <video src={post.media_url} controls autoPlay muted />
            ) : (
              <img src={mediaUrl} alt={post.caption || 'Post'} />
            )}
          </div>
        )}

        <div className="modal-info">
          <div className="modal-platform-badge">
            <span className={`post-platform-badge ${platformClass}`}>
              {platformLabel}
            </span>
          </div>

          <div className="modal-caption">
            {post.caption || 'No caption'}
          </div>

          <div className="modal-meta">
            <div>
              <span>{formatDate(post.timestamp)}</span>
              {post.likes_count > 0 && (
                <span style={{ marginLeft: 16 }}>
                  ♥ {formatLikes(post.likes_count)} likes
                </span>
              )}
            </div>
            {post.permalink && (
              <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                View Original →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
