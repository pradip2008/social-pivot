import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import { encryptToken, decryptToken } from '../utils/encryption.util';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

@Injectable()
export class MetaService {
    private logger = new Logger(MetaService.name);

    constructor(private prisma: PrismaService) { }

    // ── Generate Meta OAuth URL ──
    getOAuthUrl(platform: string, redirectUri: string): string {
        const normalizedPlatform = (platform || '').toLowerCase();

        if (normalizedPlatform === 'linkedin') {
            const linkedInClientId = process.env.LINKEDIN_CLIENT_ID;
            if (!linkedInClientId || linkedInClientId === 'your-linkedin-client-id') {
                this.logger.warn('LINKEDIN_CLIENT_ID not configured - LinkedIn OAuth URL unavailable.');
                return '';
            }

            const finalRedirectUri = redirectUri || process.env.LINKEDIN_CALLBACK_URL || '';
            if (!finalRedirectUri) {
                this.logger.warn('LinkedIn redirect URI is missing.');
                return '';
            }

            // Request minimal scopes: OIDC + posting. r_liteprofile is optional and not available on all apps.
            const scopes = ['openid', 'profile', 'email', 'w_member_social'];
            const state = `linkedin_${Date.now()}`;
            return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(linkedInClientId)}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${encodeURIComponent(state)}`;
        }

        const appId = process.env.META_APP_ID;
        if (!appId || appId === 'your-meta-app-id') {
            this.logger.warn('META_APP_ID not configured - OAuth URL unavailable.');
            return '';
        }

        const scopes = normalizedPlatform === 'facebook'
            ? ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'public_profile']
            : ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'public_profile'];

        return `https://www.facebook.com/v25.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(',')}&response_type=token`;
    }
    async exchangeLinkedInCode(code: string, redirectUri: string): Promise<{
        accessToken: string;
        expiresAt: Date | null;
        scopes: string[];
        authorUrn: string;
        accountName: string;
    }> {
        if (!code) {
            throw new BadRequestException('LinkedIn OAuth code is required');
        }

        const linkedInClientId = process.env.LINKEDIN_CLIENT_ID;
        const linkedInClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        const finalRedirectUri = redirectUri || process.env.LINKEDIN_CALLBACK_URL || '';

        if (!linkedInClientId || !linkedInClientSecret) {
            throw new BadRequestException('LinkedIn OAuth is not configured on server (LINKEDIN_CLIENT_ID/SECRET missing).');
        }
        if (!finalRedirectUri) {
            throw new BadRequestException('LinkedIn redirect URI is required.');
        }

        try {
            const body = new URLSearchParams();
            body.set('grant_type', 'authorization_code');
            body.set('code', code);
            body.set('redirect_uri', finalRedirectUri);
            body.set('client_id', linkedInClientId);
            body.set('client_secret', linkedInClientSecret);

            const { data } = await axios.post(
                'https://www.linkedin.com/oauth/v2/accessToken',
                body.toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 15000,
                },
            );

            const accessToken = data?.access_token;
            if (!accessToken) {
                throw new BadRequestException('LinkedIn did not return an access token.');
            }

            const scopes = await this.ensureLinkedInPostingScope(accessToken);
            const identity = await this.resolveLinkedInIdentity(accessToken);
            const expiresAt = data?.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

            return {
                accessToken,
                expiresAt,
                scopes,
                authorUrn: identity.authorUrn,
                accountName: identity.accountName,
            };
        } catch (error: any) {
            const message = this.extractErrorMessage(error, 'LinkedIn code exchange failed');
            throw new BadRequestException(`LinkedIn code exchange failed: ${message}`);
        }
    }

    // ── Exchange short-lived token for long-lived (60-day) token ──
    async exchangeForLongLivedToken(accessToken: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
        try {
            const { appId, appSecret } = await this.getSystemMetaApp();

            if (!appId || !appSecret || appId === 'your-meta-app-id') {
                this.logger.warn('META_APP_ID or META_APP_SECRET not correctly configured. No fallback available in DB. Using short-lived token.');
                return { accessToken, expiresAt: null };
            }

            this.logger.log('Exchanging short-lived token for long-lived one...');
            const { data } = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: accessToken,
                },
            });

            const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
            this.logger.log(`Exchange successful. Token expires at: ${expiresAt || 'Never'}`);

            return {
                accessToken: data.access_token,
                expiresAt,
            };
        } catch (error: any) {
            const msg = error.response?.data?.error?.message || error.message;
            this.logger.error(`Token exchange failed: ${msg}`);
            // Fallback to original token if exchange fails, but log it
            return { accessToken, expiresAt: null };
        }
    }

    // ── Save / update Meta connection for a platform ──
    // ISSUE 1 FIX: After long-lived exchange, fetch Page Access Token via /me/accounts
    // ISSUE 2 FIX: For Instagram, explicitly fetch IG Business Account ID via /{page-id}?fields=instagram_business_account
    async connectPlatform(
        companyId: string,
        platform: string,
        config: {
            accessToken: string;
            refreshToken?: string;
            tokenType?: string;
            expiresAt?: Date | string | null;
            pageId?: string;
            igAccountId?: string;
            appId?: string;
            appSecret?: string;
            apiKey?: string;
            apiSecret?: string;
            accessTokenSecret?: string;
            authorUrn?: string;
        },
    ) {
        const validPlatforms = ['facebook', 'instagram', 'twitter', 'linkedin'];
        const normalizedPlatform = platform.toLowerCase();
        if (!validPlatforms.includes(normalizedPlatform)) {
            throw new BadRequestException(
                `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`,
            );
        }

        if (!config.accessToken) {
            throw new BadRequestException('Access token is required');
        }

        let finalAccessToken = config.accessToken;
        let finalExpiresAt = config.expiresAt ? new Date(config.expiresAt) : null;

        // --- STRICT PRE-SAVE VALIDATION ---
        const perms = normalizedPlatform === 'linkedin' ? [] : await this.fetchPermissions(config.accessToken);
        let grantedScopeList = perms.filter((p: any) => p.status === 'granted').map((p: any) => p.permission);

        if (normalizedPlatform === 'facebook') {
            if (perms.length > 0 && !grantedScopeList.includes('pages_manage_posts')) {
                throw new BadRequestException('MISSING_PERMISSION: Connect failed. You must grant "pages_manage_posts" permission to allow this app to post on your behalf.');
            }
            if (perms.length === 0) {
                // User suggested retry and "not trusting blindly" on empty.
                // Secondary check: if we can't find ANY pages, the token is definitely bad/unauthorized
                const discoveredPages = await this.fetchMetaPages(config.accessToken);
                if (discoveredPages.length === 0) {
                    throw new BadRequestException('UNVERIFIED_TOKEN: Could not verify "pages_manage_posts" permission and found no Pages. Ensure your token is authorized for your account.');
                }
                this.logger.warn('[FB] Permissions empty but found Pages. Proceeding with caution...');
            }
            if (!config.pageId) {
                this.logger.log(`Facebook Page ID missing for company ${companyId}. Attempting auto-discovery...`);
                try {
                    const pages = await this.fetchMetaPages(config.accessToken);
                    if (pages.length === 1) {
                        config.pageId = pages[0].id;
                        this.logger.log(`Auto-discovered Facebook Page ID: ${config.pageId}`);
                    } else if (pages.length > 1) {
                        throw new BadRequestException('Multiple Facebook Pages found. Please use "Fetch Accounts" to select one.');
                    } else {
                        throw new BadRequestException('No Facebook Pages found for this token.');
                    }
                } catch (e: any) {
                    if (e instanceof BadRequestException) throw e;
                    throw new BadRequestException(`Meta ID Discovery Failed: ${e.message}`);
                }
            }

            // ISSUE 1 FIX: Exchange for long-lived User token FIRST, then derive Page Access Token
            this.logger.log(`[FB] Exchanging user token for long-lived token...`);
            const exchangeResult = await this.exchangeForLongLivedToken(config.accessToken);
            const longLivedUserToken = exchangeResult.accessToken;

            // Now fetch the Page Access Token from /me/accounts using the long-lived user token
            // Page Access Tokens derived from long-lived user tokens are permanent (never expire)
            const pageToken = await this.getPageAccessToken(longLivedUserToken, config.pageId!);
            if (!pageToken) {
                throw new BadRequestException(
                    `Failed to retrieve Page Access Token for Page ${config.pageId}. ` +
                    `Ensure this account has admin access to the Page.`
                );
            }
            finalAccessToken = pageToken;
            finalExpiresAt = null; // Page tokens derived from long-lived user tokens never expire
            this.logger.log(`[FB] Successfully retrieved permanent Page Access Token for Page ${config.pageId}`);

            try {
                this.logger.log(`Validating FB token for page ${config.pageId}...`);
                await axios.get(`${GRAPH_API_BASE}/${config.pageId}?fields=id,name&access_token=${finalAccessToken}`);
            } catch (error: any) {
                const msg = error.response?.data?.error?.message || error.message;
                throw new BadRequestException(`Facebook Validation Failed: ${msg}`);
            }
        } else if (normalizedPlatform === 'instagram') {
            const requiredIgPerms = ['instagram_content_publish', 'instagram_basic', 'pages_show_list', 'pages_read_engagement'];
            const missingIgPerms = requiredIgPerms.filter(p => !grantedScopeList.includes(p));
            if (perms.length > 0 && missingIgPerms.length > 0) {
                throw new BadRequestException(`MISSING_PERMISSION: Connect failed. You must grant the following Instagram permissions: ${missingIgPerms.join(', ')}`);
            }
            if (perms.length === 0) {
                const discoveredIG = await this.fetchInstagramAccounts(config.accessToken);
                if (discoveredIG.length === 0) {
                    throw new BadRequestException('UNVERIFIED_TOKEN: Could not verify "instagram_content_publish" permission and found no Instagram accounts. Ensure your token is authorized for IG Business.');
                }
                this.logger.warn('[IG] Permissions empty but found IG accounts. Proceeding with caution...');
            }

            // ISSUE 1 FIX: Exchange for long-lived user token first
            this.logger.log(`[IG] Exchanging user token for long-lived token...`);
            const exchangeResult = await this.exchangeForLongLivedToken(config.accessToken);
            const longLivedUserToken = exchangeResult.accessToken;

            // Auto-discover Page ID if not provided (needed to get Page Token and IG Business ID)
            if (!config.pageId) {
                const pages = await this.fetchMetaPages(longLivedUserToken);
                const igPage = pages.find((p: any) => p.instagramAccount) || (pages.length === 1 ? pages[0] : null);
                if (!igPage) {
                    throw new BadRequestException('No Facebook Page with linked Instagram Business account found. Ensure your IG is professional and linked to a Page.');
                }
                config.pageId = igPage.id;
                this.logger.log(`[IG] Auto-discovered Page ID for IG: ${config.pageId}`);
            }

            // ISSUE 1 FIX: Get Page Access Token (required for IG Content Publishing API)
            const pageToken = await this.getPageAccessToken(longLivedUserToken, config.pageId!);
            if (!pageToken) {
                throw new BadRequestException(
                    `Failed to retrieve Page Access Token for Page ${config.pageId}. ` +
                    `Instagram publishing requires a Page Access Token.`
                );
            }
            finalAccessToken = pageToken;
            finalExpiresAt = null; // Permanent token
            this.logger.log(`[IG] Retrieved permanent Page Access Token for IG publishing`);

            // ISSUE 2 FIX: Explicitly fetch Instagram Business Account ID via /{page-id}?fields=instagram_business_account
            if (!config.igAccountId) {
                this.logger.log(`[IG] Fetching Instagram Business Account ID from Page ${config.pageId}...`);
                const igBusinessId = await this.getInstagramBusinessAccountId(finalAccessToken, config.pageId!);
                if (!igBusinessId) {
                    throw new BadRequestException(
                        'No Instagram Business Account is linked to this Facebook Page. ' +
                        'Please link your Instagram Professional account to your Facebook Page in Meta Business Suite, then reconnect.'
                    );
                }
                config.igAccountId = igBusinessId;
                this.logger.log(`[IG] Discovered IG Business Account ID: ${config.igAccountId}`);
            }

            try {
                this.logger.log(`Validating IG token for account ${config.igAccountId}...`);
                await axios.get(`${GRAPH_API_BASE}/${config.igAccountId}?fields=id,username&access_token=${finalAccessToken}`);
            } catch (error: any) {
                const msg = error.response?.data?.error?.message || error.message;
                throw new BadRequestException(`Instagram Validation Failed: ${msg}`);
            }
                        } else if (normalizedPlatform === 'linkedin') {
            this.logger.log(`[LI Connect] Validating token/scopes...`);
            const linkedInIdentity = await this.resolveLinkedInIdentity(config.accessToken);
            const scopes = await this.ensureLinkedInPostingScope(config.accessToken);
            grantedScopeList = scopes;

            this.logger.log(`[LI Connect OK] Scopes OK: ${scopes.slice(0, 3).join(', ')}${scopes.length > 3 ? '...' : ''}`);

            if (!config.authorUrn) {
                config.authorUrn = linkedInIdentity.authorUrn;
            }
            if (!config.authorUrn) {
                throw new BadRequestException('LinkedIn author URN could not be resolved from token');
            }

            // Verify URN ownership
            // Soft-verify URN ownership. Some LinkedIn tenants return 403 for /people when token lacks r_liteprofile; don't block connect.
            try {
                await axios.get(`${LINKEDIN_API_BASE}/people/${linkedInIdentity.memberId}?projection=(id)`, {
                    headers: { Authorization: `Bearer ${config.accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
                });
                this.logger.log(`[LI Connect OK] URN verified: ${config.authorUrn}`);
            } catch (urnErr: any) {
                this.logger.warn(`[LI Connect] Skipping URN verification: ${this.extractLinkedInError(urnErr)}`);
            }

            finalAccessToken = config.accessToken;
            finalExpiresAt = null;
        }

        // Final fallback validation
        if (normalizedPlatform === 'facebook' && !config.pageId) throw new BadRequestException('Facebook Page ID is required');
        if (normalizedPlatform === 'instagram' && !config.igAccountId) throw new BadRequestException('Instagram Account ID is required');
        if (normalizedPlatform === 'linkedin' && !config.authorUrn) throw new BadRequestException('LinkedIn author URN is required');

        const encryptedAccessToken = encryptToken(finalAccessToken)!;
        const encryptedRefreshToken = config.refreshToken ? encryptToken(config.refreshToken) : null;
        const encryptedAppSecret = config.appSecret ? encryptToken(config.appSecret) : null;
        const encryptedApiKey = config.apiKey ? encryptToken(config.apiKey) : null;
        const encryptedApiSecret = config.apiSecret ? encryptToken(config.apiSecret) : null;
        const encryptedAccessTokenSecret = config.accessTokenSecret ? encryptToken(config.accessTokenSecret) : null;

        const expiresAt = finalExpiresAt;

        // Save granted scopes info
        const scopesString = grantedScopeList.join(',');

        const connectionData: any = {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenType: config.tokenType || 'bearer',
            expiresAt: expiresAt,
            isActive: true,
            pageId: config.pageId || null,
            igAccountId: config.igAccountId || null,
            appId: config.appId || null,
            appSecret: encryptedAppSecret,
            apiKey: encryptedApiKey,
            apiSecret: encryptedApiSecret,
            accessTokenSecret: encryptedAccessTokenSecret,
            authorUrn: config.authorUrn || null,
            scopes: scopesString,
        };

        return this.prisma.metaConnection.upsert({
            where: { companyId_platform: { companyId, platform: normalizedPlatform } },
            update: connectionData,
            create: {
                companyId,
                platform: normalizedPlatform,
                ...connectionData
            },
        });
    }

    async disconnectPlatform(companyId: string, platform: string) {
        const normalizedPlatform = platform.toLowerCase();
        return this.prisma.metaConnection.updateMany({
            where: { companyId, platform: normalizedPlatform },
            data: { isActive: false },
        });
    }

    async getPlatformConnections(companyId: string) {
        const connections = await this.prisma.metaConnection.findMany({
            where: { companyId },
            select: {
                id: true,
                platform: true,
                pageId: true,
                igAccountId: true,
                appId: true,
                authorUrn: true,
                isActive: true,
                expiresAt: true,
                updatedAt: true,
                lastFetchAt: true,
            },
        });

        // Pre-fetch health stats
        const posts = await this.prisma.post.findMany({
            where: { companyId, isDeleted: false },
            select: { platform: true, publishedAt: true, source: true }
        });

        const platforms = ['facebook', 'instagram', 'twitter', 'linkedin'];
        return platforms.map((p) => {
            const conn = connections.find((c) => c.platform === p);
            
            // Calculate health stats
            const platformPosts = posts.filter(post => post.platform === p && post.source === 'platform');
            const totalPostsViaConnection = platformPosts.length;
            const lastPostArray = platformPosts.filter(post => post.publishedAt).sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());
            const lastSuccessfulPost = lastPostArray.length > 0 ? lastPostArray[0].publishedAt : null;
            const lastSync = conn?.lastFetchAt || null;

            return {
                platform: p,
                isConnected: conn ? true : false,
                isActive: conn?.isActive ?? false,
                pageId: conn?.pageId || '',
                igAccountId: conn?.igAccountId || '',
                appId: conn?.appId || '',
                authorUrn: conn?.authorUrn || '',
                expiresAt: conn?.expiresAt || null,
                lastUpdated: conn?.updatedAt || null,
                health: {
                    lastSuccessfulPost,
                    lastSync,
                    totalPosts: totalPostsViaConnection
                }
            };
        });
    }

    async fetchMetaPages(accessToken: string) {
        try {
            this.logger.log(`Fetching pages for token...`);

            // 1. Diagnostic: Check if token is valid at all
            let debugRes;
            try {
                debugRes = await axios.get(`${GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${accessToken}`);
            } catch (e) {
                this.logger.debug("debug_token not accessible with this token, skipping debug check.");
            }

            // 2. Try standard /me/accounts (User Token discovery)
            // Enhanced to also fetch linked Instagram Business Accounts
            let pages: any[] = [];
            try {
                const { data } = await axios.get(`${GRAPH_API_BASE}/me/accounts?fields=name,id,access_token,category,picture,instagram_business_account{id,name,profile_picture_url}&access_token=${accessToken}`, { timeout: 10000 });
                this.logger.debug(`[Diagnostic] /me/accounts returned ${data.data?.length || 0} pages.`);
                pages = data.data || [];
            } catch (e: any) {
                this.logger.debug(`[Diagnostic] /me/accounts failed (likely not a user token): ${e.message}`);
                // If it fails with #100, it's definitely not a user token
            }

            if (pages.length > 0) {
                return pages.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    accessToken: p.access_token,
                    category: p.category,
                    picture: p.picture?.data?.url,
                    instagramAccount: p.instagram_business_account ? {
                        id: p.instagram_business_account.id,
                        name: p.instagram_business_account.name,
                        picture: p.instagram_business_account.profile_picture_url
                    } : null,
                    isValid: true
                }));
            }

            // 3. Fallback: Is this a Page Access Token itself?
            // Page tokens for specific pages return the page info at /me
            try {
                // We check for 'category' or 'tasks' or 'link' which are Page fields
                const meRes = await axios.get(`${GRAPH_API_BASE}/me?fields=id,name,category,link,picture&access_token=${accessToken}`);
                const me = meRes.data;
                this.logger.debug(`[Diagnostic] Fallback /me returned: ${JSON.stringify(me)}`);

                // If it has a category or is clearly not a user, treat it as the Page itself
                if (me && (me.category || me.link?.includes('facebook.com/pages') || me.link?.includes('facebook.com/profile.php?id='))) {
                    this.logger.log(`Token identified as Page Access Token for "${me.name}" (${me.id})`);
                    return [{
                        id: me.id,
                        name: me.name,
                        accessToken: accessToken,
                        category: me.category || 'Business Page',
                        picture: me.picture?.data?.url,
                        instagramAccount: null,
                        isValid: true
                    }];
                }
            } catch (e: any) {
                this.logger.debug(`Fallback Page-Token check skipped: ${e.message}`);
            }

            // 4. Still nothing? Deep Diagnostic on Permissions
            const perms = await this.fetchPermissions(accessToken);
            const granted = perms.filter(p => p.status === 'granted').map(p => p.permission);
            const required = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
            const missing = required.filter(r => !granted.includes(r));

            const meNameRes = await axios.get(`${GRAPH_API_BASE}/me?fields=name&access_token=${accessToken}`).catch(() => ({ data: { name: 'Unknown' } }));
            const meName = meNameRes.data.name;

            if (missing.length > 0) {
                throw new BadRequestException(`Connected as "${meName}", but token is missing active permissions: ${missing.join(', ')}. Please re-generate the token in Graph Explorer and ensure all boxes are checked.`);
            }

            throw new BadRequestException(`Meta found zero Facebook Pages associated with "${meName}". Ensure you have created a Page and that this account has admin access to it. If you are using a Page Token, ensure it corresponds to a valid Page.`);
        } catch (error: any) {
            if (error instanceof BadRequestException) throw error;
            const msg = error.response?.data?.error?.message || error.message;
            this.logger.error(`Failed to fetch pages: ${msg}`);
            throw new BadRequestException(`Meta API Error: ${msg}`);
        }
    }

    async fetchInstagramAccounts(accessToken: string) {
        try {
            this.logger.log(`Fetching IG accounts for token...`);

            // Check if this is a Page Token first to avoid #100 error
            const debug = await this.getDebugInfo(accessToken);
            let accounts: any[] = [];

            if (debug.type === 'PAGE' || debug.isValid && debug.targetId && !debug.scopes.includes('public_profile')) {
                // Try treating /me as the page itself
                this.logger.log(`Token appears to be a Page Token (Target: ${debug.targetId}). Fetching linked IG account for this page...`);
                const { data } = await axios.get(`${GRAPH_API_BASE}/me?fields=id,name,instagram_business_account{id,name,profile_picture_url}&access_token=${accessToken}`);
                if (data.instagram_business_account) {
                    accounts.push({
                        id: data.instagram_business_account.id,
                        name: `IG: ${data.instagram_business_account.name || 'Linked Account'}`,
                        pageId: data.id,
                        picture: data.instagram_business_account.profile_picture_url,
                        isValid: true
                    });
                }
            } else {
                // Standard User Token flow
                const { data } = await axios.get(`${GRAPH_API_BASE}/me/accounts?fields=name,id,instagram_business_account{id,name,profile_picture_url}&access_token=${accessToken}`, { timeout: 10000 });
                accounts = (data.data || [])
                    .filter((p: any) => p.instagram_business_account)
                    .map((p: any) => ({
                        id: p.instagram_business_account.id,
                        name: `IG: ${p.instagram_business_account.name || 'Linked Account'}`,
                        pageId: p.id,
                        picture: p.instagram_business_account.profile_picture_url,
                        isValid: true
                    }));
            }

            if (accounts.length === 0) {
                const perms = await this.fetchPermissions(accessToken);
                const requiredIg = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'];
                const missingIg = requiredIg.filter(r => !perms.find((p: any) => p.permission === r && p.status === 'granted'));

                if (missingIg.length > 0) {
                    throw new BadRequestException(`Missing Instagram permissions: ${missingIg.join(', ')}. Ensure your token includes these scopes.`);
                }

                throw new BadRequestException('No linked Instagram Business accounts found. Ensure your IG account is professional and linked to a Facebook Page.');
            }

            return accounts;
        } catch (error: any) {
            if (error instanceof BadRequestException) throw error;
            const errorData = error.response?.data?.error;
            const msg = errorData?.message || error.message;
            const subcode = errorData?.error_subcode;

            if (subcode === 463 || subcode === 467 || msg.toLowerCase().includes('expired')) {
                throw new BadRequestException("TOKEN_EXPIRED: Your Meta session has expired. Please generate a new token.");
            }

            this.logger.error(`Failed to fetch Instagram accounts: ${msg}`);

            // Check for missing IG scopes if it was a general 400 or empty
            const perms = await this.fetchPermissions(accessToken);
            const granted = perms.map((p: any) => p.permission);
            const igRequired = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'];
            const missingIg = igRequired.filter(r => !granted.includes(r));

            if (missingIg.length > 0) {
                throw new BadRequestException(`Fetch Failed: Missing Instagram permissions: ${missingIg.join(', ')}. Ensure your token includes these scopes.`);
            }

            throw new BadRequestException(msg);
        }
    }

    async getConnectionForPlatform(companyId: string, platform: string) {
        const platformMap: Record<string, string> = {
            LinkedIn: 'linkedin',
            'Twitter / X': 'twitter',
            Twitter: 'twitter',
            Facebook: 'facebook',
            Instagram: 'instagram',
            linkedin: 'linkedin',
            twitter: 'twitter',
            facebook: 'facebook',
            instagram: 'instagram',
        };

        const normalizedPlatform = platformMap[platform] || platform.toLowerCase();

        const conn = await this.prisma.metaConnection.findFirst({
            where: { companyId, platform: normalizedPlatform },
        });

        if (conn) {
            try {
                // @ts-ignore
                conn.accessToken = decryptToken(conn.accessToken) || conn.accessToken;
                // @ts-ignore
                if (conn.refreshToken) conn.refreshToken = decryptToken(conn.refreshToken) || conn.refreshToken;
                // @ts-ignore
                if (conn.appSecret) conn.appSecret = decryptToken(conn.appSecret) || conn.appSecret;
                // @ts-ignore
                if (conn.apiKey) conn.apiKey = decryptToken(conn.apiKey) || conn.apiKey;
                // @ts-ignore
                if (conn.apiSecret) conn.apiSecret = decryptToken(conn.apiSecret) || conn.apiSecret;
                // @ts-ignore
                if (conn.accessTokenSecret) conn.accessTokenSecret = decryptToken(conn.accessTokenSecret) || conn.accessTokenSecret;
            } catch (e) {
                this.logger.error(`Failed to decrypt connection fields for ${platform}: ${e.message}`);
            }
        }

        return conn;
    }

    async getDebugInfo(accessToken: string): Promise<any> {
        try {
            const { data } = await axios.get(`${GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${accessToken}`);
            const d = data.data;
            return {
                isValid: d.is_valid,
                type: d.type,
                application: d.application,
                scopes: d.scopes || [],
                targetId: d.profile_id || d.user_id || d.page_id,
            };
        } catch (e) {
            try {
                const { data } = await axios.get(`${GRAPH_API_BASE}/me?fields=id,name,category&access_token=${accessToken}`);
                return {
                    isValid: true,
                    type: data.category ? 'PAGE' : 'USER',
                    targetId: data.id,
                    name: data.name,
                    scopes: ['(Unknown - Fallback used)']
                };
            } catch (inner) {
                return { error: 'Could not fetch debug info', message: e.message };
            }
        }
    }

    async testAndSaveConnection(companyId: string, platform: string, accessToken: string, pageId?: string, igAccountId?: string, appId?: string, appSecret?: string) {
        const normalizedPlatform = platform.toLowerCase();
        this.logger.log(`[UnifiedConnect] Testing and saving ${normalizedPlatform} for company ${companyId}`);

        try {
            let finalPageId = pageId;
            let finalIgId = igAccountId;
            let testToken = accessToken; // Token used for quick validation only

            // Step 1: Discover pages/accounts
            if (normalizedPlatform === 'facebook') {
                const pages = await this.fetchMetaPages(accessToken);
                const selected = pageId
                    ? pages.find(p => p.id === pageId)
                    : (pages.length === 1 ? pages[0] : null);
                if (selected) {
                    finalPageId = selected.id;
                    if (selected.accessToken) testToken = selected.accessToken;
                    if (selected.instagramAccount && !finalIgId) finalIgId = selected.instagramAccount.id;
                }
            }
            if (normalizedPlatform === 'instagram') {
                const accounts = await this.fetchInstagramAccounts(accessToken);
                const selected = igAccountId
                    ? accounts.find(a => a.id === igAccountId)
                    : (accounts.length === 1 ? accounts[0] : null);
                if (selected) {
                    finalIgId = selected.id;
                    if (selected.pageId) finalPageId = selected.pageId;
                }
            }

            // Step 2: Quick test with the best available token
            const testResult = await this.testConnection(companyId, platform, testToken, finalPageId, { igAccountId: finalIgId, appId });
            if (!testResult.success) return testResult;

            // Step 3: Save — ALWAYS pass the original User Token to connectPlatform
            // connectPlatform internally: checks permissions → exchanges for long-lived → derives page token → saves
            await this.connectPlatform(companyId, platform, {
                accessToken: accessToken,
                pageId: finalPageId,
                igAccountId: finalIgId,
                appId: appId,
                appSecret: appSecret,
                authorUrn: normalizedPlatform === 'linkedin' ? testResult.authorUrn : undefined,
            });

            return { success: true, message: `${platform} connected and saved.` };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async testConnection(companyId: string, platform: string, accessToken?: string, pageId?: string, config?: any) {
        try {
            const normalizedPlatform = platform.toLowerCase();
            if (!accessToken) throw new BadRequestException('Access token is required');

            if (normalizedPlatform === 'facebook') {
                if (!pageId) return { success: false, message: 'Page ID required' };
                const { data } = await axios.get(`${GRAPH_API_BASE}/${pageId}?fields=name&access_token=${accessToken}`);
                return { success: true, accountName: data.name };
            }
            if (normalizedPlatform === 'instagram') {
                const { data } = await axios.get(`${GRAPH_API_BASE}/me?fields=name&access_token=${accessToken}`);
                return { success: true, accountName: data.name };
            }
            if (normalizedPlatform === 'twitter') {
                const client = new TwitterApi({ appKey: config.apiKey, appSecret: config.apiSecret, accessToken, accessSecret: config.accessTokenSecret });
                const user = await client.v2.me();
                return { success: true, accountName: user.data.username };
            }
            if (normalizedPlatform === 'linkedin') {
                const linkedInIdentity = await this.resolveLinkedInIdentity(accessToken);
                const scopes = await this.ensureLinkedInPostingScope(accessToken);
                return {
                    success: true,
                    accountName: linkedInIdentity.accountName,
                    authorUrn: linkedInIdentity.authorUrn,
                    scopes,
                };
            }
            return { success: false, message: 'Platform not supported' };
        } catch (error: any) {
            return { success: false, message: this.extractErrorMessage(error) };
        }
    }
    async publishToFacebook(
        accessToken: string,
        pageId: string,
        content: string,
        mediaUrl?: string,
        mediaType?: string,
        linkPostUrl?: string,
    ): Promise<{ success: boolean; postId?: string; message?: string; rawError?: any }> {
        try {
            const finalMediaUrl = this.ensurePublicUrl(mediaUrl || linkPostUrl);
            const endpoint = `${GRAPH_API_BASE}/${pageId}`;
            
            if (linkPostUrl) {
                const { data } = await axios.post(`${endpoint}/feed`, { link: linkPostUrl, message: content, access_token: accessToken });
                return { success: true, postId: data.id };
            }

            const resolvedMediaType = (mediaType || '').toUpperCase();
            const isVideo = resolvedMediaType === 'VIDEO' || resolvedMediaType === 'REEL' || (finalMediaUrl && /\.(mp4|mov|avi|mkv|webm)$/i.test(finalMediaUrl));

            if (finalMediaUrl && isVideo) {
                const { data } = await axios.post(`${endpoint}/videos`, { file_url: finalMediaUrl, description: content, access_token: accessToken }, { timeout: 120000 });
                return { success: true, postId: data.id };
            } else if (finalMediaUrl) {
                const { data } = await axios.post(`${endpoint}/photos`, { url: finalMediaUrl, caption: content, access_token: accessToken }, { timeout: 45000 });
                return { success: true, postId: data.post_id || data.id };
            } else {
                const { data } = await axios.post(`${endpoint}/feed`, { message: content, access_token: accessToken });
                return { success: true, postId: data.id };
            }
        } catch (error: any) {
            return { success: false, message: error.response?.data?.error?.message || error.message, rawError: error.response?.data?.error };
        }
    }

    async publishToInstagram(
        accessToken: string,
        igAccountId: string,
        content: string,
        mediaUrl?: string,
        mediaType?: string,
    ): Promise<{ success: boolean; postId?: string; message?: string; rawError?: any }> {
        try {
            if (!mediaUrl) return { success: false, message: 'Instagram requires media.' };
            const finalMediaUrl = this.ensurePublicUrl(mediaUrl)!;

            const resolvedMediaType = (mediaType || '').toUpperCase();
            const isVideo = resolvedMediaType === 'VIDEO' || resolvedMediaType === 'REEL' || finalMediaUrl.match(/\.(mp4|mov|avi|mkv|webm)$/i);
            const isReel = resolvedMediaType === 'REEL';

            const payload: any = { caption: content, access_token: accessToken };
            if (isReel) {
                payload.media_type = 'REELS';
                payload.video_url = finalMediaUrl;
                payload.share_to_feed = true;
            } else if (isVideo) {
                payload.media_type = 'VIDEO';
                payload.video_url = finalMediaUrl;
            } else {
                payload.image_url = finalMediaUrl;
            }

            const { data: { id: containerId } } = await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media`, payload, { timeout: 60000 });
            await this.pollMediaContainer(accessToken, containerId, 'IG');
            const { data } = await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, { creation_id: containerId, access_token: accessToken }, { timeout: 30000 });
            return { success: true, postId: data.id };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.error?.message || error.message, rawError: error.response?.data?.error };
        }
    }

    private ensurePublicUrl(url: string | undefined): string | null {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const base = process.env.BASE_URL || process.env.APP_URL || process.env.BACKEND_URL || 'https://social-ronak.onrender.com';
        return `${base.replace(/\/+$/, '')}${url.startsWith('/') ? url : '/' + url}`;
    }

    async verifyMediaUrlReachable(url: string): Promise<boolean> {
        try { await axios.head(url, { timeout: 10000 }); return true; } catch {
            try { await axios.get(url, { timeout: 10000, headers: { Range: 'bytes=0-0' } }); return true; } catch { return false; }
        }
    }

private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, label: string = 'API', shouldRetry: (error: any) => boolean = () => true): Promise<T> {
        let lastErr: any;
        for (let i = 1; i <= maxRetries; i++) {
            try { 
                return await fn(); 
            } catch (e: any) {
                lastErr = e;
                if (!shouldRetry(e) || i === maxRetries) break;
                if (i < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
            }
        }
        throw lastErr;
    }

    private shouldRetryLinkedIn(error: any): boolean {
        const status = error?.response?.status;
        return status === 429 || status >= 500; // Rate limits and server errors
    }

    private extractLinkedInError(error: any): string {
        if (!error.response) return 'Network error - check connection';

        const status = error.response.status;
        const data = error.response.data;

        // Common LinkedIn errors
        if (status === 401) return 'Token expired/invalid - reconnect account';
        if (status === 403) {
            const dataBlob = JSON.stringify(data || {}).toLowerCase();
            if (
                dataBlob.includes('insufficient permissions') ||
                dataBlob.includes('scope') ||
                dataBlob.includes('w_member_social') ||
                dataBlob.includes('not enough permissions') ||
                dataBlob.includes('access denied')
            ) {
                return 'Missing LinkedIn posting permission (w_member_social) or token is not allowed for this author URN. Reconnect LinkedIn and approve posting scope.';
            }
            return `Permissions denied (403): ${data?.message || data?.error || 'Token cannot publish for selected LinkedIn author.'}`;
        }
        if (status === 400) {
            if (data.serviceErrorCode === 10010600) return 'Invalid author URN - reconnect LinkedIn account';
            if (data.message?.includes('urn')) return 'Invalid author/person URN format';
            return `Bad request: ${data.message || 'Check content length/media URL'}`;
        }
        if (status === 429) return 'Rate limited - too many posts, retry later';
        if (status >= 500) return `LinkedIn server error (${status}) - retry later`;

        return `HTTP ${status}: ${data.message || data.error || 'Unknown error'}`;
    }
    private getLinkedInHeaders(accessToken: string) {
        return {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
        };
    }

    private async getLinkedInScopes(accessToken: string): Promise<string[]> {
        const { data } = await axios.get(`${LINKEDIN_API_BASE}/userinfo`, {
            headers: this.getLinkedInHeaders(accessToken),
            timeout: 10000,
        });

        const rawScopes = data?.scope;
        if (!rawScopes) return [];
        if (Array.isArray(rawScopes)) {
            return rawScopes.map((s: any) => String(s).trim()).filter(Boolean);
        }

        return String(rawScopes)
            .split(' ')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    private async ensureLinkedInPostingScope(accessToken: string): Promise<string[]> {
        let scopes: string[] = [];
        try {
            scopes = await this.getLinkedInScopes(accessToken);
        } catch (error: any) {
            const message = this.extractErrorMessage(error, 'Unable to verify LinkedIn token scopes');
            // LinkedIn's OpenID userinfo endpoint often omits non-OpenID scopes (like w_member_social).
            // If we cannot read scopes at all, do not block the flow here; the publish call will still
            // fail with a clear error if posting permission is actually missing.
            this.logger.warn(`[LinkedIn] Scope check skipped: ${message}`);
            return [];
        }

        // LinkedIn sometimes returns scopes as lower/upper mixed case or leaves out posting scopes from /userinfo.
        // Accept either member or organization posting scopes.
        const normalizedScopes = scopes.map((s) => s.toLowerCase());
        const hasPostingScope = normalizedScopes.includes('w_member_social') || normalizedScopes.includes('w_organization_social');

        // If LinkedIn doesn't return scopes at all, don't hard-block; rely on the publish call to surface 403.
        if (normalizedScopes.length === 0) {
            this.logger.warn('[LinkedIn] No scopes returned from token; proceeding without strict validation.');
            return [];
        }

        if (!hasPostingScope) {
            this.logger.warn('[LinkedIn] w_member_social scope not reported by token; proceeding but publishing may fail with 403 if permission is actually missing.');
            return scopes;
        }

        return scopes;
    }

    async publishToTwitter(appKey: string, appSecret: string, accessToken: string, accessSecret: string, content: string, mediaUrl?: string): Promise<{ success: boolean; postId?: string; message?: string }> {
        try {
            const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
            const res = await client.v2.tweet({ text: mediaUrl ? `${content}\n\n${mediaUrl}` : content });
            return { success: true, postId: res.data.id };
        } catch (error: any) { return { success: false, message: error.message }; }
    }

    async publishTwitterImages(client: TwitterApi, content: string, urls: string[]) {
        const mediaIds = await Promise.all(urls.map(async u => {
            const res = await axios.get(this.ensurePublicUrl(u)!, { responseType: 'arraybuffer' });
            return await client.v1.uploadMedia(Buffer.from(res.data), { mimeType: 'image/jpeg' });
        }));
        const res = await client.v2.tweet({ text: content, media: { media_ids: mediaIds as any } });
        return { success: true, postId: res.data.id };
    }

    async publishTwitterVideo(client: TwitterApi, content: string, url: string) {
        const res = await axios.get(this.ensurePublicUrl(url)!, { responseType: 'arraybuffer' });
        const mediaId = await client.v1.uploadMedia(Buffer.from(res.data), { mimeType: 'video/mp4' }); // removed invalid target
        const res2 = await client.v2.tweet({ text: content, media: { media_ids: [mediaId] } });
        return { success: true, postId: res2.data.id };
    }

    async publishTwitterThread(client: TwitterApi, tweets: string[]) {
        let lastId: string | undefined;
        for (const t of tweets) {
            const res: any = await client.v2.tweet({ text: t, reply: lastId ? { in_reply_to_tweet_id: lastId } : undefined });
            lastId = res.data.id;
        }
        return { success: true, postId: lastId };
    }

async publishToLinkedIn(accessToken: string, authorUrn: string, content: string, mediaUrl?: string): Promise<{ success: boolean; postId?: string; message?: string; rawError?: any }> {
        this.logger.log(`[LinkedIn] Starting publish - Author: ${authorUrn}, Has media: ${!!mediaUrl}, Content length: ${content.length}`);

        // Step 1: Validate token first.
        // Use the same identity resolver used during connect flow so we support
        // both /me and /userinfo token types (some valid posting tokens do not expose /me).
        try {
            const identity = await this.resolveLinkedInIdentity(accessToken);
            const scopes = await this.ensureLinkedInPostingScope(accessToken);
            this.logger.log(`[LinkedIn OK] Token OK for: ${identity.accountName} (ID: ${identity.memberId})`);
            this.logger.log(`[LinkedIn OK] Scopes OK: ${scopes.slice(0, 3).join(', ')}${scopes.length > 3 ? '...' : ''}`);

            // If stored author URN is missing/empty, fallback to token-derived URN.
            if (!authorUrn && identity.authorUrn) {
                authorUrn = identity.authorUrn;
            }
        } catch (tokenErr: any) {
            const errMsg =
                tokenErr?.response
                    ? this.extractLinkedInError(tokenErr)
                    : (tokenErr?.message || 'LinkedIn token validation failed');
            this.logger.error(`[LinkedIn ERROR TOKEN] ${errMsg}`);
            return { success: false, message: `Invalid/expired token: ${errMsg}`, rawError: tokenErr.response?.data };
        }

        try {
            if (!authorUrn) {
                return { success: false, message: 'LinkedIn author URN required' };
            }

            this.logger.log(`[LinkedIn] POST /ugcPosts payload size: ${JSON.stringify({ author: authorUrn.substring(0, 20) + '...', text: content.substring(0, 50) + '...' }).length} chars`);

            const payload: any = {
                author: authorUrn,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: { text: content },
                        shareMediaCategory: mediaUrl ? 'ARTICLE' : 'NONE',
                    },
                },
                visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
            };
            if (mediaUrl) {
                payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{ status: 'READY', originalUrl: mediaUrl }];
            }

            const result = await this.withRetry(
                () => axios.post(`${LINKEDIN_API_BASE}/ugcPosts`, payload, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'X-Restli-Protocol-Version': '2.0.0',
                        'Content-Type': 'application/json',
                    },
                }),
                3,
                'LinkedIn UGC Post',
                this.shouldRetryLinkedIn,
            );
            const { data } = result;

            this.logger.log(`[LinkedIn OK] SUCCESS postId: ${data.id}`);
            return { success: true, postId: data.id };
        } catch (error: any) {
            const errMsg = this.extractLinkedInError(error);
            const status = error?.response?.status;
            const dataMsg = error?.response?.data?.message || '';

            // LinkedIn returns 422 for duplicate content. Treat as success to avoid endless retries.
            const duplicateUrnMatch = `${errMsg} ${dataMsg}`.match(/urn:li:share:[0-9]+/);
            if (status === 422 && (errMsg.toLowerCase().includes('duplicate') || dataMsg.toLowerCase().includes('duplicate'))) {
                const duplicateUrn = duplicateUrnMatch ? duplicateUrnMatch[0] : undefined;
                this.logger.warn(`[LinkedIn DUPLICATE] Content already posted. Using existing URN: ${duplicateUrn || 'unknown'}`);
                return { success: true, postId: duplicateUrn, message: 'LinkedIn reported duplicate content; treated as already published.' };
            }

            this.logger.error(`[LinkedIn ERROR POST] ${errMsg} | Status: ${status} | Code: ${error.response?.data?.status || 'N/A'}`);
            return { success: false, message: errMsg, rawError: error.response?.data };
        }
    }
