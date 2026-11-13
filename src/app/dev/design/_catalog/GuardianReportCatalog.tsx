'use client';

import {
  GuardianReportGoneView,
  GuardianReportView,
} from '@/components/guardian-report/GuardianReportView';
import { GuardianReportLinkCard } from '@/components/guardian-report/GuardianReportSection';
import type { GuardianReport } from '@/lib/guardian-report/report';
import { Section } from './ui';

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAA';

const day = (date: string, quests: number, stamp = false, future = false) => ({
  date,
  quests,
  stamp,
  future,
});

/** `guardian_report` RPC 반환 모양 그대로 (이번 주 목요일까지) */
const SAMPLE: GuardianReport = {
  nickname: '코딩하는다람쥐',
  skin: 'sky',
  level: 6,
  week: { start: '2026-11-09', end: '2026-11-15', offset: 0 },
  days: [
    day('2026-11-09', 3, true),
    day('2026-11-10', 0),
    day('2026-11-11', 5, true),
    day('2026-11-12', 1, true),
    day('2026-11-13', 0, false),
    day('2026-11-14', 0, false, true),
    day('2026-11-15', 0, false, true),
  ],
  totals: { quests: 6, xp: 240, stars: 15, active_days: 3, stamps: 3 },
  learned: [
    { stage: '파이썬 마을 입구', title: '줄 바꾸기 마법', concept: '이스케이프 문자 \\n' },
    { stage: '파이썬 마을 입구', title: '숫자도 출력해요', concept: 'print()로 숫자 출력' },
    { stage: '변수 숲', title: '이름표 붙이기', concept: '변수 만들기' },
  ],
  bosses: [{ title: '출력 대장 버그버그', stars: 2 }],
  streak: 2,
  next: { stage: '변수 숲', title: '상자 바꿔치기' },
};

const EMPTY: GuardianReport = {
  ...SAMPLE,
  week: { start: '2026-11-02', end: '2026-11-08', offset: 1 },
  days: SAMPLE.days.map((d, i) => day(`2026-11-0${i + 2}`, 0)),
  totals: { quests: 0, xp: 0, stars: 0, active_days: 0, stamps: 0 },
  learned: [],
  bosses: [],
  streak: 0,
  next: null,
};

/**
 * 보호자 주간 리포트 (P9-15) 견본: 설정 칸 상태 4가지 + 리포트 페이지(있음 · 지난 주 기록 없음 · 열 수 없음).
 * 요청 없이 흉내 (버튼은 아무 일도 하지 않음)
 */
export function GuardianReportCatalogSection() {
  const created = new Date().toISOString();
  return (
    <Section
      id="guardian-report"
      kicker="P9-15"
      title="보호자 리포트"
      description="학생이 설정에서 만드는 비밀 링크 → 보호자가 로그인 없이 보는 주간 리포트. 요일별 학습은 여기에만(공개 주간 카드는 합계만, §12-Q67 ②). 어른용 존댓말, 인쇄하면 버튼·주 고르기는 숨김"
    >
      <h3 className="font-display text-h3">설정 칸 &ldquo;보호자에게 보여 주기&rdquo;</h3>
      <p className="text-small text-muted-foreground">
        꺼짐 · 방금 만듦(링크는 이때만 보임, 원문은 DB에 없음) · 켜짐(새 링크 만들기·끄기 = 확인 대화 상자) · 보호자 동의 전(만들기 막힘)
      </p>
      <div className="grid max-w-lg gap-2" data-testid="guardian-link-samples">
        <GuardianReportLinkCard state={{ active: false, createdAt: null }} />
        <GuardianReportLinkCard
          state={{ active: true, createdAt: created }}
          link={`https://pyroad.vercel.app/guardian/${TOKEN}`}
          message="새 링크를 만들었어요!"
        />
        <GuardianReportLinkCard state={{ active: true, createdAt: created }} />
        <GuardianReportLinkCard
          state={{ active: false, createdAt: null }}
          restricted
        />
      </div>
      <h3 className="mt-8 font-display text-h3">리포트 /guardian/[token]</h3>
      <div className="grid gap-4">
        <div className="overflow-hidden rounded-2xl ring-1 ring-line">
          <GuardianReportView report={SAMPLE} token={TOKEN} />
        </div>
        <div className="overflow-hidden rounded-2xl ring-1 ring-line">
          <GuardianReportView report={EMPTY} token={TOKEN} />
        </div>
        <div className="overflow-hidden rounded-2xl ring-1 ring-line">
          <GuardianReportGoneView />
        </div>
      </div>
    </Section>
  );
}
