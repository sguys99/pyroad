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
 * 로그인 화면 공용 틀 (서버 컴포넌트). `(protected)/layout.tsx`(월드맵·퀘스트·프로필·설정·게시판)와
 * `onboarding/layout.tsx`(P3-11)가 같이 쓴다. 온보딩은 `(protected)` 밖에 둬야 관문 리다이렉트가 돌지 않으므로 틀만 나눴다.
 *
 * - 본문 랜드마크 `<main>`은 여기서 한 번만 둔다 (B33). 각 페이지에서 `<main>`을 또 쓰지 않는다
 * - 움직임 설정 (P2-15): 서버 값(`users.settings.motion`)을 본문보다 먼저 nonce 스크립트로 부트에 넘겨
 *   새 기기에서도 첫 화면부터 연출 단계가 맞게 한다. 조회는 요청 안에서 한 번 (`loadOwnUserRow`, React cache)
 * - 사운드 설정 (P2-14): 서버 값과 기기 값 중 최신 것을 쓰고, 여기 있는 동안 바꾼 설정을 서버에 저장한다 (`SoundSettingsSync`)
 *
 * 쓰는 레이아웃은 `export const dynamic = 'force-dynamic'`이어야 한다: 페이지 CSP의 nonce를 서버 렌더 때 넣기 때문 (B27)
 */
export async function LoggedInShell({
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
