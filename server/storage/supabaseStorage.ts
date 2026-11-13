import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MediaStorageWriter } from './types.ts';

export const DEFAULT_MEDIA_BUCKET = 'advent-private';

/**
 * Supabase Storage access with the privileged server key. Server-only: this
 * module must never be imported by frontend code.
 */
export function createSupabaseStorage(url: string, serviceKey: string, bucket = DEFAULT_MEDIA_BUCKET): MediaStorageWriter {
  const client: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const objects = () => client.storage.from(bucket);

  return {
    async createSignedUrl(storagePath, expiresInSeconds) {
      const { data, error } = await objects().createSignedUrl(storagePath, expiresInSeconds);
      if (error || !data?.signedUrl) throw Object.assign(new Error('Signed URL failed'), { code: 'STORAGE' });
      return data.signedUrl;
    },
    async upload(storagePath, body, contentType) {
      const { error } = await objects().upload(storagePath, body, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });
      if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
    },
    async remove(storagePaths) {
      if (storagePaths.length === 0) return;
      const { error } = await objects().remove(storagePaths);
      if (error) throw new Error(`Remove failed: ${error.message}`);
    },
    async exists(storagePath) {
      const { data, error } = await objects().exists(storagePath);
      if (error) return false;
      return data === true;
    },
  };
}
