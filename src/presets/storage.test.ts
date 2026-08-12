import { describe, expect, it } from 'vitest';
import { presetStorageKey, readPresets, writePresets } from './storage';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('preset storage', () => {
  it('keeps anonymous and account presets isolated', () => {
    const storage = new MemoryStorage();
    writePresets(storage, { anonymous: { gridSize: 20 } });
    writePresets(storage, { account: { gridSize: 30 } }, 'user-a');

    expect(readPresets(storage)).toHaveProperty('anonymous');
    expect(readPresets(storage, 'user-a')).toHaveProperty('account');
    expect(readPresets(storage, 'user-b')).toEqual({});
  });

  it('migrates the former global key into anonymous storage once', () => {
    const storage = new MemoryStorage();
    storage.setItem('halftone_user_presets', JSON.stringify({ legacy: { gridSize: 12 } }));

    expect(readPresets(storage)).toHaveProperty('legacy');
    expect(storage.getItem('halftone_user_presets')).toBeNull();
    expect(storage.getItem(presetStorageKey())).not.toBeNull();
  });
});
