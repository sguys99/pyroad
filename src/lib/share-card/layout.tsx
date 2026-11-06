/**
 * 공유 카드 공용 레이아웃 (P2-19). satori 제약 안에서 만든다(P0-10 §4.5):
 * - flex만(grid 없음), 자식이 둘 이상인 div는 `display: flex`
 * - zIndex 없음 → 겹침 순서는 DOM 순서(땅 → 장식 → 손님 캐릭터 → 주인공)
 * - 흐림 그림자·필터 없음. 깊이는 단색 도형(언덕·메달 아랫면)으로. 발밑 그림자는 리그 정지 그림에 들어 있다
 * - 훅 없음(서버에서 그대로 호출)
 *
 * 구성: 왼쪽 캐릭터 무대(월드 틴트 면 + 큰 캐릭터 정지 그림) | 오른쪽 글(눈썹 → 닉네임 → 핵심 정보 하나 → 보조) + 아래 브랜드
 */
import type { CSSProperties, ReactNode } from 'react';
import { COLOR, type WorldId } from '@/lib/design/tokens';
import { characterUri, type CardCharacter } from './characters';
import { brandMarkSvg, iconUri, sparkleSvg, starSvg } from './icons';
import {
  CARD,
  CARD_RADIUS,
  FONT,
  GAP,
  PAD,
  STAGE_W,
  TEXT_W,
  TYPE,
  worldPalette,
} from './tokens';
import {
  digitCells,
  digitWidth,
  emWidth,
  fitLine,
  normalizeNickname,
} from './text';

const STAGE_H = CARD.height - PAD * 2;

export function CardFrame({
  stage,
  children,
}: {
  stage: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: CARD.width,
        height: CARD.height,
        display: 'flex',
        padding: PAD,
        gap: GAP,
        backgroundColor: COLOR.bg,
        fontFamily: FONT.sans,
        fontWeight: 600,
        color: COLOR.text,
        wordBreak: 'keep-all',
      }}
    >
      {stage}
      <div
        style={{
          width: TEXT_W,
          height: STAGE_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flexGrow: 1,
            paddingBottom: 24,
          }}
        >
          {children}
        </div>
        <Brand />
      </div>
    </div>
  );
}

export interface StageProps {
  world: WorldId;
  hero: CardCharacter;
  /** 주인공 크기 (px, 정사각) */
  heroSize?: number;
  /** 손님 캐릭터 (별똥이·버그버그). 주인공 왼쪽 위에 작게 */
  guest?: CardCharacter;
  /** 무대 위에 올리는 것 (메달 등). 캐릭터 다음에 그려 위에 온다 */
  overlay?: ReactNode;
}

/**
 * 반짝이 위치 (무대 기준, 크기) — 무대마다 같은 자리라 카드 4종이 한 세트로 보인다.
 * 기쁨·응원 상태는 리그 자체 반짝이가 있어 두 개만 오른쪽 위에 (화면 단순하게, §12-Q29)
 */
const SPARKLES: { left: number; top: number; size: number }[] = [
  { left: 420, top: 52, size: 30 },
  { left: 392, top: 108, size: 16 },
];

export function Stage({
  world,
  hero,
  heroSize = 480,
  guest,
  overlay,
}: StageProps) {
  const w = worldPalette(world);
  return (
    <div
      style={{
        width: STAGE_W,
        height: STAGE_H,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: CARD_RADIUS.stage,
        backgroundColor: w.soft,
      }}
    >
      {/* 언덕 (월드 틴트를 옅게, 무대 아래쪽) */}
      <div
        style={{
          position: 'absolute',
          left: -80,
          right: -80,
          bottom: -260,
          height: 400,
          borderRadius: 9999,
          backgroundColor: w.ground,
        }}
      />
      {SPARKLES.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={iconUri(sparkleSvg(i % 2 ? COLOR.accentLip : COLOR.accent))}
          width={s.size}
          height={s.size}
          alt=""
          style={{ position: 'absolute', left: s.left, top: s.top }}
        />
      ))}
      {guest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={characterUri(guest, 'card-guest-')}
          width={190}
          height={190}
          alt=""
          style={{ position: 'absolute', left: 18, top: 28 }}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={characterUri(hero, 'card-hero-')}
        width={heroSize}
        height={heroSize}
        alt=""
        style={{
          position: 'absolute',
          left: (STAGE_W - heroSize) / 2,
          bottom: -6,
        }}
      />
      {overlay}
    </div>
  );
}

