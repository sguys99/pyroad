/**
 * 인증 검증은 src/lib/supabase/middleware.ts에서 처리합니다.
 * 미들웨어가 미인증 사용자를 이미 리다이렉트하므로 여기서 중복 호출하지 않습니다.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
