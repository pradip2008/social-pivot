/**
 * Image Resizing and Cropping Utilities
 * Automatically crops and resizes images to Instagram/Facebook requirements
 */

export interface ResizeOptions {
  targetWidth: number;
  targetHeight: number;
  quality?: number; // 0-1, default 0.85
}

export interface AspectRatioOption {
  ratio: number;
  name: string;
  width: number;
  height: number;
}

/**
 * Get recommended dimensions for Instagram post types
 */
export function getInstagramDimensions(postType: string): AspectRatioOption {
  const dimensions: Record<string, AspectRatioOption> = {
    SINGLE_IMAGE: {
      ratio: 1, // 1:1 square
      name: '1:1 Square',
      width: 1080,
      height: 1080,
    },
    CAROUSEL: {
      ratio: 1, // 1:1 square
      name: '1:1 Square',
      width: 1080,
      height: 1080,
    },
    VIDEO: {
      ratio: 1, // Can be 1:1 or 4:5, default to square
      name: '1:1 Square',
      width: 1080,
      height: 1080,
    },
    REEL: {
      ratio: 9 / 16, // 9:16 vertical
      name: '9:16 Vertical',
      width: 1080,
      height: 1920,
    },
  };
  return dimensions[postType] || dimensions.SINGLE_IMAGE;
}

export function getFacebookDimensions(postType: string): AspectRatioOption {
  const dimensions: Record<string, AspectRatioOption> = {
    SINGLE_IMAGE: {
      ratio: 1200 / 630, // 1.9:1
      name: '1.9:1 Landscape',
      width: 1200,
      height: 630,
    },
    ALBUM: {
      ratio: 1, // 1:1 square
      name: '1:1 Square',
      width: 1080,
      height: 1080,
    },
    VIDEO: {
      ratio: 1, // 1:1 square
      name: '1:1 Square',
      width: 1080,
      height: 1080,
    },
    REEL: {
      ratio: 9 / 16, // 9:16 vertical
      name: '9:16 Vertical',
      width: 1080,
      height: 1920,
    },
  };
  return dimensions[postType] || dimensions.SINGLE_IMAGE;
}

/**
 * Get target dimensions based on platform and post type
 */
export function getTargetDimensions(
  platform: string,
  postType: string
): AspectRatioOption {
  if (platform === 'Instagram') {
    return getInstagramDimensions(postType);
  } else if (platform === 'Facebook') {
    return getFacebookDimensions(postType);
  }
  return getInstagramDimensions(postType);
}

/**
 * Resize image while maintaining aspect ratio (NO CROPPING)
 * Just ensures image fits within max dimensions without cutting
 */
export async function resizeImageToAspectRatio(
  file: File,
  targetDimensions: AspectRatioOption,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');

          // Get original image dimensions
          const originalWidth = img.width;
          const originalHeight = img.height;
          const originalRatio = originalWidth / originalHeight;
          
          // Calculate new dimensions while maintaining aspect ratio
          let newWidth = targetDimensions.width;
          let newHeight = Math.round(newWidth / originalRatio);

          // If height exceeds limit, scale down width instead
          if (newHeight > targetDimensions.height) {
            newHeight = targetDimensions.height;
            newWidth = Math.round(newHeight * originalRatio);
          }

          // Set canvas to actual image dimensions (no letterboxing)
          canvas.width = newWidth;
          canvas.height = newHeight;

          // Draw resized image without cropping
          ctx.drawImage(
            img,
            0, // source x (full image)
            0, // source y (full image)
            originalWidth, // source width (full)
            originalHeight, // source height (full)
            0, // destination x
            0, // destination y
            newWidth, // destination width
            newHeight // destination height
          );

          // Convert to blob with high quality
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Could not convert canvas to blob'));
              }
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Could not load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Main function: Auto-resize image for Instagram/Facebook
 * Returns a File object with the resized image
 * IMPORTANT: Maintains original aspect ratio - does NOT crop or cut images
 */
export async function autoResizeImageForSocialMedia(
  file: File,
  platform: string,
  postType: string
): Promise<{ file: File; newDimensions: AspectRatioOption; message: string }> {
  try {
    const targetDimensions = getTargetDimensions(platform, postType);

    // Get current image dimensions
    const currentDimensions = await getImageDimensions(file);
    const currentRatio = currentDimensions.width / currentDimensions.height;

    // Check if resizing is needed (only if image is larger than target max width)
    const needsResize = currentDimensions.width > targetDimensions.width;

    if (needsResize) {
      // Calculate new dimensions while maintaining aspect ratio
      const scale = targetDimensions.width / currentDimensions.width;
      const newHeight = Math.round(currentDimensions.height * scale);

      const resizeOption: AspectRatioOption = {
        ...targetDimensions,
        width: targetDimensions.width,
        height: newHeight,
      };

      const resizedBlob = await resizeImageToAspectRatio(
        file,
        resizeOption,
        0.90 // High quality
      );

      // Create new File from resized blob
      const timestamp = Date.now();
      const resizedFile = new File(
        [resizedBlob],
        `${file.name.split('.')[0]}-optimized-${timestamp}.jpg`,
        { type: 'image/jpeg' }
      );

      return {
        file: resizedFile,
        newDimensions: resizeOption,
        message: `✓ Image optimized from ${currentDimensions.width}x${currentDimensions.height} to ${targetDimensions.width}x${Math.round(newHeight)}px (keeping original aspect ratio)`,
      };
    }

    return {
      file,
      newDimensions: targetDimensions,
      message: `✓ Image size OK (${currentDimensions.width}x${currentDimensions.height}px)`,
    };
  } catch (err: any) {
    // If resize fails, just use original image
    console.error(`Auto-resize warning (non-critical): ${err.message}`);
    return {
      file,
      newDimensions: getTargetDimensions(platform, postType),
      message: `Image will be uploaded as-is`,
    };
  }
}

/**
 * Get image dimensions from File
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        reject(new Error('Could not load image'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Check if image needs resizing and get crop preview
 */
export async function getResizePreview(
  file: File,
  platform: string,
  postType: string
): Promise<{
  needsResize: boolean;
  current: { width: number; height: number; ratio: number };
  target: AspectRatioOption;
  message: string;
}> {
  try {
    const current = await getImageDimensions(file);
    const target = getTargetDimensions(platform, postType);
    const currentRatio = current.width / current.height;
    const targetRatio = target.ratio;
    const ratioTolerance = 0.05;

    const needsResize =
      Math.abs(currentRatio - targetRatio) > ratioTolerance ||
      current.width > target.width ||
      current.height > target.height;

    const message = needsResize
      ? `Image will be automatically cropped from ${current.width}x${current.height} to ${target.width}x${target.height}`
      : `Image is already the correct size`;

    return {
      needsResize,
      current,
      target,
      message,
    };
  } catch (err: any) {
    throw new Error(`Preview failed: ${err.message}`);
  }
}
