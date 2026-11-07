/**
 * 히어로 월드 일러스트 "월드 1 · 파이썬 섬" (P4-01). 최종 시안 `art.tsx`의 `HeroArt`·랜드마크를 바탕으로
 * 바다 위 섬 한 장을 **5개 레이어**(하늘 · 먼 바다 · 섬 · 앞 들판 · 전경 장식)로 나눠 그린 코드 SVG (§12-Q28, 래스터 없음).
 *
 * - 모든 레이어가 같은 viewBox(1600×900)를 쓰고 같은 상자(오른쪽 아래 기준, hero.css `.hero-art`)에 그려져 서로 맞물린다.
 *   패럴랙스는 레이어 상자(`.hero-layer`)를 깊이(`data-layer`)만큼 옮긴다 (HeroParallax)
 * - 색은 hero.css의 재질 클래스(`hm-*`, 토큰 color-mix)만. 선은 면 색의 진한 톤 1.1px(`vector-effect: non-scaling-stroke`)
 * - 반복 연출 대상은 클래스(`ha-cloud`·`ha-wave`·`ha-flag`·`ha-spark`…)로 표시하고 움직임은 CSS(full만)가 건다.
 *   CSS transform이 SVG `transform` 속성을 덮어쓰므로 위치(속성)와 움직임(클래스)은 다른 `<g>`에 둔다
 * - 서버 컴포넌트 (훅 없음). 전부 장식이라 `aria-hidden`
 */

import type { ReactNode } from 'react';

const VIEW_BOX = '0 0 1600 900';

function Layer({
  name,
  i,
  children,
}: {
  name: 'sky' | 'far' | 'mid' | 'near' | 'decor';
  i: number;
  children: ReactNode;
}) {
  return (
    <div className="hero-layer hero-par" data-layer={name}>
      <div className="hero-layer-in" data-i={i}>
        <svg
          className="hero-art"
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMax slice"
          aria-hidden
          focusable="false"
        >
          {children}
        </svg>
      </div>
    </div>
  );
}

const at = (x: number, y: number, s = 1) =>
  s === 1 ? `translate(${x} ${y})` : `translate(${x} ${y}) scale(${s})`;

// ───────────── 작은 그림 (바닥 중앙 = 0,0)

function Cloud({
  x,
  y,
  s = 1,
  wide,
}: {
  x: number;
  y: number;
  s?: number;
  /** 넓은 화면만 (모바일에서는 글자 뒤에 겹쳐 뺀다) */
  wide?: boolean;
}) {
  return (
    <g transform={at(x, y, s)} data-wide={wide ? '' : undefined}>
      <g className="ha-cloud">
        <path
          className="hm hm-cloud"
          d="M-92 20C-104 0-84-20-60-13C-54-42-14-48 4-27C16-50 60-46 66-16C90-21 106 2 94 20Z"
        />
        <path className="hm-ink" d="M-40 6c10-6 22-6 30 0" />
      </g>
    </g>
  );
}

function Bird({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)}>
      <path className="ha-bird hm-ink" d="M0 0q6-7 12 0q6-7 12 0" />
    </g>
  );
}

function Waves({ x, y, n = 3 }: { x: number; y: number; n?: number }) {
  const d = Array.from(
    { length: n },
    (_, k) => `M${k * 26} ${(k % 2) * 7}q6-6 12 0q6 6 12 0`,
  ).join('');
  return (
    <g transform={at(x, y)}>
      <path className="ha-wave hm-wave" d={d} />
    </g>
  );
}

function Pine({
  x,
  y,
  s = 1,
  tone = 'forest',
}: {
  x: number;
  y: number;
  s?: number;
  tone?: 'forest' | 'olive' | 'sage';
}) {
  return (
    <g transform={at(x, y, s)}>
      <path className="hm hm-wood-dark" d="M-3-22h6v22h-6z" />
      <path
        className={`hm hm-${tone}`}
        d="M0-92L20-52L10-52L26-22L-26-22L-10-52L-20-52Z"
      />
    </g>
  );
}

function RoundTree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)}>
      <ellipse className="hm-shadow" cx="0" cy="2" rx="46" ry="7" />
      <path className="hm hm-wood-dark" d="M-5 0v-42h10v42z" />
      <path
        className="hm hm-forest"
        d="M0-118C-38-118-56-84-44-60C-62-44-44-18-16-26C-6-14 14-14 22-26C50-18 66-46 46-62C58-88 38-118 0-118Z"
      />
      <path
        className="hm-ink"
        d="M-22-84c6-9 16-11 24-9M16-48c6-2 12-6 14-12"
      />
    </g>
  );
}

