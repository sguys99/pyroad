/**
 * 월드 표지 그림 3장 (P4-04). 최종 시안 `art.tsx`의 `CoverArt`(숲 마을·바다 여행·발명가의 공방)를
 * Q40 이름(파이썬 섬·코드 바다·메이커 시티)에 맞게 다시 그리고, 히어로(`hero/HeroArt.tsx`)와 같은 방식으로 칠한다.
 *
 * - 색은 재질 클래스(`hm-*`, 면 색 `--f` + 그 진한 톤 선 1.1px)만. 기본 규칙은 worlds.css `.ld-worlds .hm`,
 *   면 색 대부분은 히어로와 공유(hero.css의 전역 `.hm-sea`·`.hm-hill`…), 월드 2·3 전용 몇 개는 worlds.css
 * - 하늘은 카드의 `data-world`가 바꾸는 `--world-soft`
 * - 서버 컴포넌트(훅 없음). 장식이라 `aria-hidden` (이름·설명은 카드 글자가 맡는다)
 */
import type { WorldNo } from './worldsData';

const VIEW_BOX = '0 0 200 140';

/** 톱니바퀴 (시안 `Gear`, 좌표는 소수 첫째 자리까지) */
export function gearPath(x: number, y: number, r: number, teeth: number) {
  const n = teeth * 2;
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.2;
    d += `${i ? 'L' : 'M'}${f(x + Math.cos(a0) * rr)} ${f(y + Math.sin(a0) * rr)}L${f(x + Math.cos(a1) * rr)} ${f(y + Math.sin(a1) * rr)}`;
  }
  return `${d}Z`;
}

function Pine({
  x,
  y,
  s = 0.26,
  tone = 'forest',
}: {
  x: number;
  y: number;
  s?: number;
  tone?: 'forest' | 'olive';
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="hm hm-wood-dark" d="M-3-22h6v22h-6z" />
      <path
        className={`hm hm-${tone}`}
        d="M0-92L20-52L10-52L26-22L-26-22L-10-52L-20-52Z"
      />
    </g>
  );
}

function Cloud({ x, y, s = 0.26 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className="hm hm-cloud"
        d="M-92 20C-104 0-84-20-60-13C-54-42-14-48 4-27C16-50 60-46 66-16C90-21 106 2 94 20Z"
      />
    </g>
  );
}

function Waves({ x, y, n = 2 }: { x: number; y: number; n?: number }) {
  const d = Array.from(
    { length: n },
    (_, k) => `M${x + k * 13} ${y + (k % 2) * 3}q3-3 6 0q3 3 6 0`,
  ).join('');
  return <path className="hm-wave" d={d} />;
}

/** 월드 1 · 파이썬 섬: 바다 위 초록 섬, 꼭대기 성, 성까지 이어진 점선 길 */
function IslandCover() {
  return (
    <>
      <circle className="hm-sun-halo" cx="158" cy="32" r="21" />
      <circle className="hm hm-sun" cx="158" cy="32" r="12" />
      <Cloud x={52} y={30} />
      <path className="hm-ink" d="M118 22q4-5 8 0q4-5 8 0" />
      <path
        className="hm hm-sea"
        d="M-2 92C40 88 80 94 120 90C150 87 180 92 202 89V142H-2Z"
      />
      <path
        className="hm hm-sand"
        d="M18 110C30 84 64 66 100 62C138 58 168 80 182 110C150 118 50 118 18 110Z"
      />
      <path
        className="hm hm-hill"
        d="M24 106C36 82 66 66 100 62C134 58 162 80 176 106C148 113 52 113 24 106Z"
      />
      <path
        className="hm hm-hill-2"
        d="M44 107C62 94 88 90 110 91C136 92 152 99 162 106C138 112 68 112 44 107Z"
      />
      <Pine x={56} y={88} />
      <Pine x={68} y={84} s={0.2} tone="olive" />
      <Pine x={146} y={86} s={0.22} tone="olive" />
      <Pine x={157} y={92} s={0.18} />
      {/* 성 */}
      <ellipse className="hm-shadow" cx="104" cy="67" rx="22" ry="3" />
      <path className="hm hm-stone" d="M86 66V44h8v22zM114 66V44h8v22z" />
      <path
        className="hm hm-stone"
        d="M94 66V52h3v-3h3v3h3v-3h3v3h2v-3h3v3h3v14z"
      />
      <path
        className="hm hm-roof"
        d="M84.5 44L90 31L95.5 44ZM112.5 44L118 31L123.5 44Z"
      />
      <path className="hm hm-wood-dark" d="M100.5 66v-6a3.5 3.5 0 0 1 7 0v6z" />
      <path className="hm-ink" d="M90 31v-7M118 31v-7" />
      <path
        className="hm hm-gold"
        d="M90 24l6 2.5l-6 2.5zM118 24l6 2.5l-6 2.5z"
      />
      {/* 해변에서 성까지 점선 길 */}
      <path
        className="hm-road"
        d="M60 112C66 104 84 104 90 96C96 88 98 78 103 70"
      />
      <Waves x={10} y={124} />
      <Waves x={164} y={128} />
    </>
  );
}

