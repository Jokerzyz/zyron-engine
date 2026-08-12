import { describe, expect, it } from 'vitest';
import { createSafeStorage, type StorageLike } from './safe-storage';

describe('createSafeStorage', () => {
  it('mirrors successful writes and removals', () => {
    const values = new Map<string, string>();
    const backing: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const storage = createSafeStorage(() => backing);

    storage.setItem('theme', 'dark');
    expect(storage.getItem('theme')).toBe('dark');
    storage.removeItem('theme');
    expect(storage.getItem('theme')).toBeNull();
  });

  it('falls back to memory when browser storage throws', () => {
    const blocked = createSafeStorage(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    blocked.setItem('lang', 'zh');
    expect(blocked.getItem('lang')).toBe('zh');
    blocked.removeItem('lang');
    expect(blocked.getItem('lang')).toBeNull();
  });
});
