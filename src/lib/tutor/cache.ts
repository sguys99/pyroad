import type { TutorRequest } from './types';

/**
 * 튜터 응답 인메모리 캐시.
 *
 * ⚠️ 서버 인스턴스(서버리스 함수)마다 따로 있는 메모리라서 인스턴스끼리 공유되지 않고,
 * 콜드 스타트나 재배포 때마다 비어 있다. 같은 요청이라도 어느 인스턴스가 받느냐에 따라
 * 캐시 히트 여부가 달라지므로 "있으면 LLM 호출을 아끼는" 용도로만 쓰고 정확성에 기대지 않는다.
 * 크기 상한(MAX_ENTRIES)과 TTL(TTL_MS)로 인스턴스당 메모리를 제한한다.
 */
const TTL_MS = 30 * 60 * 1000; // 30분
const MAX_ENTRIES = 200;

/**
 * 프롬프트가 퀘스트·스테이지 데이터로만 만들어지는 타입만 캐시한다.
 * 학생마다 달라지는 입력(코드, 실행 결과, XP, 힌트 수, 단계·이전 코드)이 프롬프트에 들어가는
 * 타입은 다른 학생에게 재사용되면 안 되므로 캐시하지 않는다 (B17).
 * - quest_intro: 퀘스트 제목·스토리·학습 목표
 * - stage_summary: 스테이지의 개념 목록·다음 스테이지 제목
 * - encouragement는 earned_xp·hints_used가 들어가므로 제외
 */
const CACHEABLE_TYPES: ReadonlySet<TutorRequest['type']> = new Set([
  'quest_intro',
  'stage_summary',
]);

interface CacheEntry {
  text: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * 캐시 키를 만든다. 캐시하면 안 되는 요청이면 `null`.
 * 키에는 quest_id만 들어가므로, 개인화 입력이 있는 타입을 CACHEABLE_TYPES에 넣으면 안 된다.
 */
export function buildCacheKey(
  body: Pick<TutorRequest, 'type' | 'quest_id'>,
): string | null {
  if (!CACHEABLE_TYPES.has(body.type)) return null;
  return `${body.type}:${body.quest_id}`;
}

export function getCachedResponse(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }

  // 최근에 쓴 항목을 뒤로 보내 LRU로 동작하게 함 (Map은 삽입 순서를 유지)
  cache.delete(key);
  cache.set(key, entry);
  return entry.text;
}

export function setCachedResponse(key: string, text: string): void {
  cache.delete(key);

  // 용량 초과 시 가장 오래 쓰지 않은 엔트리 제거
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }

  cache.set(key, { text, timestamp: Date.now() });
}

/** 테스트용: 캐시 비우기 */
export function clearTutorCache(): void {
  cache.clear();
}
