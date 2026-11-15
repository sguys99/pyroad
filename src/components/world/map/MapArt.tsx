/**
 * 월드 지도 그림 (P5-02). 확정 시안 `design/prototypes/src/final/World.tsx`·`art.tsx`의 두루마리 보물지도를 옮긴 코드 SVG.
 *
 * - 한 레이아웃(wide·tall)을 **깊이별 SVG 3장**으로 그린다: 먼 곳(바다·물결·배·새) · 중간(산·나무) · 길(모래 길·잉크 길·랜드마크).
 *   모두 같은 viewBox라 서로 맞물리고, 패럴랙스는 먼 곳·중간 레이어 상자만 옮긴다(worldMap.css `.wm-par`, full만). 길·노드는 고정
 * - 무엇을 어디에 그릴지는 데이터: 장식은 map.yaml `decorations`, 바탕(해안선)은 world.yaml `theme` 키(`THEME_BASE`),
 *   랜드마크는 스테이지 `theme_name`. 새 월드는 `THEME_BASE`에 바탕 하나만 더하면 되고, 없으면 종이 바탕 + 장식만 그린다
 * - 색은 worldMap.css 재질 클래스(`wm-*`, 토큰 color-mix)만. 땅·나무는 `--world*`를 섞어 `data-world`가 바꾸면 월드 틴트를 따른다
 * - 잠긴 스테이지 랜드마크는 연필 스케치(`.wm-pencil`: 채움 없음 + 점선), 열린 곳은 색 (진행 = 지도가 완성되는 보상)
 * - 앰비언트(P5-09): 움직이는 것(물결·배·새 + map.yaml `ambient`의 구름·반짝임·나뭇잎)은 큰 SVG 안이 아니라 **작은 SVG 조각
 *   (`Sprite`, HTML 상자)** 으로 레이어 위에 얹는다. SVG 안 요소의 transform 애니메이션은 레이어 전체를 다시 칠하지만, HTML 상자의
 *   transform·opacity 애니메이션은 컴포지터가 처리한다. 움직임은 worldMap.css(full만), lite 이하는 같은 자리의 정지 그림
 * - 훅 없음, 전부 장식이라 `aria-hidden` (스테이지 목록은 노드 버튼이 읽힌다)
 */

import type { ReactNode } from 'react';
import type {
  MapAmbient,
  MapLayout,
  WorldMapConfig,
} from '@/lib/content/schema';
import { ambientPlan } from '@/lib/world/ambient';
import type { MapPoint } from '@/lib/world/worlds';

export type LayoutName = 'wide' | 'tall';

const at = (x: number, y: number, s = 1) =>
  s === 1 ? `translate(${x} ${y})` : `translate(${x} ${y}) scale(${s})`;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 채운 면: 재질(--f) + 그 진한 톤 선 */
function F({ m, d }: { m: string; d: string }) {
  return <path className={`wm-f wm-${m}`} d={d} />;
}
/** 채움 없는 세부 선 */
function L({ d }: { d: string }) {
  return <path className="wm-l" d={d} />;
}

// ───────────── 장식 (바닥 중앙 = 0,0)

function Mountains({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)} opacity={0.85}>
      <F m="cream" d="M0 0 L22 -38 L32 -26 L46 -52 L70 0" />
      <L d="M46 -52 L40 -38 L48 -40 L54 -32" />
      <path
        className="wm-l wm-l-soft"
        d="M52 -10 l6 -14 M58 -6 l6 -14 M30 -6 l4 -10"
      />
    </g>
  );
}

function Tree({
  x,
  y,
  s = 1,
  tone,
}: {
  x: number;
  y: number;
  s?: number;
  tone: 'forest' | 'olive';
}) {
  return (
    <g transform={at(x, y, s)}>
      <F m={tone} d="M0 -26 L9 -8 L-9 -8 Z" />
      <L d="M0 -8 v8" />
    </g>
  );
}

/** 야자수 작은 섬 (2월드). 모래톱 위에 휜 줄기 + 잎 4장 */
function Palm({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)}>
      <F m="sand" d="M-22 0 C-18 -7 18 -7 22 0 C12 4 -12 4 -22 0 Z" />
      <F m="wood" d="M-3 -2 C-1 -14 4 -24 2 -36 L6 -36 C8 -24 4 -12 2 -2 Z" />
      <F m="olive" d="M4 -36 C-4 -44 -16 -42 -20 -32 C-12 -38 -4 -38 4 -36 Z" />
      <F m="forest" d="M4 -36 C12 -44 24 -42 28 -32 C20 -38 12 -38 4 -36 Z" />
      <F m="forest" d="M4 -36 C0 -46 -8 -50 -14 -48 C-6 -46 0 -42 4 -36 Z" />
      <F m="olive" d="M4 -36 C8 -46 16 -50 22 -48 C14 -46 8 -42 4 -36 Z" />
    </g>
  );
}

/** 바다 위 바위 (2월드) + 발치 물거품 한 줄 */
function SeaRock({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)}>
      <F m="stone" d="M0 0 L5 -15 L13 -22 L21 -13 L26 0 Z" />
      <L d="M13 -22 L11 -10 M5 -15 L8 -6" />
      <path className="wm-wave" d="M-6 3 q4 -3 8 0 q4 3 8 0 M20 3 q4 -3 8 0" />
    </g>
  );
}

/** 고래 등 + 꼬리 + 물 뿜기 (2월드). 움직이지 않음 — 앰비언트 상한(worldMap.css) 안에 두려고 */
function Whale({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)}>
      <path
        className="wm-l wm-l-soft"
        d="M16 -14 C14 -20 10 -22 6 -24 M18 -14 V-26 M20 -14 C22 -20 26 -22 30 -24"
      />
      <F m="deep" d="M0 0 C4 -14 32 -16 40 0 Z" />
      <F m="deep" d="M42 -2 L48 -12 L51 -6 L58 -10 L54 -1 Z" />
      <L d="M10 -6 q2 -2 4 0" />
      <path
        className="wm-wave"
        d="M-6 2 q6 -3 12 0 q6 3 12 0 q6 -3 12 0 q6 3 12 0"
      />
    </g>
  );
}

/** 메이커 시티 골목 집 두 채 (3월드). i로 지붕 재질(벽돌·슬레이트)과 높이를 엇갈림 */
function Houses({
  x,
  y,
  s = 1,
  i,
}: {
  x: number;
  y: number;
  s?: number;
  i: number;
}) {
  const [a, b] = i % 2 ? ['slate', 'brick'] : ['brick', 'slate'];
  return (
    <g transform={at(x, y, s)}>
      <F m="cream" d="M-26 0 V-26 H-2 V0 Z" />
      <F m={a} d="M-29 -26 L-14 -42 L1 -26 Z" />
      <F m="paper" d="M-2 0 V-34 H24 V0 Z" />
      <F m={b} d="M-5 -34 L11 -50 L27 -34 Z" />
      <F m="wood-dark" d="M15 -50 v-6 h4 v10z" />
      <L d="M-20 -18 h6 v6 h-6z M6 -26 h6 v6 h-6z M6 -14 h6 v6 h-6z" />
      <F m="wood-dark" d="M-12 0 v-9 a3 3 0 0 1 6 0 v9z" />
    </g>
  );
}

/** 가로등 (3월드): 기둥 + 등 + 받침 */
function Lamp({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)}>
      <F m="wood-dark" d="M-1.5 0 V-34 H1.5 V0 Z" />
      <F m="wood-dark" d="M-5 0 h10 l-2 -4 h-6z" />
      <F m="wood-dark" d="M-6 -34 h12 l-3 -4 h-6z" />
      <F m="gold" d="M-4 -38 h8 v-8 h-8z" />
      <F m="wood-dark" d="M-5.5 -46 h11 l-5.5 -5z" />
    </g>
  );
}

// ───────────── 움직이는 조각 (앰비언트, P5-09). 좌표는 바닥 기준 (0,0), box = 조각 viewBox [x, y, w, h]

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

/** 지도 좌표 (x,y)에 놓는 작은 SVG. 크기는 지도 폭 비율이라 지도와 같이 커진다. `--i`는 조각마다 박자를 엇갈리게 */
function Sprite({
  layout,
  at: [x, y],
  s = 1,
  box: [bx, by, bw, bh],
  cls,
  i,
  children,
}: {
  layout: MapLayout;
  at: MapPoint;
  s?: number;
  box: [number, number, number, number];
  cls: string;
  i: number;
  children: ReactNode;
}) {
  return (
    <span
      className={`wm-sprite ${cls}`}
      style={
        {
          left: pct((x + bx * s) / layout.width),
          top: pct((y + by * s) / layout.height),
          width: pct((bw * s) / layout.width),
          '--i': i,
        } as React.CSSProperties
      }
    >
      <svg viewBox={`${bx} ${by} ${bw} ${bh}`} focusable="false">
        {children}
      </svg>
    </span>
  );
}

