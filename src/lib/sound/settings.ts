import type {
  CategorySetting,
  SoundCategory,
  SoundSettings,
  SoundSettingsPatch,
} from './types';

/**
 * 기본값 (§12-Q8: 효과음 ON, BGM OFF). `users.settings.sound` 기본값(00012)과 같다.
 * 정규화된 파일(효과음 역할별 RMS·피크 -1.5dBFS, BGM -16 LUFS) 기준으로 실효 gain이
 * 효과음 0.8 × 0.7 = 0.56 (약 -5dB), BGM 0.8 × 0.4 = 0.32 (약 -10dB)라서 BGM이 효과음·대사보다 항상 아래에 깔린다.
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

/** 기기 사본 (움직임 설정 `pyroad.motion.v1`과 같은 이름 규칙). 개인정보가 아닌 접근성·취향 선호라 로그아웃 뒤에도 남긴다 */
export const SOUND_SETTINGS_STORAGE_KEY = 'pyroad.sound.v1';

export const SOUND_CATEGORIES: readonly SoundCategory[] = [
  'sfx',
  'bgm',
  'voice',
];

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.min(1, Math.max(0, v))
    : fallback;
}

function normalizeCategory(
  raw: unknown,
  fallback: CategorySetting,
): CategorySetting {
  const r = (
    raw && typeof raw === 'object' ? raw : {}
  ) as Partial<CategorySetting>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : fallback.enabled,
    volume: clamp01(r.volume, fallback.volume),
  };
}

/**
 * localStorage·DB(jsonb)에서 읽은 믿을 수 없는 값을 안전한 설정으로 바꾼다 (모르는 값은 기본값).
 * 서버 쓰기 검증은 zod 스키마(`schema.ts`)가 따로 한다 — 이 함수는 브라우저 번들에 zod를 넣지 않으려는 읽기용.
 */
export function normalizeSettings(raw: unknown): SoundSettings {
  const d = DEFAULT_SOUND_SETTINGS;
  const r = (
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  ) as Partial<Record<keyof SoundSettings, unknown>>;
  return {
    version: 1,
    muted: typeof r.muted === 'boolean' ? r.muted : d.muted,
    master: clamp01(r.master, d.master),
    sfx: normalizeCategory(r.sfx, d.sfx),
    bgm: normalizeCategory(r.bgm, d.bgm),
    voice: normalizeCategory(r.voice, d.voice),
    updatedAt:
      typeof r.updatedAt === 'number' &&
      Number.isFinite(r.updatedAt) &&
      r.updatedAt >= 0
        ? Math.floor(r.updatedAt)
        : 0,
  };
}

export function mergeSettings(
  cur: SoundSettings,
  patch: SoundSettingsPatch,
  now = Date.now(),
): SoundSettings {
  const next: SoundSettings = {
    ...cur,
    muted: patch.muted ?? cur.muted,
    master:
      patch.master === undefined
        ? cur.master
        : clamp01(patch.master, cur.master),
    // 같은 밀리초에 두 번 바꿔도 순서가 남게 (기기 사이 last-write-wins)
    updatedAt: Math.max(Math.floor(now), cur.updatedAt + 1),
  };
  for (const c of SOUND_CATEGORIES) {
    const p = patch[c];
    if (p) next[c] = normalizeCategory({ ...cur[c], ...p }, cur[c]);
  }
  return next;
}

export function sameSoundSettings(a: SoundSettings, b: SoundSettings) {
  return (
    a.muted === b.muted &&
    a.master === b.master &&
    a.updatedAt === b.updatedAt &&
    SOUND_CATEGORIES.every(
      (c) => a[c].enabled === b[c].enabled && a[c].volume === b[c].volume,
    )
  );
}

/** 카테고리의 실효 gain (음소거·꺼짐이면 0) */
export function effectiveGain(s: SoundSettings, c: SoundCategory): number {
  if (s.muted || !s[c].enabled) return 0;
  return s.master * s[c].volume;
}

export interface SettingsStorage {
  load(): SoundSettings | null;
  save(s: SoundSettings): void;
}

/** 사파리 비공개 모드·저장소 차단·쿼터 초과에서도 예외 없이 동작 */
export function createLocalSettingsStorage(
  key = SOUND_SETTINGS_STORAGE_KEY,
): SettingsStorage {
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
 * 로그인 사용자의 서버 값(`users.settings.sound`)과 기기 값 중 최신 것을 고른다.
 * 서버 값이 없으면 기기, 둘 다 있으면 updatedAt이 큰 쪽(같으면 서버). 둘 다 없으면 기본값.
 */
export function pickNewerSettings(
  local: SoundSettings | null,
  server: unknown,
): SoundSettings {
  const s = server ? normalizeSettings(server) : null;
  if (!s) return local ?? normalizeSettings(null);
  if (!local) return s;
  return s.updatedAt >= local.updatedAt ? s : local;
}
