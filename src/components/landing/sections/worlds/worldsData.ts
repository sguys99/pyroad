/**
 * 랜딩 세계관 섹션의 월드 3개 (P4-04, §12-Q40·Q2, 커리큘럼 §5).
 *
 * - 이름: "월드 1 · 파이썬 섬", "월드 2 · 코드 바다", "월드 3 · 메이커 시티"(2·3은 가칭)
 * - 해제 조건(Q2): 앞 월드의 마지막 프로젝트를 끝내면 열린다. "실력 확인 퀴즈"는 아직 없어서 말하지 않는다
 * - `ready`: 콘텐츠가 실제로 있는지. false면 "준비 중" 표시 (Phase 10·11에서 월드를 만들면 true로 바꾼다)
 */
import type { WorldStats } from './worldStats';

export type WorldNo = 1 | 2 | 3;

export interface WorldPreview {
  no: WorldNo;
  /** "월드 N · " 뒤의 이름 */
  name: string;
  /** 커리큘럼 한 줄 (§5) */
  line: string;
  /** 비로그인 랜딩에서 보이는 상태: 첫 월드만 열림 */
  state: 'open' | 'locked';
  /** 콘텐츠가 있는지 (없으면 "준비 중") */
  ready: boolean;
}

export const WORLD_PREVIEWS: readonly WorldPreview[] = [
  {
    no: 1,
    name: '파이썬 섬',
    line: 'print()부터 함수까지, 파이썬 기초를 익혀요',
    state: 'open',
    ready: true,
  },
  {
    no: 2,
    name: '코드 바다',
    line: '문자열·딕셔너리·랜덤으로 더 큰 문제를 풀어요',
    state: 'locked',
    ready: false,
  },
  {
    no: 3,
    name: '메이커 시티',
    line: '거북이 그림, 텍스트 게임으로 나만의 작품을 만들어요',
    state: 'locked',
    ready: false,
  },
];

/** 잠긴 월드를 눌렀을 때 보여 주는 말 */
export const LOCKED_TIP = '앞 월드를 끝내면 열려요!';

export const worldLabel = (no: WorldNo) => `월드 ${no}`;

/** 카드 아래 한 줄: 열린 월드는 콘텐츠 수, 잠긴 월드는 해제 조건 (Q2) */
export function worldNote(
  world: WorldPreview,
  prev: WorldPreview | undefined,
  stats: WorldStats | null,
): string {
  if (world.state === 'open') {
    return stats
      ? `스테이지 ${stats.stages}곳 · 퀘스트 ${stats.quests}개`
      : '지금 바로 출발할 수 있어요';
  }
  return prev
    ? `${prev.name}의 마지막 프로젝트를 끝내면 열려요`
    : '앞 월드를 끝내면 열려요';
}

/** 지도가 펼쳐지는 동안 카드 i가 일어서는 구간 (펼침 진행 0~1). 두루마리가 카드에 닿은 직후부터 */
export function standRange(i: number, count = 3): { s: number; e: number } {
  const s = Math.round((i / count + 0.04) * 100) / 100;
  return { s, e: Math.round((s + 0.24) * 100) / 100 };
}