const WAVES_D = Array.from(
  { length: 3 },
  (_, i) => `M${i * 22} ${(i % 2) * 8}q5-5 10 0q5 5 10 0`,
).join('');
const CLOUD_D =
  'M14 36C2 36 2 22 14 22C14 10 32 6 40 16C46 4 70 4 74 18C86 12 100 20 96 30C108 30 108 36 100 36Z';
const SPARK_D = 'M0 -8L2 -2L8 0L2 2L0 8L-2 2L-8 0L-2 -2Z';
const LEAF_D = 'M0 0C5 -6 13 -6 16 0C13 6 5 6 0 0Z';

type Decoration = NonNullable<MapLayout['decorations']>[number];
const FAR_KINDS = new Set<Decoration['kind']>([
  'waves',
  'boat',
  'bird',
  'buoy',
  'cog',
  'balloon',
]);

/** 먼 곳의 움직이는 장식 (물결·배·새). 새는 날기(바깥)와 날갯짓(안쪽 svg)을 다른 상자에 걸어 transform이 겹치지 않게 */
function FarSprite({
  d,
  i,
  layout,
}: {
  d: Decoration;
  i: number;
  layout: MapLayout;
}) {
  const p = { layout, at: [d.x, d.y] as MapPoint, s: d.scale, i };
  switch (d.kind) {
    case 'waves':
      return (
        <Sprite {...p} box={[-2, -5, 70, 17]} cls="wm-a-wave">
          <path className="wm-wave" d={WAVES_D} />
        </Sprite>
      );
    case 'boat':
      return (
        <Sprite {...p} box={[-2, -14, 48, 46]} cls="wm-a-boat wm-boat">
          <F m="paper" d="M0 18 h44 l-8 12 h-28z" />
          <F m="sail" d="M22 18 v-30 l18 26 h-18" />
        </Sprite>
      );
    case 'bird':
      return (
        <Sprite {...p} box={[-2, -6, 28, 8]} cls="wm-a-bird">
          <path className="wm-l wm-bird" d="M0 0q6-6 12 0q6-6 12 0" />
        </Sprite>
      );
    // 부표는 배와 같은 출렁임 (새 키프레임 없이)
    case 'buoy':
      return (
        <Sprite {...p} box={[-12, -26, 24, 32]} cls="wm-a-boat">
          <path className="wm-wave" d="M-10 2 q5 -3 10 0 q5 3 10 0" />
          <F m="roof" d="M-7 0 L-4 -14 H4 L7 0 Z" />
          <F m="paper" d="M-5.4 -7 H5.4 L6 -4 H-6 Z" />
          <F m="gold" d="M-2 -14 V-20 H2 V-14 Z" />
          <L d="M0 -20 V-23" />
        </Sprite>
      );
    // 3월드: 천천히 도는 톱니 (가운데가 상자 가운데라 제자리 회전)
    case 'cog':
      return (
        <Sprite {...p} box={[-22, -22, 44, 44]} cls="wm-a-cog">
          <path className="wm-f wm-slate" fillRule="evenodd" d={COG_D} />
          <circle className="wm-l" r="7" />
        </Sprite>
      );
    // 3월드: 줄무늬 열기구 (둥실 떠오르기)
    case 'balloon':
      return (
        <Sprite {...p} box={[-17, -48, 34, 52]} cls="wm-a-float">
          <F
            m="paper"
            d="M0 -46 C18 -46 20 -24 6 -14 H-6 C-20 -24 -18 -46 0 -46 Z"
          />
          <F
            m="brick"
            d="M0 -46 C-8 -44 -10 -26 -6 -14 H-2 C-4 -26 -4 -40 0 -46 Z"
          />
          <F m="brick" d="M0 -46 C8 -44 10 -26 6 -14 H2 C4 -26 4 -40 0 -46 Z" />
          <L d="M-6 -14 L-4 -4 M6 -14 L4 -4" />
          <F m="wood" d="M-5 -5 h10 v6 h-10z" />
        </Sprite>
      );
    default:
      return null;
  }
}

/** 톱니바퀴 8개 이 + 가운데 구멍 (evenodd) */
const COG_D = (() => {
  const teeth = 8;
  const pts: string[] = [];
  for (let k = 0; k < teeth * 4; k++) {
    const a = (k / (teeth * 4)) * Math.PI * 2;
    const rr = k % 4 < 2 ? 19 : 14;
    pts.push(`${r1(Math.cos(a) * rr)} ${r1(Math.sin(a) * rr)}`);
  }
  return `M${pts.join('L')}Z M-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0z`;
})();

function Deco({ d, i }: { d: Decoration; i: number }) {
  const p = { x: d.x, y: d.y, s: d.scale };
  switch (d.kind) {
    case 'mountains':
      return <Mountains {...p} />;
    case 'tree':
      return <Tree {...p} tone={i % 2 ? 'olive' : 'forest'} />;
    case 'palm':
      return <Palm {...p} />;
    case 'rock':
      return <SeaRock {...p} />;
    case 'whale':
      return <Whale {...p} />;
    case 'house':
      return <Houses {...p} i={i} />;
    case 'lamp':
      return <Lamp {...p} />;
    default:
      return null; // 물결·배·새는 FarSprite
  }
}

// ───────────── 월드 테마 바탕 (theme 키 → 레이아웃별 해안선)
// 시안 좌표(wide 1200×720 · tall 400×1180) 기준이고 레이아웃 크기에 맞춰 늘린다. 패럴랙스로 움직여도 가장자리가 비지 않게
// 바다는 지도 밖까지(-200) 넉넉히 그린다

const SEA_WIDE = [
  'M-200 -200 H760 V0 C720 40 660 60 600 50 C520 36 470 90 400 80 C330 70 300 120 230 110 C160 100 110 150 40 140 C20 138 8 150 0 160 H-200 Z',
  'M1400 560 H1200 C1140 570 1110 620 1060 640 C1010 660 990 700 960 720 V920 H1400 Z',
];
const COAST_WIDE =
  'M760 0 C720 40 660 60 600 50 C520 36 470 90 400 80 C330 70 300 120 230 110 C160 100 110 150 40 140 C20 138 8 150 0 160 M1200 560 C1140 570 1110 620 1060 640 C1010 660 990 700 960 720';
const SEA_TALL = [
  'M-200 -200 H600 V60 H400 C350 80 300 70 250 90 C190 112 140 90 80 110 C40 122 16 116 0 124 H-200 Z',
];
const COAST_TALL =
  'M400 60 C350 80 300 70 250 90 C190 112 140 90 80 110 C40 122 16 116 0 124';

function Coast({
  sea,
  coast,
  w,
  h,
  layout,
}: {
  sea: string[];
  coast: string;
  w: number;
  h: number;
  layout: MapLayout;
}) {
  const sx = layout.width / w;
  const sy = layout.height / h;
  return (
    <g transform={sx === 1 && sy === 1 ? undefined : `scale(${sx} ${sy})`}>
      {sea.map((d) => (
        <path key={d} className="wm-sea" d={d} />
      ))}
      <path className="wm-coast" d={coast} />
    </g>
  );
}

// 2월드 코드 바다 (P10-04): 지도 전체가 물빛 해도. 나침반 + 거기서 뻗는 항로선(먼 레이어), 노드마다 섬(길 레이어, THEME_GROUND)

