import Link from 'next/link';

/**
 * 없는 주소 화면. 없는 주소는 `[...missing]`이 받아 요청마다 렌더하므로 nonce가 붙는다 (B27).
 * 여기서 `connection()`을 부르면 안 된다: 루트 not-found는 모든 페이지 트리에 들어가 랜딩까지 동적 렌더가 된다.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">길을 찾을 수 없어요</h1>
      <p className="text-base text-muted-foreground">
        주소가 바뀌었거나 없는 곳이에요.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground"
      >
        처음으로 가기
      </Link>
    </main>
  );
}
