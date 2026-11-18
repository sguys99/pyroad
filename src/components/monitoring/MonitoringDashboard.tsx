import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import {
  BarList,
  MonSection,
  RangeLinks,
  StatTile,
  StatusChip,
  TileGrid,
  type Status,
} from '@/components/monitoring/MonitoringParts';
import {
  MOTION_DOWNGRADE_LIMIT,
  MOTION_REVERT_LIMIT,
  SMALL_SAMPLE,
  alertsOf,
  num,
  pct,
  ratio,
  type MonitoringSummary,
} from '@/lib/monitoring/metrics';

/**
 * 운영 지표 본문 (P12-09). `/admin` 과 `/dev/design` 카탈로그(견본 값)가 같이 씀. 데이터 정의는 docs/monitoring.md
 */

const RANGE_OPTIONS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '7일' },
  { days: 28, label: '28일' },
];

const TUTOR_LABEL: Record<string, string> = {
  hint_generator: '힌트',
  quest_intro: '퀘스트 소개',
  code_feedback: '코드 피드백',
  encouragement: '응원',
  concept_explain: '개념 설명',
  quiz_explain: '퀴즈 오답 설명',
  free_question: '자유 질문',
  project_guide: '프로젝트 안내',
  project_planner: '기획 도우미',
  creation_feedback: '작품 평가',
  stage_summary: '스테이지 정리',
};

/** 비율 + 분모 ("45.7% · 12/26"). 분모가 작으면 "표본 적음" */
function Rate({ n, d }: { n: number; d: number }) {
  const r = ratio(n, d);
  return (
    <>
      {pct(r)}
      <small>
        {num(n)}/{num(d)}
        {d > 0 && d < SMALL_SAMPLE && ' · 표본 적음'}
      </small>
    </>
  );
}

/** 목표 대비 상태. 표본이 작으면 판정하지 않음 */
function goalStatus(
  n: number,
  d: number,
  goal: number,
): { status: Status; text: string } {
  const r = ratio(n, d);
  if (r === null) return { status: 'off', text: '데이터 없음' };
  if (d < SMALL_SAMPLE) return { status: 'off', text: '표본 적음' };
  return r >= goal
    ? { status: 'ok', text: '목표 달성' }
    : { status: 'warn', text: '목표 미달' };
}

function share(n: number, of: number) {
  return (
    <>
      {num(n)}
      <small>{pct(ratio(n, of))}</small>
    </>
  );
}

