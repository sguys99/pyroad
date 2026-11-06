'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useSfx, useSoundSettings } from '@/components/providers/SoundProvider';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/button';

/**
 * HUD 음소거 토글 (P2-14, P0-15 §4.7). 크롬북처럼 무음 스위치가 없는 교실 기기에서는 이것이 유일한 끄기 수단이라 늘 보이게 둔다.
 * 48px 터치 타겟, 상태는 아이콘 모양(스피커/스피커에 X) + 접근성 이름("소리 끄기"/"소리 켜기")으로 보인다.
 * 켤 때는 짧은 탭 소리로 켜진 것을 들려준다. 설정은 기기에 저장되고, 로그인 상태면 서버에도 저장된다 (`SoundSettingsSync`).
 * 모양은 HUD 아이콘 버튼(P2-11, `IconButton`): 보조 면 원, 꺼지면 아이콘이 흐린 색.
 */
export function SoundToggle({ className }: { className?: string }) {
  const [settings, setSettings] = useSoundSettings();
  const play = useSfx();
  const muted = settings.muted;
  const label = muted ? '소리 켜기' : '소리 끄기';

  return (
    <IconButton
      onClick={() => {
        setSettings({ muted: !muted });
        if (muted) play('tap');
      }}
      label={label}
      title={label}
      data-testid="sound-toggle"
      data-muted={muted}
      className={cn(muted && 'text-muted-foreground', className)}
    >
      {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
    </IconButton>
  );
}
