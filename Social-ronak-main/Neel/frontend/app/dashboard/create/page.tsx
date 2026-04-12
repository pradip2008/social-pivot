'use client';

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FiFacebook, FiInstagram, FiImage, FiVideo, FiLink, FiType, FiCalendar, FiSend, FiTrash2, FiClock, FiPlus, FiChevronRight, FiCheckCircle } from 'react-icons/fi';

const FacebookIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const InstagramIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
);

const POST_TYPES: Record<string, Array<{ value: string; label: string; icon: any; specText: string; isMulti?: boolean }>> = {
  Facebook: [
    { value: 'SINGLE_IMAGE', label: 'Image Post', icon: <FiImage />, specText: '1200 x 630px recommended · Max 8MB · JPG, PNG' },
    { value: 'VIDEO', label: 'Video Post', icon: <FiVideo />, specText: 'Max 1GB · MP4, MOV' },
    { value: 'ALBUM', label: 'Photo Album', icon: <FiImage />, specText: '1080 x 1080px recommended · Up to 20 images', isMulti: true },
    { value: 'REEL', label: 'Facebook Reel', icon: <FiVideo />, specText: '1080 x 1920px (9:16 vertical) · MP4, MOV' },
    { value: 'LINK', label: 'Link Post', icon: <FiLink />, specText: 'Paste any public URL' },
    { value: 'TEXT', label: 'Status Update', icon: <FiType />, specText: 'Plain text update' },
  ],
  Instagram: [
    { value: 'SINGLE_IMAGE', label: 'Post', icon: <FiImage />, specText: '1080 x 1080px or 4:5 · Max 8MB · JPG, PNG' },
    { value: 'VIDEO', label: 'Video', icon: <FiVideo />, specText: '1080 x 1080px or 4:5 · Max 100MB · MP4, MOV' },
    { value: 'CAROUSEL', label: 'Carousel', icon: <FiImage />, specText: '1080 x 1080px · Up to 10 items', isMulti: true },
    { value: 'REEL', label: 'Reel', icon: <FiVideo />, specText: '1080 x 1920px (9:16 vertical) · Max 100MB · MP4' },
  ],
};

type MediaItem = { url: string; filename: string; mimeType: string };

