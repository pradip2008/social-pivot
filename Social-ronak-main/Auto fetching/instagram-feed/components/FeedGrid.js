'use client';
import PostCard from './PostCard';

export default function FeedGrid({ posts, columns, onReadMore }) {
  return (
    <div
      className="feed-grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {posts.map((post) => (
        <PostCard 
          key={`${post.platform}-${post.platform_post_id || post.id}`} 
          post={post} 
          onReadMore={onReadMore}
        />
      ))}
    </div>
  );
}
