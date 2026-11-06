// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MOTION_BOOT_SCRIPT,
  MOTION_BOOT_SCRIPT_CSP_SOURCE,
  MOTION_BOOT_SCRIPT_SHA256,
  motionBootSyncScript,
} from '../boot';
import {
  MEASURED_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  detectMotionTier,
  readSettingsCache,
  saveMeasurement,
  readStaticSignals,
} from '../browser';
import {
  DEFAULT_MOTION_SETTINGS,
  resolvePolicy,
  type MotionSettings,
} from '../tier';

const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

interface Device {
  ua?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  effectiveType?: string;
  reduced?: boolean;
}

const html = document.documentElement;
const navProps = [
  'userAgent',
  'hardwareConcurrency',
  'deviceMemory',
  'connection',
] as const;

function setDevice(d: Device) {
  const values: Record<(typeof navProps)[number], unknown> = {
    userAgent: d.ua ?? CHROME_UA,
    hardwareConcurrency: d.hardwareConcurrency ?? 8,
    deviceMemory: d.deviceMemory,
    connection:
      d.saveData !== undefined || d.effectiveType !== undefined
        ? { saveData: d.saveData, effectiveType: d.effectiveType }
        : undefined,
  };
  for (const key of navProps) {
    Object.defineProperty(navigator, key, {
      value: values[key],
      configurable: true,
    });
  }
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') && !!d.reduced,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

function runBoot(server: MotionSettings | null = null) {
  new Function(MOTION_BOOT_SCRIPT)();
  if (server) new Function(motionBootSyncScript(server))();
  return { motion: html.dataset.motion, reduced: html.dataset.reduced };
}

/** 하이드레이션 뒤 Provider가 낼 값 (같아야 첫 화면과 이후 화면이 튀지 않음) */
function providerResult(
  settings: MotionSettings = readSettingsCache() ?? DEFAULT_MOTION_SETTINGS,
) {
  const detected = detectMotionTier();
  const signals = readStaticSignals();
  const p = resolvePolicy(settings, detected, signals.reducedMotion);
  return { motion: p.tier, reduced: p.reduced ? 'true' : 'false' };
}

beforeEach(() => {
  localStorage.clear();
  delete html.dataset.motion;
  delete html.dataset.reduced;
});
afterEach(() => {
  for (const key of navProps)
    delete (navigator as unknown as Record<string, unknown>)[key];
});

describe('부트 스크립트 CSP 해시', () => {
  it('MOTION_BOOT_SCRIPT_SHA256이 스크립트 내용과 같다 (바꿨다면 아래 값으로 갱신)', () => {
    const actual = createHash('sha256')
      .update(MOTION_BOOT_SCRIPT, 'utf8')
      .digest('base64');
    expect(MOTION_BOOT_SCRIPT_SHA256).toBe(actual);
    expect(MOTION_BOOT_SCRIPT_CSP_SOURCE).toBe(`'sha256-${actual}'`);
  });

  it('</script>로 끊길 글자가 없다', () => {
    expect(MOTION_BOOT_SCRIPT).not.toMatch(/<\/script/i);
    expect(
      motionBootSyncScript({ tier: '</script>', reduced: 'on' }),
    ).not.toMatch(/<\/script/i);
  });
});

describe('부트 스크립트 = detectMotionTier + resolvePolicy (첫 페인트와 하이드레이션 뒤가 같음)', () => {
  it.each<[string, Device]>([
    ['보통 PC', {}],
    ['메모리 1GB', { deviceMemory: 1 }],
    ['메모리 2GB', { deviceMemory: 2 }],
    ['코어 2개 크롬북', { hardwareConcurrency: 2, deviceMemory: 4 }],
    ['iPad (코어 수 무시)', { ua: IPAD_UA, hardwareConcurrency: 2 }],
    ['데이터 절약', { saveData: true }],
    ['2g', { effectiveType: '2g' }],
    ['기기 동작 줄이기', { reduced: true }],
  ])('%s', (_label, device) => {
    setDevice(device);
    expect(runBoot()).toEqual(providerResult());
  });

  it('지난 실측이 더 낮으면 그 단계로 시작, 기기 신호가 바뀌면 버림', () => {
    setDevice({ hardwareConcurrency: 8, deviceMemory: 8 });
    saveMeasurement(readStaticSignals(), 'minimal');
    expect(runBoot()).toEqual({ motion: 'minimal', reduced: 'false' });
    expect(runBoot()).toEqual(providerResult());

    setDevice({ hardwareConcurrency: 4, deviceMemory: 8 });
    expect(runBoot()).toEqual({ motion: 'full', reduced: 'false' });
    expect(runBoot()).toEqual(providerResult());
  });

  it('14일 넘은 실측은 버림', () => {
    setDevice({});
    const sig = `${navigator.hardwareConcurrency}/-`;
    localStorage.setItem(
      MEASURED_STORAGE_KEY,
      JSON.stringify({ measured: 'lite', at: Date.now() - 15 * 86400e3, sig }),
    );
    expect(runBoot().motion).toBe('full');
    expect(runBoot()).toEqual(providerResult());
  });

  it('기기 사본 설정: 사용자가 고른 단계·동작 줄이기가 감지보다 우선', () => {
    setDevice({ deviceMemory: 1 });
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ tier: 'full', reduced: 'on' }),
    );
    expect(runBoot()).toEqual({ motion: 'full', reduced: 'true' });
    expect(runBoot()).toEqual(providerResult());

    setDevice({ reduced: true });
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ tier: 'auto', reduced: 'off' }),
    );
    expect(runBoot()).toEqual({ motion: 'full', reduced: 'false' });
  });

  it('로그인 레이아웃 동기화: 서버 설정으로 다시 적용하고 기기 사본도 갱신', () => {
    setDevice({});
    expect(runBoot({ tier: 'minimal', reduced: 'on' })).toEqual({
      motion: 'minimal',
      reduced: 'true',
    });
    expect(readSettingsCache()).toEqual({ tier: 'minimal', reduced: 'on' });
  });

  it('이상한 저장값·저장소 오류에도 던지지 않고 기본값', () => {
    setDevice({});
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{oops');
    localStorage.setItem(MEASURED_STORAGE_KEY, '"x"');
    expect(runBoot()).toEqual({ motion: 'full', reduced: 'false' });
  });
});