/** 눈썹 글자: 둥근 이름표 (굵은 본문 글꼴) */
export function Kicker({
  children,
  color,
  background,
  icon,
}: {
  children: string;
  color: string;
  background: string;
  icon?: string;
}) {
  return (
    <div style={{ display: 'flex' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 52,
          padding: icon ? '0 24px 0 16px' : '0 24px',
          borderRadius: CARD_RADIUS.chip,
          backgroundColor: background,
          color,
          fontSize: TYPE.kicker,
          fontWeight: 700,
        }}
      >
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} width={32} height={32} alt="" />
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** 닉네임 자리 계산: 붙는 말 폭을 뺀 상자에 맞는 크기 (10자는 늘 자르지 않고 들어가야 함 — 테스트) */
export function fitNickname(nickname: string, suffix: string) {
  const name = normalizeNickname(nickname);
  const suffixW = Math.ceil(emWidth(suffix, 'sans') * TYPE.body);
  const box = TEXT_W - suffixW - 12;
  return { ...fitLine(name, box, { ...TYPE.nickname, font: 'display' }), box };
}

/** "코딩왕민준 님이 …" : 닉네임(Jua, 최대 10자·자동 크기) + 붙는 말(본문 글꼴) */
export function NicknameLine({
  nickname,
  suffix,
  marginTop = 28,
}: {
  nickname: string;
  suffix: string;
  marginTop?: number;
}) {
  const fit = fitNickname(nickname, suffix);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        marginTop,
        width: TEXT_W,
      }}
    >
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 400,
          fontSize: fit.fontSize,
          lineHeight: 1.2,
          color: COLOR.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: fit.box,
        }}
      >
        {fit.text}
      </div>
      <div
        style={{
          fontSize: TYPE.body,
          color: COLOR.textMuted,
          whiteSpace: 'nowrap',
        }}
      >
        {suffix}
      </div>
    </div>
  );
}

/** 고정폭 숫자 (Jua에 tnum이 없어 칸마다 같은 폭 상자) */
export function Digits({
  value,
  size,
  color,
  font = 'display',
}: {
  value: number;
  size: number;
  color: string;
  font?: 'display' | 'sans';
}) {
  const cell = Math.round(size * digitWidth(font));
  return (
    <div style={{ display: 'flex' }}>
      {digitCells(value).map((d, i) => (
        <div
          key={i}
          style={{
            width: cell,
            display: 'flex',
            justifyContent: 'center',
            fontFamily: font === 'display' ? FONT.display : FONT.sans,
            fontWeight: font === 'display' ? 400 : 700,
            fontSize: size,
            lineHeight: 1,
            color,
          }}
        >
          {d}
        </div>
      ))}
    </div>
  );
}

/** 별 줄 (채운 별 + 빈 별) */
export function StarRow({
  count,
  max,
  size,
  gap = 14,
}: {
  count: number;
  max: number;
  size: number;
  gap?: number;
}) {
  const n = Math.max(0, Math.min(max, Math.round(count)));
  return (
    <div style={{ display: 'flex', gap }}>
      {Array.from({ length: max }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={iconUri(starSvg(i < n))}
          width={size}
          height={size}
          alt=""
        />
      ))}
    </div>
  );
}

/** 작은 통계 칸 (아이콘 + 숫자 + 이름) — 주간 카드 */
export function StatTile({
  icon,
  value,
  unit,
  label,
  style,
}: {
  icon: string;
  value: number;
  unit: string;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '18px 22px',
        borderRadius: CARD_RADIUS.tile,
        backgroundColor: COLOR.surface,
        flexGrow: 1,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} width={38} height={38} alt="" />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <Digits value={value} size={48} color={COLOR.text} />
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 30,
              color: COLOR.text,
            }}
          >
            {unit}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 24, color: COLOR.textMuted }}>{label}</div>
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconUri(brandMarkSvg())} width={44} height={44} alt="" />
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: TYPE.brand,
          color: COLOR.text,
          lineHeight: 1,
        }}
      >
        pyRoad
      </div>
      <div
        style={{
          fontSize: TYPE.brandNote,
          color: COLOR.textMuted,
          marginLeft: 6,
          lineHeight: 1,
          paddingTop: 4,
        }}
      >
        초등학생 파이썬 모험
      </div>
    </div>
  );
}
