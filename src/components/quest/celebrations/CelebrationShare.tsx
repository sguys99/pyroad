'use client';

import { createContext, useContext, useEffect } from 'react';
import { ShareButton } from '@/components/share/ShareButton';
import type { ShareCardKind } from '@/lib/share-card/types';

/**
 * 축하 시퀀서가 주는 "잠깐 멈춤" (P9-10): 공유 시트가 열린 동안 자동 넘김·Enter/Esc·Tab 가두기를 멈춘다.
 * 시트(Base UI 대화 상자)가 자기 포커스·Esc 를 맡고, 닫히면 자랑하기 버튼으로 포커스가 돌아와 축하가 이어진다
 */
export const CelebrationHold = createContext<(hold: boolean) => void>(() => {});

/**
 * 축하 카드의 "자랑하기" (P9-10). 버튼 줄 끝의 글자 버튼이라 주 버튼(다음·지도로)의 포커스·흐름은 그대로.
 * 카드마다 따로 마운트되므로 시트도 카드마다 새로(공유 시트는 열린 동안 kind·ref 가 바뀌어도 카드를 다시 만들지 않음)
 */
export function CelebrationShare({
  kind,
  cardRef,
}: {
  kind: ShareCardKind;
  cardRef?: string;
}) {
  const hold = useContext(CelebrationHold);
  // 시트가 열린 채 카드가 사라져도(모두 닫기 등) 멈춤을 풀어 둔다
  useEffect(() => () => hold(false), [hold]);
  return (
    <ShareButton
      kind={kind}
      cardRef={cardRef}
      variant="ghost"
      onOpenChange={hold}
      testId="celebration-share"
    />
  );
}