function Bush({
  x,
  y,
  s = 1,
  tone = 'sage',
}: {
  x: number;
  y: number;
  s?: number;
  tone?: 'sage' | 'forest';
}) {
  return (
    <g transform={at(x, y, s)}>
      <path
        className={`hm hm-${tone}`}
        d="M-32 0C-36-20-16-30-2-22C8-36 34-28 32 0Z"
      />
    </g>
  );
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={at(x, y, s)}>
      <path
        className="ha-spark hm hm-gold"
        d="M0-11L3-3L11 0L3 3L0 11L-3 3L-11 0L-3-3Z"
      />
    </g>
  );
}

function Flower({ x, y, gold }: { x: number; y: number; gold?: boolean }) {
  return (
    <g transform={at(x, y)}>
      <path className="hm hm-forest" d="M0 0v-9" />
      <circle
        className={gold ? 'hm hm-gold' : 'hm hm-paper'}
        cx="0"
        cy="-11"
        r="3.6"
      />
    </g>
  );
}

/** 깃발: 장대(선) + 천(바람에 펄럭임, 원점 = 장대 끝) */
function Flag({
  x,
  y,
  h = 14,
  dir = 1,
}: {
  x: number;
  y: number;
  h?: number;
  dir?: 1 | -1;
}) {
  return (
    <g transform={at(x, y)}>
      <path className="hm-ink" d={`M0 0v${-h}`} />
      <g transform={`translate(0 ${-h})`}>
        <path
          className="ha-flag hm hm-gold"
          data-dir={dir}
          d={`M0 0l${12 * dir} 5l${-12 * dir} 5z`}
        />
      </g>
    </g>
  );
}

// ───────────── 랜드마크 (시안 Landmark 1·6·7을 재질 클래스로)

function Castle() {
  return (
    <g>
      <ellipse className="hm-shadow" cx="0" cy="3" rx="70" ry="10" />
      <path className="hm hm-stone" d="M-58 0v-62h18v62zM40 0v-62h18v62z" />
      <path
        className="hm hm-stone"
        d="M-40 0v-44h8v-8h8v8h8v-8h8v8h8v-8h8v8h8v-8h8v8h8v-8h8v8h8v44z"
      />
      <path
        className="hm hm-roof"
        d="M-62-62L-49-92L-36-62ZM36-62L49-92L62-62Z"
      />
      <path className="hm hm-wood-dark" d="M-12 0v-18a12 12 0 0 1 24 0v18z" />
      <path
        className="hm hm-gold"
        d="M-52-48h8v10h-8zM44-48h8v10h-8zM-28-34h7v9h-7zM21-34h7v9h-7z"
      />
      <path className="hm-ink" d="M-36-24h20M16-24h20" />
      <Flag x={-49} y={-92} h={16} />
      <Flag x={49} y={-92} h={16} />
      {/* 보물 표시 X (지도의 끝) */}
      <path className="hm-mark" d="M74-12l13 13M87-12l-13 13" />
    </g>
  );
}

function Tower() {
  return (
    <g>
      <ellipse className="hm-shadow" cx="0" cy="2" rx="30" ry="6" />
      <path className="hm hm-stone" d="M-20 0L-15-74L15-74L20 0Z" />
      <path className="hm hm-roof" d="M-23-74L0-110L23-74Z" />
      <path className="hm hm-gold" d="M-6-56h12v14h-12zM-6-28h12v14h-12z" />
      <path className="hm-ink" d="M-17-64h34M-18-36h36" />
      <Flag x={0} y={-110} h={14} />
    </g>
  );
}

function Gate() {
  return (
    <g>
      <ellipse className="hm-shadow" cx="0" cy="3" rx="62" ry="8" />
      <path className="hm hm-wood" d="M-44-66h12v66h-12zM32-66h12v66h-12z" />
      <path className="hm hm-roof" d="M-54-64Q0-96 54-64L52-53Q0-82-52-53Z" />
      <path className="hm-ink" d="M-12-40l-4-20M12-40l4-20" />
      <path className="hm hm-paper" d="M-20-60h40v20h-40z" />
      <path className="hm-ink" d="M-12-52h24M-9-46h18" />
      <Flag x={-38} y={-80} h={16} />
      <Flag x={38} y={-80} h={16} dir={-1} />
      <path
        className="hm hm-sage"
        d="M-60 0c0-14 18-16 20-2zM40 0c2-14 20-12 20 0z"
      />
    </g>
  );
}

