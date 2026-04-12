'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AiGenerator() {
    const router = useRouter();
    const [topic, setTopic] = useState('');
    const [platform, setPlatform] = useState('LinkedIn');
    const [tone, setTone] = useState('Professional');
    const [audience, setAudience] = useState('');
    const [cta, setCta] = useState('');
    const [length, setLength] = useState('Medium');
    const [loading, setLoading] = useState(false);
    const [generatedPost, setGeneratedPost] = useState('');
    const [draftId, setDraftId] = useState(null);
    const [scheduleDate, setScheduleDate] = useState('');



    const handleGenerate = async () => {
        setLoading(true);
        try {
            const { data } = await api.post('/ai/generate-post', {
                topic,
                platform,
                tone,
                audience,
                cta,
                length,
            });
            setGeneratedPost(data.content);
            setDraftId(data.draftId);
            toast.success('Post generated successfully!');
        } catch (error) {
            toast.error('Failed to generate post');
        } finally {
            setLoading(false);
        }
    };



    const handleSchedule = async () => {
        if (!draftId || !scheduleDate) {
            toast.error('Please select a date and time');
            return;
        }

        const selectedTime = new Date(scheduleDate);
        const isPast = selectedTime.getTime() <= Date.now();

        try {
            await api.post('/posts/schedule', {
                platform,
                content: generatedPost,
                scheduledAt: selectedTime.toISOString(),
            });
            if (isPast) {
                toast.error('⚠️ Post marked as Failed — scheduled time was in the past!');
            } else {
                toast.success('Post scheduled successfully! Redirecting...');
                setTimeout(() => router.push('/dashboard/posts?filter=pending'), 1500);
            }
            setScheduleDate('');
            setGeneratedPost('');
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to schedule post';
            toast.error(msg);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400 mb-8">
                AI Post Generator
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Form */}
                <div className="bg-surface rounded-xl p-6 border border-border shadow-lg space-y-4 h-fit">
                    <label className="block text-sm font-medium text-gray-400">Topic or Idea</label>
                    <textarea
                        className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary h-32"
                        placeholder="e.g. Launching a new SaaS feature for scheduling posts..."
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Platform</label>
                            <select
                                className="w-full bg-background border border-gray-700 rounded-lg p-2 text-white"
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                            >
                                <option>LinkedIn</option>
                                <option>Twitter / X</option>
                                <option>Facebook</option>
                                <option>Instagram</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Tone</label>
                            <select
                                className="w-full bg-background border border-gray-700 rounded-lg p-2 text-white"
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                            >
                                <option>Professional</option>
                                <option>Casual</option>
                                <option>Promotional</option>
                                <option>Witty</option>
                            </select>
                        </div>
                    </div>

                    <label className="block text-sm font-medium text-gray-400">Target Audience</label>
                    <input
                        className="w-full bg-background border border-gray-700 rounded-lg p-2 text-white"
                        placeholder="e.g. HR Managers, Founders..."
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                    />

                    <label className="block text-sm font-medium text-gray-400">Call to Action (CTA)</label>
                    <input
                        className="w-full bg-background border border-gray-700 rounded-lg p-2 text-white"
                        placeholder="e.g. Sign up for free trial"
                        value={cta}
                        onChange={(e) => setCta(e.target.value)}
                    />

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !topic}
                        className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-cyan-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                Generating Magic...
                            </>
                        ) : (
                            'Generate Post ⚡'
                        )}
                    </button>

                </div>

                {/* Output & Scheduling */}
                <div className="space-y-6">
                    <div className="bg-surface rounded-xl p-6 border border-border shadow-lg min-h-[400px] flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-4">Preview</h3>
                        {generatedPost ? (
                            <>
                                <textarea
                                    className="w-full flex-1 bg-background/50 border border-gray-700 rounded-lg p-4 text-white font-sans text-lg leading-relaxed focus:border-primary focus:ring-0"
                                    value={generatedPost}
                                    onChange={(e) => setGeneratedPost(e.target.value)}
                                />



                                <div className="mt-4 pt-4 border-t border-border">
                                    <h4 className="text-sm font-bold text-gray-400 mb-2">Schedule this post</h4>
                                    <div className="flex gap-2">
                                        <input
                                            type="datetime-local"
                                            className="bg-background border border-gray-700 rounded px-3 py-2 text-white flex-1 focus:border-cyan-500 focus:outline-none"
                                            value={scheduleDate}
                                            onChange={(e) => setScheduleDate(e.target.value)}
                                        />
                                        <button
                                            onClick={handleSchedule}
                                            disabled={!scheduleDate}
                                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded transition disabled:opacity-50"
                                        >
                                            Schedule
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
                                <p>AI Output will appear here...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
