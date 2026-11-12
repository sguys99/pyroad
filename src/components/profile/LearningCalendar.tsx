'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { IconButton } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import {
  buildCalendarMonth,
  calendarMonths,
  type CalendarCell,
} from '@/lib/profile/profileStats';
import type { KstDateKey } from '@/lib/time/kst';
import './profile.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export interface LearningCalendarProps {
  /** KST 오늘 (서버가 정해 넘김 — 하이드레이션이 같게) */
  today: KstDateKey;
  /** KST 날짜 → 그날 푼 퀘스트 수 */
  days: Record<KstDateKey, number>;
  shieldDays: readonly KstDateKey[];
  stampDays: readonly KstDateKey[];
}

function Day({ cell }: { cell: CalendarCell }) {
  return (
    <span
      className="pf-day"
      data-level={cell.level || undefined}
      data-shield={cell.shield || undefined}
      data-today={cell.today || undefined}
      data-future={cell.future || undefined}
      data-testid={`cal-${cell.key}`}
    >
      <span className="sr-only">{cell.label}</span>
      <span aria-hidden>{cell.day}</span>
      {cell.shield && (
        <RewardIcon kind="shield" size={16} className="pf-day-shield" />
      )}
      {cell.stamp && <span aria-hidden className="pf-day-stamp" />}
    </span>
  );
}

/**
 * 학습 달력 (P8-13): 한 달씩, 이전·다음 달(첫 기록 달 ~ 이번 달, 최대 12개월). 공부한 날은 초록 원(그날 푼 퀘스트 수만큼 진하게),
 * 방패로 지킨 날은 방패, 출석 도장은 아래 금색 점. 칸마다 낭독 "11월 12일, 퀘스트 3개"
 */
export function LearningCalendar({
  today,
  days,
  shieldDays,
  stampDays,
}: LearningCalendarProps) {
  const months = useMemo(
    () =>
      calendarMonths(today, [
        ...Object.keys(days),
        ...shieldDays,
        ...stampDays,
      ]),
    [today, days, shieldDays, stampDays],
  );
  const [i, setI] = useState(months.length - 1);
  const month = useMemo(
    () =>
      buildCalendarMonth(
        months[i],
        {
          days,
          shieldDays: new Set(shieldDays),
          stampDays: new Set(stampDays),
        },
        today,
      ),
    [months, i, days, shieldDays, stampDays, today],
  );
  const titleId = `cal-${month.month}`;

  return (
    <div className="grid gap-3" data-testid="learning-calendar">
      <div className="pf-cal-nav">
        <IconButton
          size="sm"
          label="이전 달"
          disabled={i === 0}
          onClick={() => setI((n) => Math.max(0, n - 1))}
        >
          <ChevronLeft aria-hidden />
        </IconButton>
        <p
          id={titleId}
          className="pf-cal-title font-display"
          aria-live="polite"
        >
          {month.title}
        </p>
        <IconButton
          size="sm"
          label="다음 달"
          disabled={i === months.length - 1}
          onClick={() => setI((n) => Math.min(months.length - 1, n + 1))}
        >
          <ChevronRight aria-hidden />
        </IconButton>
      </div>

      <table className="pf-cal" aria-labelledby={titleId}>
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th key={w} scope="col">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {month.weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((cell, di) => (
                <td key={di}>{cell && <Day cell={cell} />}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="pf-cal-sum" data-testid="calendar-summary">
        {month.learnedDays > 0 ? (
          <>
            이 달에 <b>{month.learnedDays}일</b> 공부하고 퀘스트{' '}
            <b>{month.solved}개</b>를 풀었어요
          </>
        ) : (
          '이 달에는 아직 공부한 날이 없어요. 오늘 하나 풀어 볼까요?'
        )}
      </p>
      <ul className="pf-legend" aria-label="달력 보는 법">
        <li>
          적게
          {([1, 2, 3] as const).map((l) => (
            <span key={l} className="pf-day" data-level={l} aria-hidden />
          ))}
          많이
        </li>
        <li>
          <RewardIcon kind="shield" size={16} />
          방패로 지킨 날
        </li>
        <li>
          <span className="pf-day-stamp" aria-hidden />
          출석 도장
        </li>
      </ul>
    </div>
  );
}
