/**
 * 공유 시트 도우미 (P9-09, P0-10 §4.7): 카카오톡 피드 메시지 · Web Share · 이미지 저장 · 링크 복사.
 * 브라우저 전용이지만 순수 함수(피드 만들기)는 단위 테스트가 그대로 부른다.
 *
 * **Kakao JS SDK**: 공식 CDN(`t1.kakaocdn.net`) + SRI(`integrity`, 카카오 문서의 값 = 파일 sha384 확인)로 시트를 열 때만 늦게 싣는다.
 * 자체 호스팅을 하지 않는 이유: SDK 가 어차피 kapi·sharer.kakao.com 에 붙어야 하고, 고정 버전 + SRI 면 CDN 파일이 바뀌어도
 * 실행되지 않는다(실패 → 링크 복사로). CSP 는 nonce 정책에 카카오 출처만 더함(`src/lib/security/csp.ts`).
 */
import type { ShareCardKind } from './types';

/** 고정 버전. 올릴 때는 카카오 문서(JavaScript SDK 다운로드)의 integrity 값을 같이 바꾼다 */
export const KAKAO_SDK_URL =
  'https://t1.kakaocdn.net/kakao_js_sdk/2.8.5/kakao.min.js';
export const KAKAO_SDK_INTEGRITY =
  'sha384-v6JKY3z4FUkWq21oZDHZe74YvuPk/WUrVLrDHTBojHXClOSa3iXy7sCXPY1jkFbj';

/** 공유 채널 (분석 `share_channel.channel`, P9-10 보상 콜백) */
export type ShareChannel = 'kakao' | 'web_share' | 'save_image' | 'copy_link';

/** 만들기 API 응답 (`POST /api/share-cards`, P9-07) */
export interface ShareCardCreated {
  id: string;
  kind: ShareCardKind;
  version: number;
  expiresAt: string;
  /** 사이트 안 경로 `/api/share-cards/{id}/image?v={version}` */
  imageUrl: string;
  /** 오늘(KST) 자랑하기 보상을 이미 받았는지 (P9-10). 없으면 모름 = 안 받은 것으로 보여 줌 */
  rewardClaimed?: boolean;
}

/** 자랑하기 보상 (`POST /api/share-cards/reward`, P9-10 · 00044 claim_share_reward) */
export interface ShareRewardResult {
  coins_earned: number;
  coins_balance: number;
  already_claimed: boolean;
}

/** 저장 파일 이름 (이미지 라우트 `Content-Disposition` · 이미지 저장 버튼) */
export const SHARE_CARD_FILENAME: Record<ShareCardKind, string> = {
  levelup: 'pyroad-levelup.png',
  stage: 'pyroad-stage-clear.png',
  achievement: 'pyroad-achievement.png',
  weekly: 'pyroad-weekly.png',
};

/** 카카오 메시지 제목 · Web Share 글 (닉네임 없이 — 닉네임은 카드 그림에만) */
export const SHARE_TITLE: Record<ShareCardKind, string> = {
  levelup: '파이썬 모험에서 레벨이 올랐어요!',
  stage: '파이썬 모험 스테이지를 깼어요!',
  achievement: '파이썬 모험에서 새 업적을 받았어요!',
  weekly: '이번 주 파이썬 모험 기록이에요!',
};
export const SHARE_DESCRIPTION = 'pyRoad에서 파이뱀과 파이썬을 배우고 있어요.';

/** 공유 페이지 절대 주소. 지금 열린 사이트 출처 기준(프리뷰·로컬에서 만든 카드는 그 배포에만 있음) */
export function sharePageUrl(origin: string, id: string): string {
  return `${origin}/share/${id}`;
}

/**
 * `Kakao.Share.sendDefault` 피드 템플릿. 그림은 카드 PNG(1200×630, 카카오가 2:1로 잘라도 위아래 20px 안은 바탕뿐 — 테스트로 확인),
 * 카드가 바뀌면 `?v=` 가 바뀌어 카카오 썸네일 캐시를 피한다. 버튼 "나도 해보기"는 랜딩 30초 체험(공유 페이지 CTA 와 같음)
 */
export function kakaoFeed(
  card: ShareCardCreated,
  origin: string,
  tryHref: string,
) {
  const page = sharePageUrl(origin, card.id);
  const tryUrl = new URL(tryHref, origin).toString();
  return {
    objectType: 'feed' as const,
    content: {
      title: SHARE_TITLE[card.kind],
      description: SHARE_DESCRIPTION,
      imageUrl: new URL(card.imageUrl, origin).toString(),
      imageWidth: 1200,
      imageHeight: 630,
      link: { mobileWebUrl: page, webUrl: page },
    },
    buttons: [
      { title: '나도 해보기', link: { mobileWebUrl: tryUrl, webUrl: tryUrl } },
    ],
  };
}

interface KakaoSdk {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(settings: ReturnType<typeof kakaoFeed>): void };
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let sdkPromise: Promise<KakaoSdk | null> | null = null;

/**
 * SDK 를 한 번만 싣고 `Kakao.init(키)`. 키가 없거나 못 실으면 null(→ 카카오 버튼 숨김·링크 복사).
 * 이미 `window.Kakao` 가 있으면 그것을 쓴다(다른 화면이 실었거나 e2e 모의 객체)
 */
export function loadKakao(
  key: string | undefined = process.env.NEXT_PUBLIC_KAKAO_JS_KEY,
): Promise<KakaoSdk | null> {
  if (!key || typeof window === 'undefined') return Promise.resolve(null);
  sdkPromise ??= new Promise<KakaoSdk | null>((resolve) => {
    if (window.Kakao) return resolve(window.Kakao);
    const s = document.createElement('script');
    s.src = KAKAO_SDK_URL;
    s.integrity = KAKAO_SDK_INTEGRITY;
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.onload = () => resolve(window.Kakao ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  }).then((sdk) => {
    if (!sdk) {
      sdkPromise = null; // 다음에 시트를 열 때 다시 시도
      return null;
    }
    try {
      if (!sdk.isInitialized()) sdk.init(key);
      return sdk;
    } catch {
      return null;
    }
  });
  return sdkPromise;
}

/** 클립보드에 쓰기. 막힌 웹뷰는 옛 방식으로 (InAppBrowserGuide 와 같음) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(input);
    return ok;
  }
}

/** 휴대폰(iOS·Android): `<a download>`가 잘 안 되거나(iOS Safari·웹뷰) 사진첩이 아닌 파일로 가서 공유 시트의 "이미지 저장"을 먼저 쓴다 */
export function isMobileUa(ua: string): boolean {
  return /iPhone|iPad|iPod|Android/i.test(ua);
}
