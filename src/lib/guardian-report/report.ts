import { z } from 'zod';

/**
 * 보호자 주간 리포트 (P9-15, §12-Q67 ②). 학생이 설정에서 만든 비공개 링크 `/guardian/{token}`으로 보호자가 로그인 없이 본다.
 * 공개 주간 카드(P9-07)는 합계만, 요일별 학습은 여기에만. 자료는 service_role `guardian_report`(00050)의 집계뿐 —
 * 학생 코드·질문·튜터 대화·실명·이메일은 오지 않는다.
 */

/** 링크 토큰: 128비트 난수 base64url 22자 (DB 에는 sha256 만) */
export const GUARDIAN_TOKEN = /^[A-Za-z0-9_-]{22}$/;

export const GUARDIAN_REPORT_PATH = '/guardian';
export const guardianReportPath = (token: string) =>
  `${GUARDIAN_REPORT_PATH}/${token}`;

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const COUNT = z.number().int().min(0);

export const guardianReportSchema = z.object({
  nickname: z.string().nullable(),
  skin: z.string().nullable(),
  level: z.number().int().nullable(),
  week: z.object({
    start: DATE,
    end: DATE,
    offset: z.union([z.literal(0), z.literal(1)]),
  }),
  days: z
    .array(
      z.object({
        date: DATE,
        quests: COUNT,
        stamp: z.boolean(),
        future: z.boolean(),
      }),
    )
    .length(7),
  totals: z.object({
    quests: COUNT,
    xp: COUNT,
    stars: COUNT,
    active_days: COUNT,
    stamps: COUNT,
  }),
  learned: z.array(
    z.object({ stage: z.string(), title: z.string(), concept: z.string() }),
  ),
  bosses: z.array(z.object({ title: z.string(), stars: COUNT })),
  streak: COUNT,
  next: z.object({ stage: z.string(), title: z.string() }).nullable(),
});

export type GuardianReport = z.infer<typeof guardianReportSchema>;

/** `?week=last` 만 지난 주, 나머지는 모두 이번 주 (쿼리 글자는 화면에 그리지 않음) */
export function weekOffset(param: unknown): 0 | 1 {
  return param === 'last' ? 1 : 0;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** 요일 이름 (days 는 월요일부터 7칸) */
export const weekdayLabel = (index: number) => WEEKDAYS[index] ?? '';

/** '2026-11-09' → '11월 9일' */
export function monthDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** 주 범위 '11월 9일(월) ~ 11월 15일(일)' */
export function weekRange(report: Pick<GuardianReport, 'week'>): string {
  return `${monthDay(report.week.start)}(월) ~ ${monthDay(report.week.end)}(일)`;
}

/**
 * 보호자용 한 줄 요약 (어른에게 하는 존댓말 — 아이 화면 말투와 구분). 이번 주는 아직 지나지 않은 날이 있으니 "지금까지"
 */
export function reportSummary(report: GuardianReport): string {
  const { active_days, quests } = report.totals;
  const when =
    report.week.offset === 0 ? '이번 주에는 지금까지' : '지난 주에는';
  if (active_days === 0)
    return report.week.offset === 0
      ? '이번 주에는 아직 학습 기록이 없습니다. 짧게라도 함께 시작해 보도록 응원해 주세요.'
      : '지난 주에는 학습 기록이 없습니다.';
  if (quests === 0)
    return `${when} ${active_days}일 동안 복습과 퀴즈로 공부했습니다.`;
  return `${when} ${active_days}일 동안 공부하며 새 퀘스트 ${quests}개를 마쳤습니다.`;
}

/** 요일 막대 높이 비율(0~1). 가장 많이 푼 날 = 1, 기준은 최소 3개(하루 1개가 꽉 찬 막대로 보이지 않게) */
export function barRatios(report: Pick<GuardianReport, 'days'>): number[] {
  const max = Math.max(3, ...report.days.map((d) => d.quests));
  return report.days.map((d) => d.quests / max);
}
