/**
 * 공유 카드 캐릭터 (P2-19, §2.5). 리그 정지 그림(`PybaemStatic` 등, 기본 스타일 B)을 SVG 문자열로 직렬화해 data URI로 넣는다.
 * - `framing="stage"`(여백 있는 viewBox)라 모자·팔이 잘리지 않는다
 * - `filters={false}`: 종이 결 필터를 빼 래스터 비용을 줄인다(B 스타일은 원래 필터 0, P0-10 §4.2)
 * - 같은 카드에 여러 캐릭터가 있어도 id 접두사가 달라 그라디언트·clipPath가 섞이지 않는다
 */
import { createElement } from 'react';
import {
  BugBugStatic,
  ByeolttongiStatic,
  PybaemStatic,
  type BugBugState,
  type ByeolttongiState,
  type PybaemState,
} from '@/components/characters/rig';
import type { Costume } from '@/components/characters/rig/costumes';
import { serializeSvg, svgDataUri } from './svg';

export type CardCharacter =
  | { id: 'pybaem'; state: PybaemState; costume?: Costume }
  | { id: 'bugbug'; state: BugBugState }
  | { id: 'byeolttongi'; state: ByeolttongiState };

/** 캐릭터 SVG 문자열 (크기는 카드 `<img>`가 정한다. 여기서는 viewBox 기준 256px) */
export function characterSvg(c: CardCharacter, idPrefix?: string): string {
  const common = {
    size: 256,
    framing: 'stage' as const,
    filters: false,
    label: '',
    idPrefix: idPrefix ?? `card-${c.id}-${c.state}-`,
  };
  const el =
    c.id === 'pybaem'
      ? createElement(PybaemStatic, {
          ...common,
          state: c.state,
          costume: c.costume,
        })
      : c.id === 'bugbug'
        ? createElement(BugBugStatic, { ...common, state: c.state })
        : createElement(ByeolttongiStatic, { ...common, state: c.state });
  return serializeSvg(el);
}

export function characterUri(c: CardCharacter, idPrefix?: string): string {
  return svgDataUri(characterSvg(c, idPrefix));
}
