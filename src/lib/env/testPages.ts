/**
 * 테스트 전용 페이지(`/dev/*`)를 열지 (P2-18). 개발 서버이거나 e2e가 `PYROAD_TEST_PAGES=1`을 넣은 서버에서만 연다.
 * 운영(Vercel)은 이 변수를 넣지 않으므로 404. 페이지는 동적 렌더라 요청 때마다 이 값을 읽는다(빌드에 굳지 않음)
 */
export function isTestPagesEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === 'development' || env.PYROAD_TEST_PAGES === '1';
}