/** 나침반 + 항로선 16줄. 오른쪽 아래 바다, 크기는 가로 지도 1 · 세로 지도 0.65 */
function SeaChart({ layout }: { layout: MapLayout }) {
  const k = layout.width >= 900 ? 1 : 0.65;
  const cx = layout.width - (k === 1 ? 110 : 58);
  const cy = layout.height - 95 * k;
  const R = 46 * k;
  const ray = (i: number, len: number) => {
    const a = (i / 16) * Math.PI * 2;
    return `M${r1(cx + Math.cos(a) * R * 1.12)} ${r1(cy + Math.sin(a) * R * 1.12)}L${r1(cx + Math.cos(a) * len)} ${r1(cy + Math.sin(a) * len)}`;
  };
  const star = (len: number, w: number, turn: number) =>
    Array.from({ length: 4 }, (_, i) => {
      const a = (i / 4) * Math.PI * 2 + turn;
      const p = (rr: number, da: number) =>
        `${r1(Math.cos(a + da) * rr)} ${r1(Math.sin(a + da) * rr)}`;
      return `M0 0L${p(w, -Math.PI / 4)}L${p(len, 0)}L${p(w, Math.PI / 4)}Z`;
    }).join('');
  return (
    <>
      <path
        className="wm-rhumb"
        d={Array.from({ length: 16 }, (_, i) => ray(i, 2400)).join('')}
      />
      <g transform={at(cx, cy)}>
        <circle className="wm-l wm-l-soft" r={R * 1.12} />
        <circle className="wm-l" r={R * 0.9} />
        <g transform={k === 1 ? undefined : `scale(${k})`}>
          <F m="gold" d={star(30, 7, Math.PI / 4)} />
          <F m="paper" d={star(42, 8, -Math.PI / 2)} />
          <F m="roof" d="M0 -48 L-5 -40 H5 Z" />
        </g>
      </g>
    </>
  );
}

/** 해도 바다: 깊은 물(가장자리) → 중간 → 얕은 물(가운데) 세 겹을 반투명으로 겹치고 경계에 등심선. 종이 결이 비친다 */
function SeaBase({ layout }: { layout: MapLayout }) {
  const { width: w, height: h } = layout;
  const mid = blob(w / 2, h / 2, w * 0.5, h * 0.48, 1, 2.2);
  // 세로 지도는 폭이 좁아 가운데 얕은 물을 상대적으로 넓게 (가늘고 긴 렌즈 모양이 되지 않게)
  const tall = h > w;
  const inner = blob(
    w * 0.47,
    h * 0.55,
    w * (tall ? 0.42 : 0.33),
    h * 0.32,
    2,
    tall ? 1.6 : 2.6,
  );
  return (
    <>
      <rect
        className="wm-sea-deep"
        x={-200}
        y={-200}
        width={w + 400}
        height={h + 400}
      />
      <path className="wm-sea-mid" d={mid} />
      <path className="wm-l wm-l-soft wm-l-dot" d={mid} />
      <path className="wm-sea-shallow" d={inner} />
      <path className="wm-l wm-l-soft wm-l-dot" d={inner} />
      <SeaChart layout={layout} />
    </>
  );
}

/** 둥글게 울퉁불퉁한 닫힌 곡선 (점 8개를 잇는 중점 2차 곡선). k로 섬마다 모양을 다르게, amp로 울퉁불퉁한 정도 */
const JIT = [1, 0.9, 1.07, 0.93, 1.04, 0.87, 1.09, 0.95];
function blob(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  k: number,
  amp = 1,
) {
  const pts = JIT.map((_, i) => {
    const a = (i / JIT.length) * Math.PI * 2;
    const j = 1 + (JIT[(i + k * 3) % JIT.length] - 1) * amp;
    return [cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j];
  });
  const mid = (a: number[], b: number[]) =>
    `${r1((a[0] + b[0]) / 2)} ${r1((a[1] + b[1]) / 2)}`;
  const curves = pts.map(
    (p, i) => `Q${r1(p[0])} ${r1(p[1])} ${mid(p, pts[(i + 1) % pts.length])}`,
  );
  return `M${mid(pts[pts.length - 1], pts[0])}${curves.join('')}Z`;
}

/** 노드마다 섬: 얕은 물 둘레(등심선 점선) → 물결 고리 → 모래 → 풀밭. 랜드마크가 그 위에 선다 (길 레이어라 패럴랙스 없음) */
function SeaIsles({
  layout,
  bosses,
}: {
  layout: MapLayout;
  bosses: ReadonlyArray<boolean>;
}) {
  return (
    <g>
      {layout.nodes.map(([x, y], i) => {
        const s = layout.node_scale * (bosses[i] ? 1.15 : 1);
        const cy = y + 4 * s;
        const rx = 70 * s;
        const ry = 22 * s;
        return (
          <g key={i}>
            <path
              className="wm-shoal"
              d={blob(x, cy, rx + 30 * s, ry + 15 * s, i)}
            />
            <path
              className="wm-l wm-l-soft wm-l-dot"
              d={blob(x, cy, rx + 30 * s, ry + 15 * s, i)}
            />
            <path
              className="wm-l wm-l-soft"
              d={blob(x, cy, rx + 15 * s, ry + 7 * s, i)}
            />
            <path
              className="wm-f wm-sand"
              d={blob(x, cy + 2 * s, rx + 5 * s, ry + 3 * s, i)}
            />
            <path
              className="wm-f wm-isle"
              d={blob(x, cy - s, rx - 2 * s, ry - 3 * s, i)}
            />
          </g>
        );
      })}
    </g>
  );
}

// 3월드 메이커 시티 (P11-11): 설계도 모눈종이 위 도시. 거리 사이 블록(공원 몇 곳) + 왼쪽 아래 항구(2월드에서 배를 대고 내린 곳)
// + 설계 도구 표장(먼 레이어), 노드마다 둥근 돌 광장(길 레이어, THEME_GROUND)

/** 블록 하나를 노드에서 이만큼(지도 단위 × node_scale) 떨어뜨림: 광장·랜드마크·이름표 자리를 비움 */
const CLEAR = 118;
/** 블록마다 공원인지·조금 어긋난 크기: 좌표로 정하는 결정적 값 (0~1) */
const hash01 = (a: number, b: number) => {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** 모눈 (설계도 종이) + 거리 사이 블록 */
function CityBlocks({ layout }: { layout: MapLayout }) {
  const { width: w, height: h, nodes, node_scale: ns } = layout;
  const tall = h > w;
  const cw = tall ? 92 : 112;
  const ch = tall ? 84 : 96;
  const gap = tall ? 18 : 22;
  const step = 20;
  const grid: string[] = [];
  for (let x = 0; x <= w; x += step) grid.push(`M${x} -200V${h + 200}`);
  for (let y = 0; y <= h; y += step) grid.push(`M-200 ${y}H${w + 200}`);
  const blocks: ReactNode[] = [];
  for (let gx = -1; gx * cw < w + cw; gx++) {
    for (let gy = -1; gy * ch < h + ch; gy++) {
      const x = gx * cw + (gy % 2 ? cw / 2 : 0);
      const y = gy * ch;
      const cx = x + cw / 2;
      const cy = y + ch / 2;
      if (
        nodes.some(
          ([nx, ny]) =>
            Math.hypot(nx - cx, (ny - 30 - cy) * 1.25) < CLEAR * ns + cw / 2,
        )
      )
        continue;
      const k = hash01(gx + 7, gy + 11);
      const bx = x + gap / 2;
      const by = y + gap / 2;
      const bw = cw - gap - (k > 0.7 ? 12 : 0);
      const bh = ch - gap;
      const park = k < 0.14;
      blocks.push(
        <g key={`${gx},${gy}`}>
          <rect
            className={park ? 'wm-park' : 'wm-block'}
            x={bx}
            y={by}
            width={bw}
            height={bh}
            rx={9}
          />
          {/* 위에서 본 지붕 두세 채 (블록마다 자리·재질을 엇갈림) */}
          {!park &&
            [0, 1, 2].slice(0, k > 0.55 ? 3 : 2).map((j) => {
              const rw = (bw - 18) / 3;
              const rh = j % 2 ? bh * 0.42 : bh * 0.3;
              return (
                <rect
                  key={j}
                  className={
                    (j + Math.round(k * 10)) % 3
                      ? 'wm-rooftop'
                      : 'wm-rooftop wm-rooftop-slate'
                  }
                  x={bx + 6 + j * (rw + 3)}
                  y={j % 2 ? by + bh - rh - 6 : by + 6}
                  width={rw}
                  height={rh}
                  rx={2}
                />
              );
            })}
        </g>,
      );
    }
  }
  return (
    <>
      <path className="wm-grid" d={grid.join('')} />
      <path
        className="wm-grid wm-grid-major"
        d={grid.filter((_, i) => i % 5 === 0).join('')}
      />
      {blocks}
    </>
  );
}

/** 항구 바다 (왼쪽 아래 구석): 2월드 물빛 + 해안선 + 부두 */
const HARBOR_WIDE = {
  sea: 'M-200 610 H0 C26 640 52 668 96 688 C126 702 150 712 172 720 V920 H-200 Z',
  coast: 'M0 610 C26 640 52 668 96 688 C126 702 150 712 172 720',
  pier: 'M40 662 L70 642 L77 649 L47 669 Z',
};
const HARBOR_TALL = {
  sea: 'M-200 1124 H0 C70 1136 120 1128 190 1142 C260 1156 330 1150 400 1160 H600 V1400 H-200 Z',
  coast: 'M0 1124 C70 1136 120 1128 190 1142 C260 1156 330 1150 400 1160',
  pier: 'M228 1150 L240 1124 L250 1128 L238 1154 Z',
};

/** 설계 도구 표장: 각도기 + 연필 + 톱니 (2월드 나침반 자리). 가로 지도는 오른쪽 위, 세로 지도는 왼쪽 위 */
function MakerEmblem({ layout }: { layout: MapLayout }) {
  const wide = layout.width >= 900;
  const k = wide ? 1 : 0.62;
  const cx = wide ? layout.width - 112 : 64;
  const cy = wide ? 112 : 92;
  const ticks = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI + (i / 12) * Math.PI;
    const r0 = i % 3 ? 38 : 33;
    return `M${r1(Math.cos(a) * r0)} ${r1(Math.sin(a) * r0)}L${r1(Math.cos(a) * 44)} ${r1(Math.sin(a) * 44)}`;
  }).join('');
  return (
    <g transform={at(cx, cy, k)}>
      <path
        className="wm-f wm-slate"
        fillRule="evenodd"
        transform="translate(-40 6)"
        d={COG_D}
      />
      <F m="paper" d="M-46 0 A46 46 0 0 1 46 0 Z" />
      <path className="wm-l" d={ticks} />
      <path className="wm-l wm-l-soft" d="M-22 0 A22 22 0 0 1 22 0" />
      <g transform="rotate(-38)">
        <F m="gold" d="M-40 -5 H26 V5 H-40 Z" />
        <F m="brick" d="M-48 -5 H-40 V5 H-48 Z" />
        <F m="cream" d="M26 -5 L40 0 L26 5 Z" />
        <L d="M36 -1.4 L40 0 L36 1.4 M-40 0 H26" />
      </g>
    </g>
  );
}

