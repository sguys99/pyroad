/**
 * 획득 속도·인플레이션 시뮬레이션 (P8-14). `npm run balance:economy` → docs/balance.md 2~5절의 표를 그대로 출력.
 *
 * 학생 유형 × 하루 단위로 1월드 실제 콘텐츠(content/)를 푼다. 규칙은 앱·SQL 원본을 그대로 읽음:
 * XP·레벨·레벨 업 코인 xp.ts · 코인 금액 coins.ts(SQL coin_reward 사본) · 상자 목표 chest.ts ·
 * 미션 풀 00034 · 업적 41종 00036(마이그레이션 INSERT 를 읽음 — 표를 두 벌로 두지 않음).
 * 가정(문서 2.1 절): 퀘스트 걸리는 시간 TIME, 실력 HINT_CYCLE·QUIZ_STAR_CYCLE, 복습 도전은 늘 ⭐3.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadContent } from '@/lib/content/load';
import { COIN_RULES, coinReward } from '@/lib/quest/coins';
import { calculateLevel, calculateXP, codeQuestStars } from '@/lib/quest/xp';
import { chestCoins, chestGoal } from '@/lib/world/chest';

const ROOT = resolve(__dirname, '../..');

export interface StudentType {
  id: string;
  name: string;
  /** 0 = 월요일 … 6 = 일요일 */
  activeDow: readonly number[];
  minutes: number;
  /** 하루에 하는 코드 퀘스트 복습 도전 수 (퀴즈 복습은 오늘의 퀴즈로) */
  codeReviews: number;
}

export const STUDENTS: StudentType[] = [
  {
    id: 'light',
    name: '가벼움 (주 3일 20분)',
    activeDow: [0, 2, 4],
    minutes: 20,
    codeReviews: 1,
  },
  {
    id: 'normal',
    name: '보통 (매일 30분)',
    activeDow: [0, 1, 2, 3, 4, 5, 6],
    minutes: 30,
    codeReviews: 1,
  },
  {
    id: 'eager',
    name: '열심 (매일 60분)',
    activeDow: [0, 1, 2, 3, 4, 5, 6],
    minutes: 60,
    codeReviews: 2,
  },
  {
    id: 'weekend',
    name: '몰아서 (주말 60분)',
    activeDow: [5, 6],
    minutes: 60,
    codeReviews: 2,
  },
];

/** 가정: 걸리는 분 (오늘의 퀴즈 한 문제도 quiz) */
export const TIME = { code: 12, project: 45, quiz: 2, codeReview: 6 } as const;
/** 가정: 코드 퀘스트 힌트 수 순환(평균 XP 배율 1.25 = P8-01 "보통") · 퀴즈 첫 판정 별 순환(평균 ⭐2) */
export const HINT_CYCLE = [0, 1, 1, 2] as const;
export const QUIZ_STAR_CYCLE = [3, 2, 2, 1] as const;
/** §3 "초기 코인 밸런스안" 사용 칸 (Phase 9 상점 예정가) */
export const SHOP = [
  { name: '코스튬(싼 것)', price: 50 },
  { name: '스트릭 방패', price: 60 },
  { name: '황금키', price: 80 },
  { name: '프로필 프레임', price: 100 },
  { name: '에디터 테마', price: 150 },
  { name: '코스튬(비싼 것)·펫(싼 것)', price: 300 },
  { name: '펫(비싼 것)', price: 500 },
] as const;

export const SOURCES = [
  'quest',
  'star',
  'level_up',
  'chest',
  'achievement',
  'mission',
  'attendance',
] as const;
export type Source = (typeof SOURCES)[number];
/** 학습 행동에서 나온 코인(§2.6) — 출석만 방문 */
export const LEARNING_SOURCES: readonly Source[] = SOURCES.filter(
  (s) => s !== 'attendance',
);

interface QuestDef {
  id: string;
  type: 'code' | 'project' | 'quiz';
  base: number;
  stage: number;
}
interface StageDef {
  order: number;
  isFinal: boolean;
  quests: QuestDef[];
}

