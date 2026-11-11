'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  Check,
  CircleCheck,
  Code,
  LightbulbOff,
  ListChecks,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon } from '@/components/ui/reward-icon';
import { Sheet } from '@/components/ui/sheet';
import { useSfx } from '@/components/providers/soundContext';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { addKstDays, formatKstDate } from '@/lib/time/kst';
import {
  achievementEvents,
  levelUpEvents,
  type CelebrationEvent,
} from '@/lib/quest/celebrationEvents';
import { useWorldCelebration } from './useWorldCelebration';
import {
  formatTimeLeft,
  missionReady,
  msUntilKstMidnight,
  readyCount,
  type ClaimMissionResult,
  type DailyMission,
  type DailyMissionsState,
  type MissionKind,
} from '@/lib/world/missions';
import './dailyMissions.css';

const KIND_ICON: Record<MissionKind, LucideIcon> = {
  quest_clear: Code,
  no_hint: LightbulbOff,
  review: RotateCcw,
  daily_quiz: CalendarCheck,
  quiz_correct: CircleCheck,
};

const CLAIM_ERROR = '보상을 받지 못했어요. 잠시 후 다시 해 볼까요?';

async function requestClaim(
  day: string,
  missionId: string,
): Promise<ClaimMissionResult> {
  const res = await fetch('/api/missions/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, missionId }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || CLAIM_ERROR);
  return body as ClaimMissionResult;
}

/** 지금 시각 (간격마다 다시 그림). 시트가 열려 있을 때만 그려지므로 서버 HTML 과 어긋나지 않음 */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

interface Flight {
  id: number;
  kind: 'coin' | 'xp';
  style: CSSProperties;
}

/**
 * 버튼에서 HUD 코인 칩·레벨 도장으로 날아가는 보상 (full 코인 3개·lite 1개 + XP, minimal·동작 줄이기 없음 — HUD 칩 색 반짝임이 대신).
 * `coinTarget`: 코인이 닿을 칩 (업적 도감 P8-10 은 화면 위 지갑 칩)
 */
export function useRewardFlights(coinTarget = '.wh [data-testid="hud-coin"]') {
  const { budget } = useMotionTier();
  const [flights, setFlights] = useState<Flight[]>([]);
  const seq = useRef(0);

  const launch = (from: HTMLElement | null, withXp = true) => {
    if (!from || budget.particles === 0 || budget.effectDuration === 0) return;
    const a = from.getBoundingClientRect();
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const to = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { dx: b.left + b.width / 2 - x0, dy: b.top + b.height / 2 - y0 };
    };
    const coin = to(coinTarget);
    const xp = withXp ? to('.wh [data-testid="level-seal"]') : null;
    const coins = budget.particles >= 1 ? 3 : 1;
    const next: Flight[] = [];
    const add = (
      kind: Flight['kind'],
      d: { dx: number; dy: number },
      i: number,
    ) =>
      next.push({
        id: ++seq.current,
        kind,
        style: {
          left: x0,
          top: y0,
          '--dx': `${d.dx}px`,
          '--dy': `${d.dy}px`,
          '--i': i,
          '--k': budget.effectDuration,
        } as CSSProperties,
      });
    if (coin) for (let i = 0; i < coins; i++) add('coin', coin, i);
    if (xp) add('xp', xp, 1);
    if (next.length === 0) return;
    setFlights((f) => [...f, ...next]);
    const ids = new Set(next.map((f) => f.id));
    setTimeout(() => setFlights((f) => f.filter((x) => !ids.has(x.id))), 1400);
  };

  const layer =
    flights.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <div className="dm-flights" aria-hidden>
            {flights.map((f) => (
              <span
                key={f.id}
                className="dm-fly"
                data-kind={f.kind}
                style={f.style}
              >
                {f.kind === 'coin' ? (
                  <RewardIcon kind="coin" size={24} />
                ) : (
                  <span className="dm-fly-xp font-display">XP</span>
                )}
              </span>
            ))}
          </div>,
          document.body,
        )
      : null;

  return { launch, layer };
}

interface MissionItemProps {
  mission: DailyMission;
  /** 지난날 미션이면 그 날짜 글자 ("어제", "11월 9일") */
  dayLabel?: string;
  busy: boolean;
  onClaim: (button: HTMLElement | null) => void;
}

