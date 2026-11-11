'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Bell,
  Flame,
  ListChecks,
  Menu,
  MessageSquare,
  Shield,
  Store,
} from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { HudCounter, LevelSeal } from '@/components/ui/hud';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Sheet } from '@/components/ui/sheet';
import { Toast, ToastRegion } from '@/components/ui/toast';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { LogoutButton } from '@/components/LogoutButton';
import { SoundToggle } from '@/components/sound/SoundToggle';
import type { SkinId } from '@/lib/avatar/skins';
import { getXPProgress } from '@/lib/quest/xp';
import type { Streak } from '@/lib/time/streak';

import './worldHud.css';

/**
 * 월드맵·책장 상단 HUD (P5-07, Q47). 위에 붙어 따라오는 얇은 바: 아바타+닉네임(→ /profile) · 레벨 도장 + XP 바 ·
 * 스트릭 불꽃 · 코인 잔액(P8-04, 퀘스트에서 받고 돌아오면 지난번 본 값부터 카운트업) · 오늘의 미션 칸(P8-07, 달성 수 + 받을 보상 금색 점 →
 * 미션 시트, 모든 폭) · "곧 열려요" 칩(상점, Phase 9) · 소리 토글 · 메뉴(공지·게시판·로그아웃 시트).
 * 곧 열려요 칩 둘은 1024px 미만에서 버튼 하나로 합쳐지고 640px 미만에서는 빠진다(코인 칩 자리). 640px 미만은 XP 바가 바 아래
 * 가는 띠로, 400px 미만은 닉네임 글자도 빠진다(아바타 링크 낭독은 그대로). 모양·연출은 `worldHud.css`
 */
export interface WorldHudProps {
  name: string;
  skin: SkinId;
  totalXp: number;
  level: number;
  /** 코인 잔액 (users.coins) */
  coins: number;
  streak: Streak;
  /** 가진 스트릭 방패 (P8-08, 0~2). 불꽃 칩 모서리에 작은 방패 그림으로 */
  shields?: number;
  /** 어제를 방패가 메웠음 (P8-08) → 불꽃 쪽지에 "방패가 불꽃을 지켜 줬어요" */
  shieldSaved?: boolean;
  /** 메뉴 시트 맨 위 출석 달력 (P8-08, `AttendanceCalendar`). 출석 진입점은 HUD 바에 더 두지 않음 */
  attendance?: ReactNode;
  /** 오늘의 미션 칸 (P8-07, `MissionHudButton` — 서버는 Suspense 로 감싼 슬롯). 없으면 미션도 "곧 열려요"에 남음 */
  missions?: ReactNode;
}

const SOON = [
  { key: 'mission', label: '오늘의 미션', icon: <ListChecks aria-hidden /> },
  { key: 'shop', label: '상점', icon: <Store aria-hidden /> },
] as const;

const SOON_TAIL = '곧 열려요! 조금만 기다려 줘.';

/** 이 탭에서 마지막으로 본 코인 (sessionStorage). 퀘스트에서 받고 지도로 돌아오면 그 값부터 센다 */
const SEEN_COINS_KEY = 'pyroad:hud-coins';

function useSeenCoins(coins: number): number | undefined {
  // 서버 HTML 은 잔액 그대로(HudCounter 첫 값) — 지난 값은 그리기 전 처음 한 번만 쓰므로 hydration 이 어긋나지 않음
  const [from] = useState(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const raw = window.sessionStorage.getItem(SEEN_COINS_KEY);
      const n = raw === null ? NaN : Number(raw);
      return Number.isInteger(n) && n >= 0 ? n : undefined;
    } catch {
      return undefined;
    }
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SEEN_COINS_KEY, String(coins));
    } catch {
      // 저장소를 못 쓰면 카운트업만 없음
    }
  }, [coins]);
  return from;
}

/** 불꽃 이름(낭독기·툴팁)과 눌렀을 때 쪽지. 방패(P8-08)가 있으면 개수, 어제를 방패가 메웠으면 그 안내를 덧붙임 */
export function streakText(
  { days, today }: Streak,
  shields = 0,
  shieldSaved = false,
): {
  label: string;
  note: string;
} {
  const shieldLabel = shields > 0 ? `, 방패 ${shields}개` : '';
  const shieldNote =
    (shieldSaved ? ' 어제는 방패가 불꽃을 지켜 줬어요.' : '') +
    (shields > 0 ? ` 방패 ${shields}개가 하루 쉬어도 불꽃을 지켜 줘요.` : '');
  if (days === 0) {
    return {
      label: `불꽃이 꺼져 있어요${shieldLabel}`,
      note:
        '불꽃이 꺼져 있어요. 오늘 퀘스트를 하나 풀면 불꽃이 켜져요!' +
        (shields > 0 ? ` 방패 ${shields}개를 가지고 있어요.` : ''),
    };
  }
  const label = `${days}일 연속 모험 중`;
  return {
    label: label + shieldLabel,
    note:
      (today
        ? `${label}이에요! 내일도 만나요.`
        : `${label}이에요! 오늘도 풀면 ${days + 1}일이 돼요.`) + shieldNote,
  };
}

/** 불꽃을 마지막으로 본 일수 (localStorage, 기기마다). 불꽃이 처음 켜진 날·3일이 된 날 한 번 반짝이는 데 씀 */
const SEEN_STREAK_KEY = 'pyroad:hud-streak';

