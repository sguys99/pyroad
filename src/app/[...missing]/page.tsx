import { notFound } from 'next/navigation';

/**
 * 어느 라우트에도 맞지 않는 주소를 받아 404를 요청마다 렌더한다 (B27).
 *
 * 이 라우트가 없으면 Next는 빌드 때 HTML로 굳힌 `/_not-found`를 보내는데, 그 HTML에는 nonce가 없어
 * 페이지 CSP(nonce 정책)에서 스크립트가 모두 막힌다. 구체적인 라우트와 `public/` 파일이 항상 먼저 맞으므로
 * 다른 주소에는 영향이 없다.
 */
export const dynamic = 'force-dynamic';

export default function MissingPage() {
  notFound();
}