function Signpost() {
  return (
    <g>
      <ellipse className="hm-shadow" cx="0" cy="2" rx="24" ry="5" />
      <path className="hm hm-wood-dark" d="M-4 0v-62h8v62z" />
      <path className="hm hm-wood" d="M-30-60h48l13 11l-13 11h-48z" />
      <path className="hm-ink" d="M-22-49h30" />
    </g>
  );
}

function Boat() {
  return (
    <g>
      <path className="hm hm-wood" d="M-36 0h72l-12 14h-48z" />
      <path className="hm-ink" d="M0 0v-58" />
      <path className="hm hm-paper" d="M3-54L32-8H3Z" />
      <path className="hm hm-paper" d="M-3-44L-24-8H-3Z" />
      <path className="hm hm-gold" d="M0-58l11 4l-11 4z" />
    </g>
  );
}

function Lighthouse() {
  return (
    <g>
      <path className="hm hm-paper" d="M-9 0L-7-44L7-44L9 0Z" />
      <path className="hm hm-roof" d="M-8.4-12L-8-21L8-21L8.4-12Z" />
      <path className="hm hm-roof" d="M-7.8-30L-7.5-37L7.5-37L7.8-30Z" />
      <path className="hm hm-gold ha-glow" d="M-7-44h14v-9h-14z" />
      <path className="hm hm-roof" d="M-10-53L0-63L10-53Z" />
    </g>
  );
}

function Fern({
  x,
  y,
  r,
  s = 1,
}: {
  x: number;
  y: number;
  r: number;
  s?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path
        className="hm hm-leaf"
        d="M0 0C8-52 48-94 112-114C84-72 54-30 0 0Z"
      />
      <path className="hm-ink hm-ink-leaf" d="M2-2C30-42 62-80 104-108" />
    </g>
  );
}

function Leaf({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <g className="ha-leaf">
        <path className="hm hm-sage" d="M0 0C4-12 16-18 26-18C22-8 12 0 0 0Z" />
      </g>
    </g>
  );
}

// ───────────── 레이어

/** 하늘: 해 · 구름 · 새 (가장 느리게) */
function SkyLayer() {
  return (
    <Layer name="sky" i={0}>
      <g transform={at(1180, 196)} data-wide="">
        <circle className="hm-sun-halo" r="104" />
        <circle className="hm hm-sun" r="64" />
      </g>
      <Cloud x={360} y={128} s={0.9} />
      <Cloud x={1010} y={150} s={1.15} wide />
      <Cloud x={1430} y={280} s={0.8} />
      <Cloud x={740} y={262} s={0.6} />
      <Bird x={1270} y={140} />
      <Bird x={1306} y={166} s={0.7} />
      <Bird x={560} y={214} s={0.6} />
    </Layer>
  );
}

/** 먼 바다: 수평선 · 먼 산 · 작은 섬과 등대 · 돛단배 · 물결 */
function FarLayer() {
  return (
    <Layer name="far" i={1}>
      <path
        className="hm hm-mount"
        d="M880 566L960 424L1000 462L1070 362L1140 452L1180 422L1280 566Z"
      />
      <path
        className="hm-ink"
        d="M1070 362L1056 396L1072 388L1082 404M960 424L952 446"
      />
      <path
        className="hm hm-sea"
        d="M-40 552C260 544 560 556 860 548C1160 540 1400 552 1640 546V900H-40Z"
      />
      <path
        className="hm hm-hill-far"
        d="M30 556C76 522 140 512 200 527C240 537 262 548 286 556Z"
      />
      <Pine x={168} y={524} s={0.42} tone="olive" />
      <Pine x={196} y={530} s={0.32} />
      <path
        className="hm hm-hill-far"
        d="M1450 554C1486 528 1540 520 1590 532C1612 538 1630 546 1650 554Z"
      />
      <g transform={at(1552, 528, 1.1)}>
        <Lighthouse />
      </g>
      <g transform={at(236, 598)}>
        <g className="ha-boat">
          <Boat />
        </g>
      </g>
      <Waves x={90} y={612} n={3} />
      <Waves x={520} y={600} />
      <Waves x={250} y={668} n={4} />
      <Waves x={640} y={680} n={2} />
      <Waves x={1400} y={600} />
      <Waves x={1490} y={650} n={2} />
    </Layer>
  );
}