/** 월드 2 · 코드 바다: 넓은 바다, 종이 돛단배, 고래 꼬리, 수평선 너머 등대 섬 */
function SeaCover() {
  return (
    <>
      <circle className="hm-sun-halo" cx="40" cy="32" r="20" />
      <circle className="hm hm-sun" cx="40" cy="32" r="11" />
      <path
        className="hm-ink"
        d="M118 28q4-5 8 0q4-5 8 0M140 40q3-4 6 0q3-4 6 0"
      />
      <path
        className="hm hm-hill-far"
        d="M150 77C160 68 178 66 196 72L202 77Z"
      />
      <g transform="translate(178 72)">
        <path className="hm hm-paper" d="M-3 0L-2.5-16h5L3 0Z" />
        <path className="hm hm-gold" d="M-2.5-16h5v-4h-5z" />
        <path className="hm hm-roof" d="M-3.5-20L0-24L3.5-20Z" />
      </g>
      <path
        className="hm hm-sea"
        d="M-2 76C40 72 80 79 120 75C150 72 180 77 202 75V142H-2Z"
      />
      <path
        className="hm hm-sea-deep"
        d="M-2 112C50 106 120 114 202 107V142H-2Z"
      />
      {/* 종이 돛단배 */}
      <g transform="translate(92 98)">
        <path className="hm hm-wood" d="M-26 0h52l-9 11h-34z" />
        <path className="hm-ink" d="M0 0v-42" />
        <path className="hm hm-paper" d="M2.5-39L24-6H2.5Z" />
        <path className="hm hm-paper" d="M-2.5-30L-18-6H-2.5Z" />
        <path className="hm hm-gold" d="M0-42l8 3l-8 3z" />
      </g>
      {/* 고래 꼬리 */}
      <path
        className="hm hm-whale"
        d="M158 112c-3-9-10-11-15-14c6 0 12 3 15 8c3-5 9-8 15-8c-5 3-12 5-15 14z"
      />
      <Waves x={14} y={92} n={3} />
      <Waves x={126} y={94} />
      <Waves x={30} y={126} n={3} />
      <Waves x={118} y={130} />
    </>
  );
}

/** 월드 3 · 메이커 시티: 설계도 격자 위 작은 도시, 톱니바퀴, 아이디어 전구 */
function CityCover() {
  return (
    <>
      <g className="ld-worlds-grid">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={`v${i}`} d={`M${i * 22 + 12} 0V112`} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${i * 22 + 12}H200`} />
        ))}
      </g>
      <path className="hm hm-wood" d={gearPath(118, 70, 20, 10)} />
      <circle className="hm hm-paper" cx="118" cy="70" r="7" />
      <path className="hm hm-gold" d={gearPath(92, 36, 9, 8)} />
      <circle className="hm hm-paper" cx="92" cy="36" r="3.2" />
      {/* 건물 */}
      <path className="hm hm-stone" d="M22 112V76h22v36z" />
      <path className="hm hm-paper" d="M48 112V58h24v54z" />
      <path className="hm hm-roof" d="M46 58L60 46L74 58Z" />
      <path className="hm hm-wood" d="M76 112V70h18v42z" />
      <path className="hm hm-stone" d="M132 112V82h22v30z" />
      <path className="hm hm-paper" d="M158 112V68h20v44z" />
      <path className="hm hm-roof" d="M156 68L168 58L180 68Z" />
      <path
        className="hm hm-gold"
        d="M27 82h5v6h-5zM35 82h5v6h-5zM27 94h5v6h-5zM54 66h5v7h-5zM62 66h5v7h-5zM54 80h5v7h-5zM62 80h5v7h-5zM54 94h5v7h-5zM81 78h8v6h-8zM137 88h5v6h-5zM145 88h5v6h-5zM163 76h4v6h-4zM170 76h4v6h-4zM163 90h4v6h-4z"
      />
      <path className="hm hm-wood-dark" d="M82 112v-10h6v10zM62 112v-8h5v8z" />
      {/* 아이디어 전구 */}
      <path className="hm hm-gold" d="M156 40a12 12 0 1 1 16 0v6h-16z" />
      <path
        className="hm-ink"
        d="M157 50h14M159 54h10M164 18v-6M150 24l-5-4M178 24l5-4"
      />
      <path className="hm hm-sand" d="M-2 112H202V142H-2Z" />
      <path className="hm-ink ld-worlds-dash" d="M16 126H184" />
    </>
  );
}

export function WorldCoverArt({ world }: { world: WorldNo }) {
  return (
    <svg
      className="ld-worlds-art"
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      <rect className="ld-worlds-sky" width="200" height="140" />
      {world === 1 ? (
        <IslandCover />
      ) : world === 2 ? (
        <SeaCover />
      ) : (
        <CityCover />
      )}
    </svg>
  );
}
