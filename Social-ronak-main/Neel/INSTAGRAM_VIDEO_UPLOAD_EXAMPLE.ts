/**
 * Instagram Video Upload - Complete Working Example
 * Uses Meta Graph API with proper async flow, polling, and error handling
 *
 * Requirements:
 * - Video must be MP4 format with H.264 codec and AAC audio
 * - Video must be publicly accessible via HTTPS URL
 * - Max file size: 100MB
 * - Max duration: 60 seconds
 * - Recommended aspect ratio: 9:16 (vertical/reel) or 1:1 (square)
 */

import axios from 'axios';

// ============================================================================
// CONFIGURATION
// ============================================================================

const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || 'YOUR_IG_ACCOUNT_ID';
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN';
const API_VERSION = 'v25.0';
const API_BASE = `https://graph.instagram.com/${API_VERSION}`;

// ============================================================================
// EXAMPLE 1: PUBLISH VIDEO REEL (Recommended)
// ============================================================================

async function example_publishReel() {
  console.log('📲 Example 1: Publishing Video Reel to Instagram');

  // Your public HTTPS video URL (must be accessible from Instagram servers)
  const videoUrl = 'https://your-domain.com/videos/sample-reel.mp4';
  const caption = 'Check out this awesome reel! 🎬 #instagram #video';

  try {
    const result = await publishVideoToInstagram(
      INSTAGRAM_BUSINESS_ACCOUNT_ID,
      videoUrl,
      caption,
      true, // isReel = true
      INSTAGRAM_ACCESS_TOKEN,
    );

    if (result.success) {
      console.log(`✅ Reel published successfully!`);
      console.log(`   Post ID: ${result.postId}`);
      console.log(`   Container ID: ${result.containerId}`);
    } else {
      console.log(`❌ Failed to publish reel: ${result.message}`);
      console.log(`   Error: ${JSON.stringify(result.error)}`);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// ============================================================================
// EXAMPLE 2: PUBLISH REGULAR VIDEO POST
// ============================================================================

async function example_publishVideoPost() {
  console.log('📹 Example 2: Publishing Regular Video Post to Instagram');

  const videoUrl = 'https://your-domain.com/videos/sample-video.mp4';
  const caption = 'Beautiful video moment 📸';

  try {
    const result = await publishVideoToInstagram(
      INSTAGRAM_BUSINESS_ACCOUNT_ID,
      videoUrl,
      caption,
      false, // isReel = false (regular post)
      INSTAGRAM_ACCESS_TOKEN,
    );

    if (result.success) {
      console.log(`✅ Video posted successfully!`);
      console.log(`   Post ID: ${result.postId}`);
    } else {
      console.log(`❌ Failed: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ============================================================================
// EXAMPLE 3: FULL FLOW WITH RETRY LOGIC
// ============================================================================

async function example_withRetries() {
  console.log('🔄 Example 3: Publish with Automatic Retry Logic');

  const videoUrl = 'https://your-domain.com/videos/sample.mp4';
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\nAttempt ${attempt}/${maxRetries}...`);

      const result = await publishVideoToInstagram(
        INSTAGRAM_BUSINESS_ACCOUNT_ID,
        videoUrl,
        'Amazing video!',
        true,
        INSTAGRAM_ACCESS_TOKEN,
      );

      if (result.success) {
        console.log(`✅ Success on attempt ${attempt}!`);
        return result;
      }

      lastError = result;
      console.log(`⚠️  Failure: ${result.message}`);

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Waiting ${Math.round(delayMs / 1000)}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Error on attempt ${attempt}: ${error.message}`);

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Waiting ${Math.round(delayMs / 1000)}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.log(`\n❌ Failed after ${maxRetries} attempts`);
  console.log(`Last error: ${lastError?.message || JSON.stringify(lastError)}`);
}

// ============================================================================
// CORE FUNCTION: PUBLISH VIDEO WITH PROPER ASYNC FLOW
// ============================================================================

interface PublishResult {
  success: boolean;
  postId?: string;
  containerId?: string;
  message?: string;
  error?: any;
}

async function publishVideoToInstagram(
  accountId: string,
  videoUrl: string,
  caption: string,
  isReel: boolean,
  accessToken: string,
): Promise<PublishResult> {
  const mediaType = isReel ? 'REELS' : 'VIDEO';

  try {
    // ===== STEP 1: Validate HTTPS URL =====
    console.log(`\n[Step 1] Validating video URL...`);
    if (!videoUrl.startsWith('https://')) {
      throw new Error(`Video URL must be HTTPS. Got: ${videoUrl}`);
    }
    console.log(`✓ Valid HTTPS URL`);

    // ===== STEP 2: CREATE MEDIA CONTAINER =====
    console.log(`[Step 2] Creating media container...`);

    const createPayload = {
      video_url: videoUrl,
      caption: caption || '',
      access_token: accessToken,
      media_type: mediaType, // REELS or VIDEO
      ...(isReel && { share_to_feed: true }), // Auto-share reels to feed
    };

    console.log(`  POST /${accountId}/media`);
    console.log(`  Payload: media_type=${mediaType}, caption_length=${caption.length}`);

    const createResponse = await axios.post(
      `${API_BASE}/${accountId}/media`,
      createPayload,
      { timeout: 60000 },
    );

    const containerId = createResponse.data.id;
    console.log(`✓ Container created: ${containerId}`);

    // ===== STEP 3: POLL CONTAINER STATUS UNTIL FINISHED =====
    console.log(`\n[Step 3] Polling container status...`);
    await pollContainerStatus(accessToken, containerId, mediaType);

    // ===== STEP 4: PUBLISH MEDIA =====
    console.log(`\n[Step 4] Publishing media...`);

    const publishPayload = {
      creation_id: containerId,
      access_token: accessToken,
    };

    console.log(`  POST /${accountId}/media_publish`);

    const publishResponse = await axios.post(
      `${API_BASE}/${accountId}/media_publish`,
      publishPayload,
      { timeout: 30000 },
    );

    const postId = publishResponse.data.id;
    console.log(`✅ Published! Post ID: ${postId}`);

    return {
      success: true,
      postId,
      containerId,
    };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code;
    const status = error.response?.status;

    console.error(`\n❌ Error: ${errorMsg} (Code: ${errorCode}, HTTP: ${status})`);

    return handleVideoUploadError(errorMsg, errorCode, status);
  }
}

// ============================================================================
// POLLING FUNCTION: CHECK CONTAINER STATUS WITH INTELLIGENT BACKOFF
// ============================================================================

async function pollContainerStatus(
  accessToken: string,
  containerId: string,
  mediaType: string,
): Promise<void> {
  const maxWaitMs = 5 * 60 * 1000; // 5 minute timeout
  const startTime = Date.now();
  let pollCount = 0;
  const pollIntervals = [2, 2, 3, 3, 5, 5, 5, 10, 10, 15, 15, 20];

  while (Date.now() - startTime < maxWaitMs) {
    pollCount++;
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const interval = pollIntervals[Math.min(pollCount - 1, pollIntervals.length - 1)];

    try {
      // Query: GET /{creation_id}?fields=status_code
      const response = await axios.get(
        `${API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`,
        { timeout: 10000 },
      );

      const statusCode = response.data.status_code || response.data.status;

      console.log(`  Poll #${pollCount} (${elapsedSec}s): status_code = ${statusCode}`);

      if (statusCode === 'FINISHED') {
        console.log(`✓ Media processing finished!`);
        return;
      }

      if (statusCode === 'IN_PROGRESS') {
        console.log(`  ⏳ Still processing... waiting ${interval}s`);
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        continue;
      }

      if (statusCode === 'ERROR') {
        throw new Error(`Media processing failed (status=ERROR)`);
      }

      // Unknown status, retry
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`  ⚠️  Container not found (404), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        continue;
      }

      throw error;
    }
  }

  const timeoutSec = Math.round(maxWaitMs / 1000);
  throw new Error(
    `Video processing timeout after ${timeoutSec}s. ` +
    `Try: (1) Shorter video, (2) Smaller file size, (3) H.264 codec, (4) AAC audio`,
  );
}

// ============================================================================
// ERROR HANDLER: FRIENDLY ERROR MESSAGES FOR VIDEO UPLOAD
// ============================================================================

function handleVideoUploadError(errorMsg: string, errorCode: number, status: number): PublishResult {
  // Invalid parameter - usually video format issue
  if (errorCode === 100 || errorMsg.includes('Invalid parameter')) {
    return {
      success: false,
      message:
        `Invalid video format. Ensure: (1) MP4 container, (2) H.264 video codec, ` +
        `(3) AAC audio codec, (4) 9:16 or 1:1 aspect ratio, (5) < 100MB size, ` +
        `(6) HTTPS URL, (7) Video duration <= 60s`,
      error: { code: errorCode, message: errorMsg },
    };
  }

  // Video encoding issue
  if (errorMsg.includes('transcod') || errorMsg.includes('VIDEO_NOT_TRANSCODED')) {
    return {
      success: false,
      message:
        `Video encoding failed. Fix: (1) Use ffmpeg to re-encode, ` +
        `(2) H.264 video + AAC audio, (3) Bitrate < 5Mbps, (4) Frame rate 24-30fps`,
      error: { code: errorCode, message: errorMsg },
    };
  }

  // Access token expired
  if (status === 401) {
    return {
      success: false,
      message:
        `Unauthorized. Instagram access token expired. ` +
        `Get a new token from your Meta App Dashboard.`,
      error: { code: errorCode, message: errorMsg },
    };
  }

  // Permission issue
  if (status === 403) {
    return {
      success: false,
      message:
        `Permission denied. Ensure: (1) Token has 'instagram_content_publish' permission, ` +
        `(2) Business account is properly connected, (3) App is in development or approved`,
      error: { code: errorCode, message: errorMsg },
    };
  }

  // Generic error
  return {
    success: false,
    message: `Instagram API error: ${errorMsg}`,
    error: { code: errorCode, message: errorMsg },
  };
}

// ============================================================================
// SIMPLE CURL EQUIVALENT (for reference)
// ============================================================================

/*
# STEP 1: Create media container
curl -X POST https://graph.instagram.com/v25.0/{IG_ACCOUNT_ID}/media \
  -d "video_url=https://your-domain.com/video.mp4" \
  -d "caption=My awesome video!" \
  -d "media_type=REELS" \
  -d "access_token=YOUR_TOKEN"

# Response: { "id": "creation_123456789" }

# STEP 2: Poll status
curl "https://graph.instagram.com/v25.0/creation_123456789?fields=status_code&access_token=YOUR_TOKEN"

# Response: { "status_code": "FINISHED" } (or "IN_PROGRESS" or "ERROR")

# STEP 3: Publish
curl -X POST https://graph.instagram.com/v25.0/{IG_ACCOUNT_ID}/media_publish \
  -d "creation_id=creation_123456789" \
  -d "access_token=YOUR_TOKEN"

# Response: { "id": "post_987654321" }
*/

// ============================================================================
// RUN EXAMPLES
// ============================================================================

// Uncomment to run examples:
// await example_publishReel();
// await example_publishVideoPost();
// await example_withRetries();

export { publishVideoToInstagram, pollContainerStatus, handleVideoUploadError };
