import { headers } from 'next/headers';
import { MotionSettingsSync } from '@/components/providers/MotionSettingsSync';
import { SoundSettingsSync } from '@/components/providers/SoundSettingsSync';
import { motionBootSyncScript } from '@/lib/motion/boot';
import { loadMotionSettings } from '@/lib/motion/server';
import { loadSoundSettings } from '@/lib/sound/server';
import { nonceFromCsp } from '@/lib/security/csp';
// 앱 화면 웹폰트(제목 Jua·본문 pyRoad Sans 조각). 랜딩에는 싣지 않으려고 루트가 아닌 여기서 import (P2-10)
import '@/fonts/app.css';

/**
 * 로그인 화면은 모두 요청마다 렌더한다: 페이지 CSP의 nonce를 서버 렌더 때 넣어야 하기 때문이다 (B27).
 * (설정·글쓰기처럼 서버 데이터가 없는 화면도 빌드 때 HTML로 굳히면 nonce가 없어 스크립트가 막힌다)
 */
export const dynamic = 'force-dynamic';

/**
 * 인증 검증은 src/lib/supabase/middleware.ts에서 처리합니다.
 * 미들웨어가 미인증 사용자를 이미 리다이렉트하므로 여기서 중복 호출하지 않습니다.
 *
 * 로그인 화면(월드맵·퀘스트·프로필·설정·게시판)의 본문 랜드마크 `<main>`은 여기서 한 번만 둡니다 (B33).
 * 각 페이지에서 `<main>`을 또 쓰지 마세요.
 *
 * 움직임 설정 (P2-15): 서버 값(`users.settings.motion`)을 본문보다 먼저 nonce 스크립트로 부트에 넘겨
 * 새 기기에서도 첫 화면부터 연출 단계가 맞게 한다. `getAuthUser()`는 요청 안에서 페이지와 한 번만 부른다 (React cache).
 *
 * 사운드 설정 (P2-14): 서버 값과 기기 값 중 최신 것을 쓰고, 여기 있는 동안 바꾼 설정을 서버에 저장한다 (`SoundSettingsSync`).
 * `users.settings`는 움직임 설정과 같은 조회 한 번으로 읽는다.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [motion, sound, requestHeaders] = await Promise.all([
    loadMotionSettings(),
    loadSoundSettings(),
    headers(),
  ]);
  const nonce = nonceFromCsp(requestHeaders.get('content-security-policy'));
  return (
    <main>
      {motion && (
        <>
          <script
            nonce={nonce}
            // 브라우저가 nonce 속성 값을 숨겨(nonce hiding) 하이드레이션 때 달라 보임
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: motionBootSyncScript(motion) }}
          />
          <MotionSettingsSync settings={motion} />
        </>
      )}
      <SoundSettingsSync settings={sound} />
      {children}
    </main>
  );
}
