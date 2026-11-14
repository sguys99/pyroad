/**
 * 보스 버그버그 바다 소품 (P10-04, 2월드 외형). 파이뱀 모자(`costumes.tsx`)와 달리 버그버그 머리·몸에 맞춘 128×128 좌표 그대로.
 * - 머리 소품(`BossHeadGear`): 머리 그룹 안 (머리 회전·흔들림을 같이 받음). 머리 = 타원 (64,46) 22×18, 꼭대기 y≈28, 더듬이 뿌리 (52,33)·(76,33)
 * - 문어 다리(`BossTentacles`, 선장): 몸 그룹 안, 다리 대신 (다리 경로는 그대로 두고 감춤 → 리그 애니메이션 표는 그대로)
 * - 튜브(`BossTube`, 소용돌이): 몸 그룹 안, 뒤쪽 테(몸 뒤) + 앞쪽 띠(등딱지 앞)
 * 선은 B(몸색 톤) 규칙: 제 색의 진한 톤 1.1px, 잉크 스타일(A×B)이면 잉크. 훅 없음.
 */
import type { BossGear } from '../costumes';
import type { BugBugPalette } from './Markup';

/** 소품 제 색과 진한 톤 */
const C = {
  coral: ['#E98B76', '#B85A4A'],
  coralLight: ['#F6B9A6', '#B85A4A'],
  pearl: ['#FBF4E6', '#B9A98C'],
  knitRed: ['#D25A4B', '#9E3D31'],
  knitCream: ['#FBF1DE', '#B9A98C'],
  tricorn: ['#3A3442', '#231E29'],
  gold: ['#F0B43C', '#B07E1C'],
  bandage: ['#FFFBF2', '#BDB2A0'],
  plaster: ['#F2CFA5', '#B98E5E'],
  glow: ['#FFE48A', '#C9A23A'],
  capWhite: ['#FBF8F1', '#B7AE9E'],
  capNavy: ['#2F3F66', '#1D2944'],
  visor: ['#2A2A33', '#18181E'],
} as const;

type Tone = keyof typeof C;

