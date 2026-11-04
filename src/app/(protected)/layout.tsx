/**
 * 인증 검증은 src/lib/supabase/middleware.ts에서 처리합니다.
 * 미들웨어가 미인증 사용자를 이미 리다이렉트하므로 여기서 중복 호출하지 않습니다.
 *
 * 로그인 화면(월드맵·퀘스트·프로필·설정·게시판)의 본문 랜드마크 `<main>`은 여기서 한 번만 둡니다 (B33).
 * 각 페이지에서 `<main>`을 또 쓰지 마세요.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main>{children}</main>;
}
