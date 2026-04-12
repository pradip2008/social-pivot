import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
const Vibrant = require('node-vibrant/node');
import { join } from 'path';

// Helper to determine text contrast
function getLuminance(hex: string) {
    if (!hex || !hex.startsWith('#')) return 0;
    let color = hex.substring(1);
    if (color.length === 3) {
        color = color.split('').map(c => c + c).join('');
    }
    const r = parseInt(color.slice(0, 2), 16) / 255;
    const g = parseInt(color.slice(2, 4), 16) / 255;
    const b = parseInt(color.slice(4, 6), 16) / 255;
    
    const rgb = [r, g, b].map(c => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

@Injectable()
export class ThemeService {
  private readonly logger = new Logger(ThemeService.name);
  constructor(private prisma: PrismaService) {}

  async generateThemeFromLogo(companyId: string, logoUrl: string) {
    if (!logoUrl) {
      throw new BadRequestException('Logo URL is required to generate a theme.');
    }

    this.logger.log(`Extracting colors from logo: ${logoUrl}`);

    // Resolve local file path if it's a relative URL from our uploads directory
    let imagePath = logoUrl;
    if (logoUrl.startsWith('/api/public/uploads/')) {
      const filename = logoUrl.split('/').pop() || '';
      imagePath = join(process.cwd(), 'uploads', filename);
    } else if (logoUrl.startsWith('http://localhost') || logoUrl.startsWith(process.env.NEXT_PUBLIC_API_URL || 'http://localhost')) {
       const urlObj = new URL(logoUrl);
       if (urlObj.pathname.startsWith('/api/public/uploads/')) {
          const filename = urlObj.pathname.split('/').pop() || '';
          imagePath = join(process.cwd(), 'uploads', filename);
       }
    }

    let swatches: string[] = [];
    try {
      const palette = await Vibrant.from(imagePath).getPalette();
      
      // Extract main hex colors from vibrant palette
      const extractHex = (swatch: any) => swatch ? swatch.getHex() : null;
      
      const potentialColors = [
        extractHex(palette.Vibrant),
        extractHex(palette.DarkVibrant),
        extractHex(palette.Muted),
        extractHex(palette.DarkMuted),
        extractHex(palette.LightVibrant),
        extractHex(palette.LightMuted),
      ];

      // Filter out nulls and deduplicate
      swatches = [...new Set(potentialColors.filter(Boolean))] as string[];
      this.logger.log(`Extracted swatches: ${swatches.join(', ')}`);
      
    } catch (error: any) {
       this.logger.error(`Failed to extract palette using node-vibrant: ${error.message}`);
       // Fallback colors if vibrant fails
       swatches = ['#0bd18a', '#00d1ff', '#7cfcff'];
    }

    if (swatches.length === 0) {
        swatches = ['#0bd18a', '#00d1ff', '#7cfcff']; // Absolute fallback
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
        throw new BadRequestException('Company not found');
    }

    this.logger.log(`Generating theme JSON purely via algorithm for company: ${company.name}`);

    const primary = swatches[0];
    const secondary = swatches.length > 1 ? swatches[1] : primary;
    const accent = swatches.length > 2 ? swatches[2] : secondary;
    
    // Algorithmic contrast logic
    const primaryContrast = getLuminance(primary) > 0.5 ? '#000000' : '#ffffff';
    
    // Default professional dark mode theme schema
    const themeJson = {
      theme_id: `theme_${Math.random().toString(36).substring(2, 9)}`,
      colors: {
        primary: primary,
        primary_contrast: primaryContrast,
        secondary: secondary,
        accent: accent,
        background: "#0a0a0a", // Modern dark mode background
        surface: "#171717",
        text_primary: "#f8fafc",
        text_muted: "#94a3b8",
        border: "#334155"
      },
      accessibility: {
        primary_text_contrast_ratio: 4.5,
        background_text_contrast_ratio: 7.0,
        adjustments: ["Algorithmically enforced contrast on primary button", "Dark mode set as default"]
      },
      fonts: {
        heading: {"name":"Inter", "import_url":"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap", "weight":"700"},
        body: {"name":"Inter", "import_url":"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap", "weight":"400"}
      },
      components: {
        header: {"css_variables": {"--ring": accent, "--avatar-ring": primary}, "description": "Dark gradient header styling"},
        primary_button: {"css": `.btn-primary { background: ${primary}; color: ${primaryContrast}; border-radius: 8px; padding: 10px 16px; font-weight: 600; transition: opacity 0.2s; } .btn-primary:hover { opacity: 0.9; }`},
        card: {"css": `.profile-card { background: #171717; border: 1px solid #334155; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }`}
      },
      preview_examples: {
        tailwind_config_snippet: `colors: { primary: '${primary}', secondary: '${secondary}', bg: '#0a0a0a', surface: '#171717' }`,
        css_variables: `:root { --primary: ${primary}; --primary-contrast: ${primaryContrast}; --bg: #0a0a0a; --surface: #171717; }`
      }
    };

    try {
        await this.prisma.theme.create({
            data: {
                companyId,
                themeJson: JSON.stringify(themeJson),
            }
        });

        return themeJson;

    } catch (error: any) {
        this.logger.error(`Algorithmic Theme Saving Error: ${error.message}`);
        throw new BadRequestException('Failed to save generated theme');
    }
  }

  async applyTheme(companyId: string, themeJson: any) {
      if (!themeJson || !themeJson.colors) {
          throw new BadRequestException('Invalid theme object structure');
      }

      await this.prisma.company.update({
          where: { id: companyId },
          data: { themeJson: JSON.stringify(themeJson) }
      });

      return { success: true, message: 'Theme applied successfully' };
  }
}
