/**
 * "홈 화면에 추가" 안내 판별 (P4-11). 화면 없는 순수 함수라 단위 테스트가 직접 부른다. 컴포넌트는 `src/components/pwa/`.
 *
 * - **안드로이드 Chromium**(Chrome·Samsung Internet·Edge): 브라우저가 `beforeinstallprompt`를 보내면 그 이벤트로 설치 창을 띄운다.
 *   이벤트가 없으면(설치 조건 미충족·이미 설치·Firefox 등) 안내하지 않는다 — 버튼을 눌러도 아무 일이 없게 두지 않는다
 * - **iOS·iPadOS**: 설치 API가 없다. 공유 버튼 → "홈 화면에 추가"를 그림으로 안내한다(iOS 16.4+는 Safari 밖 Chrome·Edge도 공유 메뉴에 있음)
 * - 숨김: 이미 설치해 홈 화면에서 연 경우(`display-mode: standalone`·iOS `navigator.standalone`), 카카오톡 같은 **인앱 브라우저**
 *   (추가 메뉴가 없거나 그 앱 안에서만 열림, 기존 판별 `detectInAppBrowser` 재사용), **데스크톱**(아이 대상 안내는 휴대폰·태블릿만)
 * - 아이에게 강요하지 않는다: 월드맵 쪽지는 **서로 다른 날 3번째 방문**부터 한 번, 닫으면 **30일** 동안 다시 띄우지 않는다.
 *   설정 화면 항목은 늘 있다(아이·보호자가 원할 때)
 */
import { detectInAppBrowser } from '@/lib/browser/detectInAppBrowser';
import { kstDaysBetween, kstToday } from '@/lib/time/kst';

export type InstallPlatform =
  /** 이미 홈 화면 앱으로 열림 */
  | 'installed'
  /** 카카오톡·네이버·인스타그램 등 앱 안 브라우저 */
  | 'inapp'
  /** iPhone·iPad (Safari 또는 iOS의 다른 브라우저) */
  | 'ios'
  /** 안드로이드 (설치 창은 beforeinstallprompt가 있을 때만) */
  | 'android'
  /** PC·맥 등 — 안내하지 않음 */
  | 'desktop';

export interface PlatformInput {
  userAgent: string;
  /** `matchMedia('(display-mode: standalone)')` 또는 iOS `navigator.standalone` */
  standalone: boolean;
  /** iPadOS 13+는 데스크톱 UA(Macintosh)를 보내므로 터치 지점 수로 가린다 */
  maxTouchPoints?: number;
}

export function detectInstallPlatform({
  userAgent,
  standalone,
  maxTouchPoints = 0,
}: PlatformInput): InstallPlatform {
  if (standalone) return 'installed';
  const inApp = detectInAppBrowser(userAgent);
  if (inApp.isInApp) return 'inapp';
  const iPadOS = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  if (inApp.isIOS || iPadOS) return 'ios';
  if (inApp.isAndroid) return 'android';
  return 'desktop';
}

/** iOS에서 Safari인지 (공유 버튼 위치 안내가 다름: Safari는 아래 가운데/아이패드는 위 오른쪽, 다른 브라우저는 주소창 옆) */
export function isIosSafari(userAgent: string): boolean {
  return (
    /Safari\//.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|Whale|SamsungBrowser/.test(userAgent)
  );
}

/** 지금 할 수 있는 안내 */
export type InstallAction =
  /** 브라우저 설치 창 (beforeinstallprompt.prompt()) */
  | 'prompt'
  /** 공유 → 홈 화면에 추가 그림 안내 */
  | 'ios-guide'
  /** 이미 설치됨 (설정 화면에 "이미 홈 화면에 있어요") */
  | 'installed'
  /** 인앱 브라우저: 기본 브라우저로 열어 달라고 (설정 화면에만) */
  | 'open-in-browser'
  /** 안내할 것이 없음 (데스크톱·설치 창 이벤트가 없는 안드로이드) */
  | 'none';

