'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CalendarClock,
  Check,
  Download,
  Link2,
  MessageCircleWarning,
  RotateCcw,
  Share2,
  UserRound,
} from 'lucide-react';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import { useSfx } from '@/components/providers/soundContext';
import { useRewardFlights } from '@/components/world/DailyMissions';
import { Sheet } from '@/components/ui/sheet';
import { KakaoSymbol } from '@/components/auth/brandMarks';
import { SHARE_CTA_HREF } from '@/components/share/ShareCta';
import { track } from '@/lib/analytics/track';
import { formatKstDate } from '@/lib/time/kst';
import {
  copyText,
  isMobileUa,
  kakaoFeed,
  loadKakao,
  SHARE_CARD_FILENAME,
  SHARE_DESCRIPTION,
  SHARE_TITLE,
  sharePageUrl,
  type ShareCardCreated,
  type ShareChannel,
  type ShareRewardResult,
} from '@/lib/share-card/share';
import { COIN_RULES } from '@/lib/quest/coins';
import type { ShareCardKind } from '@/lib/share-card/types';
import { cn } from '@/lib/utils';
// 카카오 버튼 면 색은 카카오 가이드 그대로 (로그인 버튼과 같은 .g-social)
import '@/components/auth/social-login.css';

export interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 만들 카드 (`POST /api/share-cards {kind, ref?}`). 시트를 열 때 만들고, 다시 열면 그 카드를 그대로 쓴다 */
  kind: ShareCardKind;
  /** 스테이지 id(stage) · 업적 id(achievement) */
  cardRef?: string;
  /** 이미 만든 카드 (카탈로그 견본 등). 주면 만들기 요청을 하지 않는다 */
  card?: ShareCardCreated;
  /** 채널을 다 썼을 때 (보상 요청과 별개로 부름) */
  onShared?: (channel: ShareChannel) => void;
  /** 자랑하기 보상 요청 (P9-10, 기본 `POST /api/share-cards/reward`. 카탈로그·테스트용) */
  requestReward?: (cardId: string) => Promise<ShareRewardResult>;
}

