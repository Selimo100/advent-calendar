/**
 * Local filesystem stand-in for the private bucket (demo only). Signed URLs
 * carry an HMAC and expiry, mirroring the production behaviour.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MediaStorageWriter } from '../../server/storage/types.ts';

export const DEMO_MEDIA_PREFIX = '/api/demo-media/';

export function createLocalStorage(root: string) {
  const secret = randomBytes(32);
  const resolve = (storagePath: string) => {
    const full = path.resolve(root, storagePath);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid storage path');
    return full;
  };
  const sign = (storagePath: string, exp: number) =>
    createHmac('sha256', secret).update(`${storagePath}:${exp}`).digest('base64url');

  const storage: MediaStorageWriter = {
    async createSignedUrl(storagePath, expiresInSeconds) {
      const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
      return `${DEMO_MEDIA_PREFIX}${storagePath}?exp=${exp}&sig=${sign(storagePath, exp)}`;
    },
    async upload(storagePath, body) {
      const full = resolve(storagePath);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
    },
    async remove(paths) {
      await Promise.all(paths.map((p) => rm(resolve(p), { force: true })));
    },
    async exists(storagePath) {
      return existsSync(resolve(storagePath));
    },
  };

  /** Serves a signed URL (with Range support, which Safari needs for audio). */
  async function serve(request: Request, mimeLookup: (storagePath: string) => Promise<string | null>): Promise<Response> {
    const url = new URL(request.url);
    const storagePath = decodeURIComponent(url.pathname.slice(DEMO_MEDIA_PREFIX.length));
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') ?? '';
    const expected = sign(storagePath, exp);
    const valid =
      Number.isFinite(exp) &&
      exp > Date.now() / 1000 &&
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid) return new Response('Expired or invalid', { status: 403 });
    const mime = await mimeLookup(storagePath);
    if (!mime || !existsSync(resolve(storagePath))) return new Response('Not found', { status: 404 });
    const data = await readFile(resolve(storagePath));
    const headers = new Headers({ 'Content-Type': mime, 'Cache-Control': 'private, max-age=600', 'Accept-Ranges': 'bytes' });
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      if (start > end || start >= data.length) return new Response(null, { status: 416, headers });
      headers.set('Content-Range', `bytes ${start}-${end}/${data.length}`);
      return new Response(data.subarray(start, end + 1), { status: 206, headers });
    }
    return new Response(data, { status: 200, headers });
  }

  return { storage, serve };
}
