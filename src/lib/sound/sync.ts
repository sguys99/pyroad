import type { SoundSettings } from './types';

/**
 * 사운드 설정 서버 저장 (`PATCH /api/settings { sound }`, P2-14).
 *
 * 로그인 화면(`SoundSettingsSync`)이 `enable()`하는 동안만 저장한다 (비로그인은 기기 저장소만).
 * 슬라이더를 끄는 동안 요청이 쏟아지지 않게 마지막 값만 `debounceMs` 뒤에 보내고, 요청은 순서대로 하나씩 보낸다.
 * 설정 화면은 `subscribe`로 저장 상태를 보여 준다. HUD 음소거 토글도 같은 저장기를 거친다.
 */
export type SoundSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SoundSettingsSaver {
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  save(settings: SoundSettings): void;
  /** 기다리는 저장을 바로 보낸다 (테스트·화면 떠나기 전) */
  flush(): Promise<void>;
  getStatus(): SoundSaveStatus;
  subscribe(listener: () => void): () => void;
}

export function createSoundSettingsSaver({
  send = defaultSend,
  debounceMs = 600,
  savedResetMs = 2000,
}: {
  send?: (settings: SoundSettings) => Promise<boolean>;
  debounceMs?: number;
  savedResetMs?: number;
} = {}): SoundSettingsSaver {
  let enabled = false;
  let pending: SoundSettings | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let status: SoundSaveStatus = 'idle';
  const listeners = new Set<() => void>();

  const setStatus = (next: SoundSaveStatus) => {
    if (next === status) return;
    status = next;
    for (const l of listeners) l();
  };

  const run = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    const value = pending;
    pending = null;
    if (!value || !enabled) return chain;
    chain = chain.then(async () => {
      const ok = await send(value).catch(() => false);
      // 뒤에 또 기다리는 값이 있으면 그것이 끝날 때 상태를 정한다
      if (pending || timer) return;
      setStatus(ok ? 'saved' : 'error');
      if (resetTimer) clearTimeout(resetTimer);
      if (ok) resetTimer = setTimeout(() => setStatus('idle'), savedResetMs);
    });
    return chain;
  };

  return {
    enable() {
      enabled = true;
    },
    disable() {
      enabled = false;
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
    isEnabled: () => enabled,
    save(settings) {
      if (!enabled) return;
      pending = settings;
      setStatus('saving');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), debounceMs);
    },
    flush: () => run(),
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

async function defaultSend(settings: SoundSettings): Promise<boolean> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sound: settings }),
  }).catch(() => null);
  return !!res?.ok;
}

let saver: SoundSettingsSaver | null = null;

/** 앱 전체 저장기 하나 (클라이언트 전용) */
export function getSoundSettingsSaver(): SoundSettingsSaver {
  saver ??= createSoundSettingsSaver();
  return saver;
}