function CityBase({ name, layout }: { name: LayoutName; layout: MapLayout }) {
  const h = name === 'wide' ? HARBOR_WIDE : HARBOR_TALL;
  const sx = layout.width / (name === 'wide' ? 1200 : 400);
  const sy = layout.height / (name === 'wide' ? 720 : 1180);
  return (
    <>
      <CityBlocks layout={layout} />
      <g transform={sx === 1 && sy === 1 ? undefined : `scale(${sx} ${sy})`}>
        <path className="wm-sea" d={h.sea} />
        <path className="wm-coast" d={h.coast} />
        <F m="wood" d={h.pier} />
      </g>
      <MakerEmblem layout={layout} />
    </>
  );
}

/** 노드마다 둥근 돌 광장: 연석 → 포장 → 돌 무늬 고리. 랜드마크가 그 위에 선다 (길 레이어라 패럴랙스 없음) */
function CityPlazas({
  layout,
  bosses,
}: {
  layout: MapLayout;
  bosses: ReadonlyArray<boolean>;
}) {
  return (
    <g>
      {layout.nodes.map(([x, y], i) => {
        const s = layout.node_scale * (bosses[i] ? 1.15 : 1);
        const cy = y + 4 * s;
        return (
          <g key={i}>
            <ellipse
              className="wm-f wm-curb"
              cx={x}
              cy={cy + 2 * s}
              rx={80 * s}
              ry={27 * s}
            />
            <ellipse
              className="wm-f wm-plaza"
              cx={x}
              cy={cy}
              rx={74 * s}
              ry={23 * s}
            />
            <ellipse
              className="wm-cobble"
              cx={x}
              cy={cy}
              rx={60 * s}
              ry={17 * s}
            />
            <ellipse
              className="wm-cobble"
              cx={x}
              cy={cy}
              rx={44 * s}
              ry={11 * s}
            />
          </g>
        );
      })}
    </g>
  );
}

/** 테마별 길 레이어 바닥 그림 (노드에 붙어 움직이면 안 되는 것: 섬). 없으면 안 그림 */
export const THEME_GROUND: Record<
  string,
  (layout: MapLayout, bosses: ReadonlyArray<boolean>) => ReactNode
> = {
  code_sea: (layout, bosses) => <SeaIsles layout={layout} bosses={bosses} />,
  maker_city: (layout, bosses) => (
    <CityPlazas layout={layout} bosses={bosses} />
  ),
};

export const THEME_BASE: Record<
  string,
  (name: LayoutName, layout: MapLayout) => ReactNode
> = {
  python_island: (name, layout) =>
    name === 'wide' ? (
      <Coast
        sea={SEA_WIDE}
        coast={COAST_WIDE}
        w={1200}
        h={720}
        layout={layout}
      />
    ) : (
      <Coast
        sea={SEA_TALL}
        coast={COAST_TALL}
        w={400}
        h={1180}
        layout={layout}
      />
    ),
  code_sea: (_name, layout) => <SeaBase layout={layout} />,
  maker_city: (name, layout) => <CityBase name={name} layout={layout} />,
};

// ───────────── 스테이지 랜드마크 7종 (바닥 중앙 = 0,0 · 대략 폭 120 × 높이 100). 키는 스테이지 theme_name

function Gate() {
  return (
    <>
      <F m="wood" d="M-44 -66 h12 v66 h-12z" />
      <F m="wood" d="M32 -66 h12 v66 h-12z" />
      <F m="roof" d="M-54 -64 Q0 -96 54 -64 L52 -53 Q0 -82 -52 -53 Z" />
      <F m="paper" d="M-20 -60 h40 v20 h-40z" />
      <L d="M-12 -40 l-4 -20 M12 -40 l4 -20 M-12 -52 h24 M-9 -46 h18" />
      <F m="gold" d="M-38 -86 v-16 l14 5 -14 5" />
      <F m="sail" d="M38 -86 v-16 l-14 5 14 5" />
      <F m="sage" d="M-58 0 c0 -14 18 -16 20 -2z M40 0 c2 -14 20 -12 20 0z" />
    </>
  );
}

function Forest() {
  const pine = (x: number, s: number, m: string) => (
    <g key={x}>
      <F
        m="wood-dark"
        d={`M${x - 3 * s} ${-22 * s} h${6 * s} v${22 * s} h${-6 * s}z`}
      />
      <F
        m={m}
        d={`M${x} ${-92 * s} L${x + 20 * s} ${-52 * s} L${x + 10 * s} ${-52 * s} L${x + 26 * s} ${-22 * s} L${x - 26 * s} ${-22 * s} L${x - 10 * s} ${-52 * s} L${x - 20 * s} ${-52 * s} Z`}
      />
    </g>
  );
  return (
    <>
      {pine(-30, 0.85, 'forest')}
      {pine(28, 0.95, 'olive')}
      <L d="M-2 -42 v42" />
      <F m="sage" d="M-2 -86 c-24 0 -26 40 0 42 c26 -2 24 -42 0 -42z" />
      <F m="brass" d="M-34 0 v-18 h26 v18z" />
      <F m="wood-dark" d="M-36 -18 h30 v-6 h-30z" />
      <F m="paper" d="M-8 -14 l10 4 -2 7 -10 -3z" />
      <F
        m="gold wm-ink-only"
        d="M-22 -34 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z"
      />
    </>
  );
}

function Crossroad() {
  return (
    <>
      <path
        className="wm-l wm-l-dot"
        d="M-56 0 C-30 -6 -10 -10 0 -12 C14 -16 34 -30 56 -34 M0 -12 C18 -10 40 -4 58 0"
      />
      <F m="wood" d="M-3 -84 h6 v84 h-6z" />
      <F m="paper" d="M-2 -80 h40 l10 9 -10 9 h-40z" />
      <F m="sand" d="M2 -56 h-40 l-10 9 10 9 h40z" />
      <L d="M8 -71 h26 M-34 -47 h28 M-36 -6 l4 -10 4 10 M-30 -6 l4 -8 4 8" />
      <F m="stone" d="M22 -2 c2 -10 14 -12 18 -4 c3 6 -4 8 -18 4z" />
    </>
  );
}

