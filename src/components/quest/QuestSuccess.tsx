'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Map } from 'lucide-react';
import { PybaemStatic } from '@/components/characters/rig';
import { useSfx } from '@/components/providers/SoundProvider';
import { isShown } from '@/components/sound/isShown';
import { Button } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import { stampSlam, type FxHandle } from '@/lib/celebration/onboardingFx';
import { rewardSfx } from '@/lib/celebration/rewardSfx';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { tierDuration } from '@/lib/motion/tokens';
import { SHOW_COINS, SHOW_STARS } from '@/lib/world/flags';
import { CountUp, StarRow } from './celebrations/parts';
import './questSuccess.css';

/**
 * 퀘스트 성공 장면 (P6-08, 최종 시안 Quest.tsx `celebrate('success')` + RewardSheet `RewardRun`):
 * 결과 쪽지에 "통과!" 도장 쾅 → 그 아래 보상 띠(별 1→3 팝 · XP 카운트업 · 코인 카운트업) → 다음 퀘스트 버튼.
 * 이야기 쪽 파이뱀은 `happy`(점프 + 젤리) → `cheer` (StoryPage `tutorLine`), 정답 컨페티는 세션이 쏜다.
 *
 * | 박자 | full | lite | minimal | 동작 줄이기 |
 * |---|---|---|---|---|
 * | 도장 | 내려찍기 + 안착 스프링 + 종이 떨림 + 금색 방울 | 짧게, 떨림·방울 없음 | 페이드 | 처음부터 찍혀 있음 |
 * | 별 | prop 스프링 차례로 | 같음(70%) | 끝 모습 | 끝 모습 |
 * | XP·코인 | 0에서 카운트업 | 70% | 끝 값 | 끝 값 |
 *
 * 장면 전체는 약 1.6초(lite 70%). 그 사이 아무 데나 누르거나 Enter·Esc·Space면 끝 상태로 건너뛴다(§12-Q28).
 * 보상은 이미 서버가 넣었으므로 건너뛰어도 숫자만 끝 값으로 바뀐다.
 * Q52: 별·코인은 연출을 완성해 두고 `SHOW_STARS`·`SHOW_COINS`로 숨김 → 지금 화면은 XP만 (카탈로그 `#success-staging`은 켜서 보여 줌)
 */
export const SUCCESS_RUN_MS = 1600;

/** 도장이 종이에 닿은 뒤 숫자가 오르기 시작 (ms, full 기준) */
const COUNT_AT_MS = 520;
const COUNT_MS = 700;
const STARS_AT_S = 0.45;

export interface QuestReward {
  /** 퀘스트 제목 (띠 머리) */
  title: string;
  /** 이번에 받은 XP (서버 값). 0이면 XP 줄 대신 `note` */
  xp: number;
  /** 별 미리 보기 (Phase 8 전에는 규칙 계산 `codeQuestStars`, SHOW_STARS일 때만 보임) */
  stars?: 1 | 2 | 3;
  /** 받은 코인 (Phase 8, SHOW_COINS일 때만 보임) */
  coins?: number;
  /** XP가 없을 때 한 줄 (황금 열쇠로 연 퀘스트 등) */
  note?: string;
  /** 다음 퀘스트 주소. 없으면(스테이지 끝) 지도가 주 버튼 */
  nextHref: string | null;
  mapHref: string;
  /** 이미 통과한 퀘스트를 다시 푼 복습 (Q57): 머리가 "복습 완료", 보상 숫자 없음 */
  review?: boolean;
  /** 띠 머리 눈썹 글자 (기본: "퀘스트 통과"·복습이면 "복습 완료"). 퀴즈는 "퀴즈 통과"·"연습 완료" 등 (P7-03) */
  kicker?: string;
  /** 플래그와 상관없이 별·코인 보이기: 카탈로그, 그리고 서버가 별을 판정하는 퀴즈(P7-03) */
  forceStarsCoins?: boolean;
}

