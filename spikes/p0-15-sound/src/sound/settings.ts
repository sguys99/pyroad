import type { CategorySetting, SoundCategory, SoundSettings, SoundSettingsPatch } from './types';

/**
 * 기본값 (§12-Q8 확정: 효과음 ON, BGM OFF).
 * 정규화된 파일(효과음 피크 -1 dBTP, BGM -16 LUFS) 기준으로 실효 gain이
 * 효과음 0.8 × 0.7 = 0.56 (약 -5 dB), BGM 0.8 × 0.4 = 0.32 (약 -10 dB)가 되도록 잡았다.
 * BGM이 효과음과 대사보다 항상 아래에 깔린다.
 */
export const DEFAULT_SOUND_SETTINGS: SoundSettings = Object.freeze({
  version: 1,
  muted: false,
  master: 0.8,
  sfx: Object.freeze({ enabled: true, volume: 0.7 }),
  bgm: Object.freeze({ enabled: false, volume: 0.4 }),
  voice: Object.freeze({ enabled: true, volume: 0.9 }),
  updatedAt: 0,
}) as SoundSettings;

export const SOUND_SETTINGS_STORAGE_KEY = 'pyroad:sound:v1';

const CATEGORIES: readonly SoundCategory[] = ['sfx', 'bgm', 'voice'];

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function normalizeCategory(raw: unknown, fallback: CategorySetting): CategorySetting {
  const r = (raw ?? {}) as Partial<CategorySetting>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : fallback.enabled,
    volume: clamp01(r.volume, fallback.volume),
  };
}

/** localStorage나 DB(jsonb)에서 읽은 신뢰할 수 없는 값을 안전한 설정으로 바꾼다 */
export function normalizeSettings(raw: unknown): SoundSettings {
  const d = DEFAULT_SOUND_SETTINGS;
  if (!raw || typeof raw !== 'object') return { ...d, sfx: { ...d.sfx }, bgm: { ...d.bgm }, voice: { ...d.voice } };
  const r = raw as Partial<Record<keyof SoundSettings, unknown>>;
  return {
    version: 1,
    muted: typeof r.muted === 'boolean' ? r.muted : d.muted,
    master: clamp01(r.master, d.master),
    sfx: normalizeCategory(r.sfx, d.sfx),
    bgm: normalizeCategory(r.bgm, d.bgm),
    voice: normalizeCategory(r.voice, d.voice),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
  };
}

export function mergeSettings(cur: SoundSettings, patch: SoundSettingsPatch, now = Date.now()): SoundSettings {
  const next: SoundSettings = {
    ...cur,
    muted: patch.muted ?? cur.muted,
    master: patch.master === undefined ? cur.master : clamp01(patch.master, cur.master),
    updatedAt: now,
  };
  for (const c of CATEGORIES) {
    const p = patch[c];
    if (p) next[c] = normalizeCategory({ ...cur[c], ...p }, cur[c]);
  }
  return next;
}

/** 카테고리의 실효 gain (음소거/비활성이면 0) */
export function effectiveGain(s: SoundSettings, c: SoundCategory): number {
  if (s.muted || !s[c].enabled) return 0;
  return s.master * s[c].volume;
}

export interface SettingsStorage {
  load(): SoundSettings | null;
  save(s: SoundSettings): void;
}

/** 사파리 비공개 모드, 저장소 차단, 쿼터 초과에서도 예외 없이 동작 */
export function createLocalSettingsStorage(key = SOUND_SETTINGS_STORAGE_KEY): SettingsStorage {
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw ? normalizeSettings(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    save(s) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(s));
      } catch {
        /* 무시: 설정 저장 실패가 재생을 막으면 안 된다 */
      }
    },
  };
}

/**
 * 로그인 후 서버(users.settings.sound)와 로컬 값 중 최신 것을 고른다.
 * 서버 값이 없으면 로컬, 둘 다 있으면 updatedAt이 큰 쪽.
 */
export function pickNewerSettings(local: SoundSettings | null, server: unknown): SoundSettings {
  const s = server ? normalizeSettings(server) : null;
  if (!s) return local ?? normalizeSettings(null);
  if (!local) return s;
  return s.updatedAt >= local.updatedAt ? s : local;
}
