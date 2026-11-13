import type { ReactNode } from 'react';
import {
  Bug,
  ChevronRight,
  CircleCheck,
  Flame,
  Lightbulb,
  RotateCcw,
  Stamp,
  Trophy,
} from 'lucide-react';

import { CardButton } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon } from '@/components/ui/reward-icon';
import { AchievementMedal } from '@/components/shared/AchievementMedal';
import { MyAvatar } from '@/components/profile/MyLook';
import {
  getLevelTitle,
  getXPProgress,
  isMilestoneLevel,
  MAX_LEVEL,
} from '@/lib/quest/xp';
import { quizAccuracy, type ProfileStatsRaw } from '@/lib/profile/profileStats';
import type { ChestState } from '@/lib/world/chest';
import type { AchievementTier } from '@/lib/quest/achievements';
import { formatKstDate } from '@/lib/time/kst';
import './profile.css';

const n = (v: number) => v.toLocaleString('ko-KR');

/** 카드 껍데기: 제목 줄(아이콘·제목·오른쪽 보조 글) + 내용 */
export function ProfileCard({
  title,
  icon,
  side,
  wide,
  children,
  'data-testid': testId,
}: {
  title: string;
  icon?: ReactNode;
  side?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  'data-testid'?: string;
}) {
  const id = testId ? `${testId}-title` : undefined;
  return (
    <section
      className={wide ? 'pf-card pf-wide' : 'pf-card'}
      aria-labelledby={id}
      data-surface="raised"
      data-testid={testId}
    >
      <h2 id={id} className="pf-h font-display">
        {icon}
        {title}
        {side && <span className="pf-h-side font-sans">{side}</span>}
      </h2>
      {children}
    </section>
  );
}

/** 머리: 아바타 + 레벨 도장, 이름, 칭호 도장(5레벨마다 큰 칭호 금색), 다음 칭호까지 경험치 */
export function ProfileHero({
  name,
  totalXp,
  action,
}: {
  name: string;
  totalXp: number;
  /** 이름·칭호 아래 버튼 (레벨 카드 자랑하기, P9-09) */
  action?: ReactNode;
}) {
  const {
    currentLevel: level,
    currentLevelXP,
    nextLevelXP,
  } = getXPProgress(totalXp);
  const big = isMilestoneLevel(level);
  const isMax = nextLevelXP === null;
  const inLevel = totalXp - currentLevelXP;
  const span = isMax ? 0 : nextLevelXP - currentLevelXP;
  return (
    <section
      className="pf-card pf-wide pf-hero"
      aria-label="내 모험가 카드"
      data-surface="raised"
      data-testid="profile-hero"
    >
      <div className="pf-avatar">
        <MyAvatar size={96} />
        <span className="pf-seal" data-big={big || undefined}>
          <span className="sr-only">레벨 {level}</span>
          <small aria-hidden className="font-sans">
            Lv
          </small>
          <b aria-hidden className="font-display">
            {level}
          </b>
        </span>
      </div>
      <div className="pf-who">
        <h1 className="pf-name font-display">{name}</h1>
        <p className="pf-title" data-big={big || undefined}>
          <small>{big ? '큰 칭호' : '칭호'}</small>
          <b className="font-display">{getLevelTitle(level)}</b>
        </p>
        {action}
      </div>
      <div className="pf-xp">
        <div className="pf-xp-row">
          {isMax ? (
            <span>
              <b>Lv {MAX_LEVEL}</b> 최고 레벨에 닿았어요!
            </span>
          ) : (
            <span>
              다음 칭호 <b>{getLevelTitle(level + 1)}</b>
            </span>
          )}
          <span>
            {isMax ? `${n(totalXp)} XP` : `${n(inLevel)} / ${n(span)} XP`}
          </span>
        </div>
        <ProgressBar
          value={isMax ? 1 : inLevel}
          max={isMax ? 1 : span}
          size="lg"
          label="다음 레벨까지 경험치"
          valueText={isMax ? '최고 레벨' : `${n(inLevel)} / ${n(span)} XP`}
          animateOnMount
          data-testid="xp-progress"
        />
      </div>
    </section>
  );
}

