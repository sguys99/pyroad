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
const FAR_KINDS = new Set<Decoration['kind']>(['waves', 'boat', 'bird']);

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
    default:
      return null;
  }
}

function Deco({ d, i }: { d: Decoration; i: number }) {
  const p = { x: d.x, y: d.y, s: d.scale };
  switch (d.kind) {
    case 'mountains':
      return <Mountains {...p} />;
    case 'tree':
      return <Tree {...p} tone={i % 2 ? 'olive' : 'forest'} />;
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

const LANDMARKS: Record<string, () => ReactNode> = {
  python_village: Gate,
  variable_forest: Forest,
  condition_crossroad: Crossroad,
  loop_cave: Cave,
  list_lake: Lake,
  function_tower: Tower,
  project_kingdom: Castle,
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
    <div className="wm-art" data-layout={name}>
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
