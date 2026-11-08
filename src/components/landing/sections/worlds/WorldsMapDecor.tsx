/**
 * 지도 여백의 작은 그림 (P4-04): 월드마다 하나씩 — 섬의 소나무, 바다의 물결과 돛단배, 도시의 톱니바퀴.
 * 화면에 들어올 때 받는 모듈(`WorldsMapDecorLazy`가 `next/dynamic`으로 import). 장식이라 `aria-hidden`.
 * 칠하는 방식은 표지 그림(WorldCoverArt)과 같다.
 */
import { gearPath } from './WorldCoverArt';
import type { WorldNo } from './worldsData';

function IslandDecor() {
  return (
    <>
      <path
        className="hm hm-hill"
        d="M4 56C12 42 26 36 38 38C50 40 58 48 62 56Z"
      />
      <g transform="translate(22 46) scale(0.34)">
        <path className="hm hm-wood-dark" d="M-3-22h6v22h-6z" />
        <path
          className="hm hm-forest"
          d="M0-92L20-52L10-52L26-22L-26-22L-10-52L-20-52Z"
        />
      </g>
      <g transform="translate(40 46) scale(0.26)">
        <path className="hm hm-wood-dark" d="M-3-22h6v22h-6z" />
        <path
          className="hm hm-olive"
          d="M0-92L20-52L10-52L26-22L-26-22L-10-52L-20-52Z"
        />
      </g>
      <path className="hm-ink" d="M10 14q4-5 8 0q4-5 8 0" />
    </>
  );
}

function SeaDecor() {
  return (
    <>
      <g transform="translate(32 40)">
        <path className="hm hm-wood" d="M-16 0h32l-6 7h-20z" />
        <path className="hm-ink" d="M0 0v-26" />
        <path className="hm hm-paper" d="M2-24L15-4H2Z" />
        <path className="hm hm-paper" d="M-2-18L-11-4H-2Z" />
        <path className="hm hm-gold" d="M0-26l6 2.5l-6 2.5z" />
      </g>
      <path
        className="hm-wave"
        d="M6 54q3-3 6 0q3 3 6 0q3-3 6 0M36 58q3-3 6 0q3 3 6 0q3-3 6 0"
      />
    </>
  );
}

function CityDecor() {
  return (
    <>
      <path className="hm hm-wood" d={gearPath(24, 34, 14, 9)} />
      <circle className="hm hm-paper" cx="24" cy="34" r="5" />
      <path className="hm hm-gold" d={gearPath(46, 48, 8, 7)} />
      <circle className="hm hm-paper" cx="46" cy="48" r="2.8" />
      <path className="hm-mark" d="M48 12l8 8M56 12l-8 8" />
    </>
  );
}

export default function WorldsMapDecor({ world }: { world: WorldNo }) {
  return (
    <svg
      className="ld-worlds-decor-art"
      viewBox="0 0 64 64"
      aria-hidden
      focusable="false"
    >
      {world === 1 ? (
        <IslandDecor />
      ) : world === 2 ? (
        <SeaDecor />
      ) : (
        <CityDecor />
      )}
    </svg>
  );
}