function Tile({
  icon,
  value,
  unit,
  label,
  tone,
  testId,
}: {
  icon: ReactNode;
  value: ReactNode;
  unit?: string;
  label: string;
  tone?: 'reward';
  testId: string;
}) {
  return (
    <li className="pf-tile" data-tone={tone} data-testid={`stat-${testId}`}>
      <span className="pf-tile-ic" aria-hidden>
        {icon}
      </span>
      <p className="pf-tile-n font-display">
        {value}
        {unit && <small className="font-sans">{unit}</small>}
      </p>
      <p className="pf-tile-k">{label}</p>
    </li>
  );
}

/** 모험 기록: 숫자 타일 8개 (업적 지표와 같은 수) */
export function ProfileStatsCard({ raw }: { raw: ProfileStatsRaw }) {
  const s = raw.stats;
  const acc = quizAccuracy(raw.quiz_right, raw.quiz_tries);
  return (
    <ProfileCard title="모험 기록" data-testid="profile-stats">
      <ul className="pf-tiles">
        <Tile
          icon={<CircleCheck />}
          value={n(s.quests)}
          unit="개"
          label="혼자 푼 퀘스트"
          testId="quests"
        />
        <Tile
          icon={<Lightbulb />}
          value={n(s.no_hint)}
          unit="개"
          label="힌트 없이 풀었어요"
          testId="no-hint"
        />
        <Tile
          icon={<Trophy />}
          value={acc === null ? '아직' : acc}
          unit={acc === null ? undefined : '%'}
          label={
            acc === null
              ? '퀴즈 전이에요'
              : `퀴즈 정답률 · 맞힌 퀴즈 ${n(s.quiz_correct)}개`
          }
          testId="quiz"
        />
        <Tile
          icon={<Bug />}
          value={n(s.errors)}
          unit="번"
          label="에러를 이겨 냈어요"
          testId="errors"
        />
        <Tile
          icon={<RotateCcw />}
          value={n(s.reviews)}
          unit="번"
          label="복습 도전"
          testId="reviews"
        />
        <Tile
          icon={<Flame />}
          value={n(raw.streak)}
          unit="일"
          label={`연속 학습 · 최고 ${n(s.streak)}일`}
          testId="streak"
        />
        <Tile
          icon={<RewardIcon kind="shield" size={22} />}
          value={raw.shields}
          unit="/ 2"
          label="가진 스트릭 방패"
          tone="reward"
          testId="shields"
        />
        <Tile
          icon={<Stamp />}
          value={n(s.attendance)}
          unit="번"
          label="출석 도장"
          tone="reward"
          testId="attendance"
        />
      </ul>
    </ProfileCard>
  );
}

export interface StageStars {
  id: string;
  order: number;
  title: string;
  stars: number;
  maxStars: number;
  chest: ChestState;
  locked: boolean;
}

const CHEST_LABEL: Record<ChestState, string> = {
  none: '',
  locked: '보물상자 별 모으는 중',
  ready: '보물상자 열 수 있어요',
  opened: '보물상자 열었어요',
};

