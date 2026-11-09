'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Flame,
  ListChecks,
  Menu,
  MessageSquare,
  Store,
} from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { LevelSeal } from '@/components/ui/hud';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon } from '@/components/ui/reward-icon';
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
 * 스트릭 불꽃 · "곧 열려요" 칩(코인·오늘의 미션·상점, Phase 8~9에서 값만 연결) · 소리 토글 · 메뉴(공지·게시판·로그아웃 시트).
 * 640px 미만은 XP 바가 바 아래 가는 띠로 내려가고 곧 열려요 칩 셋이 버튼 하나로 합쳐진다. 모양·연출은 `worldHud.css`
 */
export interface WorldHudProps {
  name: string;
  skin: SkinId;
  totalXp: number;
  level: number;
  streak: Streak;
}

const SOON = [
  { key: 'coin', label: '코인', icon: <RewardIcon kind="coin" size={22} /> },
  { key: 'mission', label: '오늘의 미션', icon: <ListChecks aria-hidden /> },
  { key: 'shop', label: '상점', icon: <Store aria-hidden /> },
] as const;

const SOON_TAIL = '곧 열려요! 조금만 기다려 줘.';

/** 불꽃 이름(낭독기·툴팁)과 눌렀을 때 쪽지 */
export function streakText({ days, today }: Streak): {
  label: string;
  note: string;
} {
  if (days === 0) {
    return {
      label: '불꽃이 꺼져 있어요',
      note: '불꽃이 꺼져 있어요. 오늘 퀘스트를 하나 풀면 불꽃이 켜져요!',
    };
  }
  const label = `${days}일 연속 모험 중`;
  return {
    label,
    note: today
      ? `${label}이에요! 내일도 만나요.`
      : `${label}이에요! 오늘도 풀면 ${days + 1}일이 돼요.`,
  };
}

export function WorldHud({
  name,
  skin,
  totalXp,
  level,
  streak,
}: WorldHudProps) {
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const say = (text: string) =>
    setNote((n) => ({ id: (n?.id ?? 0) + 1, text }));

  const { currentLevelXP, nextLevelXP } = getXPProgress(totalXp);
  const max = nextLevelXP === null ? 1 : nextLevelXP - currentLevelXP;
  const value = nextLevelXP === null ? 1 : totalXp - currentLevelXP;
  const fire = streakText(streak);

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
        </button>

        <span className="wh-soon" role="group" aria-label="곧 열려요">
          <span className="wh-soon-k" aria-hidden>
            곧 열려요
          </span>
          {SOON.map((s) => (
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
          aria-label="코인·오늘의 미션·상점, 곧 열려요"
          onClick={() => say(`코인·오늘의 미션·상점은 ${SOON_TAIL}`)}
          data-testid="hud-soon"
        >
          <RewardIcon kind="coin" size={22} />
        </button>

        <SoundToggle className="wh-icon" />

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
