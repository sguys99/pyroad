/**
 * 약관·개인정보처리방침의 운영자 정보와 버전 (P3-14, §12-Q37).
 *
 * 버전은 문서를 고칠 때마다 날짜(YYYY-MM-DD)로 올린다. 온보딩(P3-11)·보호자 동의(P3-15)는 동의할 때의 버전을
 * 기록하므로(`agreements.ts`), 버전이 바뀌면 다시 동의를 받을지 그 화면에서 판단할 수 있다.
 * 개정할 때는 같은 커밋에서 `terms.ts`·`privacy.ts`의 `history`에 한 줄을 더한다.
 */

/** 운영자 = 개인정보 보호책임자 (개인 개발자, §12-Q37) */
export const LEGAL_OPERATOR = {
  serviceName: 'pyRoad',
  serviceUrl: 'https://pyroad.vercel.app',
  name: '유기홍',
  kind: '개인 개발자',
  email: 'sguys99@gmail.com',
} as const;

// TODO(P12-06 법률 검토): 시행일은 처음 공개 배포하는 날로 다시 맞춘다 (지금 값은 초안을 쓴 날)
/** 이용약관 버전 */
export const TERMS_VERSION = '2026-11-20';
/** 개인정보처리방침 버전 */
export const PRIVACY_VERSION = '2026-11-20';

// v0.7 개정(P9-07~11·P9-15·P9-17): 공지일 + 7일 = 시행일 = 배포일. 공지를 올린 날이 2026-11-13 이 아니면
// 아래 네 값을 (공지일 + 7일 이후의) 실제 배포일로 같이 바꾼다 — v0.7 런북 "처리방침 개정 공지".
// 버전만 바뀌고 다시 동의는 받지 않는다(기존 동의 기록은 예전 버전 그대로, 새 가입·보호자 동의부터 이 버전으로 기록)
export const TERMS_EFFECTIVE_DATE = '2026-11-20';
export const PRIVACY_EFFECTIVE_DATE = '2026-11-20';

/** 법적 고지 페이지 (비로그인 열람, 정적 렌더 — `src/lib/security/csp.ts`의 STATIC_PAGE_PATHS) */
export const LEGAL_LINKS = [
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침' },
  { href: '/licenses', label: '오픈소스 고지' },
] as const;

export type LegalPath = (typeof LEGAL_LINKS)[number]['href'];

/** "2026-11-06" → "2026년 11월 6일" (시간대와 무관한 문자열 변환) */
export function formatLegalDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}