async publishLinkedInMedia(accessToken: string, authorUrn: string, content: string, mediaUrl: string, type: 'IMAGE' | 'VIDEO' | 'DOCUMENT'): Promise<{ success: boolean; postId?: string; message?: string; rawError?: any }> {
                this.logger.log(`[LinkedIn Media] ${type} upload - Author: ${authorUrn}, URL: ${mediaUrl}`);

        try {
            const scopes = await this.ensureLinkedInPostingScope(accessToken);
            this.logger.log(`[LinkedIn Media OK] Scopes OK: ${scopes.slice(0, 3).join(', ')}${scopes.length > 3 ? '...' : ''}`);
        } catch (scopeErr: any) {
            const errMsg = scopeErr?.message || 'LinkedIn scope validation failed';
            this.logger.error(`[LinkedIn Media ERROR TOKEN] ${errMsg}`);
            return { success: false, message: errMsg, rawError: scopeErr?.response?.data };
        }

        if (!authorUrn) {
            return { success: false, message: 'LinkedIn author URN required' };
        }
        
        const publicUrl = this.ensurePublicUrl(mediaUrl);
        if (!publicUrl) {
            this.logger.warn(`[LinkedIn Media] Invalid public URL: ${mediaUrl}, fallback to simple post`);
            return this.publishToLinkedIn(accessToken, authorUrn, `${content}\n\nView image: ${mediaUrl}`);
        }
        
        // Verify reachable before upload
        const reachable = await this.verifyMediaUrlReachable(publicUrl);
        if (!reachable) {
            this.logger.warn(`[LinkedIn Media] URL unreachable: ${publicUrl}, fallback to simple post`);
            return this.publishToLinkedIn(accessToken, authorUrn, `${content}\n\nView media: ${publicUrl}`);
        }
        
        const recipes = { 
            IMAGE: 'urn:li:digitalmediaRecipe:feedshare-image', 
            VIDEO: 'urn:li:digitalmediaRecipe:feedshare-video', 
            DOCUMENT: 'urn:li:digitalmediaRecipe:feedshare-document' 
        };
        
        try {
            // Step 1: Register upload
            this.logger.log(`[LinkedIn Media] Register upload for ${type}`);
            const { data: reg } = await this.withRetry(
                () => axios.post(`${LINKEDIN_API_BASE}/assets?action=registerUpload`, { 
                    registerUploadRequest: { 
                        owner: authorUrn, 
                        recipes: [recipes[type]], 
                        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }] 
                    } 
                }, { 
                    headers: { Authorization: `Bearer ${accessToken}` } 
                }),
                2, 'Register Upload'
            );
            
            const uploadUrl = reg.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
            this.logger.log(`[LinkedIn Media] Upload URL ready: ${uploadUrl.substring(0, 50)}...`);
            
            // Step 2: Download and upload binary
            const fileRes = await axios.get(publicUrl, { responseType: 'arraybuffer', timeout: 30000 });
            this.logger.log(`[LinkedIn Media] Downloaded ${fileRes.headers['content-length']} bytes`);
            
            await axios.put(uploadUrl, Buffer.from(fileRes.data), { 
                headers: { 
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': fileRes.headers['content-length']
                },
                timeout: 60000
            });
            this.logger.log(`[LinkedIn Media] Upload complete`);
            
            // Step 3: Create UGC post with asset
            const payload = { 
                author: authorUrn, 
                lifecycleState: "PUBLISHED", 
                specificContent: { 
                    "com.linkedin.ugc.ShareContent": { 
                        shareCommentary: { text: content }, 
                        shareMediaCategory: type, 
                        media: [{ status: "READY", media: reg.value.asset, title: { text: "Social Post" } }] 
                    } 
                }, 
                visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } 
            };
            
            const result = await this.withRetry(
                () => axios.post(`${LINKEDIN_API_BASE}/ugcPosts`, payload, { 
                    headers: { 
                        Authorization: `Bearer ${accessToken}`, 
                        'X-Restli-Protocol-Version': '2.0.0',
                        'Content-Type': 'application/json'
                    } 
                }),
                3, 
                'LinkedIn Media Post',
                this.shouldRetryLinkedIn
            );
            const { data } = result;
            
            this.logger.log(`[LinkedIn Media ✓] SUCCESS postId: ${data.id}`);
            return { success: true, postId: data.id };
        } catch (error: any) {
            const errMsg = this.extractLinkedInError(error);
            const status = error?.response?.status;
            const dataMsg = error?.response?.data?.message || '';
            const duplicateUrnMatch = `${errMsg} ${dataMsg}`.match(/urn:li:share:[0-9]+/);

            if (status === 422 && (errMsg.toLowerCase().includes('duplicate') || dataMsg.toLowerCase().includes('duplicate'))) {
                const duplicateUrn = duplicateUrnMatch ? duplicateUrnMatch[0] : undefined;
                this.logger.warn(`[LinkedIn Media DUPLICATE] Content already posted. Using existing URN: ${duplicateUrn || 'unknown'}`);
                return { success: true, postId: duplicateUrn, message: 'LinkedIn reported duplicate content; treated as already published.' };
            }

            this.logger.error(`[LinkedIn Media ❌] ${errMsg} | Status: ${status}`);
            return { success: false, message: errMsg, rawError: error.response?.data };
        }
    }

    async publishPost(companyId: string, platform: string, content: string, mediaUrl?: string, mediaType?: string, postType?: string, mediaItems?: string[], linkUrl?: string): Promise<{ success: boolean; postId?: string; message?: string }> {
        const conn = await this.getConnectionForPlatform(companyId, platform);
        if (!conn || !conn.isActive) return { success: false, message: 'No connection' };
        const p = platform.toLowerCase();
        const type = (postType || '').toUpperCase();
        try {
            if (p === 'facebook') {
                if (type === 'ALBUM') return this.publishFacebookAlbum(conn.accessToken, conn.pageId!, content, mediaItems || []);
                if (type === 'FACEBOOK_REEL') return this.publishFacebookReel(conn.accessToken, conn.pageId!, content, mediaUrl!);
                return this.publishToFacebook(conn.accessToken, conn.pageId!, content, mediaUrl, mediaType, linkUrl);
            }
            if (p === 'instagram') {
                if (type === 'CAROUSEL') return this.publishInstagramCarousel(conn.accessToken, conn.igAccountId!, content, mediaItems || []);
                return this.publishToInstagram(conn.accessToken, conn.igAccountId!, content, mediaUrl!, mediaType);
            }
            if (p === 'twitter') {
                const client = new TwitterApi({ appKey: conn.apiKey!, appSecret: conn.apiSecret!, accessToken: conn.accessToken, accessSecret: conn.accessTokenSecret! });
                if (type === 'THREAD') return this.publishTwitterThread(client, mediaItems || [content]);
                if (type === 'TWEET_IMAGES') return this.publishTwitterImages(client, content, mediaItems || []);
                if (type === 'TWEET_VIDEO') return this.publishTwitterVideo(client, content, mediaUrl!);
                return this.publishToTwitter(conn.apiKey!, conn.apiSecret!, conn.accessToken, conn.accessTokenSecret!, content, mediaUrl);
            }
            if (p === 'linkedin') {
                const linkedInIdentity = conn.authorUrn
                    ? { authorUrn: conn.authorUrn }
                    : await this.resolveLinkedInIdentity(conn.accessToken);

                const authorUrn = conn.authorUrn || linkedInIdentity.authorUrn;
                if (!conn.authorUrn && authorUrn) {
                    await this.prisma.metaConnection.updateMany({
                        where: { companyId, platform: 'linkedin' },
                        data: { authorUrn },
                    });
                }

                const linkedInMediaKind = this.resolveLinkedInMediaKind(mediaUrl, mediaType, type);
                if (linkedInMediaKind) {
                    if (!mediaUrl) {
                        return { success: false, message: 'LinkedIn media posts require a mediaUrl.' };
                    }
                    return this.publishLinkedInMedia(conn.accessToken, authorUrn, content, mediaUrl, linkedInMediaKind);
                }

                return this.publishToLinkedIn(conn.accessToken, authorUrn, content, mediaUrl);
            }
            return { success: false, message: 'Platform not supported' };
        } catch (e: any) { return { success: false, message: this.extractErrorMessage(e) }; }
    }

    async findValidPageForToken(userAccessToken: string): Promise<{ pageId: string; accessToken: string; name: string } | null> {
        const pages = await this.fetchMetaPages(userAccessToken);
        if (pages.length === 1) return { pageId: pages[0].id, accessToken: pages[0].accessToken || userAccessToken, name: pages[0].name };
        return null;
    }

    async testExistingConnection(companyId: string, platform: string) {
        const creds = await this.getConnectionForPlatform(companyId, platform);
        if (!creds) throw new Error('No connection');
        const p = platform.toLowerCase();
        if (p === 'facebook') {
            await axios.get(`${GRAPH_API_BASE}/${creds.pageId}?access_token=${creds.accessToken}`);
            return { success: true };
        }
        if (p === 'instagram') {
            await axios.get(`${GRAPH_API_BASE}/${creds.igAccountId}?access_token=${creds.accessToken}`);
            return { success: true };
        }
        if (p === 'linkedin') {
            const linkedInIdentity = await this.resolveLinkedInIdentity(creds.accessToken);
            const scopes = await this.ensureLinkedInPostingScope(creds.accessToken);

            if (!creds.authorUrn || creds.authorUrn !== linkedInIdentity.authorUrn) {
                await this.prisma.metaConnection.updateMany({
                    where: { companyId, platform: 'linkedin' },
                    data: {
                        authorUrn: linkedInIdentity.authorUrn,
                        scopes: scopes.join(','),
                        isActive: true,
                    },
                });
            }
            return {
                success: true,
                accountName: linkedInIdentity.accountName,
                authorUrn: linkedInIdentity.authorUrn,
                scopes,
            };
        }
        return { success: false };
    }
    async fetchDirectPosts(connection: any, since?: Date) {
        const t = connection.accessToken;
        if (connection.platform === 'facebook' && connection.pageId) {
            const { data } = await axios.get(`${GRAPH_API_BASE}/${connection.pageId}/feed?fields=id,message,created_time,full_picture,permalink_url&access_token=${t}`);
            return (data.data || []).map((p: any) => ({ externalId: p.id, content: p.message || '', mediaUrl: p.full_picture || null, publishedAt: new Date(p.created_time), permalink: p.permalink_url }));
        }
        if (connection.platform === 'instagram' && connection.igAccountId) {
            const { data } = await axios.get(`${GRAPH_API_BASE}/${connection.igAccountId}/media?fields=id,caption,media_url,timestamp,permalink&access_token=${t}`);
            return (data.data || []).map((p: any) => ({ externalId: p.id, content: p.caption || '', mediaUrl: p.media_url || null, publishedAt: new Date(p.timestamp), permalink: p.permalink }));
        }
        return [];
    }

    async publishInstagramCarousel(a: string, ig: string, c: string, m: string[]) {
        const ids = await Promise.all(m.map(async u => {
            const { data } = await axios.post(`${GRAPH_API_BASE}/${ig}/media`, { image_url: this.ensurePublicUrl(u), is_carousel_item: true, access_token: a });
            return data.id;
        }));
        const { data: { id } } = await axios.post(`${GRAPH_API_BASE}/${ig}/media`, { media_type: 'CAROUSEL', caption: c, children: ids, access_token: a });
        await this.pollMediaContainer(a, id, 'IG Carousel');
        const { data } = await axios.post(`${GRAPH_API_BASE}/${ig}/media_publish`, { creation_id: id, access_token: a });
        return { success: true, postId: data.id };
    }

    async publishFacebookAlbum(
        accessToken: string,
        pageId: string,
        content: string,
        mediaUrls: string[]
    ): Promise<{ success: boolean; postId?: string; message?: string }> {
        try {
            // Step 1: Upload each image as unpublished photo
            const mediaIds: string[] = [];
            for (const url of mediaUrls) {
                const publicUrl = this.ensurePublicUrl(url);
                if (!publicUrl) continue;
                const { data } = await axios.post(
                    `${GRAPH_API_BASE}/${pageId}/photos`,
                    {
                        url: publicUrl,
                        published: false,
                        access_token: accessToken,
                    }
                );
                mediaIds.push(data.id);
            }

            if (mediaIds.length === 0) {
                return { success: false, message: 'No valid image URLs provided for album' };
            }

            // Step 2: Create the album post with all collected media IDs
            // attached_media MUST be in the JSON body as an array — NOT in query string
            const { data } = await axios.post(
                `${GRAPH_API_BASE}/${pageId}/feed`,
                {
                    message: content,
                    attached_media: mediaIds.map(id => ({ media_fbid: id })),
                    access_token: accessToken,
                }
            );
            return { success: true, postId: data.id };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.error?.message || error.message
            };
        }
    }

    async publishFacebookReel(
        accessToken: string,
        pageId: string,
        content: string,
        videoUrl: string
    ): Promise<{ success: boolean; postId?: string; message?: string }> {
        try {
            const publicUrl = this.ensurePublicUrl(videoUrl);
            if (!publicUrl) {
                return { success: false, message: 'Invalid or non-public video URL for Facebook Reel' };
            }

            // Step 1: Start the reel upload session
            const { data: startData } = await axios.post(
                `${GRAPH_API_BASE}/${pageId}/video_reels`,
                {
                    upload_phase: 'start',
                    access_token: accessToken,
                }
            );
            const videoId = startData.video_id;
            const uploadUrl = startData.upload_url;

            // Step 2: Download video and upload binary data via PUT to upload_url
            // This is the correct Facebook Reels upload method — not a POST with file_url
            const videoResponse = await axios.get(publicUrl, {
                responseType: 'arraybuffer',
                timeout: 120000
            });
            await axios.put(uploadUrl, Buffer.from(videoResponse.data), {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Authorization': `OAuth ${accessToken}`,
                },
                timeout: 120000,
            });

            // Step 3: Finish and publish the reel
            const { data: finishData } = await axios.post(
                `${GRAPH_API_BASE}/${pageId}/video_reels`,
                {
                    upload_phase: 'finish',
                    video_id: videoId,
                    video_state: 'PUBLISHED',
                    description: content,
                    access_token: accessToken,
                }
            );
            return { success: true, postId: finishData.id || videoId };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.error?.message || error.message
            };
        }
    }

    async fetchPostEngagement(connection: any, externalId: string): Promise<{ likes: number; comments: number }> {
        const t = connection.accessToken;
        try {
            if (connection.platform === 'facebook') {
                const { data } = await axios.get(`${GRAPH_API_BASE}/${externalId}?fields=reactions.summary(true),comments.summary(true)&access_token=${t}`);
                return {
                    likes: data.reactions?.summary?.total_count || 0,
                    comments: data.comments?.summary?.total_count || 0,
                };
            }
            if (connection.platform === 'instagram') {
                const { data } = await axios.get(`${GRAPH_API_BASE}/${externalId}?fields=like_count,comments_count&access_token=${t}`);
                return {
                    likes: data.like_count || 0,
                    comments: data.comments_count || 0,
                };
            }
        } catch (error: any) {
            this.logger.error(`Failed to fetch engagement for ${externalId}: ${error.response?.data?.error?.message || error.message}`);
        }
        return { likes: 0, comments: 0 };
    }

    private extractErrorMessage(error: any, fallback: string = 'Unknown error'): string {
        if (!error) return fallback;

        const apiMessage =
            error.response?.data?.error?.message ||
            error.response?.data?.message ||
            error.response?.data?.error_description ||
            error.response?.data?.error ||
            error.message;

        if (typeof apiMessage === 'string' && apiMessage.trim()) {
            return apiMessage;
        }

        if (error.response?.status) {
            return `${fallback} (HTTP ${error.response.status})`;
        }

        return fallback;
    }

    private resolveLinkedInMediaKind(mediaUrl?: string, mediaType?: string, postType?: string): 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null {
        const type = (postType || '').toUpperCase();
        const media = (mediaType || '').toUpperCase();
        const url = (mediaUrl || '').toLowerCase();

        if (['IMAGE_POST', 'SINGLE_IMAGE', 'IMAGE', 'PHOTO'].includes(type) || media === 'IMAGE' || /\.(png|jpe?g|gif|webp)$/i.test(url)) {
            return 'IMAGE';
        }
        if (['VIDEO_POST', 'VIDEO', 'REEL', 'SHORT_VIDEO'].includes(type) || media === 'VIDEO' || /\.(mp4|mov|avi|mkv|webm)$/i.test(url)) {
            return 'VIDEO';
        }
        if (['DOCUMENT_CAROUSEL', 'DOCUMENT', 'PDF'].includes(type) || media === 'DOCUMENT' || /\.(pdf|docx?|pptx?|xlsx?)$/i.test(url)) {
            return 'DOCUMENT';
        }
        return null;
    }

    private async resolveLinkedInIdentity(accessToken: string): Promise<{ accountName: string; authorUrn: string; memberId: string }> {
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
        };

        // Prefer OIDC userinfo (works with openid+profile) and falls back to /me (needs r_liteprofile)
        const tryUserinfo = async () => {
            const { data } = await axios.get(`${LINKEDIN_API_BASE}/userinfo`, { headers, timeout: 10000 });
            const memberId = data?.sub || data?.id;
            if (!memberId) {
                throw new BadRequestException('LinkedIn userinfo did not return a member id.');
            }

            const accountName = data?.name
                || [data?.given_name, data?.family_name].filter(Boolean).join(' ').trim()
                || 'LinkedIn member';

            return { accountName, authorUrn: `urn:li:person:${memberId}`, memberId };
        };

        const tryMe = async () => {
            const { data } = await axios.get(`${LINKEDIN_API_BASE}/me`, { headers, timeout: 10000 });
            const memberId = data?.id;
            if (!memberId) throw new BadRequestException('LinkedIn profile id was not returned by /me.');

            const accountName = [data?.localizedFirstName, data?.localizedLastName]
                .filter(Boolean)
                .join(' ')
                .trim() || 'LinkedIn member';

            return { accountName, authorUrn: `urn:li:person:${memberId}`, memberId };
        };

        try {
            return await tryUserinfo();
        } catch (userinfoError: any) {
            this.logger.warn(`[LinkedIn] userinfo fallback to /me: ${this.extractErrorMessage(userinfoError)}`);
            try {
                return await tryMe();
            } catch (meError: any) {
                const message = this.extractErrorMessage(
                    meError,
                    this.extractErrorMessage(userinfoError, 'LinkedIn validation failed'),
                );
                throw new BadRequestException(`LinkedIn validation failed: ${message}`);
            }
        }
    }

    private async pollMediaContainer(t: string, id: string, label: string) {
        for (let i = 0; i < 30; i++) {
            const { data } = await axios.get(`${GRAPH_API_BASE}/${id}?fields=status_code&access_token=${t}`);
            if (data.status_code === 'FINISHED') return;
            if (data.status_code === 'ERROR') throw new Error(`${label} error`);
            await new Promise(r => setTimeout(r, 5000));
        }
        throw new Error(`${label} timeout`);
    }

    private async getSystemMetaApp() { return { appId: process.env.META_APP_ID, appSecret: process.env.META_APP_SECRET }; }
    private async getPageAccessToken(t: string, id: string) {
        try {
            const { data } = await axios.get(`${GRAPH_API_BASE}/me/accounts?access_token=${t}`);
            const token = data?.data?.find((p: any) => p.id === id)?.access_token;
            if (token) return token;
        } catch (e) { /* Ignore error, might not be a User Token */ }
        
        try {
            const { data } = await axios.get(`${GRAPH_API_BASE}/me?fields=id&access_token=${t}`);
            if (data?.id === id) return t;
        } catch (e) { /* Ignore error */ }
        
        return null;
    }
    private async getInstagramBusinessAccountId(t: string, id: string) { const { data } = await axios.get(`${GRAPH_API_BASE}/${id}?fields=instagram_business_account&access_token=${t}`); return data?.instagram_business_account?.id || null; }

    private async fetchPermissions(accessToken: string): Promise<any[]> {
        const fetchOnce = async () => {
            const { data } = await axios.get(`${GRAPH_API_BASE}/me/permissions?access_token=${accessToken}`, { timeout: 10000 });
            return data.data || [];
        };

        try {
            // Retry up to 2 times for permissions (user requested retry on empty/fail)
            return await this.withRetry(fetchOnce, 2, 'Permissions Check');
        } catch (e: any) {
            this.logger.debug(`[Meta] Permission check failed even after retries: ${e.message}`);
            return [];
        }
    }
}














