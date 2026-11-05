import type { createClient } from './client';

type BrowserClient = ReturnType<typeof createClient>;

/**
 * 브라우저용 Supabase 클라이언트를 필요할 때 불러옵니다 (로그인·로그아웃·저장 등 사용자 동작 시점).
 *
 * B33: 클라이언트 컴포넌트가 `./client`를 정적으로 import하면 supabase-js(약 66KB gzip)가
 * 랜딩·월드맵·프로필·퀘스트의 첫 JS에 들어가고, Turbopack 15.5가 같은 모듈 묶음을 화면마다 다른
 * 순서로 담아 해시만 다른 청크 두 벌이 생겼습니다. 동적 import 한 곳으로 모으면 한 벌의 비동기 청크가
 * 되어 화면을 오가도 캐시를 씁니다. 클라이언트 컴포넌트에서는 `./client` 대신 이 함수를 쓰세요.
 * (`createBrowserClient`는 브라우저에서 싱글턴이라 여러 번 불러도 같은 인스턴스)
 */
export async function loadBrowserClient(): Promise<BrowserClient> {
  const { createClient } = await import('./client');
  return createClient();
}