export function world1Stages(): StageDef[] {
  const world = loadContent(resolve(ROOT, 'content')).worlds.find(
    (w) => w.world.order === 1,
  );
  if (!world) throw new Error('1월드 콘텐츠가 없음');
  return world.stages.map((s) => ({
    order: s.stage.order,
    isFinal: s.stage.is_final,
    quests: s.quests.map(({ quest }) => ({
      id: quest.id,
      type: quest.quest_type,
      base: quest.xp_reward,
      stage: s.stage.order,
    })),
  }));
}

function migration(name: string): string {
  return readFileSync(resolve(ROOT, 'supabase/migrations', name), 'utf8');
}

export interface AchievementDef {
  id: string;
  tier: 1 | 2 | 3;
  metric: string;
  goal: number | null;
}
export function loadAchievements(): AchievementDef[] {
  const re =
    /\('(\w+)',\s*'[^']*',\s*'[^']*',\s*'\w+',\s*'(bronze|silver|gold)',\s*'\w+',\s*'(\w+)',\s*(NULL|\d+),/g;
  const tiers = { bronze: 1, silver: 2, gold: 3 } as const;
  return [...migration('00036_achievements.sql').matchAll(re)].map((m) => ({
    id: m[1],
    tier: tiers[m[2] as keyof typeof tiers],
    metric: m[3],
    goal: m[4] === 'NULL' ? null : Number(m[4]),
  }));
}

export interface MissionDef {
  id: string;
  kind: string;
  grp: string;
  target: number;
  difficulty: number;
}
export function loadMissions(): MissionDef[] {
  const re = /\('(\w+)',\s*'(\w+)',\s*'(\w+)',\s*(\d+),\s*(\d+),\s*'[^']*'\)/g;
  return [...migration('00034_daily_missions.sql').matchAll(re)].map((m) => ({
    id: m[1],
    kind: m[2],
    grp: m[3],
    target: Number(m[4]),
    difficulty: Number(m[5]),
  }));
}

/** 00034 와 같은 결정적 순서 (md5(사용자:날짜:미션)) */
function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

interface Progress {
  best: number;
  judgedOn: number;
  attempts: number;
  hints: number;
  error: boolean;
  correctAtTwoPlus: boolean;
}

export interface DayRow {
  day: number;
  xp: number;
  level: number;
  /** 누적 코인 (출처별) */
  coins: Record<Source, number>;
  quizStars: number;
  codeStars: number;
}

export interface EconomyResult {
  student: StudentType;
  rows: DayRow[];
  /** 1월드 새 퀘스트를 모두 끝낸 날 (0부터), 못 끝내면 null */
  world1Day: number | null;
  chestDays: Record<number, number>;
  /** 스테이지 별이 최대(100%)가 된 날 */
  perfectDays: Record<number, number>;
  achievements: { id: string; day: number; coins: number }[];
  missions: { assigned: Record<string, number>; done: Record<string, number> };
  maxQuizStars: number;
  maxCodeStars: number;
}

export function simulateEconomy(
  student: StudentType,
  { days = 90, missionXp = 15, stages = world1Stages(), questsTotal = 0 } = {},
): EconomyResult {
  const achievementDefs = loadAchievements();
  const missionDefs = loadMissions();
  const quests = stages.flatMap((s) => s.quests);
  const codeTotal = quests.filter((q) => q.type !== 'quiz').length;
  const allQuests = questsTotal || codeTotal; // 업적 quests_all 목표 (DB 전체 코드·프로젝트 수)
  const prog = new Map<string, Progress>();
  const coins = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<
    Source,
    number
  >;
  let xp = 0;
  let paidLevel = 1;
  let next = 0; // 다음 새 퀘스트 위치
  let credit = 0; // 다음 새 퀘스트에 쌓인 분 (긴 프로젝트는 며칠에 걸침)
  let codeDone = 0;
  let quizDone = 0;
  let attendance = 0;
  let missionsClaimed = 0;
  let chestsOpened = 0;
  let shields = 0;
  const learnDays = new Set<number>();
  const shieldDays = new Set<number>();
  const result: EconomyResult = {
    student,
    rows: [],
    world1Day: null,
    chestDays: {},
    perfectDays: {},
    achievements: [],
    missions: { assigned: {}, done: {} },
    maxQuizStars: quests.filter((q) => q.type === 'quiz').length * 3,
    maxCodeStars: codeTotal * 3,
  };
  const earned = new Set<string>();

  const stageStars = (s: StageDef) =>
    s.quests.reduce((n, q) => n + (prog.get(q.id)?.best ?? 0), 0);
  const stageCleared = (s: StageDef) =>
    s.quests.every((q) => q.type === 'quiz' || prog.has(q.id));
  const stageOpen = (s: StageDef) =>
    s.order === 1 || stageCleared(stages[stages.indexOf(s) - 1]);
  const gainStars = (id: string, from: number, to: number) => {
    coins.star += Math.max(0, to - from) * COIN_RULES.star;
  };

  function settle(day: number) {
    // 레벨 업 코인 → 상자 → 업적 (업적 코인은 바로 "받기")
    for (let l = calculateLevel(xp); paidLevel < l; )
      coins.level_up += coinReward('level_up', ++paidLevel);
    for (const s of stages) {
      const goal = chestGoal(s.quests.filter((q) => q.type !== 'quiz').length);
      if (
        !(s.order in result.chestDays) &&
        stageOpen(s) &&
        goal > 0 &&
        stageStars(s) >= goal
      ) {
        coins.chest += chestCoins(s.isFinal);
        chestsOpened++;
        result.chestDays[s.order] = day;
      }
      if (
        !(s.order in result.perfectDays) &&
        stageStars(s) === s.quests.length * 3
      )
        result.perfectDays[s.order] = day;
    }
    const all = [...prog.entries()].map(([id, p]) => ({
      q: quests.find((q) => q.id === id)!,
      p,
    }));
    const code = all.filter((x) => x.q.type !== 'quiz');
    const quiz = all.filter((x) => x.q.type === 'quiz');
    const streak = longestRun(new Set([...learnDays, ...shieldDays]));
    const metric: Record<string, number> = {
      quests: code.length,
      projects: code.filter((x) => x.q.type === 'project').length,
      stages: stages.filter(stageCleared).length,
      no_hint: code.filter((x) => x.p.hints === 0).length,
      hint_finish: code.filter((x) => x.p.hints > 0).length,
      stars: all.reduce((n, x) => n + x.p.best, 0),
      three_stars: all.filter((x) => x.p.best >= 3).length,
      quiz_correct: quiz.length,
      quiz_comeback: quiz.filter((x) => x.p.correctAtTwoPlus).length,
      reviews: all.filter((x) => x.p.attempts >= 2).length,
      streak,
      level: calculateLevel(xp),
      attendance,
      missions: missionsClaimed,
      chests: chestsOpened,
      errors: code.filter((x) => x.p.error).length,
    };
    for (const a of achievementDefs) {
      if (earned.has(a.id) || (metric[a.metric] ?? 0) < (a.goal ?? allQuests))
        continue;
      earned.add(a.id);
      const c = coinReward('achievement', a.tier);
      coins.achievement += c;
      result.achievements.push({ id: a.id, day, coins: c });
    }
  }

  for (let day = 0; day < days; day++) {
    if (student.activeDow.includes(day % 7)) {
      // 방패 정산 (00035: 빠진 날 수 ≤ 보유일 때만 메움)
      const last = Math.max(-1, ...learnDays, ...shieldDays);
      const missing = last < 0 ? 0 : day - last - 1;
      if (missing > 0 && missing <= shields) {
        for (let d = last + 1; d < day; d++) shieldDays.add(d);
        shields -= missing;
      }
      // 출석 도장 (칸 = 누적 % 7 + 1, 7일째 상자 = 30코인 + 방패)
      const slot = (attendance++ % 7) + 1;
      coins.attendance += coinReward('attendance', slot);
      if (slot === 7) shields = Math.min(2, shields + 1);

      // 오늘의 퀴즈: 열린 스테이지 퀴즈 중 복습 → 안 푼 것 → 나머지, 3개
      const bucket = (q: QuestDef) => {
        const p = prog.get(q.id);
        return !p ? 1 : p.best < 3 && p.judgedOn < day ? 0 : 2;
      };
      const picks = stages
        .filter(stageOpen)
        .flatMap((s) => s.quests.filter((q) => q.type === 'quiz'))
        .sort(
          (a, b) =>
            bucket(a) - bucket(b) ||
            md5(`${student.id}:${day}:${a.id}`).localeCompare(
              md5(`${student.id}:${day}:${b.id}`),
            ),
        )
        .slice(0, 3);

      // 미션 배정 (00034: 할 수 있는 것만, 그룹마다 하나, 퀘스트 그룹 먼저, 3개)
      const remaining = codeTotal - codeDone;
      const reviewOpen = [...prog.values()].some(
        (p) => p.best < 3 && p.judgedOn < day,
      );
      const possible = (m: MissionDef) =>
        m.kind === 'quest_clear' || m.kind === 'no_hint'
          ? remaining >= m.target
          : m.kind === 'review'
            ? reviewOpen
            : m.kind === 'daily_quiz'
              ? picks.length > 0
              : picks.length >= m.target;
      const h = (m: MissionDef) => md5(`${student.id}:${day}:${m.id}`);
      const byGroup = new Map<string, MissionDef>();
      for (const m of missionDefs
        .filter(possible)
        .sort((a, b) => h(a).localeCompare(h(b))))
        if (!byGroup.has(m.grp)) byGroup.set(m.grp, m);
      const assigned = [...byGroup.values()]
        .sort(
          (a, b) =>
            Number(a.grp !== 'quest') - Number(b.grp !== 'quest') ||
            h(a).localeCompare(h(b)),
        )
        .slice(0, 3);
      for (const m of assigned)
        result.missions.assigned[m.id] =
          (result.missions.assigned[m.id] ?? 0) + 1;

      const today = {
        quest: 0,
        noHint: 0,
        review: 0,
        dailyQuiz: 0,
        quizCorrect: 0,
      };
      let budget = student.minutes;
      const finishQuiz = (q: QuestDef) => {
        const p = prog.get(q.id);
        budget -= TIME.quiz;
        today.quizCorrect++;
        if (!p) {
          const stars = QUIZ_STAR_CYCLE[quizDone++ % QUIZ_STAR_CYCLE.length];
          xp += stars * 10;
          gainStars(q.id, 0, stars);
          prog.set(q.id, {
            best: stars,
            judgedOn: day,
            attempts: 1,
            hints: 0,
            error: false,
            correctAtTwoPlus: stars < 3,
          });
        } else if (p.best < 3 && p.judgedOn < day) {
          // 복습 도전: 첫 시도 정답 가정 → ⭐3, 늘어난 별만 XP·코인
          xp += (3 - p.best) * 10;
          gainStars(q.id, p.best, 3);
          Object.assign(p, {
            best: 3,
            judgedOn: day,
            attempts: p.attempts + 1,
          });
          today.review++;
        } // 그 밖은 연습: 아무것도 안 바뀜
      };
      for (const q of picks) finishQuiz(q);
      today.dailyQuiz = picks.length;

      // 코드 퀘스트 복습 도전 (다음 날부터, 힌트 못 씀 → ⭐3, XP 없음)
      for (
        let i = 0;
        i < student.codeReviews && budget >= TIME.codeReview;
        i++
      ) {
        const target = quests.find(
          (q) =>
            q.type !== 'quiz' &&
            (prog.get(q.id)?.best ?? 3) < 3 &&
            prog.get(q.id)!.judgedOn < day,
        );
        if (!target) break;
        const p = prog.get(target.id)!;
        gainStars(target.id, p.best, 3);
        Object.assign(p, { best: 3, judgedOn: day, attempts: p.attempts + 1 });
        budget -= TIME.codeReview;
        today.review++;
      }

      // 새 퀘스트 (순서대로, 남은 분을 쌓아 긴 퀘스트도 끝냄)
      credit += Math.max(0, budget);
      while (next < quests.length) {
        const q = quests[next];
        if (prog.has(q.id)) {
          next++;
          continue;
        }
        const cost =
          q.type === 'quiz'
            ? TIME.quiz
            : q.type === 'project'
              ? TIME.project
              : TIME.code;
        if (credit < cost) break;
        credit -= cost;
        next++;
        if (q.type === 'quiz') {
          budget = 99; // 이미 credit 에서 뺌
          finishQuiz(q);
          continue;
        }
        const hints = HINT_CYCLE[codeDone++ % HINT_CYCLE.length];
        const stars = codeQuestStars(hints, false);
        xp += calculateXP(q.base, hints);
        coins.quest += COIN_RULES.quest;
        gainStars(q.id, 0, stars);
        prog.set(q.id, {
          best: stars,
          judgedOn: day,
          attempts: 1,
          hints,
          error: hints > 0,
          correctAtTwoPlus: false,
        });
        today.quest++;
        if (hints === 0) today.noHint++;
      }
      if (next >= quests.length) {
        credit = 0;
        if (result.world1Day === null) result.world1Day = day;
      }
      if (today.quest || today.review || today.quizCorrect) learnDays.add(day);

      settle(day);
      // 미션 받기 (하루 끝에): 코인 + XP 15 + 레벨 업 코인
      const count: Record<string, number> = {
        quest_clear: today.quest,
        no_hint: today.noHint,
        review: today.review,
        daily_quiz: today.dailyQuiz,
        quiz_correct: today.quizCorrect,
      };
      for (const m of assigned) {
        const target =
          m.kind === 'daily_quiz' ? Math.max(picks.length, 1) : m.target;
        if (count[m.kind] < target) continue;
        coins.mission += coinReward('mission', m.difficulty);
        xp += missionXp;
        missionsClaimed++;
        result.missions.done[m.id] = (result.missions.done[m.id] ?? 0) + 1;
      }
      settle(day);
    }
    const sum = (t: QuestDef['type'][]) =>
      quests
        .filter((q) => t.includes(q.type))
        .reduce((n, q) => n + (prog.get(q.id)?.best ?? 0), 0);
    result.rows.push({
      day,
      xp,
      level: calculateLevel(xp),
      coins: { ...coins },
      quizStars: sum(['quiz']),
      codeStars: sum(['code', 'project']),
    });
  }
  return result;
}

function longestRun(days: Set<number>): number {
  let best = 0;
  for (const d of days) {
    if (days.has(d - 1)) continue;
    let n = 1;
    while (days.has(d + n)) n++;
    best = Math.max(best, n);
  }
  return best;
}

export const total = (c: Record<Source, number>) =>
  SOURCES.reduce((n, s) => n + c[s], 0);

/** 처음 잔액이 price 이상인 날 (쓰지 않는다고 할 때) */
export function daysToPrice(r: EconomyResult, price: number): number | null {
  return r.rows.find((row) => total(row.coins) >= price)?.day ?? null;
}

/** 소급 보상(00037): Phase 8 전에 스테이지 1..n 을 모두(퀴즈 포함) 끝낸 기존 사용자 */
export function retroCoins(stageCount: number, stages = world1Stages()) {
  const r = simulateEconomy(
    {
      id: 'retro',
      name: '소급',
      activeDow: [0],
      minutes: 10_000,
      codeReviews: 0,
    },
    {
      days: 1,
      missionXp: 0,
      stages: stages.slice(0, stageCount),
      questsTotal: stages
        .flatMap((s) => s.quests)
        .filter((q) => q.type !== 'quiz').length,
    },
  );
  const c = r.rows[0].coins;
  // 00037 은 퀘스트·별·레벨 업만 바로 넣고, 업적은 "받기 가능"으로 남김 (상자는 직접 열어야 함)
  return {
    auto: c.quest + c.star + c.level_up,
    claimable: c.achievement - achievementsNotRetro(r),
    chests: c.chest,
    level: r.rows[0].level,
  };
}

/** 소급 시점엔 출석·미션 기록이 없어 그 업적은 안 생김 — 모델의 출석 1회로 생긴 것은 뺌 */
function achievementsNotRetro(r: EconomyResult): number {
  const habit = new Set([
    'attend_7',
    'attend_30',
    'mission_1',
    'mission_10',
    'mission_50',
    'chest_1',
    'chest_5',
    'streak_3',
    'streak_7',
    'streak_30',
  ]);
  return r.achievements
    .filter((a) => habit.has(a.id))
    .reduce((n, a) => n + a.coins, 0);
}

// ---------------- 출력 ----------------

const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
const dayLabel = (d: number | null) => (d === null ? '180+' : `${d + 1}일`);

function main() {
  const days = 180;
  const runs = STUDENTS.map((s) => simulateEconomy(s, { days }));
  const noMissionXp = STUDENTS.map((s) =>
    simulateEconomy(s, { days, missionXp: 0 }),
  );
  const at = (r: EconomyResult, d: number) =>
    r.rows[Math.min(d, r.rows.length - 1)];
  const out: string[] = [];
  const p = (...l: string[]) => out.push(...l);

  p(
    '### 3.2 레벨·XP',
    '',
    '| 유형 | 1월드 끝(일째) | 그때 Lv (미션 XP 없으면) | 그때 미션 XP | 30일 Lv | 90일 Lv | 180일 Lv · XP |',
    '|---|---|---|---|---|---|---|',
  );
  runs.forEach((r, i) => {
    const w = r.world1Day;
    const noM = noMissionXp[i];
    const lvAt = (x: EconomyResult) => (w === null ? '-' : at(x, w).level);
    const mxp = w === null ? '-' : at(r, w).xp - at(noM, w).xp;
    p(
      `| ${r.student.name} | ${w === null ? '180일 안에 못 끝냄' : w + 1} | ${lvAt(r)} (${lvAt(noM)}) | ${mxp} | ${at(r, 29).level} | ${at(r, 89).level} | ${at(r, 179).level} · ${at(r, 179).xp} |`,
    );
  });

  p('', '### 3.3 코인 원천 (누적)', '');
  for (const d of [29, 89, 179]) {
    p(
      `**${d + 1}일째**`,
      '',
      `| 유형 | 합계 | ${SOURCES.join(' | ')} | 학습 비중 | 출석 비중 |`,
      `|---|---|${SOURCES.map(() => '---|').join('')}---|---|`,
    );
    for (const r of runs) {
      const c = at(r, d).coins;
      const t = total(c);
      p(
        `| ${r.student.name} | ${t} | ${SOURCES.map((s) => c[s]).join(' | ')} | ${pct(t - c.attendance, t)} | ${pct(c.attendance, t)} |`,
      );
    }
    p('');
  }

  p(
    '### 3.4 첫 구매까지 걸리는 날 (모으기만 할 때, 일째)',
    '',
    `| 유형 | 1일째 잔액 | 7일째 | ${SHOP.map((s) => `${s.name} ${s.price}`).join(' | ')} |`,
    `|---|---|---|${SHOP.map(() => '---|').join('')}`,
  );
  for (const r of runs)
    p(
      `| ${r.student.name} | ${total(at(r, 0).coins)} | ${total(at(r, 6).coins)} | ${SHOP.map((s) => dayLabel(daysToPrice(r, s.price))).join(' | ')} |`,
    );

  p(
    '',
    '### 3.5 1월드 끝 이후 정체 구간 (콘텐츠 없음, 153~180일 4주 평균)',
    '',
    '| 유형 | 주당 코인 | 그중 출석 | 그중 미션 | 주당 XP |',
    '|---|---|---|---|---|',
  );
  for (const r of runs) {
    if (r.world1Day === null || r.world1Day > 150) {
      p(`| ${r.student.name} | (아직 1월드 중) | | | |`);
      continue;
    }
    const a = at(r, 151);
    const b = at(r, 179);
    const wk = (x: number) => Math.round((x * 7) / 28);
    p(
      `| ${r.student.name} | ${wk(total(b.coins) - total(a.coins))} | ${wk(b.coins.attendance - a.coins.attendance)} | ${wk(b.coins.mission - a.coins.mission)} | ${wk(b.xp - a.xp)} |`,
    );
  }

  p(
    '',
    '### 3.6 별 채움 속도 (퀴즈 / 코드, 최대 대비)',
    '',
    '| 유형 | 7일 | 30일 | 90일 | 180일 | 퀴즈 ⭐ 모두 3 | 코드 ⭐ 모두 3 |',
    '|---|---|---|---|---|---|---|',
  );
  for (const r of runs) {
    const cell = (d: number) =>
      `${pct(at(r, d).quizStars, r.maxQuizStars)} / ${pct(at(r, d).codeStars, r.maxCodeStars)}`;
    const full = (k: 'quizStars' | 'codeStars', max: number) =>
      dayLabel(r.rows.find((x) => x[k] === max)?.day ?? null);
    p(
      `| ${r.student.name} | ${cell(6)} | ${cell(29)} | ${cell(89)} | ${cell(179)} | ${full('quizStars', r.maxQuizStars)} | ${full('codeStars', r.maxCodeStars)} |`,
    );
  }

  p(
    '',
    '### 3.7 보물상자 연 날 · 스테이지 별 100% 된 날 (일째, 스테이지 1~7)',
    '',
    '| 유형 | 상자 | 100% |',
    '|---|---|---|',
  );
  for (const r of runs) {
    const list = (rec: Record<number, number>) =>
      [1, 2, 3, 4, 5, 6, 7]
        .map((s) => (s in rec ? rec[s] + 1 : '-'))
        .join(' · ');
    p(`| ${r.student.name} | ${list(r.chestDays)} | ${list(r.perfectDays)} |`);
  }

  p(
    '',
    '### 3.8 업적 (41종 중 얻은 수 · 업적 코인)',
    '',
    '| 유형 | 7일 | 30일 | 90일 | 180일 | 180일에 못 얻은 것 |',
    '|---|---|---|---|---|---|',
  );
  for (const r of runs) {
    const by = (d: number) => {
      const got = r.achievements.filter((a) => a.day <= d);
      return `${got.length} · ${got.reduce((n, a) => n + a.coins, 0)}`;
    };
    const missing = loadAchievements()
      .filter((a) => !r.achievements.some((x) => x.id === a.id))
      .map((a) => a.id);
    p(
      `| ${r.student.name} | ${by(6)} | ${by(29)} | ${by(89)} | ${by(179)} | ${missing.join(', ')} |`,
    );
  }

  p(
    '',
    '### 3.9 데일리 미션 달성률 (180일, 달성 / 배정)',
    '',
    `| 유형 | ${loadMissions()
      .map((m) => m.id)
      .join(' | ')} |`,
    `|---|${loadMissions()
      .map(() => '---|')
      .join('')}`,
  );
  for (const r of runs)
    p(
      `| ${r.student.name} | ${loadMissions()
        .map(
          (m) =>
            `${r.missions.done[m.id] ?? 0}/${r.missions.assigned[m.id] ?? 0}`,
        )
        .join(' | ')} |`,
    );

  p('', '### 3.10 잔액 그래프 (0~180일, 쓰지 않을 때)', '', '```');
  const max = Math.max(...runs.map((r) => total(at(r, 179).coins)));
  const H = 10;
  const marks = ['L', 'N', 'E', 'W'];
  const cols = 36;
  const grid = Array.from({ length: H }, () => Array<string>(cols).fill(' '));
  runs.forEach((r, i) => {
    for (let c = 0; c < cols; c++) {
      const y = Math.round((total(at(r, c * 5 + 4).coins) / max) * (H - 1));
      grid[H - 1 - y][c] = marks[i];
    }
  });
  grid.forEach((row, i) =>
    p(
      `${String(Math.round((max * (H - 1 - i)) / (H - 1))).padStart(5)} |${row.join('')}`,
    ),
  );
  p(
    `      +${'-'.repeat(cols)}`,
    `       0일${' '.repeat(cols - 9)}180일`,
    'L 가벼움 · N 보통 · E 열심 · W 몰아서 (겹치면 뒤 유형)',
    '```',
  );

  p(
    '',
    '### 3.11 소급 보상 (00037) 받은 기존 사용자의 시작 잔액 ("보통" 실력 가정)',
    '',
    '| Phase 8 전 진행 | 바로 들어온 코인 | 받기 가능 업적 코인 | 열 수 있는 상자 코인 | 레벨 |',
    '|---|---|---|---|---|',
  );
  for (const n of [1, 3, 6, 7]) {
    const x = retroCoins(n);
    p(
      `| 스테이지 1~${n} | ${x.auto} | ${x.claimable} | ${x.chests} | ${x.level} |`,
    );
  }
  console.log(out.join('\n'));
}

if (require.main === module) main();