/** 섬: 모래 · 언덕 두 겹 · 점선 길 · 성(꼭대기) · 탑 · 숲 · 반짝이 */
function MidLayer() {
  // 왼쪽·오른쪽 해안이 바다로 비스듬히 내려간다 (오른쪽 너머로 바다와 등대 섬이 보이게)
  const hill =
    'M120 900C160 800 210 700 300 652C420 606 560 596 700 566C820 540 920 452 1060 434C1200 416 1300 470 1380 520C1440 556 1480 610 1500 660C1515 700 1525 800 1530 900Z';
  return (
    <Layer name="mid" i={2}>
      <path className="hm hm-sand" d={hill} transform="translate(-24 12)" />
      <path className="hm hm-sand" d={hill} transform="translate(22 12)" />
      <path className="hm hm-hill" d={hill} />
      <Pine x={892} y={512} s={0.62} tone="olive" />
      <Pine x={926} y={500} s={0.8} />
      <Pine x={958} y={488} s={0.56} tone="olive" />
      <Pine x={1196} y={448} s={0.52} />
      <Pine x={1220} y={456} s={0.42} tone="olive" />
      <g transform={at(1318, 486, 0.72)}>
        <Tower />
      </g>
      <path
        className="hm hm-hill-2"
        d="M430 900C470 800 540 720 640 690C760 652 860 640 940 622C1040 600 1120 604 1200 620C1300 640 1400 640 1460 690C1495 720 1512 800 1518 900Z"
      />
      <path
        className="hm-road"
        d="M960 900C930 842 860 806 880 752C900 702 990 690 1012 640C1034 592 984 566 1004 524C1018 494 1040 474 1058 458"
      />
      <g transform={at(1060, 440)}>
        <Castle />
      </g>
      <Bush x={720} y={700} s={0.9} tone="forest" />
      <Bush x={1290} y={640} s={0.8} />
      <Sparkle x={980} y={372} s={1.2} />
      <Sparkle x={1150} y={350} s={0.8} />
      <Sparkle x={1210} y={410} s={1} />
    </Layer>
  );
}

/** 앞 들판: 파이뱀이 서는 땅 · 첫 관문 · 표지판 · 나무 · 꽃 */
function NearLayer() {
  return (
    <Layer name="near" i={3}>
      <path
        className="hm hm-meadow"
        d="M-40 900L-40 772C160 744 360 760 560 780C760 800 940 770 1120 752C1300 734 1460 750 1640 728L1640 900Z"
      />
      <path
        className="hm-ink hm-ink-soft"
        d="M120 824c30-8 60-8 90 0M700 846c26-6 52-6 78 0M1240 812c30-8 58-8 86 0"
      />
      <Pine x={70} y={786} s={1.3} tone="olive" />
      <Pine x={150} y={792} s={1} />
      <Pine x={226} y={784} s={0.78} tone="olive" />
      <g transform={at(600, 790, 0.85)}>
        <Gate />
      </g>
      <Bush x={420} y={786} s={1.1} />
      <g transform={at(1050, 778)}>
        <Signpost />
      </g>
      <Bush x={1380} y={760} s={1.2} tone="forest" />
      <Bush x={1440} y={764} s={0.8} />
      <RoundTree x={1540} y={752} s={1.1} />
      <Flower x={330} y={812} gold />
      <Flower x={352} y={826} />
      <Flower x={880} y={808} />
      <Flower x={904} y={820} gold />
      <Flower x={1170} y={800} gold />
      <Flower x={1330} y={812} />
      <Flower x={1352} y={798} gold />
    </Layer>
  );
}

/** 전경 장식: 화면 모서리의 큰 풀잎 (가장 빠르게) · 떠다니는 잎 */
function DecorLayer() {
  return (
    <Layer name="decor" i={4}>
      <Fern x={-20} y={912} r={-8} s={1.25} />
      <Fern x={30} y={918} r={14} s={0.95} />
      <Fern x={-10} y={890} r={-34} s={0.8} />
      <g transform="translate(1600 0) scale(-1 1)">
        <Fern x={-20} y={912} r={-6} s={1.3} />
        <Fern x={40} y={920} r={16} s={0.9} />
        <Fern x={-4} y={880} r={-36} s={0.75} />
      </g>
      <Leaf x={520} y={320} r={-20} />
      <Leaf x={1360} y={360} r={30} />
      <Leaf x={880} y={240} r={10} />
    </Layer>
  );
}

export function HeroArt() {
  return (
    <>
      <SkyLayer />
      <FarLayer />
      <MidLayer />
      <NearLayer />
      <DecorLayer />
    </>
  );
}
