'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import type { LoginSheetProps } from './LoginSheet';

// 로그인 시트(리그·브랜드 로고·대화 상자)는 첫 화면 JS에 넣지 않는다 (§2.10 랜딩 JS 예산). 누를 때(올려놓기·포커스 때 미리) 불러온다
const loadSheet = () => import('./LoginSheet');

/**
 * 로그인 시트를 늦게 불러와 여는 훅 (P4-09). `LoginSheetButton`·`LandingLoginError`가 같이 쓴다.
 *
 * 시트를 **닫힌 채로 한 번 그린 다음 프레임에** 연다. 처음부터 `open`으로 마운트하면 Base UI가 등장 전환
 * (`data-starting-style`)을 건너뛰어, 첫 열림에서 시트가 스프링 없이 툭 나타나던 문제(P3-05~)를 막는다.
 */
export function useLazyLoginSheet() {
  const [Sheet, setSheet] = useState<ComponentType<LoginSheetProps> | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [want, setWant] = useState(false);

  const prefetch = useCallback(() => {
    void loadSheet();
  }, []);

  const show = useCallback(() => {
    setWant(true);
    void loadSheet().then(
      (m) => setSheet(() => m.LoginSheet),
      () => setWant(false),
    );
  }, []);

  // 시트가 닫힌 채로 그려진 뒤(이 효과는 그 커밋 다음) 한 프레임 쉬고 연다
  useEffect(() => {
    if (!Sheet || !want) return;
    const id = window.requestAnimationFrame(() => {
      setWant(false);
      setOpen(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [Sheet, want]);

  return { Sheet, open, setOpen, show, prefetch };
}
