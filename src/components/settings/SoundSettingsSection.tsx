'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Music, Play, Square, Volume2 } from 'lucide-react';
import {
  useSfx,
  useSoundEngine,
  useSoundSettings,
  useSoundSnapshot,
} from '@/components/providers/SoundProvider';
import type { CategorySetting, SoundCategory } from '@/lib/sound';
import { getSoundSettingsSaver, type SoundSaveStatus } from '@/lib/sound/sync';
import { cn } from '@/lib/utils';

/**
 * 설정 화면 "소리" (P2-14). 움직임 절(P2-15)과 같은 카드·글자 크기·48px 터치 타겟.
 *
 * 효과음·배경음악·음성 각각 켜기/크기 + 전체 끄기(HUD 음소거와 같은 값). 기본값은 효과음 켜짐·배경음악 꺼짐(§12-Q8).
 * 바꾸면 바로 적용되고(엔진 + 기기 사본) 로그인 레이아웃의 `SoundSettingsSync`가 서버 `users.settings.sound`에 저장한다
 * (원자적 갱신 `PATCH /api/settings`, 저장 상태는 같은 저장기에서 읽음). 음성(읽어주기)은 아직 없어서 "준비 중"으로 비활성.
 * 소리를 들어 보는 버튼은 아이가 직접 누를 때만 소리를 낸다 (자동재생 없음).
 */

function useSaveStatus(): SoundSaveStatus {
  const saver = getSoundSettingsSaver();
  return useSyncExternalStore(
    saver.subscribe,
    saver.getStatus,
    () => 'idle' as const,
  );
}

function Switch({
  checked,
  onChange,
  label,
  disabled,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cn(
        'group inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-1 text-base font-bold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {/* 상태를 색만이 아니라 글자·손잡이 위치로도 */}
      <span className="w-10 text-right text-foreground">
        {checked ? '켜짐' : '꺼짐'}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-8 w-14 items-center rounded-full border-2 transition-colors',
          checked
            ? 'border-primary bg-primary'
            : 'border-muted-foreground bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 h-6 w-6 rounded-full shadow-sm transition-transform',
            checked
              ? 'translate-x-6 bg-primary-foreground'
              : 'translate-x-0 bg-muted-foreground',
          )}
        />
      </span>
    </button>
  );
}

function VolumeSlider({
  value,
  onChange,
  onCommit,
  label,
  disabled,
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  label: string;
  disabled?: boolean;
  testId: string;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className="flex min-h-12 items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${percent}%`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        data-testid={testId}
        className="h-12 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="w-12 text-right text-base tabular-nums text-foreground">
        {percent}%
      </span>
    </div>
  );
}

interface CategoryRowProps {
  category: SoundCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  comingSoon?: boolean;
  onPreview?: () => void;
  previewLabel?: string;
  previewActive?: boolean;
  value: CategorySetting;
  muted: boolean;
  onChange: (patch: Partial<CategorySetting>) => void;
  onCommit?: () => void;
}