const SKIP_KEYS = new Set(['Enter', 'Escape', ' ']);

/**
 * 성공 장면이 끝났는지. `key`(실행 결과)가 바뀌면 새 장면. 시간이 다 되거나, 화면 아무 데나 누르거나
 * Enter·Esc·Space면 끝(건너뛰기). 동작 줄이기는 처음부터 끝. 입력은 막지 않는다(누른 버튼은 그대로 동작)
 */
export function useSuccessRun(active: boolean, key: unknown): boolean {
  const { budget } = useMotionTier();
  const ms = tierDuration(SUCCESS_RUN_MS, budget);
  const [doneKey, setDoneKey] = useState<unknown>(null);
  const done = !active || ms === 0 || doneKey === key;
  useEffect(() => {
    if (done) return;
    const finish = () => setDoneKey(key);
    const onKey = (e: KeyboardEvent) => {
      if (SKIP_KEYS.has(e.key)) finish();
    };
    const timer = setTimeout(finish, ms);
    window.addEventListener('pointerdown', finish, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', finish, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [done, key, ms]);
  return done;
}

/**
 * 결과 쪽지 위 "통과!" 도장 (시안 `.f-result-stamp`). 나타날 때 한 번 쾅(`stampSlam`, 온보딩 등록증 도장과 같은 박자),
 * `done`이 되면 남은 연출을 끝 모습으로. 글자·색으로도 통과가 보이므로 장식(aria-hidden)
 */
export function PassStamp({ done }: { done: boolean }) {
  const { budget } = useMotionTier();
  const play = useSfx();
  const ref = useRef<HTMLDivElement>(null);
  const fx = useRef<FxHandle | null>(null);
  const budgetRef = useRef(budget);

  useEffect(() => {
    const el = ref.current;
    // 정답 'correct'는 도장이 종이에 닿는 순간 (건너뛰면 그때, 동작 줄이기는 바로). 화면을 떠나며 끝낼 때는 울리지 않음
    // 숨은 쪽 쪽지(넓은/좁은 화면 중 하나)는 울리지 않음. 다음 틱에 내서 개발 모드 이중 마운트의 첫 소리는 취소된다
    let live = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    fx.current = stampSlam(el, {
      budget: budgetRef.current,
      paper: el?.parentElement,
      onImpact: () => {
        if (live) t = setTimeout(() => isShown(el) && play('correct'));
      },
    });
    return () => {
      live = false;
      clearTimeout(t);
      fx.current?.finish();
    };
  }, [play]);
  useEffect(() => {
    if (done) fx.current?.finish();
  }, [done]);

  return (
    <div ref={ref} className="qx-stamp font-display" aria-hidden>
      통과!
    </div>
  );
}

/**
 * 보상 띠의 별·코인 소리 (P6-14, 숫자·별이 같은 정보를 보여 줌): 나타날 때 한 번 예약하고, 장면 도중 건너뛰면(`done`) 남은 소리를 끊는다.
 * 처음부터 끝 모습(동작 줄이기)이면 0ms 소리로 한 번은 울린다. 숨은 쪽 띠는 조용히. XP 카운트업은 소리 없음(코인만)
 */
function useRewardSfx(
  host: RefObject<HTMLElement | null>,
  done: boolean,
  cues: () => ReturnType<typeof rewardSfx>,
) {
  const play = useSfx();
  const cuesRef = useRef(cues);
  const doneAtMount = useRef(done);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    timers.current = cuesRef
      .current()
      .map((c) =>
        setTimeout(
          () => isShown(host.current) && play(c.id, { rate: c.rate }),
          c.at,
        ),
      );
    return () => timers.current.forEach(clearTimeout);
  }, [host, play]);
  useEffect(() => {
    if (done && !doneAtMount.current) timers.current.forEach(clearTimeout);
  }, [done]);
}

/**
 * 보상 띠 (시안 RewardSheet `.f-reward`를 결과 쪽지 아래 한 장으로): 머리 "퀘스트 통과" · 별 · XP·코인 · 다음 퀘스트/지도로.
 * 별 → 숫자 순서로 차례로, `done`이면 모두 끝 모습. lg 미만(이야기 쪽이 안 보임)은 머리에 파이뱀 한마디
 */
export function RewardStrip({
  reward,
  done,
}: {
  reward: QuestReward;
  done: boolean;
}) {
  const { budget } = useMotionTier();
  const animate = !done && budget.springs && budget.effectDuration > 0;
  const showStars = (reward.forceStarsCoins || SHOW_STARS) && !!reward.stars;
  const coins =
    reward.forceStarsCoins || SHOW_COINS ? Math.max(0, reward.coins ?? 0) : 0;
  const countMs = tierDuration(COUNT_MS, budget);
  const countAt = tierDuration(COUNT_AT_MS, budget);
  const strip = useRef<HTMLElement>(null);
  useRewardSfx(strip, done, () =>
    rewardSfx({
      stars: showStars ? (reward.stars ?? 0) : 0,
      coins,
      starsAtMs: animate ? STARS_AT_S * 1000 * budget.effectDuration : 0,
      starGapMs: animate ? 150 * budget.effectDuration : 0,
      countAtMs: animate ? countAt + tierDuration(120, budget) : 0,
      countMs: animate ? countMs : 0,
    }),
  );

  return (
    <section
      ref={strip}
      className="qx"
      data-testid="quest-reward"
      data-done={done || undefined}
      data-review={reward.review || undefined}
      aria-labelledby="quest-reward-title"
    >
      <div className="qx-head">
        <span className="qx-rig" aria-hidden>
          <PybaemStatic state="cheer" size={56} label="" filters={false} />
        </span>
        <div className="qx-title">
          <p className="qx-k">
            {reward.kicker ?? (reward.review ? '복습 완료' : '퀘스트 통과')}
          </p>
          <h2 id="quest-reward-title" className="qx-t font-display">
            {reward.title}
          </h2>
        </div>
      </div>

      {showStars && reward.stars && (
        <StarRow
          stars={reward.stars}
          budget={budget}
          delay={STARS_AT_S}
          size={40}
          settled={!animate}
        />
      )}

      {(reward.xp > 0 || coins > 0) && (
        <ul className="qx-row" aria-label="받은 보상">
          {reward.xp > 0 && (
            <li className="qx-item" data-testid="reward-xp">
              <span className="qx-xp" aria-hidden>
                XP
              </span>
              <b className="qx-num">
                +
                <CountUp
                  to={reward.xp}
                  durationMs={countMs}
                  delayMs={countAt}
                  animate={animate}
                  testId="reward-xp-count"
                />
              </b>
              <span className="sr-only">XP</span>
            </li>
          )}
          {coins > 0 && (
            <li className="qx-item" data-testid="reward-coins">
              <RewardIcon kind="coin" size={30} />
              <b className="qx-num">
                +
                <CountUp
                  to={coins}
                  durationMs={countMs}
                  delayMs={countAt + tierDuration(120, budget)}
                  animate={animate}
                />
              </b>
              <span className="qx-unit">코인</span>
            </li>
          )}
        </ul>
      )}
      {reward.note && <p className="qx-note">{reward.note}</p>}

      <div className="qx-actions">
        {reward.nextHref ? (
          <>
            <Button
              href={reward.nextHref}
              iconRight={<ArrowRight aria-hidden />}
              data-testid="next-quest"
            >
              다음 퀘스트
            </Button>
            <Button
              href={reward.mapHref}
              variant="secondary"
              icon={<Map aria-hidden />}
            >
              지도로
            </Button>
          </>
        ) : (
          <Button
            href={reward.mapHref}
            icon={<Map aria-hidden />}
            data-testid="back-to-map"
          >
            지도로 돌아가기
          </Button>
        )}
      </div>
    </section>
  );
}
