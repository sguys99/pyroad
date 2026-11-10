import { PyodideProvider } from '@/lib/pyodide/PyodideProvider';
// 코드 글꼴 pyRoad Mono(D2Coding) 조각은 퀘스트·에디터 화면에서만 싣는다 (P2-10, 렌더 차단 CSS 절약)
import '@/fonts/pyroad-mono/pyroad-mono.css';

/**
 * 퀘스트 화면 공용 레이아웃. Pyodide Worker를 여기서 한 번만 띄워서
 * 퀘스트 사이를 옮겨도 실행기를 다시 불러오지 않는다 (B22, §2.9). 띄우는 때는 코드 퀘스트에 들어올 때,
 * 퀴즈는 "직접 실행해 보기"를 누를 때 (lazy, P7-07).
 * 코드 글꼴(`--font-mono`)도 여기서만 싣는다.
 */
export default function QuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PyodideProvider>{children}</PyodideProvider>;
}
