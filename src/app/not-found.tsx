import Link from 'next/link';
import { displayNotFound, sansNotFound } from '@/fonts/notFound';

/**
 * 없는 주소 화면. 없는 주소는 `[...missing]`이 받아 요청마다 렌더하므로 nonce가 붙는다 (B27).
 * 여기서 `connection()`을 부르면 안 된다: 루트 not-found는 모든 페이지 트리에 들어가 랜딩까지 동적 렌더가 된다.
 *
 * 글꼴은 랜딩 텍스트 서브셋을 같이 쓴다 (B99): 이 파일은 랜딩 글자 모으기 시작점(`LANDING_ENTRIES`)이라
 * 여기 문구 글자도 서브셋에 들어 있다. 앱 조각 CSS(`@/fonts/app.css`)는 루트 트리에 넣으면 랜딩에 실리고,
 * 오류 셸이 따로 받는 CSS는 가끔 끊겨 빈 화면이 된다.
 */
export default function NotFound() {
  return (
    <main
      className={`${displayNotFound.variable} ${sansNotFound.variable} flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center font-sans`}
    >
      <h1 className="text-2xl font-bold">길을 찾을 수 없어요</h1>
      <p className="text-base text-muted-foreground">
        주소가 바뀌었거나 없는 곳이에요.
      </p>
      {/* 다른 화면과 같은 게임 버튼 모양 (B126). 서버 컴포넌트라 `Button`(클라이언트·소리) 대신 같은 클래스만 — 눌림 연출 없음 */}
      <Link href="/" className="g-btn" data-variant="primary">
        <span className="g-btn-face font-display">처음으로 가기</span>
      </Link>
    </main>
  );
}
