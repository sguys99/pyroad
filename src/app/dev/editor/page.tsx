import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { isTestPagesEnabled } from '@/lib/env/testPages';
// 코드 글꼴 조각은 퀘스트 레이아웃에서만 싣는다. 이 페이지는 같은 에디터를 로그인 없이 재려고 같은 CSS를 싣는다
import '@/fonts/pyroad-mono/pyroad-mono.css';
// 앱 화면 전용 유틸리티 (P4-12)
import '@/app/app.css';
import { EditorLab } from './EditorLab';

export const metadata: Metadata = {
  title: '에디터 점검 (개발 전용)',
  robots: { index: false, follow: false },
};

/**
 * 에디터 점검 페이지 (P2-18, 개발·e2e 전용). 한글 주석 정렬 e2e(`e2e/public/editor-alignment.spec.ts`)와
 * 키즈 테마 스크린샷용. 운영 빌드에서는 404 (`isTestPagesEnabled`)
 */
export default async function EditorLabPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection(); // 동적 렌더: 정적 HTML로 굳지 않고 요청 때 env를 읽는다
  if (!isTestPagesEnabled()) notFound();
  const { error } = await searchParams;
  const errorLine = Number(error);
  return (
    <EditorLab
      errorLine={
        Number.isInteger(errorLine) && errorLine > 0 ? errorLine : null
      }
    />
  );
}
