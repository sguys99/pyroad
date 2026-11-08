'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import {
  AppIconMini,
  IosInstallGuide,
  IosInstallSteps,
} from '@/components/pwa/IosInstallGuide';
import { InstallAppCard } from '@/components/settings/InstallAppSection';
import type { InstallAction, InstallPlatform } from '@/lib/pwa/install';
import { PWA_MANIFEST_ICONS } from '@/lib/pwa/manifest';
import { Demo, Labeled, Section } from './ui';

const CARD_STATES: {
  label: string;
  platform: InstallPlatform;
  action: InstallAction;
}[] = [
  { label: '안드로이드: 설치 창 있음', platform: 'android', action: 'prompt' },
  { label: 'iPhone·iPad: 그림 안내', platform: 'ios', action: 'ios-guide' },
  { label: '이미 홈 화면에서 열림', platform: 'installed', action: 'installed' },
  {
    label: '카카오톡 등 앱 안 브라우저',
    platform: 'inapp',
    action: 'open-in-browser',
  },
  {
    label: '안드로이드: 설치 창 이벤트 없음 (메뉴 안내)',
    platform: 'android',
    action: 'none',
  },
];

/** 앱 아이콘 · 홈 화면에 추가 안내 (P4-11) */
export function PwaSection() {
  const [guide, setGuide] = useState<null | 'safari' | 'other'>(null);
  return (
    <Section
      id="pwa"
      kicker="앱 (P4-11)"
      title="앱 아이콘 · 홈 화면에 추가"
      description="아이콘은 빌드 때 그리는 PNG(파이뱀 리그 정지 그림, 초록 면·금색 반짝이). 안내는 로그인 뒤에만: 월드맵 쪽지(서로 다른 날 3번째 방문부터, 닫으면 30일) + 설정 화면 항목. 데스크톱·이미 설치·앱 안 브라우저에서는 쪽지를 띄우지 않아요."
    >
      <Demo
        label="아이콘 (실제 크기)"
        note="파비콘 32(16으로도 줄어듦) · apple-touch 180(불투명) · manifest 192·512 · maskable 512(가운데 80% 원 = 안전 영역)"
        data-testid="pwa-icons"
      >
        <div className="flex flex-wrap items-end gap-5">
          <Labeled label="파비콘 16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon" width={16} height={16} alt="파비콘 16px" />
          </Labeled>
          <Labeled label="파비콘 32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon" width={32} height={32} alt="파비콘 32px" />
          </Labeled>
          <Labeled label="apple-icon 180 → 60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/apple-icon"
              width={60}
              height={60}
              alt="홈 화면 아이콘"
              className="rounded-[13px]"
            />
          </Labeled>
          {Object.entries(PWA_MANIFEST_ICONS).map(([file, spec]) => (
            <Labeled key={file} label={`${file} → 96`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/pwa/${file}`}
                width={96}
                height={96}
                alt={`manifest 아이콘 ${spec.kind} ${spec.size}`}
                className={spec.kind === 'maskable' ? 'rounded-full' : undefined}
              />
            </Labeled>
          ))}
        </div>
      </Demo>

      <Demo
        label="월드맵 쪽지"
        note="공통 토스트 + 버튼(저절로 닫히지 않음). 닫기 = 30일 쉬기"
      >
        <Toast
          icon={<AppIconMini size={28} />}
          duration={0}
          onClose={() => {}}
          closeLabel="다음에 할게요"
          action={
            <Button size="sm" variant="primary" sfx={false}>
              추가하기
            </Button>
          }
        >
          파이뱀을 홈 화면에 데려가면 바로 모험을 열 수 있어요.
        </Toast>
      </Demo>

      <div className="grid gap-4 lg:grid-cols-2">
        {CARD_STATES.map((s) => (
          <Demo key={s.label} label={`설정 화면: ${s.label}`}>
            <InstallAppCard
              platform={s.platform}
              action={s.action}
              onStart={
                s.action === 'ios-guide' ? () => setGuide('safari') : undefined
              }
            />
          </Demo>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="iOS 그림 안내: Safari" surface="card">
          <IosInstallSteps safari />
          <Button
            variant="secondary"
            size="sm"
            sfx={false}
            onClick={() => setGuide('safari')}
            data-testid="pwa-guide-open"
          >
            시트로 열기
          </Button>
        </Demo>
        <Demo label="iOS 그림 안내: 다른 브라우저(Chrome 등)" surface="card">
          <IosInstallSteps safari={false} />
          <Button
            variant="secondary"
            size="sm"
            sfx={false}
            onClick={() => setGuide('other')}
          >
            시트로 열기
          </Button>
        </Demo>
      </div>

      <IosInstallGuide
        open={guide !== null}
        onOpenChange={(open) => !open && setGuide(null)}
        safari={guide !== 'other'}
      />
    </Section>
  );
}
