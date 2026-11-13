export interface MediaStorage {
  /** Short-lived URL for a private object. Never called for unopened doors. */
  createSignedUrl(storagePath: string, expiresInSeconds: number): Promise<string>;
}

/** Write access, used only by the local import tool. */
export interface MediaStorageWriter extends MediaStorage {
  upload(storagePath: string, body: Uint8Array, contentType: string): Promise<void>;
  remove(storagePaths: string[]): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
}

export const SIGNED_URL_TTL_SECONDS = 600;