function MissionItem({
  mission: m,
  dayLabel,
  busy,
  onClaim,
}: MissionItemProps) {
  const Icon = KIND_ICON[m.kind] ?? ListChecks;
  const ready = missionReady(m);
  const state = m.claimed ? 'claimed' : ready ? 'ready' : 'doing';
  return (
    <li className="dm-item" data-state={state} data-testid={`mission-${m.id}`}>
      <span className="dm-icon" aria-hidden>
        <Icon strokeWidth={2.4} />
      </span>
      <div className="dm-main">
        <p className="dm-title">
          {dayLabel && <span className="dm-day">{dayLabel}</span>}
          <b>{m.title}</b>
        </p>
        <span className="dm-level" aria-label={`난이도 ${m.difficulty}`}>
          {[1, 2, 3].map((n) => (
            <i key={n} data-on={n <= m.difficulty || undefined} />
          ))}
        </span>
        {state === 'doing' ? (
          <ProgressBar
            value={m.progress}
            max={m.target}
            size="sm"
            label={`${m.title} 진행`}
            valueText={`${m.progress} / ${m.target}`}
            className="dm-bar"
          />
        ) : null}
        <p className="dm-reward">
          <span className="dm-pill">
            <RewardIcon kind="coin" size={16} />
            코인 {m.coins}
          </span>
          <span className="dm-pill" data-kind="xp">
            XP {m.xp}
          </span>
        </p>
      </div>
      <div className="dm-side">
        {state === 'claimed' ? (
          <span className="dm-done" data-testid="mission-claimed">
            <Check aria-hidden strokeWidth={3} />
            받았어요
          </span>
        ) : state === 'ready' ? (
          <Button
            variant="reward"
            size="sm"
            loading={busy}
            sfx={false}
            onClick={(e) => onClaim(e.currentTarget as HTMLElement)}
            data-testid="mission-claim"
          >
            받기
          </Button>
        ) : (
          <span className="dm-count font-display" aria-hidden>
            {m.progress}/{m.target}
          </span>
        )}
      </div>
    </li>
  );
}

interface MissionListProps {
  state: DailyMissionsState;
  /** 받기 요청 (기본 `/api/missions/claim`. 카탈로그·테스트용) */
  request?: (day: string, missionId: string) => Promise<ClaimMissionResult>;
  /** 받은 뒤 (기본: router.refresh() — HUD 코인·XP 카운트업) */
  onClaimed?: (res: ClaimMissionResult) => void;
  /** 받기로 레벨이 올랐거나 업적을 얻었을 때 (P8-08 공용 레벨 업·P8-09 업적 카드). 주면 router.refresh() 대신 이것 — 축하를 띄울 때 새로 고침 (B56) */
  onLevelUp?: (events: CelebrationEvent[]) => void;
}

/**
 * 데일리 미션 목록 (P8-07, §3 F4). HUD 미션 칸 시트 안.
 *
 * - 오늘 미션(최대 3개): 종류 아이콘 · 이름 · 난이도 점 · 진행 막대(n/목표) · 보상(코인 10·15·20 + XP 15)
 * - 달성하면 금색 테두리 + "받기"(reward 버튼). 받기는 버튼으로만(§12-Q62 ③), 서버가 진행을 다시 세어 지급
 * - 받으면 효과음 `coin` + 코인·XP 가 HUD 로 날아감(full·lite) + HUD 카운트업(router.refresh), 낭독 문구
 * - 지난날 달성·안 받은 보상은 "지난 보상" 묶음으로 7일 동안 (사라지지 않음)
 * - 자정까지 남은 시간, 자정이 지나면 새로 고침
 */
