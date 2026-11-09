import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebAudioEngine, type WebAudioEngine } from '../webAudioEngine';
import { DEFAULT_SOUND_SETTINGS, normalizeSettings } from '../settings';
import type { SettingsStorage } from '../settings';
import type { SoundManifest, SoundSettings } from '../types';
import {
  FakeAudioContext,
  fakeLoadBytes,
  flush,
  type FakeGain,
} from './fakeAudio';

type S = 'tap' | 'coin' | 'blip' | 'levelup';
type B = 'world1' | 'world2';

const src = (id: string) => [`/sounds/x/${id}.v1.webm`] as const;
const MANIFEST: SoundManifest<S, B> = {
  sfx: {
    tap: { src: src('tap'), core: true, gain: 0.6, maxVoices: 3 },
    coin: { src: src('coin'), core: true, maxVoices: 2 },
    blip: { src: src('blip'), latencySensitive: true },
    levelup: { src: src('levelup') },
  },
  bgm: { world1: { src: src('world1') }, world2: { src: src('world2') } },
};

function memoryStorage(initial: SoundSettings | null = null) {
  let saved = initial;
  const storage: SettingsStorage & { saved: () => SoundSettings | null } = {
    load: () => saved,
    save: (s) => {
      saved = s;
    },
    saved: () => saved,
  };
  return storage;
}

let engine: WebAudioEngine<S, B>;
const loads = vi.fn(fakeLoadBytes);
let storage: ReturnType<typeof memoryStorage>;

function make(
  opts: { settings?: Partial<SoundSettings>; ctor?: boolean } = {},
) {
  storage = memoryStorage(
    opts.settings
      ? normalizeSettings({ ...DEFAULT_SOUND_SETTINGS, ...opts.settings })
      : null,
  );
  engine = createWebAudioEngine(MANIFEST, {
    storage,
    audioContextCtor:
      opts.ctor === false
        ? null
        : (FakeAudioContext as unknown as typeof AudioContext),
    loadBytes: loads,
    canPlay: () => true,
    listenVisibility: false,
    audioSessionType: null,
  });
  return engine;
}

const ctx = () => FakeAudioContext.instances.at(-1)!;
/** master, sfx, bgm, voice 순서로 만든다 */
const gains = () => {
  const g = ctx().gains as FakeGain[];
  return { master: g[0], sfx: g[1], bgm: g[2], voice: g[3] };
};

async function unlocked(opts?: Parameters<typeof make>[0]) {
  make(opts);
  engine.unlock();
  await flush();
  return engine;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudioContext.instances = [];
  FakeAudioContext.resumeHangs = false;
  loads.mockClear();
});
afterEach(() => {
  engine?.dispose();
  vi.useRealTimers();
});

describe('상태 전이', () => {
  it('첫 제스처 전에는 AudioContext를 만들지 않고(idle), unlock하면 running', async () => {
    make();
    expect(engine.getSnapshot().state).toBe('idle');
    expect(FakeAudioContext.instances).toHaveLength(0);
    engine.unlock();
    await flush();
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(engine.getSnapshot().state).toBe('running');
  });

  it('Web Audio가 없으면 unsupported, 모든 호출이 조용히 무시됨', async () => {
    make({ ctor: false });
    expect(engine.getSnapshot().state).toBe('unsupported');
    engine.unlock();
    engine.play('tap');
    engine.playBgm('world1');
    expect(engine.getSnapshot().playingBgm).toBeNull();
  });

  it('iOS interrupted → 다음 제스처에서 다시 running', async () => {
    await unlocked();
    ctx().interrupt();
    expect(engine.getSnapshot().state).toBe('interrupted');
    engine.unlock();
    await flush();
    expect(engine.getSnapshot().state).toBe('running');
  });

  it('resume이 끝나지 않으면(iOS 복귀 버그) 다음 제스처에서 컨텍스트를 새로 만든다', async () => {
    await unlocked();
    ctx().interrupt();
    FakeAudioContext.resumeHangs = true;
    engine.unlock();
    vi.advanceTimersByTime(1600);
    FakeAudioContext.resumeHangs = false;
    const old = ctx();
    engine.unlock();
    await flush();
    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(old.closed).toBe(true);
    expect(engine.getSnapshot().state).toBe('running');
  });
});

