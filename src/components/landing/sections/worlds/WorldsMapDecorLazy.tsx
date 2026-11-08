'use client';

import dynamic from 'next/dynamic';
import { WhenVisible } from '../../WhenVisible';
import type { WorldNo } from './worldsData';

// 지도 여백 그림은 첫 화면 JS·HTML에 넣지 않는다 (§2.10). 지도 300px 앞에서 받는다
const WorldsMapDecor = dynamic(() => import('./WorldsMapDecor'), {
  ssr: false,
});

/** 카드 옆(넓은 화면은 위·아래) 여백의 작은 그림 자리. 오기 전에는 비어 있다 (장식, 자리 크기는 CSS가 잡음) */
export function WorldsMapDecorLazy({ world }: { world: WorldNo }) {
  return (
    <div className="ld-worlds-decor" data-world-decor={world} aria-hidden>
      <WhenVisible minHeight="0px" className="ld-worlds-decor-in">
        <WorldsMapDecor world={world} />
      </WhenVisible>
    </div>
  );
}