export function installAction(
  platform: InstallPlatform,
  canPrompt: boolean,
): InstallAction {
  switch (platform) {
    case 'installed':
      return 'installed';
    case 'inapp':
      return 'open-in-browser';
    case 'ios':
      return 'ios-guide';
    case 'android':
      return canPrompt ? 'prompt' : 'none';
    default:
      return 'none';
  }
}

// ─────────────── 월드맵 쪽지 노출 (기기에만 저장)

/** localStorage 키 (기기별 편의 상태: 서버에 보내지 않음) */
export const INSTALL_HINT_STORAGE_KEY = 'pyroad.pwa.hint.v1';
/** 서로 다른 날 이만큼 방문하면 쪽지 (첫날·둘째 날은 모험에 집중) */
export const INSTALL_HINT_MIN_VISIT_DAYS = 3;
/** 닫으면 이만큼 다시 띄우지 않음 */
export const INSTALL_HINT_SNOOZE_DAYS = 30;

export interface InstallHintState {
  /** 월드맵을 연 서로 다른 날 수 (KST) */
  visitDays: number;
  /** 마지막으로 센 날 (KST `YYYY-MM-DD`) */
  lastVisit: string | null;
  /** 쪽지를 닫은 날 (KST) */
  dismissedOn: string | null;
}

export const EMPTY_HINT_STATE: InstallHintState = {
  visitDays: 0,
  lastVisit: null,
  dismissedOn: null,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 저장값 읽기 (형식이 틀리면 빈 상태) */
export function parseHintState(raw: string | null): InstallHintState {
  if (!raw) return EMPTY_HINT_STATE;
  try {
    const v = JSON.parse(raw) as Partial<InstallHintState>;
    const date = (d: unknown) =>
      typeof d === 'string' && DATE_RE.test(d) ? d : null;
    const days =
      typeof v.visitDays === 'number' && Number.isFinite(v.visitDays)
        ? Math.max(0, Math.min(999, Math.floor(v.visitDays)))
        : 0;
    return {
      visitDays: days,
      lastVisit: date(v.lastVisit),
      dismissedOn: date(v.dismissedOn),
    };
  } catch {
    return EMPTY_HINT_STATE;
  }
}

/** 오늘 방문을 센다 (같은 날 여러 번 열어도 1) */
export function recordVisit(
  state: InstallHintState,
  now: number = Date.now(),
): InstallHintState {
  const today = kstToday(now);
  if (state.lastVisit === today) return state;
  return { ...state, visitDays: state.visitDays + 1, lastVisit: today };
}

export function dismissHint(
  state: InstallHintState,
  now: number = Date.now(),
): InstallHintState {
  return { ...state, dismissedOn: kstToday(now) };
}

/** 월드맵 쪽지를 띄울지 */
export function shouldShowWorldHint(
  state: InstallHintState,
  action: InstallAction,
  now: number = Date.now(),
): boolean {
  if (action !== 'prompt' && action !== 'ios-guide') return false;
  if (state.visitDays < INSTALL_HINT_MIN_VISIT_DAYS) return false;
  if (
    state.dismissedOn &&
    kstDaysBetween(state.dismissedOn, kstToday(now)) < INSTALL_HINT_SNOOZE_DAYS
  ) {
    return false;
  }
  return true;
}

/** localStorage 읽기·쓰기 (사생활 모드·차단에서 던져도 앱은 그대로) */
export function loadHintState(): InstallHintState {
  try {
    return parseHintState(localStorage.getItem(INSTALL_HINT_STORAGE_KEY));
  } catch {
    return EMPTY_HINT_STATE;
  }
}

export function saveHintState(state: InstallHintState): void {
  try {
    localStorage.setItem(INSTALL_HINT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 못 해도 이번 화면은 그대로
  }
}
