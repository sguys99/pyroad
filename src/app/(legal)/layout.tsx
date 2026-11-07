// 법적 고지 페이지도 앱 화면 웹폰트를 쓴다 (P2-10). 랜딩에는 싣지 않으려고 루트가 아닌 여기서 import
import '@/fonts/app.css';

/**
 * `/terms` · `/privacy` · `/licenses` (P3-14). 비로그인 열람, 사용자 콘텐츠가 없어 빌드 때 정적 HTML로 굳는다
 * → CSP 정적 정책 목록(`src/lib/security/csp.ts`의 STATIC_PAGE_PATHS)에 들어 있다. 요청 정보(쿠키·헤더)를 읽으면
 * 동적 렌더가 되어 postbuild 경고가 나므로 여기와 페이지에서 읽지 않는다.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