async function postReward(cardId: string): Promise<ShareRewardResult> {
  const res = await fetch('/api/share-cards/reward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** 보상 줄: 안내(오늘 처음) · 받는 중 · 받음(+30) · 오늘은 이미 받음 */
type Reward = 'offer' | 'busy' | 'got' | 'claimed';

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; card: ShareCardCreated };

const FAILED = '카드를 만들지 못했어요. 잠시 뒤에 다시 해 줘.';

/**
 * 공유 시트 (P9-09). 카드 미리보기 + 카카오톡 · 공유하기(Web Share) · 이미지 저장 · 링크 복사 + 공유 전 안내(P9-11 요건).
 *
 * - 카카오: 키(`NEXT_PUBLIC_KAKAO_JS_KEY`)가 없으면 버튼을 숨긴다. SDK 는 시트를 열 때 미리 실어 둔다 — PC 는 누르는 순간
 *   팝업을 열어야 막히지 않는다. 못 실었거나 보내기가 실패하면 링크를 복사하고 알려 준다
 * - 공유하기: `navigator.share` 가 없으면 숨김(링크 복사가 대신). 그림 파일을 받을 수 있는 기기면 카드 그림 + 링크를 함께
 * - 이미지 저장: 휴대폰은 기기 공유 시트의 "이미지 저장"(iOS Safari 는 `<a download>`가 사진첩으로 가지 않음), 그 밖은 파일 내려받기.
 *   둘 다 안 되는 앱 속 브라우저는 그림을 새 창으로 열고 "꾹 눌러 저장" 안내
 * - 그림은 준비되면 한 번 받아 둔다: Safari 는 누른 뒤 기다리면(await fetch) 공유를 막는다(사용자 동작 시간 초과)
 */
export function ShareSheet({
  open,
  onOpenChange,
  kind,
  cardRef,
  card: givenCard,
  onShared,
  requestReward = postReward,
}: ShareSheetProps) {
  const [load, setLoad] = useState<Load>(
    givenCard ? { state: 'ready', card: givenCard } : { state: 'loading' },
  );
  const [file, setFile] = useState<File | null>(null);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [canWebShare, setCanWebShare] = useState(false);
  const [status, setStatus] = useState<{ text: string; copied?: boolean }>();
  const requested = useRef(false);
  const [reward, setReward] = useState<Reward>(
    givenCard?.rewardClaimed ? 'claimed' : 'offer',
  );
  const rewardRef = useRef<HTMLParagraphElement>(null);
  const claiming = useRef(false);
  const router = useRouter();
  const play = useSfx();
  const { launch, layer } = useRewardFlights();
  const hasKakaoKey = !!process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

  const create = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const res = await fetch('/api/share-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ref: cardRef }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        if (body?.rewardClaimed) setReward('claimed');
        return setLoad({ state: 'ready', card: body });
      }
      setLoad({
        state: 'error',
        // 보호자 동의 게이트(P3-15)·아직 자랑할 것이 없음(409)은 아이에게 보여 줄 문구를 준다
        message:
          body?.code === 'guardian_consent' || res.status === 409
            ? body.error
            : FAILED,
      });
    } catch {
      setLoad({ state: 'error', message: FAILED });
    }
  }, [kind, cardRef]);

  useEffect(() => {
    if (!open) return;
    track('share_open', { kind });
    setStatus(undefined);
    setCanWebShare(typeof navigator.share === 'function');
    if (hasKakaoKey) void loadKakao().then((sdk) => setKakaoReady(!!sdk));
    if (!givenCard && !requested.current) {
      requested.current = true;
      void create();
    }
  }, [open, kind, givenCard, hasKakaoKey, create]);

  const card = load.state === 'ready' ? load.card : null;

  // 그림을 미리 받아 둔다 (공유·저장이 누른 순간에 바로 되게)
  useEffect(() => {
    if (!card || !open) return;
    let alive = true;
    fetch(card.imageUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (alive && blob)
          setFile(
            new File([blob], SHARE_CARD_FILENAME[card.kind], {
              type: blob.type || 'image/png',
            }),
          );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [card, open]);

  // 자랑하기 보상 (P9-10, §12-Q67 ④): 어떤 채널이든 다 쓰면 한 번 요청. 금액·하루 1회는 서버가 정함
  const claimReward = async (cardId: string) => {
    // 연달아 눌러도 요청은 한 번 (상태는 다음 그리기에야 바뀜)
    if (reward !== 'offer' || claiming.current) return;
    claiming.current = true;
    setReward('busy');
    try {
      const res = await requestReward(cardId);
      if (res.already_claimed || res.coins_earned <= 0)
        return setReward('claimed');
      setReward('got');
      play('coin');
      launch(rewardRef.current, false);
      router.refresh();
    } catch {
      // 못 받았으면 안내로 되돌려 다음 공유 때 다시 (아이에게 오류를 보이지 않음 — 보상은 덤)
      setReward('offer');
    } finally {
      claiming.current = false;
    }
  };

  const done = (channel: ShareChannel, text?: string, copied = false) => {
    track('share_channel', { kind, channel });
    if (text) setStatus({ text, copied });
    if (card) void claimReward(card.id);
    onShared?.(channel);
  };

  const pageUrl = () => sharePageUrl(window.location.origin, card!.id);

  const copyLink = async (fallbackFrom?: 'kakao') => {
    const ok = await copyText(pageUrl());
    if (!ok) return setStatus({ text: '복사하지 못했어요. 다시 눌러 줘.' });
    done(
      'copy_link',
      fallbackFrom
        ? '카카오톡을 열 수 없어서 링크를 복사했어요. 붙여 넣어 보내 줘!'
        : '링크를 복사했어요! 보내고 싶은 곳에 붙여 넣어 줘.',
      true,
    );
  };

  const shareKakao = () => {
    if (!card) return;
    const sdk = window.Kakao;
    if (!kakaoReady || !sdk) return void copyLink('kakao');
    try {
      sdk.Share.sendDefault(
        kakaoFeed(card, window.location.origin, SHARE_CTA_HREF),
      );
      done('kakao');
    } catch {
      void copyLink('kakao');
    }
  };

  const shareFiles = (data: ShareData) =>
    file && navigator.canShare?.({ files: [file] })
      ? { ...data, files: [file] }
      : null;

  const webShare = async () => {
    if (!card) return;
    const base = {
      title: SHARE_TITLE[card.kind],
      text: SHARE_DESCRIPTION,
      url: pageUrl(),
    };
    try {
      await navigator.share(shareFiles(base) ?? base);
      done('web_share', '보냈어요!');
    } catch (e) {
      // 그만두기(AbortError)는 조용히
      if ((e as Error)?.name !== 'AbortError')
        setStatus({ text: '공유하지 못했어요. 링크 복사를 써 줘.' });
    }
  };

  const saveImage = async () => {
    if (!card) return;
    const withFile = isMobileUa(navigator.userAgent) ? shareFiles({}) : null;
    if (withFile) {
      try {
        await navigator.share(withFile);
        done('save_image', '사진첩에 저장했는지 확인해 줘!');
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError')
          setStatus({ text: '저장하지 못했어요. 다시 눌러 줘.' });
      }
      return;
    }
    if (file) {
      const href = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      return done('save_image', '그림을 내려받았어요!');
    }
    // 그림을 아직 못 받았거나 막힌 앱 속 브라우저: 그림만 열어 꾹 눌러 저장
    window.open(card.imageUrl, '_blank', 'noopener');
    done('save_image', '열린 그림을 꾹 눌러서 저장해 줘!');
  };

  const expires = card
    ? formatKstDate(new Date(card.expiresAt), 'monthDay')
    : '';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="친구에게 자랑하기"
      description="카드를 보낼 방법을 골라 줘."
      data-testid="share-sheet"
      className="sm:max-w-md"
    >
      <figure className="m-0 overflow-hidden rounded-2xl bg-surface-2 shadow-card">
        {card ? (
          // 사이트 안 동적 PNG(CDN 캐시)라 next/image 최적화를 거치지 않는다
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt="내 자랑 카드 미리보기"
            width={1200}
            height={630}
            className="block aspect-[1200/630] h-auto w-full"
            data-testid="share-sheet-preview"
          />
        ) : (
          <div
            className={cn(
              'grid aspect-[1200/630] place-items-center gap-2 p-4 text-center text-small text-muted-foreground',
            )}
            aria-busy={load.state === 'loading'}
          >
            {load.state === 'error' ? (
              <div className="grid justify-items-center gap-3">
                <p className="m-0" role="alert">
                  {load.message}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw aria-hidden />}
                  onClick={() => void create()}
                >
                  다시 해 보기
                </Button>
              </div>
            ) : (
              <p className="m-0">카드를 만들고 있어요…</p>
            )}
          </div>
        )}
      </figure>

      <div className="grid gap-2.5">
        {hasKakaoKey && (
          <button
            type="button"
            className="g-social"
            data-provider="kakao"
            disabled={!card}
            onClick={shareKakao}
            data-testid="share-kakao"
          >
            <KakaoSymbol className="size-5" />
            카카오톡으로 보내기
          </button>
        )}
        <div
          className={cn(
            'grid gap-2',
            canWebShare ? 'grid-cols-3' : 'grid-cols-2',
          )}
        >
          {canWebShare && (
            <ShareTile
              icon={<Share2 aria-hidden />}
              label="공유하기"
              disabled={!card}
              onClick={() => void webShare()}
              testId="share-web"
            />
          )}
          <ShareTile
            icon={<Download aria-hidden />}
            label="이미지 저장"
            disabled={!card}
            onClick={() => void saveImage()}
            testId="share-save"
          />
          <ShareTile
            icon={
              status?.copied ? <Check aria-hidden /> : <Link2 aria-hidden />
            }
            label={status?.copied ? '복사했어요' : '링크 복사'}
            disabled={!card}
            onClick={() => void copyLink()}
            testId="share-copy"
          />
        </div>
        <p
          role="status"
          // 비어 있으면 위 간격을 지워 자리를 차지하지 않는다 (알림 영역은 늘 있어야 낭독기가 읽음)
          className="m-0 text-center text-small font-semibold text-primary-text empty:-mt-2.5"
          data-testid="share-status"
        >
          {status?.text}
        </p>
        <p
          ref={rewardRef}
          className="m-0 flex items-center justify-center gap-1.5 text-small text-muted-foreground data-[state=got]:font-semibold data-[state=got]:text-foreground"
          data-state={reward}
          data-testid="share-reward"
          aria-live="polite"
        >
          <RewardIcon kind="coin" size={20} />
          {reward === 'got' ? (
            <>
              <b className="font-display text-foreground">
                +{COIN_RULES.share}
              </b>{' '}
              코인을 받았어요!
            </>
          ) : reward === 'claimed' ? (
            '오늘 보상은 받았어요'
          ) : (
            `오늘 처음 자랑하면 ${COIN_RULES.share}코인`
          )}
        </p>
      </div>
      {layer}

      <ul
        className="m-0 grid list-none gap-2 rounded-2xl bg-surface-2 p-3.5 text-small text-muted-foreground"
        aria-label="보내기 전에 알아 두기"
        data-testid="share-notice"
      >
        <Notice icon={<UserRound aria-hidden />}>
          카드에는 <b className="text-foreground">닉네임과 캐릭터</b>만 보여요.
        </Notice>
        <Notice icon={<CalendarClock aria-hidden />}>
          링크는 90일 동안 열려요{expires && ` (${expires}까지)`}. 그다음엔
          저절로 닫혀요.
        </Notice>
        <Notice icon={<MessageCircleWarning aria-hidden />}>
          카카오톡으로 이미 보낸 메시지의 미리보기 그림은 나중에 지울 수 없어요.
        </Notice>
      </ul>
    </Sheet>
  );
}

function ShareTile({
  icon,
  label,
  disabled,
  onClick,
  testId,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-1 py-2.5 text-small font-semibold text-foreground transition-colors hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
    >
      <span className="grid size-10 place-items-center rounded-full bg-surface text-primary-text shadow-card [&_svg]:size-5">
        {icon}
      </span>
      {label}
    </button>
  );
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
      <span className="mt-0.5 text-primary-text [&_svg]:size-4.5">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