function Part({ d, c, ink }: { d: string; c: Tone; ink?: string }) {
  const [fill, tone] = C[c];
  return (
    <path
      d={d}
      fill={fill}
      stroke={ink ?? tone}
      strokeWidth={ink ? 1.6 : 1.1}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export function BossHeadGear({
  gear,
  pal,
  ink,
}: {
  gear: BossGear;
  pal: BugBugPalette;
  /** 잉크 외곽선 스타일이면 그 색 */
  ink?: string;
}) {
  const p = (d: string, c: Tone) => <Part d={d} c={c} ink={ink} />;
  switch (gear) {
    // 2-1 산호 공방: 머리 위 산호 가지 두 갈래 + 진주 하나
    case 'coral':
      return (
        <g>
          {p(
            'M60 31 C60 24 56 20 57 13 C59 16 60 19 61 21 C62 15 64 10 67 7 C68 12 65 17 65 22 C67 20 70 16 73 15 C73 20 69 25 66 31 Z',
            'coral',
          )}
          {p('M61 21 C61.5 18 62 16 63 14', 'coralLight')}
          {p('M69 30 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0z', 'pearl')}
        </g>
      );
    // 2-2 등대 도서관: 등대지기 줄무늬 털모자 + 방울
    case 'beanie':
      return (
        <g>
          {p('M43 33 C42 18 52 11 64 11 C76 11 86 18 85 33 Z', 'knitRed')}
          {p('M46.5 22 Q64 17 81.5 22 L83.5 27 Q64 22 44.5 27 Z', 'knitCream')}
          {p('M41 31 Q64 26 87 31 L87.5 37 Q64 32 40.5 37 Z', 'knitCream')}
          {p('M60 9 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0z', 'knitCream')}
        </g>
      );
    // 2-4 해적선: 삼각 해적 모자 + 금테 + 금화
    case 'tricorn':
      return (
        <g>
          {p('M46 25 Q47 7 64 6 Q81 7 82 25 Z', 'tricorn')}
          {p(
            'M33 17 Q46 29 64 29 Q82 29 95 17 L91 28 Q79 36 64 36 Q49 36 37 28 Z',
            'tricorn',
          )}
          <path
            d="M35.5 20 Q47 31 64 31 Q81 31 92.5 20"
            stroke={C.gold[0]}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          {p('M59.5 19 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0z', 'gold')}
          <path
            d="M62 19 h4 M64 17 v4"
            stroke={C.gold[1]}
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      );
    // 2-5 병원선 환자: 머리 붕대 + 옆 매듭 + 볼 반창고
    case 'bandage':
      return (
        <g>
          {p('M43 37 Q64 21 85 37 L86.5 31 Q64 14 41.5 31 Z', 'bandage')}
          <path
            d="M50 30 Q64 22 78 30"
            stroke={C.bandage[1]}
            strokeWidth="0.9"
            strokeDasharray="2 2.5"
            fill="none"
          />
          {p('M85 32 C92 26 96 30 92 34 C96 37 92 41 86 36 Z', 'bandage')}
          {p('M75 55 l7 -4 2 3.4 -7 4 z', 'plaster')}
        </g>
      );
    // 2-6 해저 산맥: 아귀처럼 머리에서 뻗은 초롱 (빛 둘레는 은은하게)
    case 'lure':
      return (
        <g>
          <path
            d="M64 29 C63 18 70 9 80 8"
            stroke={ink ?? pal.head}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="83" cy="8.5" r="9" fill={C.glow[0]} opacity="0.35" />
          {p('M78 8.5 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0z', 'glow')}
          <circle cx="81.4" cy="6.8" r="1.4" fill="#fff" opacity="0.8" />
        </g>
      );
    // 2-F 버그버그 선장: 흰 선장 모자 + 남색 띠 + 검은 챙 + 금 닻 배지
    case 'captain':
      return (
        <g>
          {p('M40 24 Q37 9 64 7 Q91 9 88 24 Z', 'capWhite')}
          {p('M43 23 H85 V30.5 H43 Z', 'capNavy')}
          {p('M43 30 Q64 39 85 30 Q64 34.5 43 30 Z', 'visor')}
          {p('M60 19 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0z', 'gold')}
          <path
            d="M64 16.4 v5.4 M61.8 18 h4.4 M61.6 20.4 q2.4 2.6 4.8 0"
            stroke={C.capNavy[1]}
            strokeWidth="0.9"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    default:
      return null;
  }
}

/** 소용돌이 튜브: 허리(64,98)의 고리. back = 몸 뒤로 보이는 테, front = 등딱지 앞을 지나는 아래 반쪽 띠 + 흰 줄 3개 */
const TUBE_OUT = { rx: 38, ry: 11 };
const TUBE_IN = { rx: 27, ry: 6 };
const tubeAt = (deg: number, r: { rx: number; ry: number }) => {
  const a = (deg * Math.PI) / 180;
  return `${Math.round((64 + Math.cos(a) * r.rx) * 10) / 10} ${Math.round((98 + Math.sin(a) * r.ry) * 10) / 10}`;
};

export function BossTube({
  part,
  ink,
}: {
  part: 'back' | 'front';
  ink?: string;
}) {
  const stroke = ink ?? C.knitRed[1];
  const sw = ink ? 1.6 : 1.1;
  if (part === 'back') {
    return (
      <ellipse
        cx="64"
        cy="98"
        rx={TUBE_OUT.rx}
        ry={TUBE_OUT.ry}
        fill={C.knitRed[0]}
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }
  return (
    <g>
      <path
        d={`M${tubeAt(180, TUBE_OUT)} A38 11 0 0 0 ${tubeAt(0, TUBE_OUT)} L${tubeAt(0, TUBE_IN)} A27 6 0 0 1 ${tubeAt(180, TUBE_IN)} Z`}
        fill={C.knitRed[0]}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {[35, 90, 145].map((deg) => (
        <path
          key={deg}
          d={`M${tubeAt(deg, TUBE_IN)} L${tubeAt(deg, TUBE_OUT)}`}
          stroke={C.knitCream[0]}
          strokeWidth="7"
        />
      ))}
      <path
        d={`M${tubeAt(160, { rx: 33, ry: 8.5 })} A33 8.5 0 0 0 ${tubeAt(120, { rx: 33, ry: 8.5 })}`}
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
        fill="none"
      />
    </g>
  );
}

/** 문어 다리 4개: 진한 톤 굵은 선 위에 등딱지 색 선 + 빨판 점 (다리처럼 몸 아래로) */
const TENTACLES = [
  'M48 96 C38 102 30 108 32 115 C34 120 40 118 38 113',
  'M58 102 C54 110 50 116 54 120 C57 122 60 119 58 116',
  'M70 102 C74 110 78 116 74 120 C71 122 68 119 70 116',
  'M80 96 C90 102 98 108 96 115 C94 120 88 118 90 113',
];
const SUCKERS: [number, number][] = [
  [37, 106],
  [33, 113],
  [53, 112],
  [75, 112],
  [91, 106],
  [95, 113],
];

export function BossTentacles({
  pal,
  ink,
}: {
  pal: BugBugPalette;
  ink?: string;
}) {
  return (
    <g strokeLinecap="round" fill="none">
      {TENTACLES.map((d) => (
        <path key={d} d={d} stroke={ink ?? pal.outline} strokeWidth="8.4" />
      ))}
      {TENTACLES.map((d) => (
        <path key={d} d={d} stroke={pal.shell} strokeWidth="6" />
      ))}
      {SUCKERS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill={pal.shellLight} />
      ))}
    </g>
  );
}