export function MonitoringDashboard({
  data: s,
  sentryUrl,
  basePath = '/admin',
}: {
  data: MonitoringSummary;
  sentryUrl: string | null;
  basePath?: string;
}) {
  const e = s.events;
  const alerts = alertsOf(s);
  const tutorRows = Object.entries(s.tutor_today).sort(
    (a, b) => b[1].allowed - a[1].allowed,
  );
  const tutorAllowed = tutorRows.reduce((a, [, t]) => a + t.allowed, 0);
  const tutorDenied = tutorRows.reduce((a, [, t]) => a + t.denied, 0);
  const savedFree = e.free_fallback + e.free_answer_blocked;
  const days = s.daily.map((d) => d.day);
  const sparkNote = `${days[0]?.slice(5) ?? ''}~${days.at(-1)?.slice(5) ?? ''}`;
  const m = s.motion;
  const downR = ratio(m.downgraded, m.client_users);
  const backR = ratio(m.back_to_full, m.downgraded);
  const hidden = s.health;
  const r = s.retention;
  const sess = s.sessions;
  const avg = sess.sessions > 0 ? sess.completes / sess.sessions : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="m-0 font-display text-h2">운영 지표</h1>
          <p className="m-0 text-small text-muted-foreground">
            {s.from === s.to ? s.to : `${s.from} ~ ${s.to}`} (한국 시간) · 익명
            합계만 · 비율 분모가 {SMALL_SAMPLE} 미만이면 “표본 적음”
          </p>
        </div>
        <RangeLinks
          current={s.days}
          options={RANGE_OPTIONS}
          basePath={basePath}
        />
      </div>

      <div className="mon">
        <MonSection title="지금 살펴볼 것" id="mon-alerts" wide>
          <ul className="mon-alerts" data-testid="mon-alerts">
            {alerts.length === 0 ? (
              <li data-status="ok">
                <CheckCircle2 aria-hidden />
                경고 기준에 걸린 것이 없어요.
              </li>
            ) : (
              alerts.map((a) => (
                <li key={a.text}>
                  <AlertTriangle aria-hidden />
                  {a.text}
                </li>
              ))
            )}
          </ul>
        </MonSection>

        <MonSection title="건강" id="mon-health" wide>
          <TileGrid>
            <StatTile
              label="코인 불일치"
              value={num(hidden.coin_mismatches)}
              status={
                hidden.coin_mismatches === 0
                  ? { status: 'ok', text: '0 정상' }
                  : { status: 'warn', text: '원장 확인' }
              }
            />
            <StatTile
              label="파기 기한 지난 계정"
              value={num(hidden.purge_overdue)}
              sub="크론 마지막 실행 결과는 수집 안 함 (Vercel 로그)"
              status={
                hidden.purge_overdue === 0
                  ? { status: 'ok', text: '0 정상' }
                  : { status: 'warn', text: '크론 확인' }
              }
            />
            <StatTile
              label="연출 자동 하향"
              value={pct(downR)}
              sub={`${num(m.downgraded)}/${num(m.client_users)}명 · 기준 ${pct(MOTION_DOWNGRADE_LIMIT)}`}
              status={motionStatus(
                downR,
                m.client_users,
                MOTION_DOWNGRADE_LIMIT,
              )}
            />
            <StatTile
              label="하향 뒤 되돌림"
              value={pct(backR)}
              sub={`${num(m.back_to_full)}/${num(m.downgraded)}명 · 기준 ${pct(MOTION_REVERT_LIMIT)}`}
              status={motionStatus(backR, m.downgraded, MOTION_REVERT_LIMIT)}
            />
            <StatTile
              label="숨김 대기"
              value={num(
                hidden.hidden_posts +
                  hidden.hidden_comments +
                  hidden.hidden_creations,
              )}
              sub={`글 ${num(hidden.hidden_posts)} · 댓글 ${num(hidden.hidden_comments)} · 작품 ${num(hidden.hidden_creations)}`}
            />
            <StatTile
              label="기간 안 신고"
              value={num(hidden.reports)}
              sub="게시판 + 작품"
            />
          </TileGrid>
        </MonSection>

        <MonSection
          title="주요 퍼널"
          id="mon-funnel"
          wide
          note="방문 → 로그인은 날짜 합계(비로그인 세션과 학생을 잇지 않음). 가입 뒤는 기간 안에 가입한 사람 단위"
        >
          <div className="grid gap-5 md:grid-cols-3">
            <div className="grid content-start gap-2">
              <p className="mon-sub">방문 → 로그인 (세션 합계)</p>
              <BarList
                caption="방문에서 로그인까지"
                rows={[
                  { label: '랜딩 방문', value: e.landing_sessions },
                  {
                    label: '로그인 버튼 누름',
                    value: e.cta_sessions,
                    text: share(e.cta_sessions, e.landing_sessions),
                  },
                  { label: '로그인 완료 (학생)', value: e.login_users },
                  {
                    label: '그중 새로 가입',
                    value: e.signups,
                    text: share(e.signups, e.landing_sessions),
                  },
                ]}
              />
            </div>
            <div className="grid content-start gap-2">
              <p className="mon-sub">가입한 계정의 온보딩</p>
              <BarList
                caption="가입 뒤 온보딩 단계"
                rows={[
                  { label: '가입한 계정', value: s.accounts.created },
                  {
                    label: '나이 확인',
                    value: s.accounts.age_checked,
                    text: share(s.accounts.age_checked, s.accounts.created),
                  },
                  {
                    label: '14세 미만 보호자 동의',
                    value: s.accounts.guardian_ok,
                    text: (
                      <>
                        {num(s.accounts.guardian_ok)}
                        <small>/ {num(s.accounts.under14)}명 중</small>
                      </>
                    ),
                  },
                  {
                    label: '온보딩 완료',
                    value: s.accounts.onboarded,
                    text: share(s.accounts.onboarded, s.accounts.created),
                  },
                ]}
              />
            </div>
            <div className="grid content-start gap-2">
              <p className="mon-sub">가입 뒤 첫 학습</p>
              <BarList
                caption="가입 뒤 첫 학습 단계"
                rows={[
                  { label: '가입 (로그인 기록)', value: s.cohort.signups },
                  {
                    label: '첫 퀘스트 시작',
                    value: s.cohort.started,
                    text: share(s.cohort.started, s.cohort.signups),
                  },
                  {
                    label: '첫 퀘스트 완료',
                    value: s.cohort.completed,
                    text: share(s.cohort.completed, s.cohort.signups),
                  },
                  {
                    label: '스테이지 하나 클리어',
                    value: s.cohort.stage_cleared,
                    text: share(s.cohort.stage_cleared, s.cohort.signups),
                  },
                ]}
              />
            </div>
          </div>
          <p className="mon-note">
            온보딩 단계는 계정 표(파기·탈퇴한 계정 빠짐), 첫 학습은 분석
            이벤트(추적 거부 브라우저 빠짐)라 “가입” 수가 다를 수 있어요.
          </p>
        </MonSection>

        <MonSection
          title="§1 성공 지표"
          id="mon-goals"
          wide
          note="출시 4주 뒤 회고(P12-14)는 28일로"
        >
          <div
            className="mon-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="성공 지표 표 (좁은 화면은 옆으로 밀어 보기)"
          >
            <table className="mon-table" data-wide>
              <caption className="sr-only">성공 지표와 목표</caption>
              <thead>
                <tr>
                  <th scope="col">지표</th>
                  <th scope="col">지금</th>
                  <th scope="col">목표</th>
                  <th scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">랜딩 → 가입</th>
                  <td className="mon-num">
                    <Rate n={e.signups} d={e.landing_sessions} />
                  </td>
                  <td>기준선 대비 +30%</td>
                  <td>
                    <StatusChip status="off">
                      기준선과 비교는 문서에서
                    </StatusChip>
                  </td>
                </tr>
                <tr>
                  <th scope="row">D1 재방문</th>
                  <td className="mon-num">
                    <Rate n={r.d1_back} d={r.d1_cohort} />
                  </td>
                  <td>40% 이상</td>
                  <td>
                    <Goal {...goalStatus(r.d1_back, r.d1_cohort, 0.4)} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">D7 재방문</th>
                  <td className="mon-num">
                    <Rate n={r.d7_back} d={r.d7_cohort} />
                  </td>
                  <td>20% 이상</td>
                  <td>
                    <Goal {...goalStatus(r.d7_back, r.d7_cohort, 0.2)} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">세션당 완료 퀘스트</th>
                  <td className="mon-num">
                    {avg === null ? '—' : avg.toFixed(2)}
                    <small>
                      세션 {num(sess.sessions)} · 3개 이상{' '}
                      {pct(ratio(sess.three_plus, sess.sessions))}
                    </small>
                  </td>
                  <td>3개 이상</td>
                  <td>
                    <Goal
                      {...(avg === null
                        ? { status: 'off' as const, text: '데이터 없음' }
                        : sess.sessions < SMALL_SAMPLE
                          ? { status: 'off' as const, text: '표본 적음' }
                          : avg >= 3
                            ? { status: 'ok' as const, text: '목표 달성' }
                            : { status: 'warn' as const, text: '목표 미달' })}
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">휴대폰·태블릿 비율</th>
                  <td className="mon-num">
                    <Rate n={e.mobile_ids} d={e.all_ids} />
                  </td>
                  <td>측정 시작</td>
                  <td>
                    <StatusChip status="off">목표 없음</StatusChip>
                  </td>
                </tr>
                <tr>
                  <th scope="row">휴대폰 퀴즈 완료율</th>
                  <td className="mon-num">
                    <Rate
                      n={s.mobile.quiz_completes}
                      d={s.mobile.quiz_starts}
                    />
                  </td>
                  <td>70% 이상</td>
                  <td>
                    <Goal
                      {...goalStatus(
                        s.mobile.quiz_completes,
                        s.mobile.quiz_starts,
                        0.7,
                      )}
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">자랑하기 사용률</th>
                  <td className="mon-num">
                    <Rate n={e.sharers} d={e.active_users} />
                  </td>
                  <td>활동 학생 15% 이상</td>
                  <td>
                    <Goal {...goalStatus(e.sharers, e.active_users, 0.15)} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Lighthouse 성능·접근성</th>
                  <td>—</td>
                  <td>80 / 90 이상</td>
                  <td>
                    <StatusChip status="off">
                      CI에서 (perf:lighthouse)
                    </StatusChip>
                  </td>
                </tr>
                <tr>
                  <th scope="row">보상 조작 경로</th>
                  <td>—</td>
                  <td>0건</td>
                  <td>
                    <StatusChip status="off">CI에서 (RLS 회귀)</StatusChip>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </MonSection>

        <MonSection
          title="튜터"
          id="mon-tutor"
          wide
          note="v1.0은 서버 AI가 꺼져 있어 학생 본인 키가 없으면 저장된 답변이 정상"
        >
          <div className="grid gap-5 md:grid-cols-3">
            <TileGrid>
              <StatTile label="힌트 받음" value={num(e.hints)} />
              <StatTile label="자유 질문" value={num(e.free_total)} />
            </TileGrid>
            <div className="grid content-start gap-2">
              <p className="mon-sub">힌트 단계</p>
              <BarList
                caption="힌트 단계 분포"
                rows={[
                  {
                    label: '1단계',
                    value: e.hints_l1,
                    text: share(e.hints_l1, e.hints),
                  },
                  {
                    label: '2단계',
                    value: e.hints_l2,
                    text: share(e.hints_l2, e.hints),
                  },
                  {
                    label: '3단계',
                    value: e.hints_l3,
                    text: share(e.hints_l3, e.hints),
                  },
                ]}
              />
            </div>
            <div className="grid content-start gap-2">
              <p className="mon-sub">자유 질문 결과</p>
              <BarList
                caption="자유 질문 결과"
                rows={[
                  {
                    label: 'AI 답',
                    value: e.free_answered,
                    text: share(e.free_answered, e.free_total),
                  },
                  {
                    label: '저장된 답변 (AI 실패·답 거름)',
                    value: savedFree,
                    text: share(savedFree, e.free_total),
                  },
                  {
                    label: '질문을 거름',
                    value: e.free_blocked,
                    text: share(e.free_blocked, e.free_total),
                  },
                  {
                    label: '힌트·설명 등 나머지 요청의 AI/저장된 답변',
                    value: null,
                  },
                ]}
              />
            </div>
          </div>
        </MonSection>

        <MonSection
          title="사용"
          id="mon-use"
          note="익명 ID 기준. 로그인 학생은 사람 단위, 비로그인은 탭 세션"
        >
          <TileGrid>
            <StatTile
              label="활동한 학생"
              value={num(e.active_users)}
              spark={{
                values: s.daily.map((d) => d.users),
                label: `날짜별 활동한 학생 ${sparkNote}`,
              }}
              sub={`날짜별 ${sparkNote}`}
            />
            <StatTile
              label="비로그인 방문 세션"
              value={num(e.visitor_sessions)}
              spark={{
                values: s.daily.map((d) => d.visitors),
                label: `날짜별 비로그인 방문 세션 ${sparkNote}`,
              }}
              sub={`날짜별 ${sparkNote}`}
            />
          </TileGrid>
        </MonSection>

        <MonSection
          title="오늘 튜터 요청"
          id="mon-tutor-today"
          note="요청 한도 카운터의 오늘(한국 시간) 합계 — 지난 날은 남지 않아 기간과 상관없이 오늘만"
        >
          {tutorRows.length === 0 ? (
            <p className="mon-note">오늘 튜터 요청이 없어요.</p>
          ) : (
            <div className="mon-table-wrap">
              <table className="mon-table">
                <caption className="sr-only">오늘 튜터 요청 유형별</caption>
                <thead>
                  <tr>
                    <th scope="col">유형</th>
                    <th scope="col">받음</th>
                    <th scope="col">한도 초과</th>
                  </tr>
                </thead>
                <tbody>
                  {tutorRows.map(([k, t]) => (
                    <tr key={k}>
                      <th scope="row">{TUTOR_LABEL[k] ?? k}</th>
                      <td className="mon-num">{num(t.allowed)}</td>
                      <td className="mon-num">{num(t.denied)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">합계</th>
                    <td className="mon-num">{num(tutorAllowed)}</td>
                    <td className="mon-num">{num(tutorDenied)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </MonSection>

        <MonSection
          title="오류"
          tail
          id="mon-errors"
          note="앱 오류는 Sentry에만 모여요 (이 화면에서는 읽지 않음)"
        >
          <TileGrid>
            <StatTile
              label="앱 오류율"
              value="—"
              status={{ status: 'off', text: '여기서는 수집 안 함' }}
            />
            <StatTile
              label="오늘 튜터 한도 초과"
              value={num(tutorDenied)}
              status={
                tutorDenied > 0
                  ? { status: 'warn', text: '살펴보기' }
                  : { status: 'ok', text: '없음' }
              }
            />
          </TileGrid>
          {sentryUrl ? (
            <a
              className="text-small font-semibold text-primary-text underline"
              href={sentryUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Sentry 이슈 열기 (지난 24시간)
            </a>
          ) : (
            <p className="mon-note">
              SENTRY_ORG 환경 변수가 없어 바로가기를 숨겼어요.
            </p>
          )}
          <ul className="mon-list">
            <li>새 이슈·급증: area 태그(tutor·quest·consent·analytics)</li>
            <li>실행기·튜터 오류가 특정 기기(device)에만 몰리는지</li>
            <li>
              <code>analytics visitor limit exceeded</code> 경고가 매일 뜨면 봇
            </li>
          </ul>
        </MonSection>
      </div>
      <p className="mon-note">
        만든 시각{' '}
        {new Date(s.generated_at).toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
        })}{' '}
        · 화면이 안 열리면 docs/monitoring.md의 SQL을 SQL Editor에서
      </p>
    </div>
  );
}

function Goal({ status, text }: { status: Status; text: string }) {
  return <StatusChip status={status}>{text}</StatusChip>;
}

function motionStatus(
  r: number | null,
  d: number,
  limit: number,
): { status: Status; text: string } {
  if (r === null) return { status: 'off', text: '데이터 없음' };
  if (d < SMALL_SAMPLE) return { status: 'off', text: '표본 적음' };
  return r > limit
    ? { status: 'warn', text: '기준 넘음' }
    : { status: 'ok', text: '기준 안' };
}