/**
 * 불꽃 반짝임 (P5-07 제안 승인, P8-08): 오늘 풀어서 1일(처음 켜짐) 또는 3일이 됐고, 이 기기에서 그 값을 아직 못 봤으면 한 번.
 * 서버 HTML 에는 없고 그린 뒤에 붙음(hydration 같음). 저장소를 못 쓰면 반짝이지 않음(매번 반짝이지 않게)
 */
export function useStreakSpark({ days, today }: Streak): boolean {
  const [spark, setSpark] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEEN_STREAK_KEY);
      const prev = raw === null ? 0 : Number(raw);
      window.localStorage.setItem(SEEN_STREAK_KEY, String(days));
      if (today && (days === 1 || days === 3) && !(prev >= days)) {
        setSpark(true);
      }
    } catch {
      // 저장소를 못 쓰면 반짝임 없음
    }
  }, [days, today]);
  return spark;
}

export function WorldHud({
  name,
  skin,
  totalXp,
  level,
  coins,
  streak,
  shields = 0,
  shieldSaved = false,
  attendance,
  missions,
}: WorldHudProps) {
  const soon = missions ? SOON.filter((s) => s.key !== 'mission') : SOON;
  const soonName = soon.map((s) => s.label).join('·');
  const coinsFrom = useSeenCoins(coins);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const say = (text: string) =>
    setNote((n) => ({ id: (n?.id ?? 0) + 1, text }));

  const { currentLevelXP, nextLevelXP } = getXPProgress(totalXp);
  const max = nextLevelXP === null ? 1 : nextLevelXP - currentLevelXP;
  const value = nextLevelXP === null ? 1 : totalXp - currentLevelXP;
  const fire = streakText(streak, shields, shieldSaved);
  const spark = useStreakSpark(streak);

  return (
    <header className="wh" data-testid="world-hud">
      <div className="wh-in">
        <Link
          href="/profile"
          className="wh-me focus-ring"
          aria-label={`${name}, 내 프로필`}
          data-testid="hud-profile"
        >
          <UserAvatar skin={skin} size={32} className="wh-avatar" />
          <span className="wh-name">{name}</span>
        </Link>

        <span className="wh-lv">
          <LevelSeal level={level} />
          <span className="wh-xp">
            <span className="wh-xp-k" aria-hidden>
              경험치
            </span>
            <ProgressBar
              value={value}
              max={max}
              size="sm"
              label="다음 레벨까지 경험치"
              valueText={
                nextLevelXP === null ? '최고 레벨' : `${value} / ${max} XP`
              }
              animateOnMount
            />
          </span>
        </span>

        <button
          type="button"
          className="wh-chip wh-streak focus-ring"
          data-on={streak.days > 0 || undefined}
          data-spark={spark || undefined}
          aria-label={fire.label}
          title={fire.label}
          onClick={() => say(fire.note)}
          data-testid="hud-streak"
        >
          <Flame aria-hidden />
          <span aria-hidden className="wh-num font-display tabular-nums">
            {streak.days}
            <span className="wh-streak-u">일</span>
          </span>
          {shields > 0 && (
            <span
              className="wh-shields"
              aria-hidden
              data-testid="hud-shields"
              data-n={shields}
            >
              {Array.from({ length: shields }, (_, i) => (
                <Shield key={i} strokeWidth={2.6} />
              ))}
            </span>
          )}
        </button>

        <HudCounter kind="coin" value={coins} from={coinsFrom} />

        {missions}

        <span className="wh-soon" role="group" aria-label="곧 열려요">
          <span className="wh-soon-k" aria-hidden>
            곧 열려요
          </span>
          {soon.map((s) => (
            <button
              key={s.key}
              type="button"
              className="wh-soon-b focus-ring"
              aria-label={`${s.label}, 곧 열려요`}
              title={`${s.label} · 곧 열려요`}
              onClick={() => say(`${s.label}은 ${SOON_TAIL}`)}
              data-testid={`hud-soon-${s.key}`}
            >
              {s.icon}
            </button>
          ))}
        </span>
        <button
          type="button"
          className="wh-soon-one focus-ring"
          aria-label={`${soonName}, 곧 열려요`}
          onClick={() => say(`${soonName}은 ${SOON_TAIL}`)}
          data-testid="hud-soon"
        >
          {missions ? <Store aria-hidden /> : <ListChecks aria-hidden />}
        </button>

        <SoundToggle className="wh-icon wh-sound" />

        <Sheet
          title="메뉴"
          trigger={
            <IconButton label="메뉴" className="wh-icon" data-testid="hud-menu">
              <Menu aria-hidden />
            </IconButton>
          }
          data-testid="hud-menu-sheet"
        >
          <nav aria-label="메뉴" className="grid gap-2">
            {attendance}
            {/* 400px 미만은 바에 자리가 없어 소리 토글이 여기로 (미션 칸 P8-07) */}
            <div className="wh-menu-sound">
              <span>소리</span>
              <SoundToggle />
            </div>
            <Button
              href="/notice"
              variant="secondary"
              icon={<Bell aria-hidden />}
              className="w-full"
            >
              공지사항
            </Button>
            <Button
              href="/board"
              variant="secondary"
              icon={<MessageSquare aria-hidden />}
              className="w-full"
            >
              게시판
            </Button>
            <LogoutButton variant="menu" />
          </nav>
        </Sheet>
      </div>

      <ToastRegion className="wh-toast" label="HUD 안내">
        {note && (
          <Toast key={note.id} onClose={() => setNote(null)}>
            {note.text}
          </Toast>
        )}
      </ToastRegion>
    </header>
  );
}
