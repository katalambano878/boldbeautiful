import imageCompression from 'browser-image-compression';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];

interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  if (VIDEO_TYPES.includes(file.type) || !IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  if (file.type === 'image/gif') {
    return file;
  }

  const {
    maxSizeMB = 0.6,
    maxWidthOrHeight = 1400,
    quality = 0.75,
  } = options;

  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      initialQuality: quality,
      useWebWorker: true,
      fileType: file.type as string,
      preserveExif: false,
    });

    return new File([compressed], file.name, { type: compressed.type });
  } catch {
    return file;
  }
}

export async function compressImageForUpload(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1400,
    quality: 0.75,
  });
}

export async function compressImageForThumbnail(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 600,
    quality: 0.7,
  });
}
