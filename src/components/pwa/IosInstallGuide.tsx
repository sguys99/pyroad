'use client';

import type { ReactNode } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Copy,
  Ellipsis,
  Share,
  SquarePlus,
} from 'lucide-react';
import { PybaemStatic } from '@/components/characters/rig';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * iPhone·iPad "홈 화면에 추가" 그림 안내 (P4-11). iOS에는 설치 API가 없어 공유 메뉴를 그림 세 장으로 보여 준다.
 * 공통 시트(모바일 아래 시트·넓은 화면 가운데 대화 상자). 그림은 장식(`aria-hidden`)이고 같은 내용을 글로 쓴다.
 *
 * Safari 버전마다 공유 버튼 자리가 달라(아래 막대·주소창 옆·⋯ 메뉴 안) "안 보이면 ⋯"을 함께 적는다.
 * 아이폰 공유 모양은 lucide `Share`(네모 + 위 화살표)로 그린다 — 애플 그림 파일을 쓰지 않는다
 */
export function IosInstallGuide({
  open,
  onOpenChange,
  safari,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Safari면 "화면 아래(아이패드는 위)", 다른 브라우저면 "주소창 옆" */
  safari: boolean;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="홈 화면에 파이뱀 데려가기"
      description="한 번 추가해 두면 앱처럼 바로 열 수 있어요."
      data-testid="ios-install-guide"
      footer={
        <SheetClose render={<Button variant="primary" />}>알겠어요</SheetClose>
      }
    >
      <IosInstallSteps safari={safari} />
    </Sheet>
  );
}

/** 단계 목록 (시트 밖 카탈로그에서도 그대로 보여 줌) */
export function IosInstallSteps({ safari }: { safari: boolean }) {
  return (
    <ol className="grid gap-3" data-testid="ios-install-steps">
      <Step
        n={1}
        art={<ToolbarArt />}
        text={
          safari
            ? '화면 아래(아이패드는 위)에 있는 공유 버튼을 눌러요. 안 보이면 ⋯ 버튼을 먼저 눌러요.'
            : '주소창 옆에 있는 공유 버튼을 눌러요. 안 보이면 ⋯ 메뉴에서 찾아요.'
        }
      />
      <Step
        n={2}
        art={<MenuArt />}
        text="‘홈 화면에 추가’를 눌러요. 안 보이면 목록을 위로 밀어서 찾아요."
      />
      <Step
        n={3}
        art={<HomeArt />}
        text="오른쪽 위 ‘추가’를 누르면 홈 화면에 파이뱀이 생겨요!"
      />
    </ol>
  );
}

function Step({ n, art, text }: { n: number; art: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
      <span
        aria-hidden
        className="grid size-8 flex-none place-items-center rounded-full bg-accent font-display text-base text-on-accent"
      >
        {n}
      </span>
      <p className="min-w-0 flex-1 text-small font-medium text-text">
        <span className="sr-only">{n}단계: </span>
        {text}
      </p>
      <div
        aria-hidden
        className="grid h-20 w-28 flex-none place-items-center overflow-hidden rounded-xl bg-surface"
      >
        {art}
      </div>
    </li>
  );
}

/** 강조 고리: 눌러야 할 곳 (금색 = "지금 여기") */
function Spot({ children, on }: { children: ReactNode; on?: boolean }) {
  return (
    <span
      className={cn(
        'grid size-6 place-items-center rounded-full text-text-muted',
        on && 'bg-accent-soft text-accent-text ring-2 ring-accent',
      )}
    >
      {children}
    </span>
  );
}

/** ① 브라우저 아래 막대: 공유 버튼 강조 */
function ToolbarArt() {
  const icon = 'size-3.5';
  return (
    <div className="flex w-full flex-col justify-end self-stretch">
      <div className="mx-2 mb-2 h-3 rounded-full bg-surface-2" />
      <div className="flex items-center justify-around border-t border-line px-1 py-1.5">
        <Spot>
          <ChevronLeft className={icon} strokeWidth={2.4} />
        </Spot>
        <Spot>
          <ChevronRight className={icon} strokeWidth={2.4} />
        </Spot>
        <Spot on>
          <Share className={icon} strokeWidth={2.4} />
        </Spot>
        <Spot>
          <Ellipsis className={icon} strokeWidth={2.4} />
        </Spot>
      </div>
    </div>
  );
}

/** ② 공유 메뉴: 줄 셋 중 "홈 화면에 추가"(네모 + 더하기) 줄 강조. 작은 글자 대신 막대로 */
function MenuArt() {
  const row = 'flex items-center justify-between gap-2 rounded-md px-2 py-1';
  const bar = 'h-1.5 flex-1 rounded-full';
  return (
    <div className="grid w-full gap-1 px-1.5 text-text-muted">
      <div className={row}>
        <span className={cn(bar, 'bg-surface-2')} />
        <Copy className="size-3.5" />
      </div>
      <div className={row}>
        <span className={cn(bar, 'bg-surface-2')} />
        <Bookmark className="size-3.5" />
      </div>
      <div
        className={cn(
          row,
          'bg-accent-soft text-accent-text ring-2 ring-accent ring-inset',
        )}
      >
        <span className={cn(bar, 'bg-accent-light')} />
        <SquarePlus className="size-3.5" strokeWidth={2.4} />
      </div>
    </div>
  );
}

/** ③ 홈 화면: 다른 앱 칸 사이에 파이뱀 아이콘 */
function HomeArt() {
  return (
    <div className="grid grid-cols-3 gap-1.5 px-2">
      <span className="size-7 rounded-lg bg-surface-2" />
      <span className="size-7 rounded-lg bg-surface-2" />
      <span className="rounded-lg ring-2 ring-accent ring-offset-1 ring-offset-surface">
        <AppIconMini size={28} />
      </span>
      <span className="size-7 rounded-lg bg-surface-2" />
      <span className="size-7 rounded-lg bg-surface-2" />
      <span className="size-7 rounded-lg bg-surface-2" />
    </div>
  );
}

/** 앱 아이콘 축소판 (아이콘 그림 `src/lib/pwa/iconArt.tsx`와 같은 구성: 초록 면 + 파이뱀) */
export function AppIconMini({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-grid place-items-center overflow-hidden bg-primary align-middle"
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    >
      <PybaemStatic
        state="idle"
        size={Math.round(size * 0.9)}
        filters={false}
        label=""
      />
    </span>
  );
}