export default function CreatePostPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'scheduled'>('create');
  const [platform, setPlatform] = useState<'Facebook' | 'Instagram'>('Facebook');
  const [postType, setPostType] = useState('SINGLE_IMAGE');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState('');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [schedulerLoading, setSchedulerLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('ALL');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchJobs = async () => {
    setSchedulerLoading(true);
    try {
      const { data } = await api.get('/posts/schedule');
      setJobs(data);
    } catch (e: any) {
      toast.error('Failed to load scheduled posts');
    } finally {
      setSchedulerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'scheduled') {
      fetchJobs();
    }
  }, [activeTab]);

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Delete this scheduled post?')) return;
    try {
      await api.delete(`/posts/schedule/${id}`);
      toast.success('Scheduled post deleted');
      fetchJobs();
    } catch (e: any) {
      toast.error('Failed to delete scheduled post');
    }
  };

  useEffect(() => {
    const types = POST_TYPES[platform];
    if (!types.find(t => t.value === postType)) {
      setPostType(types[0].value);
    }
  }, [platform]);

  const maxChars = platform === 'Facebook' ? 63206 : 2200;
  const chars = caption.length;
  const isOverLimit = chars > maxChars;
  const currentTypeMeta = POST_TYPES[platform].find(t => t.value === postType);
  const isMulti = !!currentTypeMeta?.isMulti;
  const needsMedia = !['TEXT', 'LINK'].includes(postType);
  const isLink = postType === 'LINK';

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploadingProgress(`Uploading... ${file.name}`);
      const res = await api.post('/media/upload', formData, {
        params: { platform: platform.toUpperCase(), postType }
      });
      return { url: res.data.url, filename: res.data.filename, mimeType: res.data.mimeType };
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Upload failed');
      return null;
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    
    if (!isMulti && files.length > 1) {
      toast.error('This post type only accepts 1 file.');
      return;
    }

    setUploadingProgress('Preparing upload...');
    for (const file of files) {
      const res = await uploadFile(file);
      if (res) setMediaItems(prev => isMulti ? [...prev, res] : [res]);
    }
    setUploadingProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDropUpload = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!needsMedia) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      if (!isMulti && files.length > 1) {
        toast.error('This post type only accepts 1 file.');
        return;
      }
      for (const file of files) {
        const res = await uploadFile(file);
        if (res) setMediaItems(prev => isMulti ? [...prev, res] : [res]);
      }
      setUploadingProgress('');
    }
  };

  const removeMedia = (idx: number) => {
    setMediaItems(prev => prev.filter((_, i) => i !== idx));
  };

  const buildPayload = () => {
    const mediaUrls = mediaItems.map(x => x.url);
    return {
      platform,
      content: caption,
      mediaUrl: isLink ? linkUrl : (mediaUrls.length > 0 ? mediaUrls[0] : undefined),
      mediaType: mediaItems.length > 0 ? (mediaItems[0].mimeType.startsWith('video') ? 'VIDEO' : 'IMAGE') : undefined,
      postType,
      mediaUrls: mediaUrls.length > 1 ? mediaUrls : undefined,
      linkUrl: isLink ? linkUrl : undefined,
    };
  };

  const handlePublish = async () => {
    if (needsMedia && mediaItems.length === 0 && !isLink) return toast.error('Please add media first');
    if (!caption.trim() && !isLink) return toast.error('Content is required');
    if (isOverLimit) return toast.error('Content exceeds character limit');
    
    setIsPublishing(true);
    try {
      await api.post('/posts/publish-now', buildPayload());
      toast.success(`Published to ${platform}!`);
      resetForm();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledAt) return toast.error('Select a date and time');
    setIsScheduling(true);
    try {
      await api.post('/posts/schedule', { ...buildPayload(), scheduledAt: new Date(scheduledAt).toISOString() });
      toast.success(`Scheduled for ${new Date(scheduledAt).toLocaleString()}`);
      resetForm();
      setShowSchedulePicker(false);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Schedule failed');
    } finally {
      setIsScheduling(false);
    }
  };

  const resetForm = () => {
    setCaption('');
    setMediaItems([]);
    setLinkUrl('');
    setScheduledAt('');
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = selectedPlatform === 'ALL' || job.platform === selectedPlatform;
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">
              Create & Schedule
            </span>
          </h1>
          <p className="text-gray-400">Compose and plan your social media content across platforms.</p>
        </div>

        <div className="flex bg-surface p-1 rounded-xl border border-border self-start">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
          >
            Composer
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'scheduled' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
          >
            Scheduler
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: Composer */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Platform & Type */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                 <FiPlus size={120} />
              </div>
              
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Select Platform & Format
              </h3>

              <div className="flex gap-4 mb-8">
                <button
                  onClick={() => setPlatform('Facebook')}
                  className={`flex-1 p-4 rounded-xl border transition-all flex items-center justify-center gap-3 ${platform === 'Facebook' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-black/20 border-border text-gray-500 hover:border-gray-700'}`}
                >
                  <FacebookIcon />
                  <span className="font-bold">Facebook</span>
                </button>
                <button
                  onClick={() => setPlatform('Instagram')}
                  className={`flex-1 p-4 rounded-xl border transition-all flex items-center justify-center gap-3 ${platform === 'Instagram' ? 'bg-pink-600/10 border-pink-500 text-pink-400' : 'bg-black/20 border-border text-gray-500 hover:border-gray-700'}`}
                >
                  <InstagramIcon />
                  <span className="font-bold">Instagram</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {POST_TYPES[platform].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setPostType(type.value)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition-all ${postType === type.value ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-black/20 border-border text-gray-400 hover:border-gray-600'}`}
                  >
                    <span className="opacity-70">{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Content */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
               <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Compose Content
              </h3>

              {isLink ? (
                <div className="space-y-4">
                  <div className="relative">
                    <FiLink className="absolute left-4 top-4 text-gray-500" />
                    <input
                      type="url"
                      placeholder="Enter link URL (e.g. https://your-site.com)"
                      className="w-full bg-black/40 border border-border rounded-xl p-4 pl-11 text-white focus:outline-none focus:border-primary transition"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                    />
                  </div>
                </div>
              ) : needsMedia ? (
                <div className="space-y-4 mb-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDropUpload}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-black/20 hover:border-gray-600 hover:bg-black/40'}`}
                  >
                     <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple={isMulti} accept="image/*,video/*" />
                     {uploadingProgress ? (
                        <div className="flex flex-col items-center gap-3">
                           <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                           <span className="text-sm text-primary font-bold animate-pulse">{uploadingProgress}</span>
                        </div>
                     ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-lg shadow-primary/10">
                            <FiPlus size={24} />
                          </div>
                          <p className="text-white font-bold">Drag & Drop Media</p>
                          <p className="text-xs text-gray-500 mt-1">{currentTypeMeta?.specText}</p>
                        </>
                     )}
                  </div>

                  {mediaItems.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                      {mediaItems.map((item, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-black/40">
                          {item.mimeType.startsWith('video') ? (
                            <div className="w-full h-full flex items-center justify-center bg-black"><FiVideo size={20} className="text-gray-500" /></div>
                          ) : (
                            <img src={item.url} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => removeMedia(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="relative">
                <textarea
                  className="w-full bg-black/40 border border-border rounded-2xl p-5 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition min-h-[160px] resize-none"
                  placeholder={platform === 'Facebook' ? "Share what's on your mind..." : "Write a caption for your post..."}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <div className={`absolute bottom-4 right-4 text-[10px] font-bold px-2 py-1 rounded-md ${isOverLimit ? 'bg-red-500/20 text-red-400' : 'bg-black/40 text-gray-500'}`}>
                  {chars.toLocaleString()} / {maxChars.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Preview & Actions */}
          <div className="lg:col-span-1 border-l border-border hidden lg:block" />
          <div className="lg:col-span-4 space-y-6">
            
            <div className="sticky top-6 space-y-6">
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
                 <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Publishing Actions
                  </h3>

                  <div className="space-y-3">
                    <button
                      onClick={handlePublish}
                      disabled={isPublishing || !!uploadingProgress}
                      className="w-full bg-primary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                      {isPublishing ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><FiSend /> Publish Now</>}
                    </button>

                    {!showSchedulePicker ? (
                      <button
                        onClick={() => setShowSchedulePicker(true)}
                        className="w-full bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
                      >
                        <FiCalendar /> Schedule for later
                      </button>
                    ) : (
                      <div className="p-4 bg-black/40 border border-border rounded-xl space-y-4 animate-slide-up">
                         <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400">Select Date & Time</span>
                            <button onClick={() => setShowSchedulePicker(false)} className="text-gray-500 hover:text-white"><FiTrash2 size={14} /></button>
                         </div>
                         <input
                           type="datetime-local"
                           value={scheduledAt}
                           onChange={(e) => setScheduledAt(e.target.value)}
                           className="w-full bg-surface border border-border rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none"
                         />
                         <button
                           onClick={handleSchedule}
                           disabled={isScheduling || !scheduledAt}
                           className="w-full bg-primary/20 border border-primary/30 text-primary font-bold py-3 rounded-lg hover:bg-primary/30 transition-all disabled:opacity-30"
                         >
                           {isScheduling ? 'Scheduling...' : 'Confirm Schedule'}
                         </button>
                      </div>
                    )}
                  </div>
              </div>

              {/* Live Preview (Simple) */}
              <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
                 <div className="p-4 border-b border-border bg-black/20">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Smart Preview</h3>
                 </div>
                 
                 <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">U</div>
                       <div className="flex-1">
                          <p className="text-sm font-bold text-white">Your Profile</p>
                          <p className="text-[10px] text-gray-500 flex items-center gap-1">
                            {platform === 'Facebook' ? <FiFacebook size={10} /> : <FiInstagram size={10} />}
                            Preview Mode
                          </p>
                       </div>
                    </div>

                    <div className="bg-black/40 border border-border rounded-xl min-h-[200px] flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
                       {(mediaItems.length > 0 || linkUrl) ? (
                          <div className="absolute inset-0">
                             {linkUrl && isLink ? (
                                <div className="p-4 h-full flex flex-col justify-center">
                                   <FiLink className="mx-auto mb-2 text-primary" size={24} />
                                   <p className="text-[10px] text-blue-400 truncate">{linkUrl}</p>
                                </div>
                             ) : mediaItems.length > 0 ? (
                                mediaItems[0].mimeType.startsWith('video') ? (
                                   <video src={mediaItems[0].url} className="w-full h-full object-cover" muted autoPlay loop />
                                ) : (
                                   <img src={mediaItems[0].url} className="w-full h-full object-cover" />
                                )
                             ) : null}
                          </div>
                       ) : (
                          <div className="space-y-2 opacity-30">
                             <FiImage size={32} className="mx-auto" />
                             <p className="text-xs px-10">Media or links will appear here</p>
                          </div>
                       )}
                    </div>

                    <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed">
                       {caption || 'The caption you write will be displayed here...'}
                    </p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SCHEDULER VIEW */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 flex bg-surface border border-border rounded-2xl p-1 shrink-0">
               <button onClick={() => setSelectedPlatform('ALL')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all ${selectedPlatform === 'ALL' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}>All</button>
               <button onClick={() => setSelectedPlatform('Facebook')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all ${selectedPlatform === 'Facebook' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}>Facebook</button>
               <button onClick={() => setSelectedPlatform('Instagram')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all ${selectedPlatform === 'Instagram' ? 'bg-pink-500/20 text-pink-400' : 'text-gray-400 hover:text-white'}`}>Instagram</button>
            </div>
            <div className="relative">
              <FiClock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search schedule..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl p-4 pl-11 text-sm text-white focus:outline-none focus:border-primary transition"
              />
            </div>
          </div>

          {schedulerLoading ? (
             <div className="py-20 flex justify-center"><div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredJobs.length === 0 ? (
             <div className="py-32 bg-surface/30 border border-border border-dashed rounded-[2rem] text-center space-y-4">
                <FiCalendar size={48} className="mx-auto text-gray-700" />
                <p className="text-gray-500 font-medium">No posts scheduled in this filter.</p>
                <button onClick={() => setActiveTab('create')} className="text-primary font-bold text-sm bg-primary/10 px-6 py-2 rounded-full border border-primary/20">Create One Now</button>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <div key={job.id} className="group bg-surface border border-border rounded-2xl p-6 hover:border-primary/50 transition-all relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${job.platform === 'Facebook' ? 'bg-blue-500/10 text-blue-400' : 'bg-pink-500/10 text-pink-400'}`}>
                          {job.platform === 'Facebook' ? <FiFacebook /> : <FiInstagram />}
                       </div>
                       <div>
                          <p className="text-sm font-bold text-white uppercase tracking-wider">{job.platform}</p>
                          <p className="text-[10px] text-gray-500">{job.postType || 'Single Post'}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-border">
                        <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'Sent' ? 'bg-green-500' : job.status === 'Failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className="text-[10px] font-bold text-gray-300 uppercase">{job.status || 'Scheduled'}</span>
                    </div>
                  </div>

                  <p className="text-gray-400 text-sm line-clamp-3 mb-6 leading-relaxed italic border-l-2 border-primary/20 pl-4">
                    "{job.content}"
                  </p>

                  <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-tight">
                       <FiClock />
                       {new Date(job.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-red-500/10"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
