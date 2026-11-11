'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, Sparkle, Sprout } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { HudCounter } from '@/components/ui/hud';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon } from '@/components/ui/reward-icon';
import { Sheet } from '@/components/ui/sheet';
import { SegmentedTabs } from '@/components/ui/tabs';
import { AchievementMedal } from '@/components/shared/AchievementMedal';
import { useSfx } from '@/components/providers/soundContext';
import { useRewardFlights } from '@/components/world/DailyMissions';
import {
  TIER_LABEL,
  type AchievementTier,
  type ClaimAchievementResult,
} from '@/lib/quest/achievements';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  markClaimed,
  summarizeBook,
  type AchievementCategory,
  type BookEntry,
} from '@/lib/quest/achievementBook';
import { formatKstDate } from '@/lib/time/kst';
import { cn } from '@/lib/utils';
import './achievementBook.css';

const CLAIM_ERROR = '코인을 받지 못했어요. 잠시 후 다시 해 볼까요?';
const WALLET = '[data-ab-wallet] [data-testid="hud-coin"]';

async function requestClaim(id: string): Promise<ClaimAchievementResult> {
  const res = await fetch('/api/achievements/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error((res.status !== 401 && body?.error) || CLAIM_ERROR);
  return body as ClaimAchievementResult;
}

/** 카테고리 한 줄 소개. 실패 칭찬은 따뜻한 띠로 따로 */
const CATEGORY_NOTE: Record<AchievementCategory, string> = {
  learn: '퀘스트를 혼자 풀며 모아요',
  star: '별을 모으면 열려요',
  quiz: '퀴즈를 맞히면 열려요',
  habit: '매일 조금씩 하면 열려요',
  growth: '레벨이 오르고 상자를 열면 열려요',
  grit: '틀리고 다시 해 본 용기에 주는 업적이에요',
};

type Filter = 'all' | 'earned' | 'todo';
const FILTERS = [
  { value: 'all', label: '모두' },
  { value: 'earned', label: '얻었어요' },
  { value: 'todo', label: '도전 중' },
] as const;
const FILTER_PANEL = 'ab-panel';

const owned = (e: BookEntry) => e.state === 'earned' || e.state === 'claimable';

function stateText(e: BookEntry): string {
  switch (e.state) {
    case 'claimable':
      return `얻었어요, 코인 ${e.coins}개를 받을 수 있어요`;
    case 'earned':
      return `얻었어요 ${formatKstDate(e.achievedAt!, 'dot')}`;
    case 'secret':
      return '아직 비밀이에요';
    default:
      return `아직, ${e.progress}/${e.goal}`;
  }
}

/** 메달: 얻음 = 티어 색 · 아직 = 실루엣 · 비밀 = 물음표 */
function BookMedal({ entry, big }: { entry: BookEntry; big?: boolean }) {
  const size = big ? 'ab-medal-big' : undefined;
  if (entry.state === 'secret')
    return (
      <span
        className={cn('ach-medal ab-medal size-14 font-display', size)}
        data-tier={entry.tier}
        data-earned="false"
        data-secret=""
        aria-hidden
      >
        ?
      </span>
    );
  return (
    <AchievementMedal
      icon={entry.icon}
      tier={entry.tier}
      earned={owned(entry)}
      className={cn('ab-medal', size)}
    />
  );
}

function TierTag({ tier }: { tier: AchievementTier }) {
  return (
    <span className="ab-tier" data-tier={tier}>
      {TIER_LABEL[tier]}
    </span>
  );
}

interface TileProps {
  entry: BookEntry;
  busy: boolean;
  onOpen: () => void;
  onClaim: (button: HTMLElement | null) => void;
}

function Tile({ entry: e, busy, onOpen, onClaim }: TileProps) {
  return (
    <li
      className="ab-tile"
      data-state={e.state}
      data-tier={e.tier}
      data-testid={`achievement-${e.id}`}
    >
      <button
        type="button"
        className="ab-open focus-ring"
        aria-label={`${e.state === 'secret' ? '비밀 업적' : e.name}, ${TIER_LABEL[e.tier]}, ${stateText(e)}`}
        onClick={onOpen}
      >
        <span className="ab-medal-wrap">
          <BookMedal entry={e} />
          {e.state === 'claimable' && (
            <>
              <Sparkle className="ab-glint" data-i="0" aria-hidden />
              <Sparkle className="ab-glint" data-i="1" aria-hidden />
            </>
          )}
        </span>
        <span className="ab-name">{e.name}</span>
        {e.state === 'locked' ? (
          <span className="ab-prog" aria-hidden>
            <span className="ab-prog-bar">
              <span
                style={{
                  transform: `scaleX(${e.goal ? e.progress! / e.goal : 0})`,
                }}
              />
            </span>
            <span className="ab-prog-n font-display tabular-nums">
              {e.progress}/{e.goal}
            </span>
          </span>
        ) : e.state === 'earned' ? (
          <span className="ab-date">{formatKstDate(e.achievedAt!, 'dot')}</span>
        ) : e.state === 'secret' ? (
          <span className="ab-date">비밀</span>
        ) : null}
      </button>
      {e.state === 'claimable' && (
        <Button
          variant="reward"
          size="sm"
          sfx={false}
          loading={busy}
          icon={<RewardIcon kind="coin" size={18} />}
          className="ab-claim"
          onClick={(ev) => onClaim(ev.currentTarget as HTMLElement)}
          data-testid="achievement-claim"
        >
          받기 {e.coins}
        </Button>
      )}
    </li>
  );
}

export interface AchievementBookProps {
  entries: BookEntry[];
  /** 지금 코인 잔액 (users.coins) */
  coins: number;
  /** 받기 요청 (기본 `/api/achievements/claim`. 카탈로그·테스트용) */
  request?: (id: string) => Promise<ClaimAchievementResult>;
  /** 위 "← 프로필" 링크를 숨김 (카탈로그) */
  embedded?: boolean;
}

/**
 * 업적 도감 (P8-10, §3 F5). `/profile/achievements`.
 *
 * - 위 요약: 얻은 수/전체 · 티어별 · 받을 코인 + "모두 받기"
 * - 거르기 탭(모두·얻었어요·도전 중) + 카테고리 절(학습·별·퀴즈·꾸준함·성장·실패 칭찬 — 실패 칭찬은 따뜻한 띠)
 * - 칸: 얻음 = 티어 색 메달 + 날짜 · 받을 수 있음 = 반짝임 + "받기" · 아직 = 실루엣 + 진행 막대 · 숨김 = "???"
 * - 칸을 누르면 상세 시트. 받기는 서버 RPC(멱등) → 효과음 `coin` + 코인이 위 지갑으로 날아감 + 응답 잔액으로 카운트업
 *   (router.refresh 없음 — B56)
 */
export function AchievementBook({
  entries: initial,
  coins: initialCoins,
  request = requestClaim,
  embedded = false,
}: AchievementBookProps) {
  const play = useSfx();
  const { launch, layer } = useRewardFlights(WALLET);
  const [entries, setEntries] = useState(initial);
  const [coins, setCoins] = useState(initialCoins);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [say, setSay] = useState('');
  const summary = useMemo(() => summarizeBook(entries), [entries]);
  const open = entries.find((e) => e.id === openId) ?? null;

  const claim = async (
    ids: string[],
    key: string,
    from: HTMLElement | null,
  ) => {
    if (ids.length === 0) return;
    setBusy(key);
    setError(null);
    try {
      const res = await Promise.all(ids.map((id) => request(id)));
      const got = res.reduce((n, r) => n + r.coins_earned, 0);
      setEntries((list) => markClaimed(list, new Set(ids)));
      // 동시에 받은 것들의 잔액 중 가장 큰 값이 마지막 지급 뒤 (원장은 늘기만)
      setCoins((c) => Math.max(c, ...res.map((r) => r.coins_balance)));
      if (got > 0) {
        play('coin');
        launch(from, false);
        setSay(`코인 ${got}개를 받았어요!`);
      } else setSay('이미 받은 코인이에요');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : CLAIM_ERROR);
    } finally {
      setBusy(null);
    }
  };

  const visible = entries.filter((e) =>
    filter === 'all' ? true : filter === 'earned' ? owned(e) : !owned(e),
  );
  const claimable = entries.filter((e) => e.state === 'claimable');

  return (
    <div className="ab" data-testid="achievement-book">
      <div className="ab-top">
        {!embedded && (
          <Link href="/profile" className="ab-back focus-ring">
            <ChevronLeft aria-hidden />
            프로필
          </Link>
        )}
        <span data-ab-wallet className="ab-wallet">
          <HudCounter kind="coin" value={coins} />
        </span>
      </div>

      <section className="ab-hero" aria-labelledby="ab-title">
        <div className="ab-hero-head">
          <h1 id="ab-title" className="ab-title font-display">
            업적 도감
          </h1>
          <p className="ab-count font-display tabular-nums">
            <b>{summary.earned}</b>
            <span>/{summary.total}</span>
          </p>
        </div>
        <ProgressBar
          value={summary.earned}
          max={Math.max(1, summary.total)}
          label="모은 업적"
          valueText={`${summary.total}개 중 ${summary.earned}개`}
          animateOnMount
        />
        <ul className="ab-tiers" aria-label="티어별로 모은 업적">
          {(['bronze', 'silver', 'gold'] as const).map((t) => (
            <li key={t} className="ab-tier-n" data-tier={t}>
              <span className="ab-tier-dot" aria-hidden />
              {TIER_LABEL[t]}{' '}
              <b className="font-display tabular-nums">{summary.byTier[t]}</b>
            </li>
          ))}
        </ul>
        {summary.claimable > 0 ? (
          <div className="ab-collect" data-testid="achievement-collect">
            <RewardIcon kind="coin" size={28} />
            <p>
              <span className="ab-collect-amt">
                받을 코인{' '}
                <span className="ab-nowrap">
                  <b className="font-display tabular-nums">
                    {summary.claimableCoins}
                  </b>
                  개
                </span>
              </span>
              <span>업적 {summary.claimable}개</span>
            </p>
            <Button
              variant="reward"
              size="sm"
              sfx={false}
              loading={busy === 'all'}
              disabled={busy !== null && busy !== 'all'}
              onClick={(ev) =>
                claim(
                  claimable.map((e) => e.id),
                  'all',
                  ev.currentTarget as HTMLElement,
                )
              }
              data-testid="achievement-claim-all"
            >
              모두 받기
            </Button>
          </div>
        ) : (
          <p className="ab-hint">업적을 얻으면 여기서 코인을 받을 수 있어요.</p>
        )}
      </section>

      {error && (
        <p className="ab-err" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {say}
      </p>

      <SegmentedTabs
        items={FILTERS.map((f) => ({ ...f, panelId: FILTER_PANEL }))}
        value={filter}
        onValueChange={setFilter}
        aria-label="업적 거르기"
        idBase="ab-filter"
        className="ab-filter"
      />

      <div
        id={FILTER_PANEL}
        role="tabpanel"
        aria-labelledby={`ab-filter-${filter}`}
        className="ab-sections"
      >
        {CATEGORY_ORDER.map((c) => {
          const list = visible.filter((e) => e.category === c);
          if (list.length === 0) return null;
          const all = entries.filter((e) => e.category === c);
          return (
            <section
              key={c}
              className="ab-sec"
              data-category={c}
              aria-labelledby={`ab-sec-${c}`}
            >
              <header className="ab-sec-head">
                <h2 id={`ab-sec-${c}`} className="ab-sec-t font-display">
                  {CATEGORY_LABEL[c]}
                </h2>
                <span className="ab-sec-n tabular-nums">
                  {all.filter(owned).length}/{all.length}
                </span>
              </header>
              {c === 'grit' ? (
                <p className="ab-grit">
                  <Sprout aria-hidden />
                  <span>
                    <b className="font-display">실수도 실력이 돼요!</b>{' '}
                    {CATEGORY_NOTE.grit}
                  </span>
                </p>
              ) : (
                <p className="ab-sec-note">{CATEGORY_NOTE[c]}</p>
              )}
              <ul className="ab-grid">
                {list.map((e) => (
                  <Tile
                    key={e.id}
                    entry={e}
                    busy={busy === e.id}
                    onOpen={() => {
                      play('tap');
                      setOpenId(e.id);
                    }}
                    onClaim={(b) => claim([e.id], e.id, b)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 && (
          <p className="ab-empty">
            {filter === 'earned'
              ? '아직 얻은 업적이 없어요. 첫 퀘스트를 풀어 볼까요?'
              : '모든 업적을 모았어요! 정말 대단해요.'}
          </p>
        )}
      </div>

      <Sheet
        title={open ? (open.state === 'secret' ? '비밀 업적' : open.name) : ''}
        open={open !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        align="center"
        media={open && <BookMedal entry={open} big />}
        data-testid="achievement-sheet"
      >
        {open && (
          <div className="ab-detail" data-state={open.state}>
            <p className="ab-detail-meta">
              <TierTag tier={open.tier} />
              <span>
                {CATEGORY_LABEL[open.category]} · 코인 {open.coins}
              </span>
            </p>
            <p className="ab-detail-text">{open.text}</p>
            {open.state === 'locked' && (
              <div className="ab-detail-prog">
                <ProgressBar
                  value={open.progress ?? 0}
                  max={Math.max(1, open.goal ?? 1)}
                  label={`${open.name} 진행`}
                  valueText={`${open.progress} / ${open.goal}`}
                />
                <span className="font-display tabular-nums" aria-hidden>
                  {open.progress}/{open.goal}
                </span>
              </div>
            )}
            {owned(open) && (
              <p className="ab-detail-date">
                {formatKstDate(open.achievedAt!)}에 얻었어요
              </p>
            )}
            {open.state === 'claimable' ? (
              <Button
                variant="reward"
                sfx={false}
                loading={busy === open.id}
                icon={<RewardIcon kind="coin" size={22} />}
                onClick={(ev) =>
                  claim([open.id], open.id, ev.currentTarget as HTMLElement)
                }
                data-testid="achievement-sheet-claim"
                className="w-full"
              >
                코인 {open.coins}개 받기
              </Button>
            ) : open.state === 'earned' ? (
              <p className="ab-detail-done">
                <Check aria-hidden strokeWidth={3} />
                코인을 받았어요
              </p>
            ) : null}
          </div>
        )}
      </Sheet>
      {layer}
    </div>
  );
}
