/**
 * 사이트 공유 미리보기 그림 (P4-10, `src/app/opengraph-image.tsx`). 공유 카드(P2-19)와 **같은 틀·폰트·직렬화**를 쓴다:
 * `CardFrame`(왼쪽 무대 | 오른쪽 글 + 아래 브랜드) · `Stage`(월드 1 틴트 면 + 리그 정지 그림) · `loadShareCardFonts`.
 *
 * 무대는 랜딩 첫 화면 그림(최종 시안 `HeroArt`)의 느낌을 줄인 지도: 먼 언덕·가까운 언덕, 점선 잉크 길이 언덕을 넘어
 * 금색 X(보물 자리)로 가고, 길가에 깃발 탑과 나무. 그 앞에서 파이뱀이 손을 흔든다.
 * 색은 토큰만(단일 톤 바탕, 초록·금색, 면 색의 진한 톤 얇은 선), 흐림·필터·`<text>` 없음(P0-10 §4.5).
 *
 * 글은 사실만: 무료(약관 제11조), 설치 없이 웹 브라우저에서(Pyodide), 퀘스트로 진짜 파이썬 코드.
 */
import type { ReactElement } from 'react';
import { COLOR, blend } from '@/lib/design/tokens';
import { CardFrame, Kicker, STAGE_H, Stage } from './layout';
import { glyphSvg, iconUri } from './icons';
import { svgDataUri } from './svg';
import { FONT, STAGE_W, TEXT_W } from './tokens';

/** 사이트 OG 글 (테스트가 화면 글자와 대조) */
export const SITE_CARD_TEXT = {
  kicker: '무료 · 설치 없이 웹에서',
  title: ['파이뱀과 떠나는', '파이썬 모험'],
  sub: '퀘스트를 깨며 진짜 파이썬 코드를 배워요',
} as const;

export const SITE_CARD_TITLE_SIZE = 84;

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}">${body}</svg>`;

/** 무대 지도 (500×534, 무대 좌표). 캐릭터 뒤에 깔린다 */
export function siteMapSvg(): string {
  const soft = COLOR.w1Soft;
  const far = blend(COLOR.w1, soft, 0.3);
  const farLine = blend(COLOR.w1Ink, far, 0.25);
  const near = blend(COLOR.w1, soft, 0.55);
  const nearLine = blend(COLOR.w1Ink, near, 0.3);
  const tree = blend(COLOR.w1, COLOR.w1Ink, 0.55);
  const treeLine = COLOR.w1Ink;
  const sun = blend(COLOR.accentLight, soft, 0.55);
  const stone = COLOR.surface;
  const stoneLine = COLOR.lineStrong;
  const bird = blend(COLOR.textMuted, soft, 0.6);

  const treeAt = (x: number, y: number, s: number) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-1.6 0h3.2v8h-3.2z" fill="${COLOR.w3}" stroke="${treeLine}" stroke-width="1"/>` +
    `<path d="M0 -30 15 0H-15z" fill="${tree}" stroke="${treeLine}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `</g>`;

  return svg(
    // 해 (옅은 금색) · 새 두 마리
    `<circle cx="104" cy="104" r="46" fill="${sun}"/>` +
      `<path d="M196 92q7-6 14 0q7-6 14 0M232 116q5-4 10 0q5-4 10 0" fill="none" stroke="${bird}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
      // 먼 언덕
      `<path d="M-10 318C90 262 170 262 262 286S420 252 510 212V544H-10z" fill="${far}" stroke="${farLine}" stroke-width="1.2"/>` +
      // 깃발 탑 (먼 언덕 위)
      `<g transform="translate(372 262)">` +
      `<path d="M-14 0V-58H14V0z" fill="${stone}" stroke="${stoneLine}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M-6 -42h12v12h-12zM-6 -20h12v12h-12z" fill="${COLOR.accentLight}" stroke="${COLOR.accentLip}" stroke-width="1.1"/>` +
      `<path d="M-20 -58 0 -84 20 -58z" fill="${COLOR.accent}" stroke="${COLOR.accentLip}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M0 -84V-104" stroke="${COLOR.text}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M0 -104 16 -98 0 -92z" fill="${COLOR.accent}" stroke="${COLOR.accentLip}" stroke-width="1.1" stroke-linejoin="round"/>` +
      `</g>` +
      treeAt(306, 284, 0.9) +
      treeAt(232, 276, 0.7) +
      // 가까운 언덕
      `<path d="M-10 412C70 376 160 372 250 386S420 360 510 322V544H-10z" fill="${near}" stroke="${nearLine}" stroke-width="1.2"/>` +
      treeAt(48, 420, 1.15) +
      treeAt(86, 432, 0.85) +
      // 점선 잉크 길: 왼쪽 아래에서 언덕을 넘어 오른쪽 위 X로
      `<path d="M24 506C96 478 150 456 196 420S270 330 330 312S410 262 446 222" fill="none" stroke="${COLOR.primary}" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.1 14"/>` +
      // 보물 자리 X (금색 글자색 = 진한 금색)
      `<path d="M440 196l22 22M462 196l-22 22" stroke="${COLOR.accentText}" stroke-width="5" stroke-linecap="round"/>`,
  );
}

/** 제목 한 줄. 둘째 줄은 형광펜(금색 밝은 띠)을 아래쪽 절반에 깐다 (최종 시안 첫 화면 제목과 같은 강조) */
function TitleLine({
  children,
  highlight,
}: {
  children: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ display: 'flex', position: 'relative' }}>
        {highlight ? (
          <div
            style={{
              position: 'absolute',
              left: -6,
              right: -6,
              bottom: 14,
              height: 32,
              borderRadius: 8,
              backgroundColor: COLOR.accentLight,
            }}
          />
        ) : null}
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 400,
            fontSize: SITE_CARD_TITLE_SIZE,
            lineHeight: 1.18,
            color: COLOR.text,
            whiteSpace: 'nowrap',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** 사이트 OG 그림 (1200×630). `new ImageResponse(SiteOgCard(), { ...CARD, fonts })` */
export function SiteOgCard(): ReactElement {
  const [line1, line2] = SITE_CARD_TEXT.title;
  return (
    <CardFrame
      stage={
        <Stage
          world={1}
          ground={false}
          backdrop={
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={svgDataUri(siteMapSvg())}
              width={STAGE_W}
              height={STAGE_H}
              alt=""
              style={{ position: 'absolute', left: 0, top: 0 }}
            />
          }
          hero={{ id: 'pybaem', state: 'wave' }}
          heroSize={360}
          heroLeft={96}
        />
      }
    >
      <Kicker
        color={COLOR.primaryText}
        background={COLOR.primarySoft}
        icon={iconUri(glyphSvg('flag', COLOR.primaryText))}
      >
        {SITE_CARD_TEXT.kicker}
      </Kicker>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 30,
          width: TEXT_W,
        }}
      >
        <TitleLine>{line1}</TitleLine>
        <TitleLine highlight>{line2}</TitleLine>
      </div>
      <div
        style={{
          marginTop: 26,
          fontSize: 30,
          lineHeight: 1.4,
          color: COLOR.textMuted,
        }}
      >
        {SITE_CARD_TEXT.sub}
      </div>
    </CardFrame>
  );
}
