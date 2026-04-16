/**
 * ============================================================================
 * INSTAGRAM VIDEO UPLOAD - BEFORE & AFTER COMPARISON
 * Meta Graph API v25.0 Async Flow Fix
 * ============================================================================
 */

// ============================================================================
// ISSUE #1: POLLING STATUS FIELD (CRITICAL)
// ============================================================================

// ❌ BEFORE: Wrong field name
const statusBefore = await axios.get(
  `${API_BASE}/${containerId}?fields=status&access_token=${token}`,
);
if (statusBefore.data.status === 'FINISHED') {
  // Might not work - Instagram uses status_code not status
}

// ✅ AFTER: Correct field
const statusAfter = await axios.get(
  `${API_BASE}/${containerId}?fields=status_code&access_token=${token}`,
);
if (statusAfter.data.status_code === 'FINISHED') {
  // Works reliably
}

// ============================================================================
// ISSUE #2: MISSING API RESPONSE LOGGING
// ============================================================================

// ❌ BEFORE: No response logging
async function pollMediaContainer_Before() {
  while (Date.now() - startTime < maxWaitMs) {
    const response = await axios.get(`...?fields=status`);
    const status = response.data.status;
    this.logger.debug(`Poll #${pollCount}: Status = ${status}`);
    if (status === 'FINISHED') return;
    await new Promise(r => setTimeout(r, interval * 1000));
  }
  // If fails: No idea what response looked like
}

// ✅ AFTER: Full response logging
async function pollMediaContainer_After() {
  while (Date.now() - startTime < maxWaitMs) {
    const response = await axios.get(`...?fields=status_code`);
    const statusCode = response.data.status_code;
    const statusMsg = response.data.status_code_description;

    if (statusCode !== lastStatus) {
      this.logger.log(`Poll #${pollCount}: status_code = ${statusCode}`);
      this.logger.debug(`Full response: ${JSON.stringify(response.data)}`);
      lastStatus = statusCode;
    }

    if (statusCode === 'FINISHED') return;
    if (statusCode === 'ERROR') {
      this.logger.error(`Media processing failed: ${statusMsg}`);
      throw error;
    }
  }
}

// ============================================================================
// ISSUE #3: FIXED POLLING INTERVALS (INEFFICIENT)
// ============================================================================

// ❌ BEFORE: Fixed 5-second intervals
const pollIntervalsBefore = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]; // All same
// Result: Too aggressive initially, too slow at end

// ✅ AFTER: Intelligent backoff
const pollIntervalsAfter = [2, 2, 3, 3, 5, 5, 5, 10, 10, 15, 15, 20, 20, 30];
// Start fast: 2 seconds (detect quick errors)
// Gradual slowdown: 3→5→10→15→20→30 (respect Instagram processing time)
// Better server load + faster failure detection

// ============================================================================
// ISSUE #4: NO HTTPS URL VALIDATION
// ============================================================================

// ❌ BEFORE: No URL validation
async function publishVideo_Before(videoUrl: string) {
  const payload = {
    video_url: videoUrl, // Could be HTTP, could be invalid
    caption: caption,
    access_token: token,
    media_type: 'REELS',
  };
  const response = await axios.post(`${API_BASE}/${accountId}/media`, payload);
}

// ✅ AFTER: Validate HTTPS first
async function publishVideo_After(videoUrl: string) {
  if (!videoUrl.startsWith('https://')) {
    throw new BadRequestException(`Video URL must be HTTPS. Got: ${videoUrl}`);
  }

  const payload = {
    video_url: videoUrl, // Guaranteed HTTPS
    caption: caption,
    access_token: token,
    media_type: 'REELS',
  };
  const response = await axios.post(`${API_BASE}/${accountId}/media`, payload);
}

// ============================================================================
// ISSUE #5: INCOMPLETE ERROR MESSAGES
// ============================================================================

// ❌ BEFORE: Generic error handling
if (errorCode === 100) {
  return {
    success: false,
    message: `Invalid media format. Ensure MP4 H.264 codec, proper aspect ratio, and < 100MB size.`,
    error: { code: errorCode, message: errorMsg },
  };
}

// ✅ AFTER: Video-specific details
if (errorCode === 100 || errorMsg.includes('Invalid parameter')) {
  let suggestion = `Invalid media format.`;
  if (context.includes('Video') || context.includes('Reel')) {
    suggestion +=
      ` Ensure: (1) MP4 format, (2) H.264 video codec, (3) AAC audio codec, ` +
      `(4) 9:16 or 1:1 aspect ratio, (5) < 100MB file size, (6) HTTPS URL, ` +
      `(7) Video duration <= 60s`;
  }
  return {
    success: false,
    message: suggestion,
    error: { code: errorCode, subcode: errorSubcode, message: errorMsg },
  };
}

// ============================================================================
// ISSUE #6: NO REQUEST PAYLOAD LOGGING
// ============================================================================

// ❌ BEFORE: Silent upload
const createResponse = await axios.post(
  `${this.apiBase}/${igBusinessAccountId}/media`,
  payload, // What exactly was sent? Unknown
  { timeout: 60000 },
);

