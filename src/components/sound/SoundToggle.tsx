'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useSfx, useSoundSettings } from '@/components/providers/SoundProvider';
import { cn } from '@/lib/utils';

/**
 * HUD 음소거 토글 (P2-14, P0-15 §4.7). 크롬북처럼 무음 스위치가 없는 교실 기기에서는 이것이 유일한 끄기 수단이라 늘 보이게 둔다.
 * 48px 터치 타겟, 상태는 아이콘 모양(스피커/스피커에 X) + 접근성 이름("소리 끄기"/"소리 켜기")으로 보인다.
 * 켤 때는 짧은 탭 소리로 켜진 것을 들려준다. 설정은 기기에 저장되고, 로그인 상태면 서버에도 저장된다 (`SoundSettingsSync`).
 * 디자인은 P2-11에서 HUD와 함께 다시 한다.
 */
export function SoundToggle({ className }: { className?: string }) {
  const [settings, setSettings] = useSoundSettings();
  const play = useSfx();
  const muted = settings.muted;
  const label = muted ? '소리 켜기' : '소리 끄기';

  return (
    <button
      type="button"
      onClick={() => {
        setSettings({ muted: !muted });
        if (muted) play('tap');
      }}
      aria-label={label}
      title={label}
      data-testid="sound-toggle"
      data-muted={muted}
      className={cn(
        'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        muted
          ? 'bg-muted text-muted-foreground hover:bg-muted/80'
          : 'bg-primary/10 text-primary hover:bg-primary/20',
        className,
      )}
    >
      {muted ? (
        <VolumeX aria-hidden className="h-5 w-5" />
      ) : (
        <Volume2 aria-hidden className="h-5 w-5" />
      )}
    </button>
  );
}
