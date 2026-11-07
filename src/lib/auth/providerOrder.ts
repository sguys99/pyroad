import type { SocialProvider } from './socialLogin';

/**
 * 로그인 버튼 순서 (P3-08). `priority`에 적은 provider를 그 순서대로 앞으로 옮기고, 나머지는 원래 순서를 지킨다.
 * 보이지 않는 provider(`providers`에 없음)·빈 값은 무시한다.
 *
 *   orderProviders(['kakao', 'naver', 'google'], [lastUsed])          // 최근에 쓴 수단을 맨 위로 (P3-08)
 *   orderProviders(['kakao', 'naver', 'google'], ['kakao', lastUsed]) // 카카오톡 인앱이면 카카오가 먼저 (P3-09)
 */
export function orderProviders(
  providers: readonly SocialProvider[],
  priority: readonly (SocialProvider | null | undefined)[] = [],
): SocialProvider[] {
  const front: SocialProvider[] = [];
  for (const p of priority) {
    if (p && providers.includes(p) && !front.includes(p)) front.push(p);
  }
  return [...front, ...providers.filter((p) => !front.includes(p))];
}
