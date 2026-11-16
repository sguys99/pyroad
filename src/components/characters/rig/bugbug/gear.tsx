/**
 * 보스 버그버그 바다 소품 (P10-04, 2월드 외형). 파이뱀 모자(`costumes.tsx`)와 달리 버그버그 머리·몸에 맞춘 128×128 좌표 그대로.
 * - 머리 소품(`BossHeadGear`): 머리 그룹 안 (머리 회전·흔들림을 같이 받음). 머리 = 타원 (64,46) 22×18, 꼭대기 y≈28, 더듬이 뿌리 (52,33)·(76,33)
 * - 문어 다리(`BossTentacles`, 선장): 몸 그룹 안, 다리 대신 (다리 경로는 그대로 두고 감춤 → 리그 애니메이션 표는 그대로)
 * - 튜브(`BossTube`, 소용돌이): 몸 그룹 안, 뒤쪽 테(몸 뒤) + 앞쪽 띠(등딱지 앞)
 * - 3월드 메이커 소품 (P11-11): 머리 소품(베레모·두루마리·헤드셋+나비넥타이·강아지 귀·사냥 모자·조종사 고글; 오락기는 더듬이 끝 빨간 공(팔레트)이 조이스틱),
 *   몸 소품(`BossBodyGear`: 책 망토 · 밥그릇 · 돋보기 · 메가 로봇 몸통·팔·다리), 등딱지 소품(`BossShellGear`: 오락기 십자키·단추)
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
  // 3월드 메이커 (P11-11)
  beret: ['#B5476A', '#86304D'],
  paintBlue: ['#5B8ED6', '#3A68A8'],
  paintGreen: ['#79B85B', '#4F8A38'],
  wood: ['#D9B07A', '#9C7442'],
  bristle: ['#F0B43C', '#B07E1C'],
  parchment: ['#F6E7C4', '#B9A27A'],
  ribbon: ['#C8553D', '#8C3B2B'],
  leather: ['#7A3E4E', '#552A36'],
  page: ['#FBF6EA', '#C2B79F'],
  bow: ['#D83F4F', '#9E2836'],
  headset: ['#3A3D4A', '#22242C'],
  mic: ['#9AA3B5', '#5F6778'],
  puppy: ['#B98352', '#7E5530'],
  puppyIn: ['#F2B6B0', '#C27F78'],
  band: ['#F0B43C', '#B07E1C'],
  bowl: ['#5BA3C9', '#3A7699'],
  kibble: ['#A86A3C', '#734422'],
  tweed: ['#B08A5A', '#7A5B34'],
  tweedDark: ['#8C6A40', '#5E4524'],
  brass: ['#E0B14A', '#9E7820'],
  lens: ['#DDEFF5', '#8FB2C0'],
  plastic: ['#2F3340', '#1B1E26'],
  btnRed: ['#E0524A', '#A3332D'],
  btnYellow: ['#F2C43D', '#B38A17'],
  steel: ['#9CABBE', '#66778D'],
  steelDark: ['#6E7F96', '#46546A'],
  bolt: ['#D7DEE7', '#8C99AA'],
  lamp: ['#FFD25A', '#C99A1E'],
  goggle: ['#7FC6D9', '#3F8396'],
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
    // ── 3월드 메이커 시티 (P11-11)
    // 3-1 거북이 화가 공방: 기운 베레모 + 물감 방울 + 귀 뒤에 꽂은 붓
    case 'beret':
      return (
        <g>
          {p('M84 46 L101 21', 'wood')}
          <path
            d="M84 46 L101 21"
            stroke={ink ?? C.wood[1]}
            strokeWidth="1"
            strokeLinecap="round"
          />
          {p(
            'M99.5 24 L103 18.5 C105 15 108 15.5 107.5 19 L104 25 Z',
            'bristle',
          )}
          {p(
            'M41 31 C38 20 54 13 69 14 C83 15 91 22 86 31 C77 36 50 36 41 31 Z',
            'beret',
          )}
          {p('M63 14 l1.5 -5 3 0.6 -0.8 4.6 z', 'beret')}
          {p('M50 23 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0z', 'paintBlue')}
          {p('M72 21 a2.4 2.4 0 1 0 4.8 0 a2.4 2.4 0 1 0 -4.8 0z', 'bristle')}
          {p('M60 28 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0z', 'paintGreen')}
        </g>
      );
    // 3-2 모험 이야기 극장: 머리 위 리본 묶은 두루마리 (망토는 BossBodyGear)
    case 'scroll':
      return (
        <g>
          {p('M42 22 H86 V31 H42 Z', 'parchment')}
          {p('M38 26.5 a4.5 5 0 1 0 9 0 a4.5 5 0 1 0 -9 0z', 'parchment')}
          {p('M81 26.5 a4.5 5 0 1 0 9 0 a4.5 5 0 1 0 -9 0z', 'parchment')}
          {p('M61 21 h6 v11 h-6z', 'ribbon')}
          {p(
            'M61 32 l-3 6 3 -1 1 2 1 -7z M67 32 l3 6 -3 -1 -1 2 -1 -7z',
            'ribbon',
          )}
          <path
            d="M48 25 h8 M48 28 h10 M72 25 h8 M70 28 h10"
            stroke={C.parchment[1]}
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>
      );
    // 3-3 퀴즈쇼 진행자: 머리띠 헤드셋 + 입 옆 마이크 + 목에 나비넥타이
    case 'headset':
      return (
        <g>
          <path
            d="M43 44 C42 22 86 22 85 44"
            stroke={ink ?? C.headset[0]}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {p('M81 40 h8 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 h-8 z', 'headset')}
          <path
            d="M88 51 C88 58 82 61 76 60"
            stroke={ink ?? C.headset[0]}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          {p('M71 60 a3.4 3 0 1 0 6.8 0 a3.4 3 0 1 0 -6.8 0z', 'mic')}
          {p('M64 64 L52 58 L52 70 Z M64 64 L76 58 L76 70 Z', 'bow')}
          {p('M61 61 h6 v6 h-6z', 'bow')}
        </g>
      );
    // 3-4 펫 돌봄 센터: 강아지 귀 머리띠 (밥그릇은 BossBodyGear)
    case 'puppy':
      return (
        <g>
          <path
            d="M44 36 C44 24 84 24 84 36"
            stroke={ink ?? C.band[1]}
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M44 36 C44 24 84 24 84 36"
            stroke={C.band[0]}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          {p(
            'M47 30 C38 26 30 34 32 46 C33 53 39 55 42 50 C45 44 46 38 49 33 Z',
            'puppy',
          )}
          {p(
            'M45 33 C39 32 35 38 36 45 C37 49 40 49 41 46 C43 41 44 37 46 34 Z',
            'puppyIn',
          )}
          {p(
            'M81 30 C90 26 98 34 96 46 C95 53 89 55 86 50 C83 44 82 38 79 33 Z',
            'puppy',
          )}
          {p(
            'M83 33 C89 32 93 38 92 45 C91 49 88 49 87 46 C85 41 84 37 82 34 Z',
            'puppyIn',
          )}
        </g>
      );
    // 3-5 데이터 탐정 사무소: 앞뒤 챙 사냥 모자 + 위로 묶은 귀덮개 (돋보기는 BossBodyGear)
    case 'deerstalker':
      return (
        <g>
          {p('M34 31 Q40 26 46 29 L44 34 Q38 33 34 31 Z', 'tweedDark')}
          {p('M94 31 Q88 26 82 29 L84 34 Q90 33 94 31 Z', 'tweedDark')}
          {p('M43 32 C41 16 52 9 64 9 C76 9 87 16 85 32 Z', 'tweed')}
          <path
            d="M64 9 V32 M53 12 C50 18 49 25 50 32 M75 12 C78 18 79 25 78 32 M45 22 H83"
            stroke={C.tweedDark[1]}
            strokeWidth="0.9"
            strokeLinecap="round"
            fill="none"
          />
          {p('M47 27 C45 33 46 38 50 40 C52 36 52 31 51 27 Z', 'tweedDark')}
          {p('M81 27 C83 33 82 38 78 40 C76 36 76 31 77 27 Z', 'tweedDark')}
          {p('M61 6 a3 2.4 0 1 0 6 0 a3 2.4 0 1 0 -6 0z', 'tweedDark')}
        </g>
      );
    // 3-F 메가 로봇 (최종 보스): 조종사 고글 + 머리 위 경고등 (로봇 몸은 BossBodyGear)
    case 'robot':
      return (
        <g>
          {p('M42 31 C44 20 84 20 86 31 L84 35 C76 30 52 30 44 35 Z', 'steel')}
          {p('M50 27 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0z', 'goggle')}
          {p('M66 27 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0z', 'goggle')}
          <path
            d="M53 25 l3 -2 M69 25 l3 -2"
            stroke="#fff"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.8"
          />
          {p('M62 20 h4 v-5 h-4z', 'steelDark')}
          {p('M60 15 a4 4 0 0 1 8 0 z', 'lamp')}
        </g>
      );
    default:
      return null;
  }
}

/** 등딱지 소품 (오락기): 왼쪽 반쪽 십자키, 오른쪽 반쪽 단추 두 개. 등딱지 반쪽 그룹 안이라 열고 닫힘을 같이 받음 */
export function BossShellGear({
  side,
  ink,
}: {
  side: 'L' | 'R';
  ink?: string;
}) {
  const p = (d: string, c: Tone) => <Part d={d} c={c} ink={ink} />;
  return side === 'L' ? (
    <g>
      {p('M44 72 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 z', 'plastic')}
      {p('M48 98 h8 v3 h-8z', 'plastic')}
    </g>
  ) : (
    <g>
      {p('M74 76 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0z', 'btnRed')}
      {p('M70 89 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0z', 'btnYellow')}
      {p('M72 98 h8 v3 h-8z', 'plastic')}
    </g>
  );
}

