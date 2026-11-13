import Link from 'next/link';
import {
  CalendarCheck,
  CalendarDays,
  Flame,
  Lightbulb,
  Map as MapIcon,
  Star,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { PybaemStatic } from '@/components/characters/rig';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { cn } from '@/lib/utils';
import {
  barRatios,
  monthDay,
  reportSummary,
  weekRange,
  weekdayLabel,
  type GuardianReport,
} from '@/lib/guardian-report/report';
import { GuardianReportActions } from './GuardianReportActions';

/** 로고 줄 (공유 페이지와 같은 모양) */
function ReportHeader() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-gutter py-4">
      <Link
        href="/"
        className="inline-flex min-h-touch items-center font-display text-h2 text-primary-text"
      >
        pyRoad
      </Link>
      <span className="text-caption text-muted-foreground">
        보호자용 학습 리포트
      </span>
    </header>
  );
}

function Panel({
  title,
  icon,
  children,
  className,
  testId,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      className={cn(
        'grid content-start gap-4 rounded-2xl bg-card p-5 shadow-card print:break-inside-avoid print:shadow-none print:ring-1 print:ring-line',
        className,
      )}
      data-surface="raised"
      data-testid={testId}
    >
      <h2 className="flex items-center gap-2 text-h3 font-bold text-foreground">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary-text [&>svg]:size-4"
        >
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit: string;
}) {
  return (
    <div className="grid gap-1 rounded-2xl bg-card p-4 shadow-card print:shadow-none print:ring-1 print:ring-line">
      <dt className="flex items-center gap-1.5 text-small text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0">
        {icon}
        {label}
      </dt>
      <dd className="font-display text-h1 text-foreground">
        {value}
        <span className="ml-1 font-sans text-small text-muted-foreground">
          {unit}
        </span>
      </dd>
    </div>
  );
}

