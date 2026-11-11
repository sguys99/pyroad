import { coinReward } from './coins';
import type { AchievementTier } from './achievements';

/**
 * 업적 도감 (P8-10). 서버가 정의(00036 `achievements`) · 내 업적(`user_achievements`) · 진행도(`achievement_progress`)를 읽어
 * 이 함수로 화면 값을 만든다. 숨김 업적은 얻기 전에는 이름·조건·진행을 내려보내지 않음("???").
 */
export type AchievementCategory =
  | 'learn'
  | 'star'
  | 'quiz'
  | 'habit'
  | 'growth'
  | 'grit';

export const CATEGORY_ORDER: readonly AchievementCategory[] = [
  'learn',
  'star',
  'quiz',
  'habit',
  'growth',
  'grit',
];

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  learn: '학습',
  star: '별',
  quiz: '퀴즈',
  habit: '꾸준함',
  growth: '성장',
  grit: '실패 칭찬',
};

/** 정의 한 줄 (00036 achievements 에서 쓰는 열) */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  category: AchievementCategory;
  metric: string;
  sort: number;
  hidden: boolean;
}

export interface OwnedAchievement {
  achievement_id: string;
  achieved_at: string;
  claimed_at: string | null;
}

export interface AchievementProgressRow {
  achievement_id: string;
  progress: number;
  goal: number;
}

/** claimable: 얻고 코인 안 받음 · earned: 받음 · locked: 아직 · secret: 숨김 업적 아직(이름·조건 비밀) */
export type BookState = 'claimable' | 'earned' | 'locked' | 'secret';

export interface BookEntry {
  id: string;
  category: AchievementCategory;
  state: BookState;
  tier: AchievementTier;
  /** secret 이면 '???' */
  name: string;
  /** 얻었으면 업적 설명, 아직이면 "어떻게 얻는지" 한 줄, secret 이면 비밀 안내 */
  text: string;
  /** secret 이면 '' (화면은 물음표) */
  icon: string;
  coins: number;
  /** 아직(locked)일 때만 */
  progress: number | null;
  goal: number | null;
  achievedAt: string | null;
}

export interface BookSummary {
  earned: number;
  total: number;
  byTier: Record<AchievementTier, number>;
  /** 받을 수 있는 업적 수 · 코인 합 */
  claimable: number;
  claimableCoins: number;
}

const TIER_N: Record<AchievementTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

export function tierCoins(tier: AchievementTier): number {
  return coinReward('achievement', TIER_N[tier]);
}

/** 지표(00036 metric) → 얻는 법 한 줄. 표에 새 지표를 쓰면 여기에도 (테스트가 대조) */
export const METRIC_HINT: Record<string, (goal: number) => string> = {
  quests: (g) => `퀘스트 ${g}개를 혼자 풀어요`,
  stages: (g) => `스테이지 ${g}개를 끝까지 깨요`,
  projects: () => '최종 프로젝트를 완성해요',
  no_hint: (g) => `힌트 없이 퀘스트 ${g}개를 풀어요`,
  hint_finish: (g) => `힌트를 보고 퀘스트 ${g}개를 끝까지 해내요`,
  stars: (g) => `별을 ${g}개 모아요`,
  three_stars: (g) => `별 3개 퀘스트를 ${g}개 만들어요`,
  quiz_correct: (g) => `퀴즈 ${g}문제를 맞혀요`,
  quiz_comeback: (g) => `틀린 퀴즈 ${g}문제를 다시 풀어 맞혀요`,
  reviews: (g) => `복습 도전을 ${g}번 해내요`,
  streak: (g) => `${g}일 연속으로 공부해요`,
  level: (g) => `레벨 ${g}까지 올라가요`,
  attendance: (g) => `출석 도장을 ${g}번 찍어요`,
  missions: (g) => `데일리 미션 ${g}개를 해내요`,
  chests: (g) => `스테이지 보물상자를 ${g}개 열어요`,
  errors: (g) => `에러를 만나도 끝까지 풀어 퀘스트 ${g}개를 통과해요`,
};

export const SECRET_TEXT = '비밀 업적이에요. 계속 모험하면 알게 될 거예요!';

export function buildAchievementBook(
  defs: readonly AchievementDef[],
  owned: readonly OwnedAchievement[],
  progress: readonly AchievementProgressRow[],
): BookEntry[] {
  const mine = new Map(owned.map((o) => [o.achievement_id, o]));
  const prog = new Map(progress.map((p) => [p.achievement_id, p]));
  const cat = (c: AchievementCategory) => CATEGORY_ORDER.indexOf(c);

  const entries = [...defs]
    .sort((a, b) => cat(a.category) - cat(b.category) || a.sort - b.sort)
    .map((d): BookEntry => {
      const o = mine.get(d.id);
      const coins = tierCoins(d.tier);
      const base = {
        id: d.id,
        category: d.category,
        tier: d.tier,
        coins,
        achievedAt: o?.achieved_at ?? null,
      };
      if (o)
        return {
          ...base,
          state: o.claimed_at ? 'earned' : 'claimable',
          name: d.name,
          text: d.description,
          icon: d.icon,
          progress: null,
          goal: null,
        };
      if (d.hidden)
        return {
          ...base,
          state: 'secret',
          name: '???',
          text: SECRET_TEXT,
          icon: '',
          progress: null,
          goal: null,
        };
      const p = prog.get(d.id);
      const goal = p?.goal ?? 0;
      return {
        ...base,
        state: 'locked',
        name: d.name,
        text: (goal > 0 && METRIC_HINT[d.metric]?.(goal)) || d.description,
        icon: d.icon,
        progress: Math.min(p?.progress ?? 0, goal),
        goal,
      };
    });

  return entries;
}

/** 위 요약: 얻은 수/전체(숨김 포함 — "???" 칸도 보이므로), 티어별, 받을 코인 */
export function summarizeBook(entries: readonly BookEntry[]): BookSummary {
  const byTier: Record<AchievementTier, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
  };
  let claimable = 0;
  let claimableCoins = 0;
  for (const e of entries) {
    if (e.state === 'earned' || e.state === 'claimable') byTier[e.tier]++;
    if (e.state === 'claimable') {
      claimable++;
      claimableCoins += e.coins;
    }
  }
  return {
    earned: byTier.bronze + byTier.silver + byTier.gold,
    total: entries.length,
    byTier,
    claimable,
    claimableCoins,
  };
}

/** 받기 뒤 화면 값 (서버 응답을 받은 업적 id 를 earned 로) */
export function markClaimed(
  entries: readonly BookEntry[],
  ids: ReadonlySet<string>,
): BookEntry[] {
  return entries.map((e) =>
    e.state === 'claimable' && ids.has(e.id) ? { ...e, state: 'earned' } : e,
  );
}
