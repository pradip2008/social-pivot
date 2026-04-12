import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private logger = new Logger(AiService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private async getOpenAIClient(companyId?: string): Promise<OpenAI> {
    let apiKey = this.config.get('OPENAI_API_KEY');
    if (companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: companyId }});
      if (company?.openaiApiKey) apiKey = company.openaiApiKey;
    }
    return new OpenAI({
      apiKey,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      fetch: fetch,
    });
  }

  async generatePost(userId: string, companyId: string, data: any) {
    const { topic, platform, tone, audience, cta, length } = data;

    const prompt = `
You are a professional social media content strategist.

Create a high-engagement ${platform} post.

Topic: ${topic}
Tone: ${tone}
Audience: ${audience}
CTA: ${cta}
Length: ${length}

Make it optimized for engagement and platform algorithm. Return only the post content, no explanations.
    `.trim();

    try {
      const openai = await this.getOpenAIClient(companyId);
      const completion = await openai.chat.completions.create({
        model: this.config.get('OPENAI_MODEL') || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      });

      const content = completion.choices[0].message.content?.trim() || '';
      if (!content) throw new Error('AI returned empty response');
      const tokens = completion.usage?.total_tokens || 0;

      return await this.saveGeneratedPost(
        companyId,
        userId,
        platform,
        content,
        tokens,
        prompt,
        topic,
        tone,
        audience,
        cta,
      );
    } catch (error) {
      this.logger.warn(
        'AI Generation failed, using fallback mock mode',
        error.message,
      );
      // Fallback to mock mode
      const mockContent = `🚀 Exciting news for our ${audience || 'community'}!\n\nWe are exploring ${topic}. Keep an eye out for updates.\n\n👇 ${cta || 'Let us know your thoughts below!'}`;
      return await this.saveGeneratedPost(
        companyId,
        userId,
        platform,
        mockContent,
        50,
        prompt,
        topic,
        tone,
        audience,
        cta,
      );
    }
  }

  private async saveGeneratedPost(
    companyId: string,
    userId: string,
    platform: string,
    content: string,
    tokens: number,
    prompt: string,
    topic: string,
    tone: string,
    audience: string,
    cta: string,
  ) {
    // Log the generation
    await this.prisma.aiGenerationLog.create({
      data: {
        companyId,
        userId,
        prompt,
        response: content,
        platform,
        tokens,
      },
    });

    // Save as draft automatically
    const draft = await this.prisma.draftPost.create({
      data: {
        companyId,
        userId,
        platform,
        content,
        topic,
        tone,
        audience,
        cta,
      },
    });

    return { content, draftId: draft.id };
  }

    async generateImage(
    userId: string,
    companyId: string,
    topic: string,
    style: string = 'Corporate',
    size: string = '1:1',
  ) {
    // Security: sanitize topic to prevent prompt injection
    topic = topic.replace(/[<>"'`;]/g, '').substring(0, 500).trim();

    // Size map — pixel dimensions for each aspect ratio
    const sizeMap: Record<string, { width: number; height: number }> = {
      '1:1':  { width: 1024, height: 1024 },
      '4:5':  { width: 820,  height: 1024 },
      '16:9': { width: 1280, height: 720  },
      '9:16': { width: 720,  height: 1280 },
    };
    const { width, height } = sizeMap[size] ?? sizeMap['1:1'];

    // Style modifiers — describe visual aesthetic for each style option
    const styleModifiers: Record<string, string> = {
      'Corporate':             'professional corporate design, clean layout, business aesthetic, professional lighting',
      'Modern startup':        'modern startup branding, vibrant colors, tech aesthetic',
      'Minimalist':            'ultra minimal design, clean white space, sleek digital elements',
      'Illustration':          'professional digital illustration, clean characters, modern art style',
      '3D render':             'high quality 3D render, octane render style, professional lighting',
      'Flat design':           'modern flat design illustration, vector art, clean shapes',
      'Creative':              'creative composition, vibrant colors, artistic framing, dynamic layout',
      'Bold':                  'bold high-contrast design, dramatic lighting, strong visual impact',
      'Cinematic':             'cinematic lighting, depth of field, widescreen composition, film-grade color grading',
      'Professional marketing':'high-impact marketing banner, call to action layout, engaging visuals',
    };
    const styleMod = styleModifiers[style] ?? styleModifiers['Corporate'];

    // Master prefix — injected into every single prompt
    // This is what makes every image look like IT company marketing material
    const masterPrompt = `Professional AI-generated marketing image for an IT technology company. 
    The image must look like it was created by a professional B2B marketing designer. 
    Corporate, tech-forward, modern aesthetic. Clean background. Professional studio lighting. 
    No watermarks. No random artifacts. No unrelated objects. No nature, landscapes, or outdoor 
    scenes unless explicitly requested. Photorealistic or high-quality digital illustration only.`;

    // Step 1 — Enhance the raw topic using OpenAI into a rich visual description
    // If OpenAI fails (no key, quota exceeded, network error), we fall back to raw topic
    let enhancedPrompt = topic;
    try {
      const isHiring = /hiring|job|vacancy|join our team|we.?re hiring|job opening/i.test(topic);
      const hiringContext = isHiring
        ? 'This is a hiring post for an IT company. The image should show a professional team environment, modern tech office, confident professionals, and career growth themes.'
        : 'This is a professional IT company marketing post. The image should reflect the topic with corporate, tech-forward visual elements.';

      const openai = await this.getOpenAIClient(companyId);
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional visual prompt engineer for B2B IT company marketing. 
            Your job is to convert a simple topic into a rich, detailed, single-paragraph visual 
            description for AI image generation. The description must always result in a 
            professional, corporate, tech-themed image. Never describe nature, landscapes, 
            abstract art, or anything unrelated to IT and business. Follow the user topic exactly. 
            Do not add anything the user did not ask for.`,
          },
          {
            role: 'user',
            content: `Topic: ${topic}\nContext: ${hiringContext}\n\nWrite one paragraph describing the exact visual scene for this image. Be specific about people, environment, objects, lighting, and composition.`,
          },
        ],
        max_tokens: 200,
      });
      enhancedPrompt = completion.choices[0].message.content?.trim() ?? topic;
    } catch (e: any) {
      // OpenAI failed — this is fine, we continue with the raw topic
      this.logger.warn(`Prompt enhancement skipped: ${e.message}`);
    }

    // Final prompt — combines master context + enhanced description + style
    const fullPrompt = `${masterPrompt} Subject: ${enhancedPrompt}. Visual style: ${styleMod}. 
    Optimized for ${size} aspect ratio. 4K quality. Sharp focus. Commercial photography or 
    high-end digital illustration grade. This image is for a professional IT company marketing post.`;

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // Step 2 — Fetch image from Pollinations.ai WITH proper retry logic
    // Pollinations is a free API that takes 60-120 seconds to respond.
    // We give it 3 attempts with 2 minutes each before giving up.
    // We DO NOT fall back to random photos — if generation fails, that slot is skipped.
    const fetchPollinationsWithRetry = async (
      url: string,
      variantIndex: number,
    ): Promise<Buffer | null> => {
      const MAX_ATTEMPTS = 3;
      const TIMEOUT_MS = 120000; // 2 minutes per attempt

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          this.logger.log(`[Variant ${variantIndex}] Attempt ${attempt}/${MAX_ATTEMPTS} — Pollinations request sent`);
          const res = await fetch(url, { signal: controller.signal as any });
          clearTimeout(timer);

          if (!res.ok) {
            throw new Error(`Pollinations returned HTTP ${res.status}`);
          }

          const buffer = Buffer.from(await res.arrayBuffer());

          // Validate that what came back is actually an image, not an error HTML page
          // A real PNG/JPEG image will always be larger than 10KB
          if (buffer.length < 10000) {
            throw new Error(`Response is only ${buffer.length} bytes — likely an error page, not an image`);
          }

          this.logger.log(`[Variant ${variantIndex}] Attempt ${attempt} SUCCESS — ${buffer.length} bytes received`);
          return buffer;

        } catch (err: any) {
          clearTimeout(timer);
          this.logger.warn(`[Variant ${variantIndex}] Attempt ${attempt} failed: ${err.message}`);

          if (attempt < MAX_ATTEMPTS) {
            // Wait 5 seconds before retrying — gives Pollinations server time to recover
            this.logger.log(`[Variant ${variantIndex}] Waiting 5s before retry...`);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }

      // All 3 attempts failed — return null, do NOT fall back to random photos
      this.logger.error(`[Variant ${variantIndex}] All ${MAX_ATTEMPTS} attempts failed. Slot will be empty.`);
      return null;
    };

    // Step 3 — Generate all 4 variants in PARALLEL so total wait time = 1 image wait, not 4x
    const variantPromises = [1, 2, 3, 4].map(async (i) => {
      const seed = Math.floor(Math.random() * 9999999); // unique seed = unique variation
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt.trim())}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true&enhance=true`;

      const buffer = await fetchPollinationsWithRetry(pollinationsUrl, i);

      // If generation failed, skip this variant entirely
      if (!buffer) return null;

      // Save the image to disk and return its public URL
      const filename = `ai-${crypto.randomUUID()}.png`;
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      return { url: `/api/public/uploads/${filename}`, prompt: fullPrompt };
    });

    // Wait for all 4 variants to finish (or fail)
    const settled = await Promise.allSettled(variantPromises);
    const results = settled
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    // If absolutely nothing came back, throw a clear error
    // so the frontend can show a proper "generation failed, please retry" message
    if (results.length === 0) {
      throw new InternalServerErrorException(
        'Image generation failed. Pollinations.ai did not respond. Please wait 30 seconds and try again.'
      );
    }

    return results;
  }


    async verifyOpenAIKey(companyId: string, providedKey?: string) {
        let apiKey = providedKey;
        if (!apiKey) {
            const company = await this.prisma.company.findUnique({ where: { id: companyId }});
            apiKey = company?.openaiApiKey || this.config.get('OPENAI_API_KEY');
        }

        if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') {
            return { success: false, message: 'No API Key configured' };
        }

        try {
            const openai = new OpenAI({ apiKey, fetch: fetch });
            await openai.models.list();
            return { success: true, message: 'Valid API Key' };
        } catch (e: any) {
            return { success: false, message: e.message || 'Invalid API Key' };
        }
    }
}