/** 요일별 학습: 막대 = 그날 푼 퀘스트 수(새로 끝냄·복습·퀴즈 포함, 학습 달력과 같은 셈), 점 = 출석 도장 */
function DailyBars({ report }: { report: GuardianReport }) {
  const ratios = barRatios(report);
  return (
    <>
      <ol
        className="grid grid-cols-7 gap-1.5 sm:gap-3"
        data-testid="guardian-days"
      >
        {report.days.map((day, i) => {
          const label = weekdayLabel(i);
          const text = day.future
            ? `${label}요일 ${monthDay(day.date)}: 아직 오지 않은 날`
            : `${label}요일 ${monthDay(day.date)}: 퀘스트 ${day.quests}개${day.stamp ? ', 출석' : ''}`;
          return (
            <li
              key={day.date}
              aria-label={text}
              className="grid justify-items-center gap-1.5"
              data-quests={day.quests}
              data-future={day.future || undefined}
            >
              <span
                aria-hidden
                className={cn(
                  'text-small font-bold',
                  day.quests > 0 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {day.future ? '\u00a0' : day.quests}
              </span>
              <span
                aria-hidden
                className={cn(
                  'flex h-28 w-full max-w-12 items-end overflow-hidden rounded-lg sm:h-36',
                  day.future
                    ? 'border-2 border-dashed border-line'
                    : 'bg-surface-2',
                )}
              >
                {!day.future && day.quests > 0 && (
                  <span
                    className="w-full rounded-lg bg-primary print:bg-primary-text"
                    style={{ height: `${Math.max(8, ratios[i] * 100)}%` }}
                  />
                )}
              </span>
              <span aria-hidden className="grid justify-items-center">
                <span className="text-small font-bold text-foreground">
                  {label}
                </span>
                <span className="text-caption text-muted-foreground">
                  {day.date.slice(5).replace('-', '.').replace(/^0/, '')}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'size-2.5 rounded-full',
                  day.stamp ? 'bg-accent' : 'bg-transparent',
                )}
              />
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-primary" />
          그날 푼 퀘스트 수(복습·퀴즈 포함)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          출석 도장
        </span>
      </p>
    </>
  );
}

function WeekTabs({ token, offset }: { token: string; offset: 0 | 1 }) {
  const tabs = [
    { label: '이번 주', href: `/guardian/${token}`, on: offset === 0 },
    {
      label: '지난 주',
      href: `/guardian/${token}?week=last`,
      on: offset === 1,
    },
  ];
  return (
    <nav
      aria-label="주 고르기"
      className="flex w-full rounded-full bg-surface-2 p-1 sm:w-fit print:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          aria-current={t.on ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-10 flex-1 items-center justify-center rounded-full px-4 text-small font-bold',
            t.on
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          data-testid={t.on ? 'guardian-week-current' : 'guardian-week-other'}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * 보호자 주간 리포트 본문 (P9-15). 어른에게 하는 존댓말(아이 화면과 말투를 나눔), 학습 기록의 집계만.
 * 360: 한 줄로 쌓음 · 768+: 숫자 4칸·두 열. 인쇄하면 주 고르기·버튼은 숨고 카드 그림자 대신 테두리
 */
export function GuardianReportView({
  report,
  token,
}: {
  report: GuardianReport;
  token: string;
}) {
  const name = report.nickname ?? '모험가';
  const { totals } = report;
  return (
    <div className="min-h-dvh bg-background font-sans print:bg-card">
      <ReportHeader />
      <main className="mx-auto grid w-full max-w-3xl gap-5 px-gutter pb-12">
        <section
          aria-labelledby="guardian-title"
          className="flex flex-wrap items-center gap-4"
        >
          <UserAvatar skin={report.skin} size={64} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="text-kicker text-primary-text">주간 학습 리포트</p>
            <h1
              id="guardian-title"
              className="font-display text-h1 text-balance break-keep text-foreground"
            >
              {name} 학생의 한 주
            </h1>
            <p className="text-small text-muted-foreground">
              {weekRange(report)}
              {report.level !== null && ` · 레벨 ${report.level}`}
            </p>
          </div>
          <WeekTabs token={token} offset={report.week.offset} />
        </section>

        <p
          className="rounded-2xl bg-primary-soft px-5 py-4 text-body text-pretty text-foreground"
          data-testid="guardian-summary"
        >
          {reportSummary(report)}
        </p>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon={<CalendarCheck aria-hidden />}
            label="공부한 날"
            value={totals.active_days}
            unit="/ 7일"
          />
          <Stat
            icon={<Trophy aria-hidden />}
            label="새로 마친 퀘스트"
            value={totals.quests}
            unit="개"
          />
          <Stat
            icon={<Star aria-hidden />}
            label="모은 별"
            value={totals.stars}
            unit="개"
          />
          <Stat
            icon={<Zap aria-hidden />}
            label="얻은 경험치"
            value={totals.xp}
            unit="XP"
          />
        </dl>

        <Panel
          title="요일별 학습"
          icon={<CalendarDays />}
          testId="guardian-daily"
        >
          <DailyBars report={report} />
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel
            title="새로 익힌 내용"
            icon={<Lightbulb />}
            testId="guardian-learned"
          >
            {report.learned.length === 0 ? (
              <p className="text-small text-muted-foreground">
                이 주에 새로 마친 퀘스트가 없습니다.
              </p>
            ) : (
              <ul className="grid gap-3">
                {report.learned.map((l, i) => (
                  <li key={`${l.title}-${i}`} className="grid gap-0.5">
                    <span className="text-body font-bold text-foreground">
                      {l.concept}
                    </span>
                    <span className="text-small text-muted-foreground">
                      {l.stage} · {l.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="꾸준함과 도전" icon={<Flame />}>
            <ul className="grid gap-3 text-body text-foreground">
              <li className="flex items-center justify-between gap-3">
                <span>지금 이어 가는 연속 학습</span>
                <strong>{report.streak}일</strong>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>이 주의 출석 도장</span>
                <strong>{totals.stamps}번</strong>
              </li>
            </ul>
            <div className="grid gap-2 border-t border-line pt-3">
              <p className="flex items-center gap-1.5 text-small font-bold text-foreground [&>svg]:size-4">
                <Swords aria-hidden />
                보스 관문
              </p>
              {report.bosses.length === 0 ? (
                <p className="text-small text-muted-foreground">
                  이 주에 새로 통과한 보스 관문이 없습니다. 보스는 스테이지
                  마지막에 배운 내용을 연달아 확인하는 문제입니다.
                </p>
              ) : (
                <ul className="grid gap-1.5" data-testid="guardian-bosses">
                  {report.bosses.map((b, i) => (
                    <li
                      key={`${b.title}-${i}`}
                      className="flex items-center justify-between gap-3 text-small text-foreground"
                    >
                      <span>{b.title} 통과</span>
                      <span className="text-muted-foreground">
                        별 {b.stars}개
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>

        <Panel title="다음에 할 것" icon={<MapIcon />} testId="guardian-next">
          <div className="flex items-center gap-4">
            <PybaemStatic
              state="wave"
              size={64}
              framing="avatar"
              label=""
              className="hidden shrink-0 sm:block print:hidden"
            />
            <div className="grid gap-1">
              {report.next ? (
                <p className="text-body text-foreground">
                  다음 퀘스트는{' '}
                  <strong>
                    {report.next.stage} · {report.next.title}
                  </strong>
                  입니다.
                </p>
              ) : (
                <p className="text-body text-foreground">
                  지금 열린 퀘스트를 모두 마쳤습니다. 새 퀘스트가 열리면 이어서
                  할 수 있습니다.
                </p>
              )}
              <p className="text-small text-pretty text-muted-foreground">
                오늘 배운 내용을 아이가 직접 설명해 보게 하면 더 오래
                기억합니다. 결과보다 꾸준히 한 날을 칭찬해 주세요.
              </p>
            </div>
          </div>
        </Panel>

        <footer className="grid gap-3 border-t border-line pt-4">
          <p className="text-caption text-pretty text-muted-foreground">
            이 페이지는 {name} 학생이 보호자께 보여 드리려고 만든 비공개
            링크입니다. 링크를 아는 사람만 볼 수 있고, 학생의 코드·질문 내용은
            담지 않습니다. 학생이 설정에서 링크를 다시 만들거나 끄면 이 주소는
            더 이상 열리지 않습니다.
          </p>
          <GuardianReportActions offset={report.week.offset} />
        </footer>
      </main>
    </div>
  );
}

/** 없음·꺼짐·다시 만들어 무효 (404). 학생 정보는 하나도 보이지 않는다 */
export function GuardianReportGoneView() {
  return (
    <div className="min-h-dvh bg-background font-sans">
      <ReportHeader />
      <main className="mx-auto grid w-full max-w-md gap-4 px-gutter pt-4 pb-12 text-center">
        <PybaemStatic
          state="think"
          size={120}
          framing="avatar"
          label=""
          className="mx-auto"
        />
        <h1 className="font-display text-h1 text-balance text-foreground">
          이 리포트 링크는 열 수 없습니다
        </h1>
        <p className="text-body text-pretty text-muted-foreground">
          학생이 링크를 끄거나 새로 만들었을 수 있습니다. 학생에게 설정 →
          &lsquo;보호자에게 보여 주기&rsquo;에서 새 링크를 받아 주세요.
        </p>
      </main>
    </div>
  );
}