export function MissionList({
  state,
  request = requestClaim,
  onClaimed,
  onLevelUp,
}: MissionListProps) {
  const router = useRouter();
  const play = useSfx();
  const { launch, layer } = useRewardFlights();
  const now = useNow(30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [say, setSay] = useState('');
  const left = msUntilKstMidnight(now);

  // 시트를 연 채 자정을 넘기면 한 번 새로 고침 (새 날 미션)
  useEffect(() => {
    const t = setTimeout(() => router.refresh(), msUntilKstMidnight() + 1000);
    return () => clearTimeout(t);
  }, [state.day, router]);

  const key = (day: string, id: string) => `${day}:${id}`;
  const view = (m: DailyMission, day: string): DailyMission =>
    claimed.has(key(day, m.id)) ? { ...m, claimed: true } : m;

  const claim = async (
    day: string,
    m: DailyMission,
    button: HTMLElement | null,
  ) => {
    setBusy(key(day, m.id));
    setError(null);
    try {
      const res = await request(day, m.id);
      setClaimed((s) => new Set(s).add(key(day, m.id)));
      if (!res.already_claimed) {
        play('coin');
        launch(button);
        const lv = res.level_ups.reduce((n, l) => n + l.coins, 0);
        setSay(
          `코인 ${res.mission_coins}개와 ${res.xp_earned} XP를 받았어요!` +
            (res.level_after > res.level_before
              ? ` 레벨 업! Lv ${res.level_after}${lv > 0 ? `, 코인 ${lv}개 더!` : ''}`
              : ''),
        );
      }
      const ups = [
        ...levelUpEvents(res),
        ...achievementEvents(res.new_achievements),
      ];
      if (onLevelUp && ups.length > 0 && !res.already_claimed) onLevelUp(ups);
      else (onClaimed ?? (() => router.refresh()))(res);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : CLAIM_ERROR);
    } finally {
      setBusy(null);
    }
  };

  const yesterday = addKstDays(state.day, -1);
  const done = state.missions.filter((m) => m.progress >= m.target).length;

  return (
    <div className="dm" data-testid="mission-list">
      <p className="dm-sum">
        <span className="dm-sum-n font-display">
          {done}/{state.missions.length}
        </span>
        <span>
          {state.missions.length === 0
            ? '오늘은 할 수 있는 미션이 없어요. 새 스테이지를 열어 볼까요?'
            : done === state.missions.length
              ? '오늘 미션을 다 했어요! 내일 또 만나요'
              : '퀘스트와 퀴즈를 풀면 미션이 채워져요'}
        </span>
      </p>

      {state.missions.length > 0 && (
        <ul className="dm-list" aria-label="오늘의 미션">
          {state.missions.map((m) => (
            <MissionItem
              key={m.id}
              mission={view(m, state.day)}
              busy={busy === key(state.day, m.id)}
              onClaim={(b) => claim(state.day, m, b)}
            />
          ))}
        </ul>
      )}

      {state.pending.length > 0 && (
        <section className="dm-past" aria-labelledby="dm-past-t">
          <h3 id="dm-past-t" className="dm-past-t font-display">
            지난 보상 <span className="font-sans">7일 동안 받을 수 있어요</span>
          </h3>
          <ul className="dm-list">
            {state.pending.map((m) => (
              <MissionItem
                key={key(m.day, m.id)}
                mission={view(m, m.day)}
                dayLabel={
                  m.day === yesterday
                    ? '어제'
                    : formatKstDate(m.day, 'monthDay')
                }
                busy={busy === key(m.day, m.id)}
                onClaim={(b) => claim(m.day, m, b)}
              />
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="dm-err" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {say}
      </p>
      <p className="dm-timer" data-testid="mission-timer">
        새 미션까지 <b>{formatTimeLeft(left)}</b>
      </p>
      {layer}
    </div>
  );
}

/** HUD 미션 칸 자리 (서버가 미션을 읽는 동안, 같은 크기라 바가 흔들리지 않음) */
export function MissionHudPlaceholder() {
  return (
    <span className="wh-chip wh-mission" data-loading aria-hidden>
      <ListChecks />
    </span>
  );
}

/**
 * HUD 미션 칸 (P8-07): 아이콘 + 달성 수, 받을 보상이 있으면 금색 점. 누르면 미션 시트.
 * 받기로 레벨이 오르거나 업적을 얻으면 시트를 닫고 레벨 업·업적 카드 (P8-08 공용 `useWorldCelebration`)
 */
export function MissionHudButton({ state }: { state: DailyMissionsState }) {
  const [open, setOpen] = useState(false);
  const { celebrate, layer } = useWorldCelebration();
  const done = state.missions.filter((m) => m.progress >= m.target).length;
  const total = state.missions.length;
  const ready = readyCount(state);
  const label = `오늘의 미션 ${done}/${total} 달성${ready > 0 ? `, 받을 보상 ${ready}개` : ''}`;
  return (
    <>
      <Sheet
        title="오늘의 미션"
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            className="wh-chip wh-mission focus-ring"
            data-ready={ready > 0 || undefined}
            aria-label={label}
            title={label}
            data-testid="hud-mission"
          >
            <ListChecks aria-hidden />
            <span
              aria-hidden
              className="wh-num wh-mission-n font-display tabular-nums"
            >
              {done}/{total}
            </span>
            {ready > 0 && <span className="wh-mission-dot" aria-hidden />}
          </button>
        }
        data-testid="mission-sheet"
      >
        <MissionList
          state={state}
          onLevelUp={(events) => {
            setOpen(false);
            celebrate(events);
          }}
        />
      </Sheet>
      {layer}
    </>
  );
}
