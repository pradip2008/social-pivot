import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';
import axios from 'axios';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';

@Injectable()
export class HashtagsService {
    private logger = new Logger(HashtagsService.name);

    constructor(
        private prisma: PrismaService,
        private metaService: MetaService,
    ) {}

    // ── SHARED METHOD — used by search and top endpoints ──
    // Now with 24h caching via HashtagCache table to respect Meta's rate limits
    private async getHashtagData(
        igUserId: string,
        hashtag: string,
        accessToken: string,
    ): Promise<{ hashtag: string; count: string; raw: number }> {
        const normalizedTag = hashtag.toLowerCase().replace(/^#/, '');

        // Step 0: Check HashtagCache for a recent result (within 24 hours)
        try {
            const cached = await this.prisma.hashtagCache.findUnique({
                where: { hashtag: normalizedTag },
            });

            if (cached) {
                const hoursSinceLastFetch = (Date.now() - cached.lastFetchedAt.getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastFetch < 24) {
                    this.logger.debug(`[Hashtag] Cache HIT for "${normalizedTag}" (${hoursSinceLastFetch.toFixed(1)}h old)`);
                    return { hashtag: normalizedTag, count: this.formatCount(cached.resultCount), raw: cached.resultCount };
                }
                this.logger.debug(`[Hashtag] Cache STALE for "${normalizedTag}" (${hoursSinceLastFetch.toFixed(1)}h old). Refreshing...`);
            }
        } catch (e) {
            // Cache check failed, proceed to live fetch
        }

        try {
            // Step 1: Search for the hashtag ID
            const searchRes = await axios.get(
                `${GRAPH_API_BASE}/ig_hashtag_search`,
                {
                    params: {
                        q: normalizedTag,
                        user_id: igUserId,
                        access_token: accessToken,
                    },
                    timeout: 15000,
                },
            );

            const hashtagId = searchRes.data?.data?.[0]?.id;
            if (!hashtagId) {
                return { hashtag: normalizedTag, count: 'No data', raw: 0 };
            }

            // Step 2: Fetch media count for that hashtag
            const countRes = await axios.get(
                `${GRAPH_API_BASE}/${hashtagId}`,
                {
                    params: {
                        fields: 'name,media_count',
                        access_token: accessToken,
                    },
                    timeout: 15000,
                },
            );

            const raw = countRes.data?.media_count ?? 0;

            // Step 3: Upsert into HashtagCache for future 24h caching
            try {
                await this.prisma.hashtagCache.upsert({
                    where: { hashtag: normalizedTag },
                    update: { resultCount: raw, lastFetchedAt: new Date() },
                    create: { hashtag: normalizedTag, resultCount: raw, lastFetchedAt: new Date() },
                });
                this.logger.debug(`[Hashtag] Cached result for "${normalizedTag}": ${raw}`);
            } catch (cacheErr) {
                this.logger.warn(`[Hashtag] Failed to cache result for "${normalizedTag}": ${cacheErr.message}`);
            }

            return { hashtag: normalizedTag, count: this.formatCount(raw), raw };
        } catch (error: any) {
            const msg =
                error.response?.data?.error?.message || error.message;
            this.logger.warn(
                `[Hashtag] Failed to fetch data for "${normalizedTag}": ${msg}`,
            );
            return { hashtag: normalizedTag, count: 'No data', raw: 0 };
        }
    }

    private formatCount(raw: number): string {
        if (raw >= 1_000_000) {
            return `${(raw / 1_000_000).toFixed(1)}M posts`;
        }
        if (raw >= 1_000) {
            return `${(raw / 1_000).toFixed(1)}K posts`;
        }
        return `${raw} posts`;
    }

    // ── ENDPOINT 1: Search a single hashtag ──
    async searchHashtag(companyId: string): Promise<{
        igUserId: string;
        accessToken: string;
    } | null> {
        const conn = await this.metaService.getConnectionForPlatform(
            companyId,
            'instagram',
        );
        if (!conn || !conn.isActive || !conn.igAccountId || !conn.accessToken) {
            return null;
        }
        return { igUserId: conn.igAccountId, accessToken: conn.accessToken };
    }

    async search(
        companyId: string,
        query: string,
    ): Promise<{ hashtag: string; count: string; raw: number }> {
        const ig = await this.searchHashtag(companyId);
        if (!ig) {
            return {
                hashtag: query,
                count: 'Instagram not connected',
                raw: 0,
            };
        }
        return this.getHashtagData(ig.igUserId, query, ig.accessToken);
    }

    // ── ENDPOINT 2: Top hashtags from synced posts ──
    async getTopHashtags(
        companyId: string,
    ): Promise<{ hashtag: string; frequency: number; count?: string; raw?: number }[]> {
        // Step 1: Pull all post content for this company
        const posts = await this.prisma.post.findMany({
            where: { companyId, isDeleted: false },
            select: { content: true },
        });

        // Step 2: Extract hashtags via regex and count frequency
        const freq = new Map<string, number>();
        const hashtagRegex = /#(\w+)/g;

        for (const post of posts) {
            if (!post.content) continue;
            let match: RegExpExecArray | null;
            while ((match = hashtagRegex.exec(post.content)) !== null) {
                const tag = match[1].toLowerCase();
                freq.set(tag, (freq.get(tag) || 0) + 1);
            }
        }

        // Step 3: Sort by frequency, take top 20
        const sorted = [...freq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([hashtag, frequency]) => ({ hashtag, frequency }));

        if (sorted.length === 0) return [];

        // Step 4: If IG connected, try to fetch live counts (best effort)
        const ig = await this.searchHashtag(companyId);
        if (!ig) {
            return sorted;
        }

        const results = await Promise.allSettled(
            sorted.map(async (item) => {
                const data = await this.getHashtagData(
                    ig.igUserId,
                    item.hashtag,
                    ig.accessToken,
                );
                return { ...item, count: data.count, raw: data.raw };
            }),
        );

        return results.map((r, i) => {
            if (r.status === 'fulfilled') return r.value;
            return sorted[i]; // fallback to frequency-only
        });
    }

    // ── ENDPOINT 3: Hashtag Groups CRUD ──
    async getGroups(companyId: string) {
        return this.prisma.hashtagGroup.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createGroup(
        companyId: string,
        name: string,
        hashtags: string,
    ) {
        // Normalize: "#tech #ai machine-learning" → "tech,ai,machine-learning"
        const normalized = hashtags
            .replace(/#/g, '')
            .split(/[\s,]+/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)
            .filter((t, i, arr) => arr.indexOf(t) === i) // dedupe
            .join(',');

        return this.prisma.hashtagGroup.create({
            data: { companyId, name: name.trim(), hashtags: normalized },
        });
    }

    async deleteGroup(companyId: string, groupId: string) {
        // Verify ownership before deleting
        const group = await this.prisma.hashtagGroup.findFirst({
            where: { id: groupId, companyId },
        });
        if (!group) {
            return { success: false, message: 'Group not found' };
        }
        await this.prisma.hashtagGroup.delete({ where: { id: groupId } });
        return { success: true };
    }
}