function Cave() {
  return (
    <>
      <F
        m="stone"
        d="M-62 0 L-30 -66 L-16 -54 L2 -92 L26 -58 L36 -66 L64 0 Z"
      />
      <F m="paper" d="M2 -92 L-6 -74 L4 -78 L10 -70 L14 -78 L26 -58" />
      <F m="cave" d="M-22 0 C-22 -30 22 -30 22 0 Z" />
      <L d="M-10 -20 l3 6 3 -6 M4 -22 l3 7 3 -7" />
    </>
  );
}

function Lake() {
  return (
    <>
      <F
        m="water"
        d="M-60 -14 C-58 -40 -10 -46 26 -40 C58 -34 66 -14 52 -4 C30 8 -50 8 -60 -14 Z"
      />
      <L d="M-40 -22 q6 -4 12 0 q6 4 12 0 M8 -14 q6 -4 12 0 q6 4 12 0" />
      <F m="wood" d="M-12 -34 h26 l-5 8 h-16z" />
      <F m="paper" d="M1 -34 v-22 l12 14 h-12" />
      <L d="M-58 -8 v-24 M-52 -10 v-30 M-46 -8 v-20" />
      <F m="olive" d="M-52 -40 c-3 -4 3 -8 0 -12" />
    </>
  );
}

function Tower() {
  return (
    <>
      <F m="stone" d="M-20 0 L-15 -74 L15 -74 L20 0 Z" />
      <F m="roof" d="M-22 -74 L0 -108 L22 -74 Z" />
      <F m="gold" d="M0 -108 v-14 l14 5 -14 5" />
      <F m="gold" d="M-6 -56 h12 v14 h-12z M-6 -26 h12 v14 h-12z" />
      <L d="M-17 -64 h34 M-18 -36 h36" />
      <F m="sage" d="M-40 0 c0 -10 14 -12 16 0z M24 0 c2 -12 18 -10 18 0z" />
    </>
  );
}

function Castle() {
  return (
    <>
      <F
        m="stone"
        d="M-40 0 v-44 h8 v-8 h8 v8 h8 v-8 h8 v8 h8 v-8 h8 v8 h8 v-8 h8 v8 h8 v44z"
      />
      <F m="stone" d="M-58 0 v-62 h18 v62z M40 0 v-62 h18 v62z" />
      <F m="roof" d="M-62 -62 L-49 -90 L-36 -62 Z M36 -62 L49 -90 L62 -62 Z" />
      <F m="gold" d="M-49 -90 v-14 l12 5 -12 5 M49 -90 v-14 l12 5 -12 5" />
      <F m="wood-dark" d="M-12 0 v-18 a12 12 0 0 1 24 0 v18z" />
      {/* 보물 표시 X */}
      <path className="wm-mark" d="M62 -10 l12 12 M74 -10 l-12 12" />
    </>
  );
}

// ───────────── 2월드 코드 바다 랜드마크 7종 (P10-04, 같은 좌표 규칙)

/** 글자 타일 (문자열 = 글자를 줄줄이 꿴 것): 줄 위의 점 · 재질 */
const TILES: [number, number, string][] = [
  [-18.5, -67.5, 'paper'],
  [-1.1, -66.5, 'gold'],
  [16.1, -66.9, 'paper'],
  [33.1, -68.7, 'sail'],
];

