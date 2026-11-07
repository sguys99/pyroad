import { toSocialProvider } from './loginProvider';
import type { SocialProvider } from './socialLogin';

/**
 * 로그인 화면에 보일 provider (P3-09). `NEXT_PUBLIC_LOGIN_PROVIDERS=kakao,google`처럼 쉼표로 고른다.
 *
 * - 목적: 네이버 검수(P3-03, 2~3 영업일)가 끝나기 전에 병합·배포할 수 있게 버튼만 숨긴다. 검수 전에는 관리자·테스터 ID만
 *   로그인되므로 일반 사용자에게 보이면 실패 화면만 본다
 * - 비우거나(기본) 알아볼 수 있는 값이 하나도 없으면 **세 개 모두**(오타로 로그인 버튼이 사라지는 일을 막음)
 * - 순서는 env가 아니라 화면 규칙(`orderProviders`: 카카오톡 인앱 → 최근 사용 → 기본 순서)이 정한다
 * - 버튼만 숨긴다. 이미 연결된 계정·`getOAuthCredentials`는 그대로(provider 설정은 Supabase 대시보드가 원본)
 * - `NEXT_PUBLIC_`이라 빌드 때 번들에 들어간다 → 바꾸면 재배포
 */
export const ALL_SOCIAL_PROVIDERS: readonly SocialProvider[] = [
  'kakao',
  'naver',
  'google',
];

export function parseLoginProviders(
  raw: string | null | undefined,
): SocialProvider[] {
  if (!raw) return [...ALL_SOCIAL_PROVIDERS];
  const picked = new Set<SocialProvider>();
  for (const part of raw.split(',')) {
    const p = toSocialProvider(part);
    if (p) picked.add(p);
  }
  if (picked.size === 0) return [...ALL_SOCIAL_PROVIDERS];
  return ALL_SOCIAL_PROVIDERS.filter((p) => picked.has(p));
}

/** 이 빌드의 provider 목록 (기본 순서 카카오 → 네이버 → Google 중 켠 것) */
export const ENABLED_LOGIN_PROVIDERS: readonly SocialProvider[] =
  parseLoginProviders(process.env.NEXT_PUBLIC_LOGIN_PROVIDERS);