describe('효과음', () => {
  it('제스처 전 play는 버린다 (자동재생 없음)', async () => {
    make();
    engine.play('tap');
    await flush();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('unlock 뒤 재생: 파일 gain을 곱한 노드를 거쳐 효과음 카테고리로', async () => {
    await unlocked();
    engine.play('tap');
    await flush();
    const playing = ctx().playing('tap');
    expect(playing).toHaveLength(1);
    const fileGain = playing[0].outputs[0] as FakeGain;
    expect(fileGain.gain.value).toBe(0.6);
    expect(fileGain.outputs[0]).toBe(gains().sfx);
  });

  it('미리 디코드(prefetch)한 core 효과음은 첫 탭에 바로(동기) 시작', async () => {
    make();
    const offline = new FakeAudioContext();
    engine = createWebAudioEngine(MANIFEST, {
      storage,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      createOfflineContext: () => offline as unknown as BaseAudioContext,
      loadBytes: loads,
      canPlay: () => true,
      listenVisibility: false,
      audioSessionType: null,
    });
    engine.prefetch();
    await flush();
    engine.unlock();
    engine.play('coin');
    expect(ctx().playing('coin')).toHaveLength(1);
  });

  it('음소거·효과음 끔이면 시작하지 않음', async () => {
    await unlocked({ settings: { muted: true } });
    engine.play('tap');
    await flush();
    expect(ctx().playing('tap')).toHaveLength(0);
    engine.setSettings({ muted: false, sfx: { enabled: false } });
    engine.play('tap');
    await flush();
    expect(ctx().playing('tap')).toHaveLength(0);
    engine.setSettings({ sfx: { enabled: true } });
    engine.play('tap');
    await flush();
    expect(ctx().playing('tap')).toHaveLength(1);
  });

  it('같은 효과음 동시 재생 상한: 넘으면 가장 오래된 것을 멈춤', async () => {
    await unlocked();
    for (let i = 0; i < 5; i++) {
      engine.play('coin');
      await flush();
    }
    expect(ctx().playing('coin')).toHaveLength(2);
  });

  it('출력 지연이 크면(블루투스) 대사 블립만 끈다', async () => {
    await unlocked();
    ctx().outputLatency = 0.3;
    engine.play('blip');
    engine.play('levelup');
    await flush();
    expect(ctx().playing('blip')).toHaveLength(0);
    expect(ctx().playing('levelup')).toHaveLength(1);
  });

  it('rate 옵션은 playbackRate로 (별 1→3 상승음)', async () => {
    await unlocked();
    engine.play('coin', { rate: 1.26 });
    await flush();
    expect(ctx().playing('coin')[0].playbackRate.value).toBe(1.26);
  });
});

describe('볼륨·설정', () => {
  it('카테고리·마스터 볼륨과 음소거가 GainNode에 반영', async () => {
    await unlocked();
    expect(gains().master.gain.value).toBe(0.8);
    expect(gains().sfx.gain.value).toBe(0.7);
    expect(gains().bgm.gain.value).toBe(0); // 기본 꺼짐
    engine.setSettings({ sfx: { volume: 0.25 }, bgm: { enabled: true } });
    expect(gains().sfx.gain.value).toBe(0.25);
    expect(gains().bgm.gain.value).toBe(0.4);
    engine.setSettings({ muted: true });
    expect(gains().master.gain.value).toBe(0);
  });

  it('setSettings는 기기 저장 + 사용자 변경 알림, adoptSettings는 저장만 (서버 값 반영)', async () => {
    make();
    const seen: SoundSettings[] = [];
    engine.onUserSettings((s) => seen.push(s));
    engine.setSettings({ muted: true });
    expect(seen).toHaveLength(1);
    expect(storage.saved()?.muted).toBe(true);
    const server = normalizeSettings({
      ...DEFAULT_SOUND_SETTINGS,
      bgm: { enabled: true, volume: 0.1 },
      updatedAt: 5,
    });
    engine.adoptSettings(server);
    expect(seen).toHaveLength(1);
    expect(engine.getSnapshot().settings.bgm).toEqual({
      enabled: true,
      volume: 0.1,
    });
    expect(storage.saved()?.updatedAt).toBe(5);
  });
});

describe('배경음악', () => {
  it('기본(BGM 꺼짐)에서는 원해도 재생하지 않고, 켜면 그때 재생', async () => {
    await unlocked();
    engine.playBgm('world1');
    await flush();
    expect(engine.getSnapshot()).toMatchObject({
      desiredBgm: 'world1',
      playingBgm: null,
    });
    engine.setSettings({ bgm: { enabled: true } });
    await flush();
    expect(engine.getSnapshot().playingBgm).toBe('world1');
    const [loop] = ctx().playing('world1');
    expect(loop.loop).toBe(true);
  });

  it('연출 단계 minimal(bgmAllowed=false)이면 끄고, 효과음은 그대로', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    engine.playBgm('world1');
    await flush();
    expect(engine.getSnapshot().playingBgm).toBe('world1');
    engine.setBgmAllowed(false);
    vi.advanceTimersByTime(500);
    await flush();
    expect(engine.getSnapshot()).toMatchObject({
      playingBgm: null,
      bgmAllowed: false,
    });
    expect(ctx().playing('world1')).toHaveLength(0);
    engine.play('tap');
    await flush();
    expect(ctx().playing('tap')).toHaveLength(1);
    engine.setBgmAllowed(true);
    await flush();
    expect(engine.getSnapshot().playingBgm).toBe('world1');
  });

  it('월드를 옮기면 크로스페이드: 새 곡이 시작하고 이전 곡은 페이드 뒤 멈춤', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    engine.playBgm('world1');
    await flush();
    engine.playBgm('world2', { fadeMs: 800 });
    await flush();
    expect(engine.getSnapshot().playingBgm).toBe('world2');
    expect(ctx().playing('world1')).toHaveLength(1); // 페이드아웃 중
    expect(ctx().playing('world2')).toHaveLength(1);
    vi.advanceTimersByTime(900);
    await flush();
    expect(ctx().playing('world1')).toHaveLength(0);
  });

  it('크로스페이드 gain 램프: 새 곡 슬롯 0 → 1, 이전 곡 슬롯 → 0 (둘 다 800ms)', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    // master·sfx·bgm·voice 다음 BGM 슬롯 둘
    const [, , , , a, b] = ctx().gains as FakeGain[];
    engine.playBgm('world1', { fadeMs: 800 });
    await flush();
    expect(a.gain.ramps.at(-1)).toEqual([1, 0.8]);
    engine.playBgm('world2', { fadeMs: 800 });
    await flush();
    expect(a.gain.ramps.at(-1)).toEqual([0, 0.8]);
    expect(b.gain.ramps.at(-1)).toEqual([1, 0.8]);
    expect(a.gain.value).toBe(0);
    expect(b.gain.value).toBe(1);
  });

  it('디코드한 BGM은 지금 월드 곡만 보관: 이전 곡은 페이드 뒤 버리고, 돌아오면 다시 받음', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    const bgmLoads = (id: string) =>
      loads.mock.calls.filter(([u]) => u.includes(`/${id}.`)).length;
    engine.playBgm('world1');
    await flush();
    engine.playBgm('world2');
    await flush();
    vi.advanceTimersByTime(900);
    await flush();
    expect(bgmLoads('world2')).toBe(1);
    // 이전 곡(world1)은 버려져 돌아오면 다시 받고, 그 사이 world2 는 페이드 뒤 버린다
    engine.playBgm('world1');
    await flush();
    expect(bgmLoads('world1')).toBe(2);
    expect(ctx().playing('world1')).toHaveLength(1);
    vi.advanceTimersByTime(900);
    engine.playBgm('world2');
    await flush();
    expect(bgmLoads('world2')).toBe(2);
  });

  it('페이드아웃 중에 같은 곡을 다시 원하면 처음부터 다시 시작하지 않고 이어서', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    engine.playBgm('world1');
    await flush();
    const first = ctx().playing('world1')[0];
    engine.stopBgm({ fadeMs: 800 });
    vi.advanceTimersByTime(100);
    engine.playBgm('world1');
    vi.advanceTimersByTime(1000);
    await flush();
    expect(ctx().playing('world1')).toEqual([first]);
  });

  it('탭이 숨겨지면 BGM을 멈추고 컨텍스트 suspend, 다시 보이면 이어서 재생', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    engine.playBgm('world1');
    await flush();
    engine.setHiddenForTest(true);
    expect(engine.getSnapshot().playingBgm).toBeNull();
    vi.advanceTimersByTime(350);
    await flush();
    expect(ctx().state).toBe('suspended');
    expect(engine.getSnapshot().state).toBe('suspended');
    engine.setHiddenForTest(false);
    await flush();
    expect(engine.getSnapshot()).toMatchObject({
      state: 'running',
      playingBgm: 'world1',
    });
  });

  it('음소거하면 BGM도 멈춤', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    engine.playBgm('world1');
    await flush();
    engine.setSettings({ muted: true });
    expect(engine.getSnapshot().playingBgm).toBeNull();
  });
});

