#!/usr/bin/env node

/**
 * ============================================================================
 * VIDEO ENCODING GUIDE FOR INSTAGRAM
 * Meta Graph API requires strict MP4/H.264/AAC format
 * ============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// FFMPEG COMMANDS FOR INSTAGRAM VIDEO UPLOAD
// ============================================================================

interface VideoEncodingOptions {
  inputPath: string;
  outputPath: string;
  maxDuration?: number; // seconds, default 60
  targetBitrate?: string; // kbps, default 3000k
  resolution?: string; // WxH, default 1080x1920
  fps?: number; // default 30
}

/**
 * Encode video to Instagram-compatible format
 * Output: MP4 with H.264 video + AAC audio
 *
 * Requirements met:
 * - Container: MP4
 * - Video Codec: H.264 (libx264)
 * - Audio Codec: AAC
 * - Bitrate: 3 Mbps max (configurable)
 * - Resolution: 1080p max
 * - FPS: 30 (configurable)
 * - Duration: 60s max (trim)
 * - File Size: < 100MB
 */
function encodeForInstagram(options: VideoEncodingOptions): void {
  const {
    inputPath,
    outputPath,
    maxDuration = 60,
    targetBitrate = '3000k',
    resolution = '1080x1920',
    fps = 30,
  } = options;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const command = [
    'ffmpeg',
    `-i "${inputPath}"`, // Input file
    '-t', maxDuration.toString(), // Trim to max duration
    '-c:v', 'libx264', // H.264 video codec
    '-preset', 'medium', // medium = balance speed/quality
    '-crf', '23', // Quality (0-51, lower=better, 23=default)
    '-s', resolution, // Scale to resolution
    '-maxrate', targetBitrate, // Max bitrate
    '-bufsize', `${Math.round(parseInt(targetBitrate) / 3)}k`, // Buffer size
    '-r', fps.toString(), // Frame rate
    '-c:a', 'aac', // AAC audio codec
    '-b:a', '192k', // Audio bitrate
    '-ac', '2', // 2 audio channels (stereo)
    '-ar', '48000', // Audio sample rate 48kHz
    `-y`, // Overwrite output
    `"${outputPath}"`,
  ].join(' ');

  console.log(`\nEncoding video for Instagram...`);
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Command: ${command}\n`);

  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`\n✅ Video encoded successfully!`);

    // Check output file size
    const stats = fs.statSync(outputPath);
    const sizeGB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Output file size: ${sizeGB}MB`);

    if (stats.size > 100 * 1024 * 1024) {
      console.error(`⚠️  File exceeds 100MB limit (Instagram max). Try lower bitrate.`);
    }
  } catch (error: any) {
    console.error(`❌ Encoding failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// EXAMPLE COMMANDS FOR DIFFERENT SOURCE FORMATS
// ============================================================================

/*
EXAMPLE 1: MOV to MP4 (iPhone video)
ffmpeg -i input.mov \
  -t 60 \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -s 1080x1920 \
  -maxrate 3000k \
  -bufsize 1000k \
  -r 30 \
  -c:a aac \
  -b:a 192k \
  -ac 2 \
  -ar 48000 \
  output.mp4

EXAMPLE 2: AVI to MP4 (old format)
ffmpeg -i input.avi \
  -t 60 \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -s 1080x1920 \
  -maxrate 3000k \
  -bufsize 1000k \
  -r 30 \
  -c:a aac \
  -b:a 192k \
  -ac 2 \
  -ar 48000 \
  output.mp4

EXAMPLE 3: WebM to MP4 (web format)
ffmpeg -i input.webm \
  -t 60 \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -s 1080x1920 \
  -maxrate 3000k \
  -bufsize 1000k \
  -r 30 \
  -c:a aac \
  -b:a 192k \
  -ac 2 \
  -ar 48000 \
  output.mp4

EXAMPLE 4: YouTube-downloaded video (often VP9/Opus)
ffmpeg -i input.webm \
  -t 60 \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -s 1080x1920 \
  -maxrate 3000k \
  -bufsize 1000k \
  -r 30 \
  -c:a aac \
  -b:a 192k \
  -ac 2 \
  -ar 48000 \
  output.mp4

EXAMPLE 5: Screen recording (usually slow/large)
ffmpeg -i input.mkv \
  -t 60 \
  -c:v libx264 \
  -preset fast \
  -crf 28 \
  -s 1080x1920 \
  -maxrate 2500k \
  -bufsize 800k \
  -r 24 \
  -c:a aac \
  -b:a 128k \
  -ac 2 \
  -ar 44100 \
  output.mp4
*/

// ============================================================================
// QUICK ENCODING FOR DIFFERENT SCENARIOS
// ============================================================================

/**
 * Quick encode with optimized settings for Instagram Reel (9:16 vertical)
 */
function encodeInstagramReel(inputPath: string, outputPath: string): void {
  encodeForInstagram({
    inputPath,
    outputPath,
    maxDuration: 60,
    targetBitrate: '3000k',
    resolution: '1080x1920', // 9:16 aspect ratio
    fps: 30,
  });
}

/**
 * Quick encode for Instagram Square Post (1:1)
 */
function encodeInstagramSquare(inputPath: string, outputPath: string): void {
  encodeForInstagram({
    inputPath,
    outputPath,
    maxDuration: 120, // Longer for regular posts
    targetBitrate: '4000k',
    resolution: '1080x1080', // 1:1 aspect ratio
    fps: 30,
  });
}

/**
 * Fast encode (lower quality but quicker)
 */
function encodeInstagramFast(inputPath: string, outputPath: string): void {
  encodeForInstagram({
    inputPath,
    outputPath,
    maxDuration: 60,
    targetBitrate: '2000k', // Lower bitrate = faster encoding
    resolution: '720x1280', // Lower resolution
    fps: 24, // Lower fps
  });
}

/**
 * High quality encode (larger file but better quality)
 */
function encodeInstagramHQ(inputPath: string, outputPath: string): void {
  encodeForInstagram({
    inputPath,
    outputPath,
    maxDuration: 60,
    targetBitrate: '5000k', // Higher bitrate
    resolution: '1080x1920',
    fps: 30,
  });
}

// ============================================================================
// BATCH ENCODING HELPER
// ============================================================================

interface BatchEncodeOptions {
  inputDir: string;
  outputDir: string;
  pattern?: string; // File pattern to match, e.g., "*.mov"
  quality?: 'fast' | 'standard' | 'hq';
}

/**
 * Encode all videos in a directory at once
 */
function batchEncodeForInstagram(options: BatchEncodeOptions): void {
  const { inputDir, outputDir, pattern = '*.mov', quality = 'standard' } = options;

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory not found: ${inputDir}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Find files matching pattern
  const files = fs.readdirSync(inputDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ['.mov', '.avi', '.mkv', '.webm', '.mp4'].includes(ext);
  });

  if (files.length === 0) {
    console.log(`No video files found in ${inputDir}`);
    return;
  }

  console.log(`Found ${files.length} video files to encode`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputPath = path.join(inputDir, file);
    const outputName = `${path.parse(file).name}.mp4`;
    const outputPath = path.join(outputDir, outputName);

    console.log(`\n[${i + 1}/${files.length}] Encoding: ${file}`);

    try {
      if (quality === 'fast') {
        encodeInstagramFast(inputPath, outputPath);
      } else if (quality === 'hq') {
        encodeInstagramHQ(inputPath, outputPath);
      } else {
        encodeInstagramReel(inputPath, outputPath);
      }
    } catch (error: any) {
      console.error(`⚠️  Failed to encode ${file}: ${error.message}`);
      continue;
    }
  }

  console.log(`\n✅ Batch encoding complete!`);
}

// ============================================================================
// DETECTION & AUTO-ENCODE HELPER
// ============================================================================

/**
 * Detect video format and suggest encoding if needed
 */
function detectAndSuggestEncoding(filePath: string): {
  isCompatible: boolean;
  suggestion: string;
  command?: string;
} {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.mp4') {
    // Need to check actual codec, but assume compatible
    return {
      isCompatible: true,
      suggestion: 'Already MP4 format. Verify codec is H.264/AAC before uploading.',
    };
  }

  const outputPath = `${path.parse(filePath).name}_instagram.mp4`;

  const suggestions: Record<string, string> = {
    '.mov': `iPhone/Mac format. Encode with: encodeInstagramReel("${filePath}", "${outputPath}")`,
    '.avi': `Old video format. Encode with: encodeInstagramReel("${filePath}", "${outputPath}")`,
    '.mkv': `Matroska format. Encode with: encodeInstagramReel("${filePath}", "${outputPath}")`,
    '.webm': `Web format (VP9/Opus). Encode with: encodeInstagramReel("${filePath}", "${outputPath}")`,
    '.flv': `Flash format. Encode with: encodeInstagramReel("${filePath}", "${outputPath}")`,
    '.wmv': `Windows Media. Encode with: encodeInstagramReel("${filePath}", "${outputPath}")`,
    '.m4v': `iTunes video. Encode with: encodeInstagramReel("${filePath}", "${outputPath}")`,
  };

  return {
    isCompatible: false,
    suggestion:
      suggestions[ext] ||
      `Unsupported format: ${ext}. Please convert to MP4 with H.264/AAC codec.`,
  };
}

// ============================================================================
// VERIFICATION AFTER ENCODING
// ============================================================================

/**
 * Verify encoded video meets Instagram requirements
 */
function verifyEncodedVideo(filePath: string): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!fs.existsSync(filePath)) {
    issues.push('File does not exist');
    return { valid: false, issues, warnings };
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp4') {
    issues.push(`File extension is ${ext}, should be .mp4`);
  }

  // Check file size
  const sizeBytes = fs.statSync(filePath).size;
  const sizeMB = sizeBytes / (1024 * 1024);

  if (sizeMB > 100) {
    issues.push(`File size ${sizeMB.toFixed(1)}MB exceeds 100MB limit`);
  } else if (sizeMB > 80) {
    warnings.push(`File size ${sizeMB.toFixed(1)}MB is approaching 100MB limit`);
  }

  // Note: Full codec verification requires ffprobe
  // For now just check file size and extension
  if (issues.length === 0) {
    warnings.push(
      'Use ffprobe to verify H.264 video and AAC audio codecs: ' +
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1:nokey=1 "${filePath}"`,
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Single video encoding
encodeInstagramReel('input.mov', 'output.mp4');

// Different quality presets
encodeInstagramFast('input.mov', 'output_fast.mp4'); // Quick encoding
encodeInstagramHQ('input.mov', 'output_hq.mp4'); // High quality

// Batch processing
batchEncodeForInstagram({
  inputDir: './videos',
  outputDir: './videos_instagram',
  quality: 'standard'
});

// Detect format
const result = detectAndSuggestEncoding('input.avi');
console.log(result.suggestion);

// Verify after encoding
const verification = verifyEncodedVideo('output.mp4');
if (verification.valid) {
  console.log('✅ Video is ready for Instagram upload!');
} else {
  console.log('❌ Issues found:', verification.issues);
}
*/

// ============================================================================
// INSTALLATION REQUIREMENTS
// ============================================================================

/*
BEFORE using these functions, install FFmpeg:

Windows:
  choco install ffmpeg
  OR download from https://ffmpeg.org/download.html

macOS:
  brew install ffmpeg

Linux (Ubuntu/Debian):
  sudo apt-get install ffmpeg

Linux (Fedora/RHEL):
  sudo dnf install ffmpeg

Verify installation:
  ffmpeg -version
  ffprobe -version
*/

export {
  encodeForInstagram,
  encodeInstagramReel,
  encodeInstagramSquare,
  encodeInstagramFast,
  encodeInstagramHQ,
  batchEncodeForInstagram,
  detectAndSuggestEncoding,
  verifyEncodedVideo,
};
