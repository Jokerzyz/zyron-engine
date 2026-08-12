export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export function createSafeStorage(resolveStorage: () => StorageLike): StorageLike {
  const memory = new Map<string, string>();

  return {
    getItem(key) {
      try {
        const value = resolveStorage().getItem(key);
        if (value !== null) memory.set(key, value);
        return value ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        resolveStorage().setItem(key, value);
      } catch {
        // The in-memory mirror keeps local-only features usable when storage is blocked.
      }
    },
    removeItem(key) {
      memory.delete(key);
      try {
        resolveStorage().removeItem(key);
      } catch {
        // Keep the fallback state consistent even when persistent storage is unavailable.
      }
    },
  };
}
