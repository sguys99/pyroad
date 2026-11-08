/**
 * 브라우저 설치 창 보관소 (P4-11, 브라우저 전용). Chromium은 설치 조건이 맞으면 페이지마다 `beforeinstallprompt`를 한 번 보낸다.
 * 이 이벤트를 잡아 두었다가 아이가 "홈 화면에 추가"를 누를 때만 `prompt()`를 부른다(사용자 제스처 안에서만 열림).
 *
 * - 잡기는 로그인 화면 공용 틀(`LoggedInShell` → `InstallPromptCatcher`)이 하이드레이션 직후 시작한다. 그 전에 온 이벤트는 놓치지만
 *   브라우저가 다음 페이지 로드 때 다시 보낸다
 * - `preventDefault()`: 브라우저의 자동 미니 안내 띠를 막는다(아이에게 갑자기 뜨지 않게, 안내는 우리 쪽지·설정에서만)
 * - `appinstalled`: 설치를 마치면 보관한 이벤트를 버리고 `installed`로. 분석 `pwa_installed`
 * - `useSyncExternalStore`용 구독·스냅샷. 스냅샷 객체는 바뀔 때만 새로 만든다
 */
import { track } from '@/lib/analytics/track';

/** Chromium 전용 이벤트 (표준 타입에 없음) */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallPromptSnapshot {
  /** 지금 설치 창을 띄울 수 있음 */
  canPrompt: boolean;
  /** 이 페이지에서 설치를 마침 */
  installed: boolean;
}

const SERVER_SNAPSHOT: InstallPromptSnapshot = {
  canPrompt: false,
  installed: false,
};

let deferred: BeforeInstallPromptEvent | null = null;
let snapshot: InstallPromptSnapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function emit(next: InstallPromptSnapshot) {
  snapshot = next;
  for (const fn of listeners) fn();
}

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  emit({ canPrompt: true, installed: snapshot.installed });
}

function onAppInstalled() {
  deferred = null;
  emit({ canPrompt: false, installed: true });
  track('pwa_installed', {});
}

/** 이벤트 잡기 시작 (여러 번 불러도 한 번만) */
export function startInstallPromptCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getInstallPromptSnapshot(): InstallPromptSnapshot {
  return snapshot;
}

export function getServerInstallPromptSnapshot(): InstallPromptSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * 설치 창 띄우기 (버튼을 누른 처리 안에서). 이벤트는 한 번만 쓸 수 있어 쓰고 나면 버린다.
 * @returns 고른 결과, 이벤트가 없으면 `unavailable`
 */
export async function promptInstall(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  emit({ canPrompt: false, installed: snapshot.installed });
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

/** 테스트 전용: 상태 초기화 */
export function __resetInstallPromptForTest(): void {
  if (typeof window !== 'undefined' && started) {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  }
  deferred = null;
  snapshot = SERVER_SNAPSHOT;
  started = false;
  listeners.clear();
}
