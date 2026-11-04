'use client';

import { createContext, useContext } from 'react';
import { usePyodide, type UsePyodideOptions } from './usePyodide';

export type PyodideRuntime = ReturnType<typeof usePyodide>;

const PyodideContext = createContext<PyodideRuntime | null>(null);

/**
 * 퀘스트 레이아웃 단위 Pyodide Worker 싱글톤 (B22, §2.9).
 *
 * `src/app/(protected)/quest/layout.tsx`에 둔다. 퀘스트 사이를 소프트 내비게이션으로 옮기면
 * 레이아웃은 그대로라 Worker와 불러온 Pyodide를 다시 쓰고, 퀘스트 화면을 벗어나면(월드맵 등)
 * 레이아웃이 언마운트되면서 Worker를 terminate한다. 격리 헤더(COOP/COEP)를 쓰지 않으므로
 * 소프트 내비게이션 제약이 없다(P0-05). 늦은 이벤트는 usePyodide의 세대 번호로 계속 무시된다(B14).
 */
export function PyodideProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  /** 테스트용 (시간 초과·멈추기 대기 시간) */
  options?: UsePyodideOptions;
}) {
  const runtime = usePyodide(options);
  return (
    <PyodideContext.Provider value={runtime}>{children}</PyodideContext.Provider>
  );
}

/** PyodideProvider 안에서 공용 실행기를 꺼낸다 */
export function usePyodideRuntime(): PyodideRuntime {
  const runtime = useContext(PyodideContext);
  if (!runtime) {
    throw new Error('usePyodideRuntime은 PyodideProvider 안에서만 쓸 수 있어요');
  }
  return runtime;
}
