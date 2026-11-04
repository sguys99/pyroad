import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Pyodide 자체 호스팅 파일(/pyodide/)과 Worker 스크립트(/workers/)는 정적 파일이라 세션 갱신이 필요 없다 (B26)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|pyodide/|workers/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
