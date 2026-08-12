import type { StorageLike } from '../storage/safe-storage';

export type PresetRecord = Record<string, Record<string, unknown>>;

export function presetStorageKey(uid?: string | null): string {
  return `halftone_user_presets:${uid || 'anonymous'}`;
}

export function readPresets(storage: StorageLike, uid?: string | null): PresetRecord {
  const key = presetStorageKey(uid);
  let raw = storage.getItem(key);
  if (!raw && !uid) {
    raw = storage.getItem('halftone_user_presets');
    if (raw) {
      storage.setItem(key, raw);
      storage.removeItem('halftone_user_presets');
    }
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as PresetRecord : {};
  } catch {
    return {};
  }
}

export function writePresets(storage: StorageLike, presets: PresetRecord, uid?: string | null): void {
  storage.setItem(presetStorageKey(uid), JSON.stringify(presets));
}
