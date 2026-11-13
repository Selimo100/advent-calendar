/**
 * Media preparation for import: photos are resized, auto-rotated, converted to
 * WebP and stripped of metadata (EXIF / GPS) with sharp. Audio is passed
 * through unchanged after a type and size check.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
export const AUDIO_EXTENSIONS = ['.m4a', '.mp4', '.mp3', '.ogg', '.oga', '.webm', '.wav'];
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const AUDIO_MIME: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.webm': 'audio/webm',
  '.wav': 'audio/wav',
};

export interface PreparedMedia {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
  /** Hash of the source file, used to skip unchanged media. */
  sourceHash: string;
}

export const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

export async function prepareMediaFile(fullPath: string, kind: 'image' | 'audio'): Promise<PreparedMedia> {
  const source = await readFile(fullPath);
  if (source.byteLength > MAX_MEDIA_BYTES) throw new Error(`File too large: ${path.basename(fullPath)}`);
  const ext = path.extname(fullPath).toLowerCase();
  const sourceHash = sha256(source);

  if (kind === 'audio') {
    const mimeType = AUDIO_MIME[ext];
    if (!mimeType) throw new Error(`Unsupported audio type ${ext}`);
    return { bytes: source, mimeType, extension: ext.slice(1), width: null, height: null, sourceHash };
  }

  if (!IMAGE_EXTENSIONS.includes(ext)) throw new Error(`Unsupported image type ${ext} (convert HEIC to JPEG first)`);
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(source, { density: ext === '.svg' ? 144 : undefined })
    .rotate() // apply EXIF orientation, then metadata is dropped
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: new Uint8Array(data),
    mimeType: 'image/webp',
    extension: 'webp',
    width: info.width,
    height: info.height,
    sourceHash,
  };
}