// ✅ AFTER: Log request and response
this.logger.log(`[IG REELS] Step 1/3: Creating media container...`);
this.logger.debug(`[IG REELS] CREATE Request: POST /${igBusinessAccountId}/media`);
this.logger.debug(
  `[IG REELS] Payload: ${JSON.stringify({ ...payload, access_token: '[REDACTED]' })}`,
);

const createResponse = await axios.post(
  `${this.apiBase}/${igBusinessAccountId}/media`,
  payload,
  { timeout: 60000 },
);

const containerId = createResponse.data.id;
this.logger.log(`[IG REELS] ✓ Container created: ${containerId}`);
this.logger.debug(`[IG REELS] CREATE Response: ${JSON.stringify(createResponse.data)}`);

// ============================================================================
// COMPLETE FLOW COMPARISON
// ============================================================================

/*
BEFORE:
1. Create container (silent, no logging)
2. Poll status every 5s (fixed interval)
3. Query status field (wrong field name)
4. No response logging
5. If error: generic error message
6. If timeout: generic timeout message

AFTER:
1. Validate HTTPS URL
2. Create container (log request & response)
3. Poll status_code with intelligent backoff [2,2,3,3,5,5,5,10,10,15,15,20]
4. Log status changes and full response
5. If ERROR: Video-specific error guidance
6. If timeout: Clear instructions for resolution
7. Full request/response logging for debugging
8. 5-minute timeout (vs 2-3 minutes before)
*/

// ============================================================================
// DEBUGGING WITH FULL LOGS
// ============================================================================

/*
Example successful upload logs:

[IG REELS] 🎬 Starting Reel upload for account 123456789
[IG REELS] Video URL: https://example.com/video.mp4
[IG REELS] Step 1/3: Creating media container...
[IG REELS] CREATE Request: POST /123456789/media
[IG REELS] Payload: {"video_url":"https://example.com/video.mp4","media_type":"REELS",...}
[IG REELS] ✓ Container created: 9876543210
[IG REELS] CREATE Response: {"id":"9876543210"}
[IG REELS] Step 2/3: Polling container status until FINISHED...
[Polling] Starting poll loop (max wait: 300s)
[Polling] Poll #1 (2s elapsed): Checking GET /9876543210?fields=status_code
[Polling] Poll #1: status_code = IN_PROGRESS
[Polling] Poll #2 (4s elapsed): Checking GET /9876543210?fields=status_code
[Polling] Poll #3 (7s elapsed): Checking GET /9876543210?fields=status_code
[Polling] Poll #3: status_code = FINISHED
[Polling] ✅ REELS ready! Finished after 3 polls in 7s
[IG REELS] Step 3/3: Publishing media...
[IG REELS] PUBLISH Request: POST /123456789/media_publish
[IG REELS] ✅ Published successfully! Post ID: 987654321
*/

// ============================================================================
// VIDEO REQUIREMENTS CHECKLIST
// ============================================================================

/*
Instagram Reel/Video Upload Checklist:

✅ Format & Codec
  □ Container: MP4 (not MOV, AVI, MKV, WebM)
  □ Video Codec: H.264 (not H.265, VP9, etc)
  □ Audio Codec: AAC (not MP3, Vorbis, etc)

✅ Dimensions & Duration
  □ Aspect Ratio: 9:16 (reel) or 1:1 (square), or 4:5-1.91:1
  □ Resolution: Max 1080p (1080×1920 for vertical)
  □ Frame Rate: 23-30 fps (not 60fps)
  □ Duration: ≤ 60 seconds

✅ File Size & Bitrate
  □ File Size: < 100MB (Instagram hard limit)
  □ Video Bitrate: < 5 Mbps
  □ Audio Bitrate: 128-256 kbps

✅ Accessibility
  □ URL Protocol: HTTPS (not HTTP)
  □ Public Access: Accessible from Instagram servers (not localhost)
  □ URL Format: Valid UTF-8, no special characters

✅ Upload Flow
  □ Valid Instagram token with instagram_content_publish permission
  □ Business account properly connected
  □ Account not rate-limited
*/

// ============================================================================
// COMMON FIXES FOR FAILURES
// ============================================================================

/*
ERROR: "Invalid parameter" (Code 100)
→ Check video codec (must be H.264, not H.265 or VP9)
→ Use ffmpeg: ffmpeg -i input.mov -c:v libx264 -preset fast output.mp4

ERROR: "VIDEO_NOT_TRANSCODED"
→ Re-encode with specific settings:
   ffmpeg -i input.avi \
     -c:v libx264 \
     -preset medium \
     -crf 23 \
     -maxrate 5000k \
     -bufsize 1000k \
     -c:a aac \
     -b:a 192k \
     -s 1080x1920 \
     -r 30 \
     -t 60 \
     output.mp4

ERROR: "Unauthorized" (Code 401)
→ Instagram token expired, get new token from Meta app dashboard

ERROR: "Permission denied" (Code 403)
→ Add instagram_content_publish permission to your app
→ User hasn't authorized the app
→ Business account not properly connected

TIMEOUT: "Polling exceeded max wait time"
→ Try shorter video (< 30 seconds)
→ Ensure bitrate is low (< 3 Mbps)
→ Check file size (< 50MB ideal)
→ Wait a few minutes, Instagram API might be slow
*/

export {};
