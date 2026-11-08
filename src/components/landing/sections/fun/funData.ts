/**
 * 랜딩 재미 요소 쇼케이스의 장면 5개 (P4-05, §12-Q42).
 *
 * - `soon`: 아직 앱에 없는 기능 → "곧 열려요" 배지. **배지는 여기 플래그만 바꾸면 꺼진다** (Phase 8 코인, Phase 9 자랑하기·보스 배틀)
 *   지금 있는 것(2026-11): 레벨·경험치(퀘스트 완료, 레벨 업 축하), 파이뱀 색 6가지(온보딩에서 고름, §12-Q34).
 *   없는 것: 코인·상점(Phase 8), 공유 카드 자랑하기·보스 배틀(Phase 9), 옷·모자(코스튬, Phase 9)
 * - 문구는 장면마다 제목 + 한 줄 (랜딩 글꼴 서브셋 예산)
 * - 장면 길이·간격은 모션 토큰에서 만든다 (CSS `--ld-fun-t`와 같은 값, fun.css)
 */
import { DURATION } from '@/lib/motion/tokens';
import type { MotionTier } from '@/lib/motion/tier';

export type FunSceneId = 'level' | 'coin' | 'dress' | 'share' | 'boss';

export interface FunScene {
  id: FunSceneId;
  title: string;
  line: string;
  /** 아직 없는 기능: "곧 열려요" */
  soon: boolean;
}

export const SOON_LABEL = '곧 열려요';

export const FUN_SCENES: readonly FunScene[] = [
  {
    id: 'level',
    title: '레벨 업',
    line: '퀘스트를 깨면 경험치가 차고 레벨이 올라요',
    soon: false,
  },
  {
    id: 'coin',
    title: '코인 모으기',
    line: '퀘스트 보상으로 코인을 모아요',
    soon: true,
  },
  {
    id: 'dress',
    title: '파이뱀 꾸미기',
    line: '6가지 색 중에서 내 파이뱀 색을 골라요',
    soon: false,
  },
  {
    id: 'share',
    title: '자랑하기',
    line: '멋진 순간을 카드로 만들어 보여 줘요',
    soon: true,
  },
  {
    id: 'boss',
    title: '보스 배틀',
    line: '스테이지 끝에서 버그버그와 겨뤄요',
    soon: true,
  },
];

/** 장면 한 번 길이 (ms) = 축하 카드 2.5장. CSS `--ld-fun-t: calc(var(--dur-celebrate) * 2.5)` */
export const SCENE_MS = DURATION.celebrate * 2.5;
/** 다음 장면까지 쉬는 시간 (ms) */
export const SCENE_GAP_MS = DURATION.page;

/**
 * 재생 방식 (motion-guidelines §2):
 * - `loop`: full — 화면 안의 장면을 **한 번에 하나씩** 차례로 반복 (동시에 다 움직이지 않게)
 * - `once`: lite — 화면에 들어온 장면을 차례로 한 번씩만
 * - `still`: minimal·동작 줄이기 — 대표 정지 그림 + 설명 글자
 */
export type ShowMode = 'loop' | 'once' | 'still';

export function showMode(tier: MotionTier, reduced: boolean): ShowMode {
  if (reduced || tier === 'minimal') return 'still';
  return tier === 'full' ? 'loop' : 'once';
}

/** 다음에 틀 장면: 화면 안(visible, 오름차순) 중 마지막 장면 다음. once는 아직 안 튼 것만. 없으면 null */
export function nextScene(
  visible: readonly number[],
  last: number | null,
  played: ReadonlySet<number>,
  mode: ShowMode,
): number | null {
  if (mode === 'still') return null;
  const cands =
    mode === 'once' ? visible.filter((i) => !played.has(i)) : [...visible];
  if (cands.length === 0) return null;
  if (last === null) return cands[0];
  return cands.find((i) => i > last) ?? cands[0];
}