/** 2-1 산호 문자열 공방: 가지 산호 + 조개 지붕 공방 + 산호에서 장대까지 꿴 글자 타일 */
function CoralWorkshop() {
  return (
    <>
      <F
        m="coral"
        d="M-50 0 C-50 -12 -48 -22 -54 -34 C-58 -42 -57 -52 -53 -58 C-51 -50 -50 -44 -46 -38 C-45 -50 -42 -62 -36 -70 C-33 -62 -37 -50 -39 -40 C-36 -36 -31 -42 -27 -50 C-24 -41 -29 -31 -37 -23 C-39 -14 -39 -6 -37 0 Z"
      />
      <F m="wood" d="M48 -74 h4 v74 h-4z" />
      <F m="paper" d="M-14 0 V-34 H30 V0 Z" />
      <F m="coral" d="M-20 -34 Q8 -68 36 -34 Q8 -42 -20 -34 Z" />
      <L d="M-6 -39 L8 -58 M8 -38 V-58 M22 -39 L8 -58" />
      <F m="wood-dark" d="M2 0 v-15 a6 6 0 0 1 12 0 v15z" />
      <F m="water" d="M-9 -22 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0z" />
      <path className="wm-l" d="M-36 -70 Q8 -62 50 -72" />
      {TILES.map(([x, y, m], i) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${i % 2 ? 6 : -6})`}>
          <F m={m} d="M-4 1 h8 v8 h-8z" />
          <L d={i % 2 ? 'M-1.5 7 L0 3 L1.5 7' : 'M-1.5 3 v4 h3'} />
        </g>
      ))}
      <F
        m="gold wm-ink-only"
        d="M24 -4 l2 -5 2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3z"
      />
    </>
  );
}

/** 2-2 등대 딕셔너리 도서관: 줄무늬 등대 + 발치에 쌓인 책과 이름표(키) */
function LighthouseLibrary() {
  return (
    <>
      <F m="stone" d="M-40 0 C-40 -10 -26 -14 -18 -6 L-16 0 Z" />
      <F m="paper" d="M-16 0 L-11 -70 H11 L16 0 Z" />
      <F m="roof" d="M-14.1 -26 L-13.3 -38 H13.3 L14.1 -26 Z" />
      <F m="roof" d="M-12.4 -50 L-11.7 -60 H11.7 L12.4 -50 Z" />
      <F m="wood-dark" d="M-15 -70 h30 v-4 h-30z" />
      <F m="gold" d="M-8 -74 h16 v-12 h-16z" />
      <L d="M0 -74 v-12 M-8 -80 h16" />
      <F m="roof" d="M-11 -86 L0 -98 L11 -86 Z" />
      <L d="M0 -98 v-5" />
      <path
        className="wm-l wm-l-soft wm-ink-only"
        d="M12 -80 l26 -9 M12 -80 l26 3 M-12 -80 l-24 -8 M-12 -80 l-24 3"
      />
      <F m="wood-dark" d="M-5 0 v-10 a5 5 0 0 1 10 0 v10z" />
      <F m="sail" d="M20 0 V-8 H46 V0 Z" />
      <F m="sage" d="M22 -8 V-15 H42 V-8 Z" />
      <F m="roof" d="M19 -15 V-22 H40 V-15 Z" />
      <L d="M24 -4 h18 M26 -11.5 h12" />
      <L d="M40 -18 L46 -26" />
      <F m="paper" d="M44 -32 h9 l3 3 -3 3 h-9z" />
    </>
  );
}

/** 소용돌이 (반복 안의 반복): 가운데서 2바퀴 반 감기는 선 */
const SPIRAL = Array.from({ length: 61 }, (_, i) => {
  const t = (i / 60) * Math.PI * 2 * 2.5;
  const r = 2 + t * 2.7;
  return `${i ? 'L' : 'M'}${r1(Math.cos(t) * r)} ${r1(Math.sin(t) * r * 0.34 - 18)}`;
}).join('');

/** 2-3 소용돌이 반복 미로: 바위 기둥 둘 사이 소용돌이 + 출렁다리 + 보물 지도 깃발 */
function Whirlpool() {
  return (
    <>
      <F m="water" d="M-52 -18 C-52 -38 52 -38 52 -18 C52 2 -52 2 -52 -18 Z" />
      <L d={SPIRAL} />
      <F m="stone" d="M-62 0 L-58 -38 L-48 -46 L-40 -30 L-38 0 Z" />
      <L d="M-48 -46 L-50 -28 M-58 -38 L-54 -20" />
      <F m="stone" d="M36 0 L40 -50 L50 -58 L58 -42 L62 0 Z" />
      <L d="M50 -58 L48 -36 M40 -50 L44 -30" />
      <path className="wm-l wm-l-dot" d="M-46 -44 Q0 -26 46 -56" />
      <F m="wood" d="M48 -58 h3 v-24 h-3z" />
      <F m="paper" d="M51 -82 h16 v11 h-16z" />
      <L d="M56 -79 l5 5 M61 -79 l-5 5" />
    </>
  );
}

/** 대관람차 칸 6개 자리 (가운데 28,-56 · 반지름 24) */
const WHEEL = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2;
  return [r1(28 + Math.cos(a) * 24), r1(-56 + Math.sin(a) * 24)] as const;
});

/** 2-4 해적선 랜덤 놀이공원: 줄무늬 돛 해적선 + 갑판 주사위 + 뒤에 대관람차 */
function PirateFair() {
  return (
    <>
      <F m="wood" d="M14 0 L28 -56 L42 0 h-4 L28 -48 L18 0 Z" />
      <L
        d={`${WHEEL.map(([x, y]) => `M28 -56L${x} ${y}`).join('')}M4 -56a24 24 0 1 0 48 0a24 24 0 1 0 -48 0`}
      />
      {WHEEL.map(([x, y], i) => (
        <F
          key={i}
          m={i % 2 ? 'gold' : 'roof'}
          d={`M${x - 4} ${y} h8 v6 h-8z`}
        />
      ))}
      <F m="wood" d="M-60 -18 H16 L6 0 H-50 Z" />
      <L d="M-48 -9 a2 2 0 1 0 0.1 0 M-36 -9 a2 2 0 1 0 0.1 0 M-24 -9 a2 2 0 1 0 0.1 0" />
      <F m="wood-dark" d="M-24 -18 h3 v-66 h-3z" />
      <F m="paper" d="M-44 -76 Q-22 -70 0 -76 V-30 Q-22 -36 -44 -30 Z" />
      <F m="roof" d="M-44 -62 Q-22 -56 0 -62 V-52 Q-22 -46 -44 -52 Z" />
      <F m="roof" d="M-44 -42 Q-22 -36 0 -42 V-34 Q-22 -28 -44 -34 Z" />
      <F m="gold" d="M-22.5 -84 v-12 l14 5 -14 5" />
      <F m="paper" d="M-58 -30 h12 v12 h-12z" />
      <L d="M-55 -27 h0.1 M-52 -24 h0.1 M-49 -21 h0.1" />
    </>
  );
}

/** 2-5 버그 병원선: 하얀 배 + 초록 더하기 표지 + 굴뚝 김 + 구명 튜브 */
function HospitalShip() {
  return (
    <>
      <F m="paper" d="M-60 -20 H60 L48 0 H-50 Z" />
      <F m="water" d="M-58 -14 H58 L56 -10 H-56 Z" />
      <F m="paper" d="M-34 -20 V-48 H22 V-20 Z" />
      <F m="sage" d="M-38 -48 H26 V-53 H-38 Z" />
      <L d="M-24 -30 a3.5 3.5 0 1 0 0.1 0 M-12 -30 a3.5 3.5 0 1 0 0.1 0 M0 -30 a3.5 3.5 0 1 0 0.1 0" />
      <F m="paper" d="M4 -36 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0z" />
      <F m="forest" d="M10 -42 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4z" />
      <F m="roof" d="M30 -20 V-60 H42 V-20 Z" />
      <F m="paper" d="M30 -50 H42 V-44 H30 Z" />
      <F
        m="paper wm-ink-only"
        d="M40 -66 c-2 -6 6 -9 9 -5 c3 -6 12 -4 11 2 c4 1 3 7 -2 7 h-14 c-5 0 -6 -3 -4 -4z"
      />
      <path
        className="wm-f wm-roof"
        fillRule="evenodd"
        d="M-52 -11 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0z M-49 -11 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0z"
      />
      <F m="wood-dark" d="M-50 -20 h2 v-34 h-2z" />
      <F m="sage" d="M-48 -54 v-10 l12 5 -12 5" />
    </>
  );
}

/** 2-6 해저 알고리즘 산맥: 낮은 것부터 높은 것까지 줄 선 봉우리(정렬) + 오르는 점선 + 해초·물방울 */
function SortedRidge() {
  return (
    <>
      <F m="stone" d="M10 0 L32 -88 L42 -74 L58 0 Z" />
      <F m="paper" d="M32 -88 L26 -64 L32 -68 L36 -62 L42 -74 Z" />
      <F m="stone" d="M-16 0 L4 -66 L12 -56 L24 0 Z" />
      <F m="paper" d="M4 -66 L0 -50 L5 -53 L9 -48 L12 -56 Z" />
      <F m="stone" d="M-40 0 L-24 -48 L-6 0 Z" />
      <F m="stone" d="M-62 0 L-50 -30 L-34 0 Z" />
      <L d="M-24 -48 L-28 -24 M4 -66 L2 -36 M32 -88 L30 -50" />
      <path className="wm-l wm-l-dot" d="M-50 -30 L-24 -48 L4 -66 L32 -88" />
      <F m="gold" d="M32 -88 v-14 l13 5 -13 5" />
      <F m="sage" d="M-58 0 C-64 -10 -52 -16 -58 -28 C-50 -18 -52 -8 -50 0 Z" />
      <F m="olive" d="M50 0 C46 -8 56 -14 52 -24 C60 -16 58 -6 56 0 Z" />
      <path
        className="wm-l wm-ink-only"
        d="M-14 -66 a3 3 0 1 0 0.1 0 M-20 -78 a2 2 0 1 0 0.1 0 M-12 -86 a1.5 1.5 0 1 0 0.1 0"
      />
    </>
  );
}

/** 2-F 응용 프로젝트 항구 (보스 스테이지): 부두 + 항구 창고 + 돛 두 개 큰 배 */
function Harbor() {
  return (
    <>
      <F m="stone" d="M-58 -6 V-44 H-18 V-6 Z" />
      <F m="roof" d="M-62 -44 L-38 -64 L-14 -44 Z" />
      <F m="gold" d="M-42 -30 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0z" />
      <F m="wood-dark" d="M-52 -6 v-14 h8 v14z" />
      <F m="wood-dark" d="M10 -20 h3 v-68 h-3z M34 -20 h3 v-58 h-3z" />
      <F m="wood" d="M-12 -24 H62 L52 -6 H-2 Z" />
      <L d="M4 -15 a2 2 0 1 0 0.1 0 M18 -15 a2 2 0 1 0 0.1 0 M32 -15 a2 2 0 1 0 0.1 0" />
      <L d="M46 -19 v7 M43 -16 h6 M42 -13 q4 4 8 0" />
      <F m="paper" d="M-2 -82 Q11 -76 24 -82 V-50 Q11 -44 -2 -50 Z" />
      <F m="paper" d="M24 -72 Q35 -67 46 -72 V-46 Q35 -40 24 -46 Z" />
      <F m="gold" d="M11.5 -88 v-12 l14 5 -14 5" />
      <F m="sail" d="M35.5 -78 v-10 l11 4 -11 4" />
      <F m="wood" d="M-64 -6 H64 V0 H-64 Z" />
      <L d="M-48 -6 v6 M-24 -6 v6 M0 -6 v6 M24 -6 v6 M48 -6 v6" />
      <F m="wood-dark" d="M-12 -6 v-6 h6 v6z" />
    </>
  );
}

// ───────────── 3월드 메이커 시티 랜드마크 7종 (P11-11, 같은 좌표 규칙). 공방마다 톱니 지붕·간판으로 "만드는 곳" 느낌

/** 3-1 거북이 화가 공방: 톱니 지붕 작업실 + 이젤 위 별 그림 + 붓 자국을 끌고 가는 거북이 느릿이 */
function TurtleStudio() {
  return (
    <>
      <F m="cream" d="M-58 0 V-50 H-8 V0 Z" />
      <F
        m="brick"
        d="M-62 -50 L-62 -58 L-46 -74 L-46 -58 L-30 -74 L-30 -58 L-14 -74 L-14 -58 L-4 -58 L-4 -50 Z"
      />
      <F m="water" d="M-44 -66 L-34 -66 L-34 -58 M-28 -66 L-18 -66 L-18 -58" />
      <F m="water" d="M-52 -40 h16 v14 h-16z" />
      <L d="M-44 -40 v14 M-52 -33 h16" />
      <F m="wood-dark" d="M-28 0 v-22 a7 7 0 0 1 14 0 v22z" />
      <L d="M10 0 L22 -64 M44 0 L32 -64 M27 -64 V-6" />
      <F m="paper" d="M8 -74 H46 V-40 H8 Z" />
      <F m="gold" d="M27 -70 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" />
      <path
        className="wm-l wm-ink-only"
        d="M12 -46 q6 -6 10 0 M34 -46 q4 -5 8 0"
      />
      <F m="wood" d="M8 -40 H46 V-36 H8 Z" />
      <path className="wm-l wm-l-dot" d="M-6 6 C8 10 20 2 34 6" />
      <F m="olive" d="M38 0 C38 -14 62 -14 62 0 Z" />
      <L d="M44 -2 L48 -9 L54 -9 L58 -2 M48 -9 L46 -12 M54 -9 L56 -12" />
      <F m="sage" d="M61 -6 a5 5 0 1 0 0.1 0z" />
      <F m="sage" d="M40 0 h5 v3 h-5z M54 0 h5 v3 h-5z" />
      <F m="brick" d="M-4 0 h7 v-6 h-7z" />
      <F m="slate" d="M-62 0 h7 v-8 h-7z" />
    </>
  );
}

/** 3-2 모험 이야기 극장: 삼각 지붕 극장 + 빨간 막이 걷힌 무대 + 지붕 위 펼친 책 간판 */
function StoryTheater() {
  return (
    <>
      <F m="cream" d="M-50 0 V-58 H50 V0 Z" />
      <F m="brick" d="M-56 -58 L0 -82 L56 -58 Z" />
      <L d="M-38 -62 L0 -77 L38 -62" />
      <F
        m="paper"
        d="M-22 -86 Q-11 -92 0 -86 Q11 -92 22 -86 V-72 Q11 -78 0 -72 Q-11 -78 -22 -72 Z"
      />
      <L d="M0 -86 V-72 M-16 -84 q5 -2 10 0 M6 -84 q5 -2 10 0 M-16 -80 q5 -2 10 0 M6 -80 q5 -2 10 0" />
      <F m="cave" d="M-30 0 V-34 Q0 -50 30 -34 V0 Z" />
      <F m="coral" d="M-30 0 V-34 Q-8 -40 -8 -30 Q-14 -18 -24 -12 V0 Z" />
      <F m="coral" d="M30 0 V-34 Q8 -40 8 -30 Q14 -18 24 -12 V0 Z" />
      <F m="gold" d="M-32 -36 Q0 -54 32 -36 V-32 Q0 -48 -32 -32 Z" />
      <F
        m="gold wm-ink-only"
        d="M0 -22 l2 -5 2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3z"
      />
      <F m="stone" d="M-46 0 V-54 H-38 V0 Z M38 0 V-54 H46 V0 Z" />
      <F m="stone" d="M-54 0 H54 V6 H-54 Z" />
    </>
  );
}

/** 3-3 두근두근 퀴즈쇼 방송국: 방송국 건물 + "ON AIR" 불 + 물음표 말풍선 + 신호를 내보내는 철탑 */
function QuizStudio() {
  return (
    <>
      <F m="slate" d="M-56 0 V-52 H6 V0 Z" />
      <F m="paper" d="M-52 0 V-46 H2 V0 Z" />
      <F m="coral" d="M-44 -40 H-14 V-30 H-44 Z" />
      <path className="wm-l wm-ink-only" d="M-40 -35 h4 M-32 -35 h10" />
      <F m="water" d="M-44 -22 h12 v10 h-12z M-24 -22 h12 v10 h-12z" />
      <F m="wood-dark" d="M-8 0 v-16 h10 v16z" />
      <F
        m="gold"
        d="M-40 -72 a16 13 0 1 1 10 12 l-6 6 0 -8 a16 13 0 0 1 -4 -10z"
      />
      <L d="M-30 -76 q0 -5 5 -5 q5 0 5 5 q0 3 -5 5 v3 M-25 -63 v0.1" />
      <F m="wood-dark" d="M18 0 L30 -84 L42 0 h-4 L30 -72 L22 0 Z" />
      <L d="M23 -14 L39 -28 M37 -14 L23 -28 M25 -36 L36 -52 M35 -36 L25 -52 M27 -60 L33 -70" />
      <F m="coral" d="M30 -86 a4 4 0 1 0 0.1 0z" />
      <path
        className="wm-l wm-ink-only"
        d="M20 -94 q-5 8 0 16 M40 -94 q5 8 0 16 M14 -98 q-8 12 0 24 M46 -98 q8 12 0 24"
      />
    </>
  );
}

/** 3-4 가상 펫 돌봄 센터: 하트 창 돌봄 집 + 발자국 간판 + 개집 + 뼈다귀 */
function PetCenter() {
  return (
    <>
      <F m="paper" d="M-56 0 V-44 H8 V0 Z" />
      <F m="brick" d="M-62 -42 L-24 -76 L14 -42 Z" />
      <F
        m="coral"
        d="M-24 -50 c-3 -6 -11 -3 -8 3 l8 7 8 -7 c3 -6 -5 -9 -8 -3z"
      />
      <F m="gold" d="M-46 -32 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0z" />
      <L d="M-38 -30 a2.5 2 0 1 0 0.1 0 M-42 -35 v0.1 M-38 -37 v0.1 M-34 -35 v0.1" />
      <F m="water" d="M-20 -32 h14 v12 h-14z" />
      <F m="wood-dark" d="M-22 0 v-14 h12 v14z" />
      <F m="wood" d="M20 0 V-24 H54 V0 Z" />
      <F m="brick" d="M16 -22 L37 -42 L58 -22 Z" />
      <F m="cave" d="M30 0 v-10 a7 7 0 0 1 14 0 v10z" />
      <F
        m="paper"
        d="M44 6 h10 a2.5 2.5 0 1 1 2 -3 a2.5 2.5 0 1 1 -2 -3 h-10 a2.5 2.5 0 1 1 -2 3 a2.5 2.5 0 1 1 2 3z"
      />
      <L d="M-62 0 v-10 M-66 -6 h8" />
    </>
  );
}

/** 3-5 데이터 탐정 사무소: 좁고 높은 사무소 + 창에 막대그래프 + 돋보기 간판 + 설문 쪽지 상자 */
function DetectiveOffice() {
  return (
    <>
      <F m="stone" d="M-38 0 V-80 H14 V0 Z" />
      <F m="slate" d="M-42 -80 H18 V-88 H-42 Z" />
      <F m="wood-dark" d="M-6 -88 v-10 h8 v10z" />
      <F m="paper" d="M-30 -70 h36 v24 h-36z" />
      <F m="brick" d="M-25 -50 h6 v-8 h-6z" />
      <F m="gold" d="M-16 -50 h6 v-16 h-6z" />
      <F m="slate" d="M-7 -50 h6 v-11 h-6z" />
      <L d="M-28 -50 h32" />
      <F m="water" d="M-30 -36 h12 v12 h-12z M-6 -36 h12 v12 h-12z" />
      <F m="wood-dark" d="M-20 0 v-16 h12 v16z" />
      <L d="M14 -62 H34 V-56" />
      <path
        className="wm-f wm-paper"
        fillRule="evenodd"
        d="M22 -46 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0z M26 -46 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0z"
      />
      <F m="water" d="M26 -46 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0z" />
      <F m="wood-dark" d="M42 -36 l10 10 -3 3 -10 -10z" />
      <F m="wood" d="M24 0 V-14 H48 V0 Z" />
      <F m="paper" d="M28 -14 l2 -8 h7 l-1 8z M38 -14 l3 -7 h6 l-2 7z" />
      <L d="M24 -7 H48" />
    </>
  );
}

/** 3-6 미니 게임 오락실: 오락기 모양 건물 (간판 띠 + 화면 속 픽셀 별 + 조이스틱·단추) + 떠 있는 코인 */
function GameArcade() {
  return (
    <>
      <F m="slate" d="M-40 0 V-58 L-34 -84 H34 L40 -58 V0 Z" />
      <F m="gold" d="M-34 -84 H34 L36 -74 H-36 Z" />
      <path className="wm-l wm-ink-only" d="M-24 -79 h48" />
      <F m="cave" d="M-30 -68 H30 V-36 H-30 Z" />
      <F
        m="gold"
        d="M-3 -64 h6 v5 h6 v5 h-3 v5 h3 v5 h-6 v-3 h-6 v3 h-6 v-5 h3 v-5 h-3 v-5 h6z"
      />
      <F m="sage" d="M-24 -44 h4 v4 h-4z M18 -60 h4 v4 h-4z" />
      <F m="cream" d="M-44 -30 H44 L40 -20 H-40 Z" />
      <L d="M-24 -26 V-36" />
      <F m="coral" d="M-28 -38 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0z" />
      <F m="brick" d="M6 -27 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0z" />
      <F m="gold" d="M16 -27 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0z" />
      <F m="wood-dark" d="M-10 0 v-14 h20 v14z" />
      <L d="M0 -14 v14" />
      <F m="gold wm-ink-only" d="M50 -60 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0z" />
      <path className="wm-l wm-ink-only" d="M56 -63 v6" />
    </>
  );
}

/** 3-F 메이커 박람회 (보스 스테이지): 줄무늬 큰 천막 + 작은 천막 + 삼각 깃발 줄 + 받침대 위 로봇 작품 */
function MakerFair() {
  return (
    <>
      <path className="wm-l" d="M-62 -54 Q-30 -40 0 -58 Q30 -40 62 -54" />
      {[-50, -38, -26, -14, 14, 26, 38, 50].map((x, i) => (
        <F
          key={x}
          m={['gold', 'brick', 'slate', 'sage'][i % 4]}
          d={`M${x - 4} ${-55 + Math.abs(x) * 0.18 - (Math.abs(x) > 40 ? 0 : 6)} h8 l-4 7z`}
        />
      ))}
      <F m="paper" d="M-28 0 V-44 H28 V0 Z" />
      <F m="brick" d="M-20 0 V-44 H-10 V0 Z M10 0 V-44 H20 V0 Z" />
      <F m="cave" d="M-8 0 V-20 Q0 -28 8 -20 V0 Z" />
      <F m="paper" d="M-34 -44 L0 -84 L34 -44 Z" />
      <F m="brick" d="M-23 -44 L0 -84 L-6 -44 Z M6 -44 L0 -84 L23 -44 Z" />
      <F m="wood-dark" d="M-1 -84 v-12 h2 v12z" />
      <F m="gold" d="M1 -96 l12 4 -12 4z" />
      <F m="cream" d="M30 0 V-22 H58 V0 Z" />
      <F m="slate" d="M26 -22 L44 -40 L62 -22 Z" />
      <L d="M44 -22 V0" />
      <F m="stone" d="M-62 0 V-10 H-36 V0 Z" />
      <F m="stone" d="M-56 -10 V-30 H-42 V-10 Z" />
      <F m="slate" d="M-58 -30 V-44 H-40 V-30 Z" />
      <F m="gold" d="M-54 -38 h3 v3 h-3z M-47 -38 h3 v3 h-3z" />
      <L d="M-49 -44 v-6 M-60 -24 h-4 M-38 -24 h4" />
      <F m="coral" d="M-51 -52 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0z" />
    </>
  );
}

const LANDMARKS: Record<string, () => ReactNode> = {
  python_village: Gate,
  variable_forest: Forest,
  condition_crossroad: Crossroad,
  loop_cave: Cave,
  list_lake: Lake,
  function_tower: Tower,
  project_kingdom: Castle,
  string_workshop: CoralWorkshop,
  dict_library: LighthouseLibrary,
  nested_maze: Whirlpool,
  random_park: PirateFair,
  bug_hospital: HospitalShip,
  algorithm_ridge: SortedRidge,
  project_harbor: Harbor,
  turtle_studio: TurtleStudio,
  story_theater: StoryTheater,
  quiz_studio: QuizStudio,
  pet_center: PetCenter,
  detective_office: DetectiveOffice,
  game_arcade: GameArcade,
  maker_fair: MakerFair,
};

/** 보스(마지막) 스테이지 랜드마크 배율. 노드 이름표 자리도 같은 값(worldMap.css `--s`) */
const BOSS_SCALE = 1.15;

/** 보스 표시: 랜드마크 위 왕관 (어느 랜드마크든 위쪽 -112 근처) */
function BossCrown() {
  return (
    <g transform="translate(0 -108)">
      <F m="gold" d="M-18 0 L-22 -20 L-10 -10 L0 -26 L10 -10 L22 -20 L18 0 Z" />
      <F m="roof" d="M-3 -9 h6 v6 h-6z" />
    </g>
  );
}

export function Landmark({
  theme,
  pencil,
  boss,
}: {
  theme: string;
  pencil?: boolean;
  boss?: boolean;
}) {
  const Body = LANDMARKS[theme];
  if (!Body) return null;
  return (
    <g
      className={pencil ? 'wm-pencil' : undefined}
      transform={boss ? `scale(${BOSS_SCALE})` : undefined}
    >
      {!pencil && (
        <ellipse className="wm-shadow" cx="0" cy="2" rx="52" ry="9" />
      )}
      <Body />
      {boss && <BossCrown />}
    </g>
  );
}

// ───────────── 레이어

function Layer({
  name,
  layout,
  par,
  children,
}: {
  name: 'far' | 'mid' | 'road';
  layout: MapLayout;
  par?: boolean;
  children: ReactNode;
}) {
  return (
    <svg
      className={par ? 'wm-layer wm-par' : 'wm-layer'}
      data-layer={name}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export interface MapArtProps {
  name: LayoutName;
  layout: MapLayout;
  /** world.yaml theme */
  theme: string;
  /** 스테이지 theme_name·잠김·보스(is_final), 노드 순서대로. 랜드마크는 여기서만 그린다(노드는 이름표만, P5-04) */
  landmarks: ReadonlyArray<{ theme: string; locked: boolean; boss?: boolean }>;
  /** 길 전체 · 남은 길(연필 점선). 지난 길(잉크)은 그리기 연출 때문에 children 으로 받는다 */
  route: { all: string; todo: string };
  /** 길 모양 (반짝임을 길 위에 놓으려고) · map.yaml ambient (P5-09) */
  curve: WorldMapConfig['path'];
  ambient?: MapAmbient;
  children?: ReactNode;
}

/** 한 레이아웃의 지도 그림. 화면 폭에 맞지 않는 쪽은 worldMap.css가 숨긴다 */
export function MapArt({
  name,
  layout,
  theme,
  landmarks,
  route,
  curve,
  ambient,
  children,
}: MapArtProps) {
  const decos = layout.decorations ?? [];
  const wide = name === 'wide';
  const amb = ambientPlan(layout, curve, ambient);
  const spark = (pt: MapPoint, i: number) => (
    <Sprite
      key={`s${i}`}
      layout={layout}
      at={pt}
      box={[-9, -9, 18, 18]}
      cls="wm-a-spark"
      i={i}
    >
      <F m="gold" d={SPARK_D} />
    </Sprite>
  );
  return (
    <div className="wm-art" data-layout={name} data-theme={theme}>
      <Layer name="far" layout={layout} par>
        {THEME_BASE[theme]?.(name, layout)}
      </Layer>
      {/* 먼 곳의 움직이는 조각: 먼 레이어와 같은 깊이로 패럴랙스 */}
      <div className="wm-layer wm-par wm-amb" data-layer="far">
        {amb.clouds.map((pt, i) => (
          <Sprite
            key={`c${i}`}
            layout={layout}
            at={pt}
            s={layout.node_scale}
            box={[0, 0, 108, 40]}
            cls="wm-a-cloud"
            i={i}
          >
            <F m="paper" d={CLOUD_D} />
          </Sprite>
        ))}
        {decos.map((d, i) =>
          FAR_KINDS.has(d.kind) ? (
            <FarSprite key={i} d={d} i={i} layout={layout} />
          ) : null,
        )}
        {amb.seaSparks.map(spark)}
      </div>
      <Layer name="mid" layout={layout} par>
        {decos.map((d, i) =>
          FAR_KINDS.has(d.kind) ? null : <Deco key={i} d={d} i={i} />,
        )}
      </Layer>
      <Layer name="road" layout={layout}>
        {THEME_GROUND[theme]?.(
          layout,
          landmarks.map((l) => !!l.boss),
        )}
        {/* 길: 모래 바탕 → 남은 길(연필 점선) → 지난 길(잉크) */}
        <path
          className="wm-road-sand"
          d={route.all}
          strokeWidth={wide ? 22 : 18}
        />
        <path className="wm-road-todo" d={route.todo} />
        {children}
        {layout.nodes.map(([x, y], i) =>
          landmarks[i] ? (
            <g key={i} transform={at(x, y + 6, layout.node_scale)}>
              <Landmark
                theme={landmarks[i].theme}
                pencil={landmarks[i].locked}
                boss={landmarks[i].boss}
              />
            </g>
          ) : null,
        )}
      </Layer>
      {(amb.roadSparks.length > 0 || amb.leaves.length > 0) && (
        <div className="wm-layer wm-amb">
          {amb.roadSparks.map((pt, i) => spark(pt, i + amb.seaSparks.length))}
          {amb.leaves.map((pt, i) => (
            <Sprite
              key={`l${i}`}
              layout={layout}
              at={pt}
              s={1.4 * layout.node_scale}
              box={[-1, -7, 18, 14]}
              cls="wm-a-leaf"
              i={i}
            >
              <F m={i % 2 ? 'olive' : 'sage'} d={LEAF_D} />
            </Sprite>
          ))}
        </div>
      )}
    </div>
  );
}
