/**
 * 앱 아이콘 그림 (P4-11). 파비콘·홈 화면(apple-touch)·manifest 아이콘을 **같은 그림 한 벌**에서 크기·자르기만 바꿔 만든다.
 *
 * - 공유 카드·OG 이미지(P2-19·P4-10)와 같은 파이프라인: 리그 정지 그림(`PybaemStatic`, 기본 스타일 B)을 자체 직렬화기로
 *   SVG 문자열 → data URI `<img>` → `next/og`(satori + resvg)가 PNG로. 빌드 때 정적 생성(`force-static`)
 * - 승인된 B 디자인: 단일 톤 바탕(브랜드 초록 `primary` 한 색), 언덕 하나(그 진한 톤 `primaryLip`), 금색 반짝이 하나,
 *   리그 자체 외곽선(면 색의 진한 톤). 글자·이모지 없음 → 기기 글꼴과 무관하게 같은 모습.
 *   옅은 바탕(월드 1 틴트)도 그려 봤지만 흰 탭·밝은 배경화면에서 테두리가 사라져 16px에서 묻혔다 → 진한 초록 면 위의 연두 파이뱀
 * - 작은 크기(16·32px 파비콘)는 얼굴만 크게 자른다(몸·언덕·반짝이는 뭉개져 잡음이 됨). 큰 크기는 몸 전체 + 언덕 + 반짝이
 * - 표정은 `idle`(눈을 뜬 기본 얼굴). `happy`는 리그 자체 반짝이가 붙어 작은 크기에서 지저분하다
 */
import { createElement, type ReactElement } from 'react';
import { PybaemStatic } from '@/components/characters/rig';
import { COLOR, blend } from '@/lib/design/tokens';
import { sparkleSvg } from '@/lib/share-card/icons';
import { serializeSvg, svgDataUri } from '@/lib/share-card/svg';

/**
 * 아이콘 종류.
 * - `favicon`: 브라우저 탭(32px, 16px로도 줄어듦). 얼굴만, 둥근 사각형(모서리 투명)
 * - `apple`: iOS 홈 화면(180px). **불투명 정사각형**(iOS가 모서리를 깎고, 투명하면 검게 칠함)
 * - `any`: manifest 일반 아이콘(192·512). 둥근 사각형(모서리 투명): 데스크톱 설치 앱·작업 표시줄
 * - `maskable`: manifest 마스크 아이콘(512). 바탕을 끝까지 채우고 그림은 가운데 80% 원(안전 영역) 안에만
 */
export type PwaIconKind = 'favicon' | 'apple' | 'any' | 'maskable';

/** 리그 avatar 틀(0 0 128 128)에서 자르는 영역 */
const VIEWBOX = {
  /** 머리만 (얼굴이 아이콘을 채움) */
  head: '33 13 62 62',
  /** 몸 전체 (발밑 그림자 포함, 위아래 여백 조금) */
  body: '2 4 124 124',
} as const;

/**
 * 안전 영역: maskable은 가운데 지름 80% 원. 그림 상자는 62% — 상자 모서리는 원 밖으로 조금 나가지만 그 자리는
 * 리그 틀의 빈 여백이고, 몸·꼬리·반짝이는 모두 중심에서 반지름 40% 안이다(테스트가 반짝이 위치를 확인)
 */
export const MASKABLE_SAFE_RATIO = 0.8;
const MASKABLE_ART_RATIO = 0.62;

/** 둥근 사각형 모서리 (크기 대비). iOS·macOS 아이콘 모서리와 비슷한 22% */
const CORNER_RATIO = 0.22;

export const PWA_ICON_COLORS = {
  bg: COLOR.primary,
  hill: COLOR.primaryLip,
  hillLine: blend(COLOR.primaryLip, COLOR.text, 0.6),
  sparkle: COLOR.accent,
} as const;

/** 파이뱀 정지 그림 SVG 문자열 (자르기 영역만 바꿈) */
export function pybaemIconSvg(crop: keyof typeof VIEWBOX): string {
  const svg = serializeSvg(
    createElement(PybaemStatic, {
      state: 'idle',
      size: 128,
      framing: 'avatar',
      filters: false,
      label: '',
      idPrefix: `pwa-icon-${crop}-`,
    }),
  );
  return svg.replace(/viewBox="[^"]*"/, `viewBox="${VIEWBOX[crop]}"`);
}

/** 바탕 언덕 (아이콘 아래쪽, 정사각형 0 0 100 100 좌표) */
function hillSvg(): string {
  const c = PWA_ICON_COLORS;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<path d="M-2 74C20 64 40 62 58 66S88 66 102 58V102H-2z" fill="${c.hill}" stroke="${c.hillLine}" stroke-width="0.6"/>` +
    `</svg>`
  );
}

/** 아이콘 그림 (satori 엘리먼트, size×size) */
export function PwaIcon({
  kind,
  size,
}: {
  kind: PwaIconKind;
  size: number;
}): ReactElement {
  const c = PWA_ICON_COLORS;
  const small = kind === 'favicon';
  const rounded = kind === 'favicon' || kind === 'any';
  // 그림 상자: maskable은 안전 원 안, 나머지는 거의 가득
  const art = Math.round(
    size * (kind === 'maskable' ? MASKABLE_ART_RATIO : small ? 1 : 0.92),
  );
  const offset = Math.round((size - art) / 2);
  // 큰 아이콘은 그림을 조금 내려 언덕에 앉힌다 (maskable은 안전 원 가운데 그대로)
  const top =
    kind === 'any' || kind === 'apple'
      ? offset + Math.round(size * 0.03)
      : offset;
  const sparkle = Math.round(art * 0.16);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: c.bg,
        borderRadius: rounded ? Math.round(size * CORNER_RATIO) : 0,
      }}
    >
      {small ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={svgDataUri(hillSvg())}
          width={size}
          height={size}
          alt=""
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
      )}
      {small ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={svgDataUri(sparkleSvg(c.sparkle))}
          width={sparkle}
          height={sparkle}
          alt=""
          style={{
            position: 'absolute',
            left: offset + Math.round(art * 0.76),
            top: top + Math.round(art * 0.06),
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={svgDataUri(pybaemIconSvg(small ? 'head' : 'body'))}
        width={art}
        height={art}
        alt=""
        style={{ position: 'absolute', left: offset, top }}
      />
    </div>
  );
}
