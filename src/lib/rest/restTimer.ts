/**
 * 휴식 알림 타이머 (P8-12, §2.6 건강한 재미). React·브라우저 API 없이 시각만 받아 계산하는 순수 함수 — 가짜 시계로 테스트한다.
 *
 * "연속 플레이" = 탭이 보이는 동안 흐른 시간의 합. 쉬는 것으로 보고 처음부터 다시 세는 경우:
 * - 탭을 숨기거나 닫았다가(마지막으로 센 때부터) `BREAK_MS` 넘게 지나 돌아옴
 * - 탭은 보이지만 입력(누르기·키·스크롤)이 `BREAK_MS` 동안 없음 (자리 비움)
 * 시각은 epoch ms. e2e는 빨리 감은 시계(`Date.now() * 배속`)를 넘겨 몇 초 만에 40분을 만든다.
 * 서버 저장 없음: 탭 하나의 세션 값이라 sessionStorage면 충분하다 (새로 고침·페이지 이동에도 이어짐).
 */

const MIN = 60_000;

/** 이만큼 연속으로 놀면 알림 (계획서 §2.6 "40분 연속 플레이") */
export const REST_AFTER_MS = 40 * MIN;
/** "조금만 더 할래요"를 고르면 이만큼 더 논 뒤 다시 */
export const SNOOZE_MS = 20 * MIN;
/** 숨김·자리 비움이 이만큼 이어지면 쉰 것으로 보고 리셋 (초등학교 쉬는 시간 10분) */
export const BREAK_MS = 10 * MIN;
/** "5분 쉬기" 카운트다운 */
export const REST_MS = 5 * MIN;
/** 화면이 보일 때 세는 간격. 한 번에 이보다 길게 비면(탭 숨김·기기 잠듦) 그 틈은 놀이로 세지 않는다 */
export const TICK_MS = 15_000;
const MAX_STEP_MS = 2 * TICK_MS;

export interface RestState {
  /** 지금까지 센 연속 놀이 시간 */
  played: number;
  /** played가 이 값에 닿으면 알림 (처음 REST_AFTER_MS, 미루면 +SNOOZE_MS) */
  nextAt: number;
  /** 마지막으로 센 시각 (epoch ms) */
  lastSeen: number;
  /** 마지막 입력 시각 (epoch ms) */
  lastInput: number;
}

export function freshRestState(now: number): RestState {
  return { played: 0, nextAt: REST_AFTER_MS, lastSeen: now, lastInput: now };
}

/** 화면이 보일 때 부른다. 돌려준 `due`가 참이고 바쁘지 않으면(실행·채점 중 아님) 알림을 띄운다 */
export function tickRest(
  s: RestState,
  now: number,
): { state: RestState; due: boolean } {
  const gap = now - s.lastSeen;
  if (gap >= BREAK_MS || now - s.lastInput >= BREAK_MS) {
    return { state: freshRestState(now), due: false };
  }
  const played = s.played + Math.max(0, Math.min(gap, MAX_STEP_MS));
  return { state: { ...s, played, lastSeen: now }, due: played >= s.nextAt };
}

/** 입력이 있었음 (자리 비움 판정용) */
export function markInput(s: RestState, now: number): RestState {
  return { ...s, lastInput: now };
}

/** "조금만 더 할래요": 지금부터 SNOOZE_MS 뒤 다시 */
export function snoozeRest(s: RestState): RestState {
  return { ...s, nextAt: s.played + SNOOZE_MS };
}

/** sessionStorage에서 읽은 값 확인 (모양이 다르면 버림) */
export function parseRestState(raw: string | null): RestState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RestState>;
    const ok = (['played', 'nextAt', 'lastSeen', 'lastInput'] as const).every(
      (k) => typeof v[k] === 'number' && Number.isFinite(v[k]),
    );
    return ok ? (v as RestState) : null;
  } catch {
    return null;
  }
}
