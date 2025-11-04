import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type ImageData = {
  base64: string;
  mimeType: string;
};

// Standard max dimensions for images (longest side)
const MAX_IMAGE_DIMENSION = 1200;
const COMPRESSION_QUALITY = 0.7;

/**
 * Resize and compress image to standard dimensions
 * @param uri - The image URI
 * @returns Resized and compressed image URI
 */
async function resizeAndCompressImage(uri: string): Promise<string> {
  try {
    // Manipulate the image: resize to max dimension and compress
    const manipResult = await manipulateAsync(
      uri,
      [
        {
          resize: {
            width: MAX_IMAGE_DIMENSION,
            height: MAX_IMAGE_DIMENSION,
          },
        },
      ],
      {
        compress: COMPRESSION_QUALITY,
        format: SaveFormat.JPEG, // Convert to JPEG for better compression
        base64: false,
      }
    );
    
    return manipResult.uri;
  } catch (error) {
    console.warn('Failed to resize image, using original:', error);
    return uri; // Fallback to original if resize fails
  }
}

/**
 * Convert an image URI to base64 data
 * @param uri - The image URI (local file path or data URI)
 * @returns Object containing base64 data and mime type
 */
export async function imageToBase64(uri: string): Promise<ImageData> {
  try {
    // Handle data URIs (already base64)
    if (uri.startsWith('data:')) {
      const matches = uri.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        return {
          mimeType: matches[1],
          base64: matches[2],
        };
      }
      throw new Error('Invalid data URI format');
    }

    // Resize and compress the image first (except for web)
    let processedUri = uri;
    if (Platform.OS !== 'web') {
      processedUri = await resizeAndCompressImage(uri);
    }

    // For file URIs, read and convert to base64
    if (Platform.OS === 'web') {
      // Web: fetch and convert to base64
      const response = await fetch(processedUri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      
      return {
        mimeType: blob.type || 'image/jpeg',
        base64: base64.split(',')[1] || base64, // Remove data URI prefix if present
      };
    } else {
      // Native: use FileSystem to read as base64
      const base64 = await FileSystem.readAsStringAsync(processedUri, {
        encoding: 'base64',
      });
      
      // After compression, we're using JPEG format
      const mimeType = 'image/jpeg';
      
      return {
        mimeType,
        base64,
      };
    }
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error(`Failed to convert image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert a Blob to base64 (for web platform)
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get MIME type from file URI based on extension
 */
function getMimeTypeFromUri(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
  };
  
  return mimeTypes[extension || ''] || 'image/jpeg';
}
