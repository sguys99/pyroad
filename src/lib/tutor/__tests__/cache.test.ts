import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildCacheKey,
  clearTutorCache,
  getCachedResponse,
  setCachedResponse,
} from '../cache';
import type { TutorRequest } from '../types';

describe('buildCacheKey — 개인화 입력이 있는 응답은 캐시하지 않음 (B17)', () => {
  it('encouragement는 XP·힌트 수가 프롬프트에 들어가므로 캐시 키가 없다', () => {
    expect(buildCacheKey({ type: 'encouragement', quest_id: 'q1' })).toBeNull();
  });

  it.each<TutorRequest['type']>([
    'hint_generator',
    'code_feedback',
    'project_guide',
  ])('%s는 학생 코드·단계 정보가 들어가므로 캐시하지 않는다', (type) => {
    expect(buildCacheKey({ type, quest_id: 'q1' })).toBeNull();
  });

  it('quest_intro·stage_summary는 퀘스트별로만 캐시하고, 학생 입력이 달라도 같은 키', () => {
    const studentA: TutorRequest = {
      type: 'quest_intro',
      quest_id: 'q1',
      earned_xp: 10,
      hints_used: 0,
      student_code: 'print(1)',
    };
    const studentB: TutorRequest = {
      ...studentA,
      earned_xp: 150,
      hints_used: 3,
    };
    expect(buildCacheKey(studentA)).toBe('quest_intro:q1');
    expect(buildCacheKey(studentB)).toBe(buildCacheKey(studentA));
    expect(buildCacheKey({ type: 'stage_summary', quest_id: 'q1' })).toBe(
      'stage_summary:q1',
    );
    expect(buildCacheKey({ type: 'concept_explain', quest_id: 'q1' })).toBe(
      'concept_explain:q1',
    );
    expect(buildCacheKey({ type: 'quest_intro', quest_id: 'q2' })).not.toBe(
      buildCacheKey(studentA),
    );
  });
});

describe('인메모리 캐시 — TTL과 크기 상한', () => {
  beforeEach(() => clearTutorCache());
  afterEach(() => vi.useRealTimers());

  it('30분이 지나면 만료된다', () => {
    vi.useFakeTimers();
    setCachedResponse('k', '안녕');
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(getCachedResponse('k')).toBe('안녕');
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(getCachedResponse('k')).toBeNull();
  });

  it('200개를 넘으면 가장 오래 쓰지 않은 항목부터 지운다', () => {
    for (let i = 0; i < 200; i++) setCachedResponse(`k${i}`, `v${i}`);
    // k0을 최근에 사용 → k1이 가장 오래된 항목이 됨
    expect(getCachedResponse('k0')).toBe('v0');
    setCachedResponse('new', 'v');
    expect(getCachedResponse('k0')).toBe('v0');
    expect(getCachedResponse('k1')).toBeNull();
    expect(getCachedResponse('new')).toBe('v');
  });
});