describe('BGM 미리 받기 prefetchBgm (P5-11 추가)', () => {
  const bgmLoads = () =>
    loads.mock.calls.filter(([u]) => u.includes('world')).map(([u]) => u);

  afterEach(() => vi.unstubAllGlobals());

  it('BGM 설정이 꺼져 있으면(기본) 받지 않는다', async () => {
    make();
    engine.prefetchBgm(['world1', 'world2']);
    await flush();
    expect(bgmLoads()).toEqual([]);
  });

  it('켜져 있으면 곡마다 한 번만 받고 디코드하지 않는다(제스처 전에도)', async () => {
    make({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    engine.prefetchBgm(['world1', 'world2']);
    engine.prefetchBgm(['world1']);
    await flush();
    expect(bgmLoads()).toEqual([src('world1')[0], src('world2')[0]]);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('데이터 절약 모드·2G 연결이면 받지 않는다', async () => {
    make({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    engine.prefetchBgm(['world1']);
    vi.stubGlobal('navigator', { connection: { effectiveType: '2g' } });
    engine.prefetchBgm(['world2']);
    await flush();
    expect(bgmLoads()).toEqual([]);
  });

  it('이미 재생 중(디코드한) 곡은 다시 받지 않는다', async () => {
    await unlocked({ settings: { bgm: { enabled: true, volume: 0.4 } } });
    engine.playBgm('world1');
    await flush();
    loads.mockClear();
    engine.prefetchBgm(['world1']);
    await flush();
    expect(bgmLoads()).toEqual([]);
  });
});
