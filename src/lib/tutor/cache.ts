const TTL_MS = 30 * 60 * 1000; // 30분
const MAX_ENTRIES = 200;

interface CacheEntry {
  text: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedResponse(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.text;
}

export function setCachedResponse(key: string, text: string): void {
  // 용량 초과 시 가장 오래된 엔트리 제거
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.set(key, { text, timestamp: Date.now() });
}

export function buildCacheKey(type: string, questId: string): string {
  return `${type}:${questId}`;
}