function CategoryRow({
  category,
  title,
  description,
  icon,
  comingSoon,
  onPreview,
  previewLabel,
  previewActive,
  children,
  value,
  muted,
  onChange,
  onCommit,
}: CategoryRowProps) {
  const off = comingSoon || !value.enabled;
  return (
    <div
      className="rounded-xl border-2 border-border bg-card px-3 py-3"
      data-testid={`sound-${category}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-text"
        >
          {icon}
        </span>
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[17px] font-bold leading-snug text-foreground">
          {title}
          {comingSoon && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-medium text-foreground">
              준비 중
            </span>
          )}
        </p>
        <Switch
          checked={!comingSoon && value.enabled}
          disabled={comingSoon}
          onChange={(enabled) => onChange({ enabled })}
          label={`${title} 켜기`}
          testId={`sound-${category}-switch`}
        />
      </div>
      {/* 설명은 좁은 화면에서도 한 줄 폭을 다 쓰도록 제목 줄 아래에 */}
      <p className="mt-1 text-base leading-snug text-muted-foreground">
        {description}
      </p>
      <VolumeSlider
        value={value.volume}
        disabled={off}
        onChange={(volume) => onChange({ volume })}
        onCommit={onCommit}
        label={`${title} 크기`}
        testId={`sound-${category}-volume`}
      />
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          disabled={off || muted}
          aria-pressed={previewActive}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-2 text-base font-medium text-foreground underline underline-offset-4 hover:bg-muted disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        >
          {previewActive ? (
            <Square aria-hidden className="h-4 w-4" />
          ) : (
            <Play aria-hidden className="h-4 w-4" />
          )}
          {previewLabel}
        </button>
      )}
      {children}
    </div>
  );
}

export function SoundSettingsSection() {
  const [settings, setSettings] = useSoundSettings();
  const { bgmAllowed, playingBgm } = useSoundSnapshot();
  const engine = useSoundEngine();
  const play = useSfx();
  const status = useSaveStatus();
  const groupId = useId();
  const [bgmPreview, setBgmPreview] = useState(false);

  // 배경음악 들어 보기: 이 화면에 있는 동안만, 끄거나 나가면 멈춤
  useEffect(() => {
    if (!bgmPreview) return;
    engine.playBgm('world1', { fadeMs: 400 });
    return () => engine.stopBgm({ fadeMs: 400 });
  }, [bgmPreview, engine]);
  useEffect(() => {
    if (!settings.bgm.enabled || settings.muted) setBgmPreview(false);
  }, [settings.bgm.enabled, settings.muted]);

  return (
    <section
      aria-labelledby={`${groupId}-title`}
      className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
      data-testid="sound-settings"
    >
      <h2
        id={`${groupId}-title`}
        className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground"
      >
        <Volume2 aria-hidden className="h-5 w-5 text-accent-foreground" />
        소리
      </h2>
      <p className="mb-3 text-base text-muted-foreground">
        효과음과 배경음악을 켜고 끄거나 크기를 골라요. 화면 위 스피커 단추로도
        소리를 끌 수 있어요.
      </p>

      <div className="mb-3 flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 border-border bg-card px-3 py-2">
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-snug text-foreground">
            소리 모두 끄기
          </p>
          <p className="text-base leading-snug text-muted-foreground">
            교실처럼 조용해야 할 때 켜요.
          </p>
        </div>
        <Switch
          checked={settings.muted}
          onChange={(muted) => {
            setSettings({ muted });
            if (!muted) play('tap');
          }}
          label="소리 모두 끄기"
          testId="sound-mute-switch"
        />
      </div>

      <div className="flex flex-col gap-3">
        {settings.muted && (
          <p className="text-base font-medium text-foreground">
            지금은 소리를 모두 껐어요. 아래 설정은 다시 켜면 그대로 쓰여요.
          </p>
        )}
        <CategoryRow
          value={settings.sfx}
          muted={settings.muted}
          onChange={(sfx) => setSettings({ sfx })}
          onCommit={() => play('tap')}
          category="sfx"
          title="효과음"
          description="버튼·정답·축하 소리예요."
          icon={<Volume2 className="h-5 w-5" />}
          onPreview={() => play('correct')}
          previewLabel="효과음 들어 보기"
        />
        <CategoryRow
          value={settings.bgm}
          muted={settings.muted}
          onChange={(bgm) => setSettings({ bgm })}
          category="bgm"
          title="배경음악"
          description="지도와 퀘스트에서 흐르는 음악이에요. 처음에는 꺼져 있어요."
          icon={<Music className="h-5 w-5" />}
          onPreview={() => setBgmPreview((v) => !v)}
          previewLabel={bgmPreview ? '음악 멈추기' : '배경음악 들어 보기'}
          previewActive={bgmPreview}
        >
          {!bgmAllowed && settings.bgm.enabled && (
            <p className="mt-1 text-base text-foreground">
              움직임이 ‘최소로’라서 배경음악은 나오지 않아요. 효과음은 그대로
              나요.
            </p>
          )}
          {bgmPreview && bgmAllowed && !playingBgm && (
            <p className="mt-1 text-base text-muted-foreground" role="status">
              음악을 불러오는 중…
            </p>
          )}
        </CategoryRow>
        <CategoryRow
          value={settings.voice}
          muted={settings.muted}
          onChange={(voice) => setSettings({ voice })}
          category="voice"
          title="목소리"
          description="파이뱀이 글을 읽어 줘요."
          icon={<Volume2 className="h-5 w-5" />}
          comingSoon
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          'mt-3 min-h-6 text-base font-medium',
          status === 'error' ? 'text-destructive' : 'text-foreground',
        )}
        data-testid="sound-save-status"
      >
        {status === 'saving' && '저장하는 중…'}
        {status === 'saved' && '저장했어요!'}
        {status === 'error' &&
          '저장하지 못했어요. 이 기기에서만 바뀌었어요. 잠시 뒤 다시 골라 주세요.'}
      </p>
    </section>
  );
}
