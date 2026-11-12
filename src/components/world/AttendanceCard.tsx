'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import { useSfx } from '@/components/providers/soundContext';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { stampSlam } from '@/lib/celebration/onboardingFx';
import { coinReward } from '@/lib/quest/coins';
import { formatKstDate } from '@/lib/time/kst';
import {
  achievementEvents,
  type CelebrationEvent,
} from '@/lib/quest/celebrationEvents';
import {
  ATTENDANCE_DAYS,
  MAX_SHIELDS,
  afterStamp,
  attendanceCells,
  type AttendanceStatus,
  type StampAttendanceResult,
} from '@/lib/world/attendance';
import { useRewardFlights } from './DailyMissions';
import { useWorldCelebration } from './useWorldCelebration';
import './attendance.css';

const STAMP_ERROR = '도장을 찍지 못했어요. 잠시 후 다시 해 볼까요?';
const CHEST_COINS = coinReward('attendance', ATTENDANCE_DAYS);

async function requestStamp(): Promise<StampAttendanceResult> {
  const res = await fetch('/api/attendance/stamp', { method: 'POST' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || STAMP_ERROR);
  return body as StampAttendanceResult;
}

interface CalendarProps {
  status: AttendanceStatus;
  /** 오늘 찍은 칸의 도장 (도장 쾅 연출 대상) */
  stampRef?: React.Ref<HTMLSpanElement>;
}

/**
 * 출석 달력 7칸 (P8-08). 찍은 칸은 그림 자리에 금색 "출석" 도장(B63) + 날짜, 오늘 찍을 칸은 점선 테두리, 7일째는 상자(내용은 아래 한 줄로 공개).
 * 칸마다 받는(받은) 코인. 낭독기는 칸마다 "n일째, 코인 m개, 찍음/오늘/남음"
 */
export function AttendanceCalendar({ status, stampRef }: CalendarProps) {
  const cells = attendanceCells(status);
  return (
    <ol className="at-cal" aria-label="출석 달력 7칸">
      {cells.map((c) => {
        const state = c.day ? 'done' : c.next ? 'next' : 'later';
        const isToday = c.day === status.today;
        return (
          <li
            key={c.n}
            className="at-cell"
            data-state={state}
            data-chest={c.chest || undefined}
            data-testid={`attendance-cell-${c.n}`}
            aria-label={`${c.n}일째${c.chest ? ' 상자' : ''}, 코인 ${c.coins}개, ${
              c.day
                ? `${formatKstDate(c.day, 'monthDay')} 찍음`
                : c.next
                  ? '오늘'
                  : '남음'
            }`}
          >
            <span className="at-n" aria-hidden>
              {c.n}일
            </span>
            <span className="at-face" aria-hidden>
              {/* 찍은 칸은 도장이 그림 자리를 대신함 (위 "n일"·아래 코인과 겹치지 않게, B63) */}
              {c.day ? (
                <span
                  ref={isToday ? stampRef : undefined}
                  className="at-stamp font-display"
                >
                  출석
                </span>
              ) : c.chest ? (
                <RewardIcon kind="chest" size={26} />
              ) : (
                <RewardIcon kind="coin" size={22} />
              )}
            </span>
            <span className="at-coins font-display tabular-nums" aria-hidden>
              +{c.coins}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 7일째 상자에 든 것 (내용 공개형 §2.6) */
function ChestNote({ shields }: { shields?: number }) {
  const full = shields !== undefined && shields >= MAX_SHIELDS;
  return (
    <p className="at-note">
      <RewardIcon kind="chest" size={18} />
      <span>
        7일째 상자: 코인 {CHEST_COINS} + 스트릭 방패 1개
        {full ? ' (방패가 가득하면 코인만)' : ''}
      </span>
    </p>
  );
}

interface AttendanceCardProps {
  status: AttendanceStatus;
  /** 가진 방패 (7일째 상자 안내 "가득"에 씀) */
  shields: number;
  /** 어제를 방패가 메웠음 → "방패가 불꽃을 지켜 줬어요" */
  shieldSaved?: boolean;
  /** 도장 요청 (기본 `/api/attendance/stamp`. 카탈로그·테스트용) */
  request?: () => Promise<StampAttendanceResult>;
  /** 찍은 뒤 새로 고침 (기본 router.refresh(), 카탈로그는 끔) */
  onStamped?: (res: StampAttendanceResult) => void;
}

/**
 * 월드맵 출석 카드 (P8-08, §3 F5, §12-Q62 ①③). 오늘 출석 전이면 지도 맨 위(오늘의 퀴즈 위)에 보이고, 도장을 직접 눌러 찍음.
 *
 * - 7칸 달력(누적 출석으로 채움 — 하루 빠져도 진행 유지), 오늘 칸 코인, 7일째 상자에 든 것(코인 30 + 방패) 공개
 * - "출석 도장 꾹!" → 서버(`stamp_attendance`) → 오늘 칸에 금색 도장 쾅(온보딩·통과 도장과 같은 `stampSlam`) + 효과음 `coin` +
 *   코인이 HUD 로 날아감(full·lite) → HUD 카운트업(router.refresh). 7일째면 도장 뒤 상자 카드(`ChestCard`, 방패 포함)
 * - 찍은 뒤에는 이 방문 동안 완료 모습으로 남고(닫기 가능), 다음 방문부터는 그리지 않음(메뉴 시트 달력에서 봄)
 * - 어제를 방패가 메웠으면 "방패가 불꽃을 지켜 줬어요" 한 줄
 */
export function AttendanceCard({
  status,
  shields,
  shieldSaved,
  request = requestStamp,
  onStamped,
}: AttendanceCardProps) {
  const router = useRouter();
  const play = useSfx();
  const { budget } = useMotionTier();
  const { launch, layer } = useRewardFlights();
  const { celebrate, layer: celebration } = useWorldCelebration();
  const card = useRef<HTMLElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  const [local, setLocal] = useState<AttendanceStatus | null>(null);
  const [result, setResult] = useState<StampAttendanceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [say, setSay] = useState('');

  // 찍은 직후 한 번: 도장 쾅 → 닿는 순간 소리·코인 → (7일째면) 상자 카드, 아니면 HUD 새로 고침
  const budgetRef = useRef(budget);
  budgetRef.current = budget;
  useEffect(() => {
    if (!result) return;
    const fx = stampSlam(stamp.current, {
      budget: budgetRef.current,
      paper: card.current,
      onImpact: () => {
        play('coin');
        launch(stamp.current, false);
      },
    });
    let live = true;
    void fx.done.then(() => {
      if (!live) return;
      const won = achievementEvents(result.new_achievements);
      if (result.day_n === ATTENDANCE_DAYS) {
        const chest: CelebrationEvent = {
          type: 'chest',
          stageTitle: '',
          goal: 0,
          contents: {
            coins: result.coins_earned,
            goldenKeys: 0,
            shields: result.shield_granted,
          },
          note: '7일 출석을 다 채웠어요!',
        };
        celebrate([chest, ...won]);
      } else if (won.length > 0) {
        celebrate(won);
      } else {
        (onStamped ?? (() => router.refresh()))(result);
      }
    });
    return () => {
      live = false;
      fx.finish();
    };
    // 결과가 바뀔 때만 (한 번)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const view = local ?? status;
  if (hidden || (status.stamped_today && !local))
    return (
      <>
        {layer}
        {celebration}
      </>
    );

  const stampNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await request();
      setLocal(afterStamp(view, res));
      if (!res.already_stamped) {
        setResult(res);
        setSay(
          `${res.day_n}일째 출석 도장! 코인 ${res.coins_earned}개를 받았어요.` +
            (res.shield_granted > 0 ? ' 스트릭 방패도 1개 받았어요!' : ''),
        );
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : STAMP_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const done = view.stamped_today;
  return (
    <section
      ref={card}
      className="at"
      data-state={done ? 'done' : 'todo'}
      aria-labelledby="attendance-title"
      data-testid="attendance-card"
    >
      <div className="at-head">
        <span className="at-k">출석 도장</span>
        <h2 id="attendance-title" className="at-t font-display">
          {done
            ? `${view.day_n}일째 출석 완료!`
            : `오늘은 ${view.day_n}일째 출석이에요`}
        </h2>
        {done && (
          <IconButton
            label="출석 카드 닫기"
            size="sm"
            className="at-close"
            onClick={() => setHidden(true)}
          >
            <X aria-hidden />
          </IconButton>
        )}
      </div>
      {shieldSaved && (
        <p className="at-saved" data-testid="attendance-shield-saved">
          <RewardIcon kind="shield" size={18} />
          방패가 불꽃을 지켜 줬어요
        </p>
      )}
      <AttendanceCalendar status={view} stampRef={stamp} />
      <div className="at-foot">
        <ChestNote shields={shields} />
        {!done && (
          <Button
            variant="reward"
            size="sm"
            loading={busy}
            sfx={false}
            onClick={stampNow}
            data-testid="attendance-stamp"
          >
            출석 도장 꾹!
          </Button>
        )}
      </div>
      {error && (
        <p className="at-err" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {say}
      </p>
      {layer}
      {celebration}
    </section>
  );
}

/** 메뉴 시트 맨 위 출석 달력 (P8-08): 찍은 뒤에도 보는 곳. 보기만 (도장은 지도 카드에서) */
export function AttendanceMenuSection({
  status,
  shields,
}: {
  status: AttendanceStatus;
  shields: number;
}) {
  return (
    <section
      className="at at-menu"
      aria-labelledby="attendance-menu-title"
      data-testid="attendance-menu"
    >
      <div className="at-head">
        <span className="at-k">출석 달력</span>
        <h2 id="attendance-menu-title" className="at-t font-display">
          {status.stamped_today
            ? `오늘 ${status.day_n}일째 출석했어요`
            : '오늘 출석 도장을 아직 안 찍었어요'}
        </h2>
      </div>
      <AttendanceCalendar status={status} />
      <div className="at-foot">
        <ChestNote shields={shields} />
        <p className="at-note">
          <RewardIcon kind="shield" size={18} />
          <span>
            스트릭 방패 {shields}/{MAX_SHIELDS}개 · 하루 쉬면 1개가 불꽃을
            지켜요
          </span>
        </p>
      </div>
    </section>
  );
}
