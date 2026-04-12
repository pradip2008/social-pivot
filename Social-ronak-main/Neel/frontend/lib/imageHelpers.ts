export const intentMap: Record<string, string[]> = {
  hiring: ['hiring','job','recruit','vacancy','opening','career','apply','fresher','internship','position','talent','we are looking','join us','join our team'],
  marketing: ['sale','discount','offer','launch','campaign','promo','promotion','deal','announce','limited time','exclusive','new arrival','introducing'],
  corporate: ['company','team','office','business','corporate','enterprise','organization','professional','meeting','conference','workshop','event','milestone','achievement'],
  tech: ['ai','ml','software','developer','engineer','tech','digital','cloud','data','startup','saas','app','platform','product','innovation','automation'],
  social: ['community','update','news','announcement','celebrate','award','congratulations','thank you','appreciation','collaboration','partnership'],
};

export const detectBusinessIntent = (prompt: string): string => {
  const lower = prompt.toLowerCase();
  for (const [intent, keywords] of Object.entries(intentMap)) {
    if (keywords.some((kw) => lower.includes(kw))) return intent;
  }
  return 'general';
};

export const intentVisualMap: Record<string, string> = {
  hiring:    `professional corporate recruitment poster, diverse team of skilled professionals in a modern office environment, confident people shaking hands or working collaboratively, clean bright workspace, career growth visual metaphor, business attire, photorealistic, 4K, sharp focus, corporate color palette`,
  marketing: `bold eye-catching marketing banner, vibrant product showcase, dynamic composition, professional advertising aesthetic, clean brand-ready layout, modern graphic design, high contrast, commercial photography style, photorealistic, 4K`,
  corporate: `modern corporate office setting, professional business environment, sleek architecture, team collaboration, glass boardroom, business professionals, polished and premium aesthetic, photorealistic, sharp focus, 4K, professional lighting`,
  tech:      `futuristic technology workspace, glowing screens showing code and data visualizations, modern AI and machine learning aesthetic, clean tech lab environment, neural network visual metaphors, blue and cyan color palette, photorealistic, 4K, cinematic`,
  social:    `warm community celebration visual, group of diverse happy professionals, achievement and success theme, confetti or award elements, bright optimistic colors, social media ready composition, photorealistic, 4K, professional photography`,
  general:   `high quality professional business visual, clean modern aesthetic, brand-safe composition, photorealistic, 4K, sharp focus, professional lighting, commercial photography style`,
};

export const styleModifiers: Record<string, string> = {
  'Corporate':    'corporate photography, professional lighting, clean background, modern office, sharp focus',
  'Creative':     'creative composition, vibrant colors, artistic framing, dynamic layout, design-forward aesthetic',
  'Minimalist':   'minimalist composition, white space, clean lines, simple elegant layout, premium feel',
  'Bold':         'bold high-contrast design, dramatic lighting, strong visual impact, vivid saturated colors',
  'Cinematic':    'cinematic lighting, depth of field, widescreen composition, film-grade color grading',
  'Illustration': 'flat design illustration style, vector aesthetic, clean graphic art, professional iconography',
};

export const sizeMap: Record<string, { width: number; height: number }> = {
  '1:1':           { width: 1024, height: 1024 },
  '1:1 Square':    { width: 1024, height: 1024 },
  '4:5':           { width: 820,  height: 1024 },
  '4:5 Portrait':  { width: 820,  height: 1024 },
  '16:9':          { width: 1024, height: 576  },
  '16:9 Landscape':{ width: 1024, height: 576  },
  '9:16':          { width: 576,  height: 1024 },
  '9:16 Story':    { width: 576,  height: 1024 },
};

const MASTER_PREFIX = `Professional AI-generated image for IT company marketing. Modern, corporate, tech-forward, clean background, professional lighting, suitable for B2B IT marketing. No watermarks, no random artifacts, no unrelated visual elements. Photorealistic or high-quality digital illustration.`;

export const buildFinalPrompt = (rawPrompt: string, style: string): string => {
  const intent   = detectBusinessIntent(rawPrompt);
  const visual   = intentVisualMap[intent];
  const modifier = styleModifiers[style] ?? styleModifiers['Corporate'];
  return `${MASTER_PREFIX} ${rawPrompt}, ${visual}, ${modifier}`;
};

export const getPollinationsUrl = (prompt: string, width: number, height: number, seed: number): string => {
  const ts = Date.now();
  // Append .jpg to the encoded prompt so social APIs recognize it as a photo
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}.jpg?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true&enhance=true&cache=false&t=${ts}`;
};


export const downloadImage = async (imageUrl: string): Promise<void> => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `socialpivot-ai-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
  }
};
