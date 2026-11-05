import { PyodideProvider } from '@/lib/pyodide/PyodideProvider';

/**
 * 퀘스트 화면 공용 레이아웃. Pyodide Worker를 여기서 한 번만 띄워서
 * 퀘스트 사이를 옮겨도 실행기를 다시 불러오지 않는다 (B22, §2.9).
 */
export default function QuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PyodideProvider>{children}</PyodideProvider>;
}
