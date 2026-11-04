/**
 * 기존 마스코트 컴포넌트(src/components/characters/*Svg.tsx)를 그대로 써서
 * 정지 SVG 문자열 / data URI를 만듭니다. (setup.sh가 vendor/characters/로 복사)
 *
 * 꾸미기(Phase 9) 레이어 합성 데모: 같은 viewBox(0 0 128 128) 위에
 * 배경 → 캐릭터 → 코스튬(모자·스카프) 순으로 <g>를 쌓습니다.
 */
import { PybaemSvg } from '@/vendor/characters/PybaemSvg';
import { BugBugSvg } from '@/vendor/characters/BugBugSvg';
import { ByeolttongiSvg } from '@/vendor/characters/ByeolttongiSvg';
import type {
  BugBugExpression,
  ByeolttongiExpression,
  Character,
  PybaemExpression,
} from '@/vendor/characters/expressions';
import { composeLayers, serializeSvg, svgDataUri } from './svg';

export type Costume = 'explorer-hat' | 'party-hat' | 'scarf' | 'glasses';

// 스파이크용 임시 코스튬 (viewBox 128 기준, 파이뱀 머리 중심 cx=64, cy=44, rx=28, ry=24)
const COSTUMES: Record<Costume, string> = {
  'explorer-hat':
    '<svg viewBox="0 0 128 128"><ellipse cx="64" cy="25" rx="34" ry="7" fill="#B07D48"/>' +
    '<path d="M44 25 C44 8, 84 8, 84 25 Z" fill="#D7A86E"/>' +
    '<rect x="44" y="19" width="40" height="5" rx="2" fill="#6D4C41"/>' +
    '<ellipse cx="56" cy="14" rx="6" ry="2.5" fill="#fff" opacity="0.35"/></svg>',
  'party-hat':
    '<svg viewBox="0 0 128 128"><path d="M64 2 L80 26 L48 26 Z" fill="#FF6F91"/>' +
    '<path d="M57 12 L71 12 L74 18 L54 18 Z" fill="#FFD54F"/>' +
    '<circle cx="64" cy="5" r="5" fill="#4FC3F7"/></svg>',
  scarf:
    '<svg viewBox="0 0 128 128"><path d="M40 62 Q64 74 88 62 L88 70 Q64 82 40 70 Z" fill="#EF5350"/>' +
    '<path d="M78 68 L86 92 L76 90 L72 70 Z" fill="#E53935"/>' +
    '<path d="M44 64 Q64 74 84 64" stroke="#fff" stroke-width="2" stroke-dasharray="3 4" fill="none" opacity="0.7"/></svg>',
  glasses:
    '<svg viewBox="0 0 128 128"><circle cx="52" cy="40" r="9" stroke="#37474F" stroke-width="3" fill="#B3E5FC" fill-opacity="0.35"/>' +
    '<circle cx="76" cy="40" r="9" stroke="#37474F" stroke-width="3" fill="#B3E5FC" fill-opacity="0.35"/>' +
    '<path d="M61 40 L67 40" stroke="#37474F" stroke-width="3"/></svg>',
};

export interface CharacterOptions {
  character: Character;
  expression?: string;
  size: number;
  costumes?: Costume[];
  /** 같은 카드에 같은 캐릭터를 여러 번 그릴 때 gradient id 충돌 방지 */
  idPrefix?: string;
}

export function characterSvg({ character, expression, size, costumes = [], idPrefix }: CharacterOptions): string {
  const el =
    character === 'pybaem' ? (
      <PybaemSvg expression={(expression ?? 'happy') as PybaemExpression} size={size} />
    ) : character === 'bugbug' ? (
      <BugBugSvg expression={(expression ?? 'fixed') as BugBugExpression} size={size} />
    ) : (
      <ByeolttongiSvg expression={(expression ?? 'sparkling') as ByeolttongiExpression} size={size} />
    );
  const base = serializeSvg(el, { idPrefix: idPrefix ?? `${character}-`, stripAnimation: true });
  if (costumes.length === 0) return base;
  return composeLayers('0 0 128 128', [base, ...costumes.map((c) => COSTUMES[c])], size);
}

export function characterImg(opts: CharacterOptions): string {
  return svgDataUri(characterSvg(opts));
}