/**
 * 몸 소품 (3월드). back = 다리 뒤·배 앞(몸 뒤로 보임), front = 등딱지 앞.
 * - 책 망토(scroll): 등 뒤로 펼친 가죽 표지 + 책장 끝
 * - 밥그릇(puppy) · 돋보기(deerstalker): 발치 오른쪽
 * - 메가 로봇(robot): 등 뒤 몸통·어깨·팔(back) + 쇠 다리(back, 원래 다리는 감춤) + 가슴 볼트 띠(front)
 */
export function BossBodyGear({
  gear,
  part,
  ink,
}: {
  gear: BossGear;
  part: 'back' | 'front';
  ink?: string;
}) {
  const p = (d: string, c: Tone) => <Part d={d} c={c} ink={ink} />;
  if (part === 'back') {
    switch (gear) {
      case 'scroll':
        return (
          <g>
            {p('M30 60 L98 60 L108 110 L20 110 Z', 'leather')}
            {p('M24 106 L104 106 L108 110 L20 110 Z', 'page')}
            <path
              d="M64 60 V110 M28 66 L36 104 M100 66 L92 104"
              stroke={ink ?? C.leather[1]}
              strokeWidth="1"
              strokeLinecap="round"
              fill="none"
            />
            {p('M60 58 h8 v6 h-8z', 'brass')}
          </g>
        );
      case 'robot':
        return (
          <g>
            {p('M14 66 L30 62 L32 74 L18 96 L10 92 Z', 'steel')}
            {p('M114 66 L98 62 L96 74 L110 96 L118 92 Z', 'steel')}
            {p('M6 92 L14 88 L20 98 L14 104 L16 96 Z', 'steelDark')}
            {p('M122 92 L114 88 L108 98 L114 104 L112 96 Z', 'steelDark')}
            {p('M24 58 H104 L100 104 H28 Z', 'steelDark')}
            {p('M20 56 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0z', 'steel')}
            {p('M88 56 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0z', 'steel')}
            {p(
              'M28 56 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0z M96 56 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0z',
              'bolt',
            )}
            {p('M38 100 H56 V118 H38 Z M72 100 H90 V118 H72 Z', 'steelDark')}
            {p('M34 116 H58 V123 H34 Z M70 116 H94 V123 H70 Z', 'steel')}
            <path
              d="M38 106 H56 M72 106 H90"
              stroke={ink ?? C.steelDark[1]}
              strokeWidth="1"
              fill="none"
            />
          </g>
        );
      default:
        return null;
    }
  }
  switch (gear) {
    case 'puppy':
      return (
        <g>
          {p('M94 104 a9 3 0 1 0 18 0 a9 3 0 1 0 -18 0z', 'kibble')}
          {p('M92 104 H114 L110 114 H96 Z', 'bowl')}
          <path
            d="M100 109 c1.5 -2 3 -2 4.5 0 M103 108 v0.1"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
        </g>
      );
    case 'deerstalker':
      return (
        <g>
          {p('M100 98 L112 112 L108.5 115 L96.5 101 Z', 'wood')}
          <path
            fillRule="evenodd"
            d="M88 88 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0z M91.5 88 a7.5 7.5 0 1 0 15 0 a7.5 7.5 0 1 0 -15 0z"
            fill={C.brass[0]}
            stroke={ink ?? C.brass[1]}
            strokeWidth={ink ? 1.6 : 1.1}
          />
          <circle cx="99" cy="88" r="7.5" fill={C.lens[0]} opacity="0.7" />
          <path
            d="M95 84 l3 -2"
            stroke="#fff"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>
      );
    case 'robot':
      return (
        <g>
          {p('M40 100 H88 V106 H40 Z', 'steel')}
          {p(
            'M46 103 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0z M62.4 103 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0z M78.8 103 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0z',
            'bolt',
          )}
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
