'use client';

import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppIconMini, IosInstallGuide } from '@/components/pwa/IosInstallGuide';
import { useInstallFlow } from '@/components/pwa/useInstallFlow';
import type { InstallAction, InstallPlatform } from '@/lib/pwa/install';

/**
 * 설정 화면 "홈 화면에 추가" (P4-11). 아이·보호자가 원할 때 언제든 할 수 있는 자리(월드맵 쪽지는 가끔 한 번만).
 * 다른 설정 절과 같은 카드·글자 크기·터치 크기.
 *
 * 상태: 안드로이드 설치 창 · iOS 그림 안내 · 이미 홈 화면에서 열림 · 앱 안 브라우저(기본 브라우저로 열어 달라고) ·
 * 안드로이드인데 설치 창 이벤트가 없음(브라우저 메뉴 안내). 데스크톱과 하이드레이션 전에는 그리지 않는다.
 */
export function InstallAppSection() {
  const flow = useInstallFlow('settings');
  if (!flow.platform || flow.platform === 'desktop') return null;
  return (
    <>
      <InstallAppCard
        platform={flow.platform}
        action={flow.action}
        onStart={flow.start}
      />
      <IosInstallGuide
        open={flow.guideOpen}
        onOpenChange={flow.onGuideOpenChange}
        safari={flow.iosSafari}
      />
    </>
  );
}

const BODY: Record<InstallAction, string> = {
  prompt: '파이뱀 아이콘을 홈 화면에 두면 앱처럼 바로 모험을 열 수 있어요.',
  'ios-guide':
    '파이뱀 아이콘을 홈 화면에 두면 앱처럼 바로 모험을 열 수 있어요. 방법을 그림으로 알려 줄게요.',
  installed: '지금 홈 화면에서 열었어요. 이미 추가되어 있어요!',
  'open-in-browser':
    '카카오톡 같은 앱 안에서는 추가할 수 없어요. 크롬이나 사파리 같은 인터넷 앱에서 열어 주세요.',
  none: '인터넷 앱의 메뉴(⋮)에서 ‘홈 화면에 추가’나 ‘앱 설치’를 눌러요.',
};

/** 카드 (상태별 진열을 위해 기기 판별과 나눔: 카탈로그가 직접 그린다) */
export function InstallAppCard({
  platform,
  action,
  onStart,
}: {
  platform: InstallPlatform;
  action: InstallAction;
  onStart?: () => void;
}) {
  const canStart = action === 'prompt' || action === 'ios-guide';
  return (
    <section
      aria-labelledby="install-app-title"
      className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
      data-testid="install-app-settings"
      data-platform={platform}
      data-action={action}
    >
      <h2
        id="install-app-title"
        className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground"
      >
        <Smartphone aria-hidden className="h-5 w-5 text-accent-foreground" />
        {'홈 화면에 추가'}
      </h2>
      <div className="flex items-center gap-3">
        <AppIconMini size={48} />
        <p className="min-w-0 flex-1 text-base text-muted-foreground">
          {BODY[action]}
        </p>
      </div>
      {canStart && (
        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={onStart}>
            {action === 'prompt' ? '홈 화면에 추가하기' : '방법 보기'}
          </Button>
        </div>
      )}
    </section>
  );
}