/** 별과 보물: 코인(이번 주 번 코인) · 별 합 · 상자 · 스테이지별 별 막대 */
export function TreasureCard({
  coins,
  coinsWeek,
  threeStars,
  stages,
}: {
  coins: number;
  coinsWeek: number;
  threeStars: number;
  stages: StageStars[];
}) {
  const stars = stages.reduce((t, s) => t + s.stars, 0);
  const maxStars = stages.reduce((t, s) => t + s.maxStars, 0);
  const withChest = stages.filter((s) => s.chest !== 'none');
  const opened = withChest.filter((s) => s.chest === 'opened').length;
  return (
    <ProfileCard title="별과 보물" data-testid="profile-treasure">
      <div className="pf-big">
        <span className="pf-big-n font-display" data-testid="treasure-coins">
          <RewardIcon kind="coin" size={32} />
          <span className="sr-only">코인 {n(coins)}개</span>
          <span aria-hidden>{n(coins)}</span>
        </span>
        {coinsWeek > 0 && (
          <span className="pf-pill">이번 주 +{n(coinsWeek)}</span>
        )}
      </div>
      <ul className="pf-tiles">
        <Tile
          icon={<RewardIcon kind="star" size={24} />}
          value={n(stars)}
          unit={`/ ${n(maxStars)}`}
          label={`모은 별 · 별 3개 퀘스트 ${n(threeStars)}개`}
          tone="reward"
          testId="stars"
        />
        <Tile
          icon={<RewardIcon kind="chestOpen" size={24} />}
          value={opened}
          unit={`/ ${withChest.length}`}
          label="연 보물상자"
          tone="reward"
          testId="chests"
        />
      </ul>
      <ul className="pf-stages" aria-label="스테이지별 별">
        {stages.map((s) => (
          <li
            key={s.id}
            className="pf-stage"
            data-locked={s.locked || undefined}
          >
            <span className="pf-stage-t">
              {s.order}. {s.title}
            </span>
            <span className="pf-stage-v">
              <RewardIcon kind="star" size={16} />
              {s.stars}/{s.maxStars}
              {s.chest !== 'none' && (
                <span className="pf-chest" data-state={s.chest}>
                  <RewardIcon
                    kind={s.chest === 'opened' ? 'chestOpen' : 'chest'}
                    size={20}
                    label={CHEST_LABEL[s.chest]}
                  />
                </span>
              )}
            </span>
            <ProgressBar
              value={s.stars}
              max={Math.max(1, s.maxStars)}
              size="sm"
              tone="reward"
              label={`${s.order}단계 ${s.title} 별`}
              valueText={`별 ${s.stars}개 / ${s.maxStars}개`}
            />
          </li>
        ))}
      </ul>
    </ProfileCard>
  );
}

export interface RecentMedal {
  id: string;
  name: string;
  icon: string;
  tier: AchievementTier;
  achievedAt: string;
}

/** 업적 카드 → 도감 (P8-10). 얻은 수/전체 · 진행 막대 · 최근 얻은 메달 3개. 받을 코인이 있으면 금색 알약 */
export function AchievementsCard({
  earned,
  total,
  claimable,
  recent,
}: {
  earned: number;
  total: number;
  claimable: number;
  recent: RecentMedal[];
}) {
  return (
    <CardButton
      href="/profile/achievements"
      radius="l"
      padding="lg"
      className="grid gap-3.5"
      data-testid="profile-achievements"
      aria-label={`업적 도감, ${total}개 중 ${earned}개${claimable > 0 ? `, 받을 보상 ${claimable}개` : ''}`}
    >
      <div className="flex items-center gap-2">
        <h2 className="font-display text-h3 whitespace-nowrap text-foreground">
          업적 {earned}/{total}
        </h2>
        {claimable > 0 && (
          <span className="ach-ready whitespace-nowrap" aria-hidden>
            받을 코인
          </span>
        )}
        <span className="ml-auto inline-flex shrink-0 items-center text-caption font-semibold whitespace-nowrap text-primary-text">
          도감 보기
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </div>
      <ProgressBar
        value={earned}
        max={Math.max(1, total)}
        size="sm"
        tone="reward"
        label="얻은 업적"
        valueText={`${earned} / ${total}`}
      />
      {recent.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          아직 얻은 업적이 없어요. 퀘스트를 풀면 업적이 생겨요!
        </p>
      ) : (
        <>
          <p className="text-caption font-semibold text-muted-foreground">
            최근에 얻은 업적
          </p>
          <ul className="pf-medals">
            {recent.map((a) => (
              <li key={a.id} className="pf-medal">
                <AchievementMedal icon={a.icon} tier={a.tier} size="lg" />
                <p className="font-semibold">{a.name}</p>
                <p>{formatKstDate(a.achievedAt, 'monthDay')}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </CardButton>
  );
}
