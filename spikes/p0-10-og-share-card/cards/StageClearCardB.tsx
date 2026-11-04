/**
 * 스테이지 클리어 카드: 시안 B(마법 그림책) 방향.
 * 크림색 종이 + 종이 결, 손으로 그린 테두리, 수채 번짐, 손그림 별, "참 잘했어요" 도장.
 * 제목은 Gaegu(손글씨), 본문은 Gowun Dodum.
 */
import { characterImg } from '../lib/characters';
import { handStars, paperBackground, scribbleUnderline, stampRing, watercolorWash, svg } from '../lib/decor';
import { svgDataUri } from '../lib/svg';
import { emWidth, fitText, fitTitle, normalizeNickname } from '../lib/text';
import { FONT_STACK } from '../lib/fontStack';
import type { CardData, RenderedCard } from './types';

const INK = '#3B3226';
const TERRA = '#C8553D';
const OLIVE = '#6B7A3A';

export function StageClearCardB(d: CardData, opts: { grain?: boolean } = {}): RenderedCard {
  const st = d.stage!;
  const nick = normalizeNickname(d.nickname);
  const nickFit = fitText(`${nick}의 모험 일지`, 430, { max: 30, min: 22, family: 'Gowun Dodum' });
  const nameFit = fitTitle(st.name, 640, { max: 112, min: 64, family: 'Gaegu' });
  const two = nameFit.lines.length > 1;
  const nameW = Math.min(660, Math.round(Math.max(...nameFit.lines.map((l) => emWidth(l, 'Gaegu'))) * nameFit.fontSize));
  const nameH = Math.round(nameFit.fontSize * 1.2 * nameFit.lines.length);
  const starSize = two ? 72 : 92;

  const bg = svgDataUri(paperBackground(11, { grain: opts.grain ?? false }));
  const wash = svgDataUri(watercolorWash(nameW + 160, nameH + 40, '#8EC5E8', 5));
  const underline = svgDataUri(scribbleUnderline(nameW, '#F2C14E', 9));
  const stars = svgDataUri(handStars(st.stars, st.maxStars, starSize, 21));
  const stamp = svgDataUri(stampRing(210, TERRA, 4));
  const pybaem = characterImg({ character: d.avatar.character, expression: d.avatar.expression ?? 'proud', size: 360, costumes: d.avatar.costumes });
  const puddle = svgDataUri(watercolorWash(440, 120, '#8FB86A', 3));
  const ribbon = svgDataUri(svg(40, 64, `<path d="M4 0 H36 V60 L20 48 L4 60Z" fill="${TERRA}"/><path d="M8 4 H32" stroke="#fff" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="3 4"/>`));

  const element = (
    <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: FONT_STACK.b.body, color: INK }}>
      <img src={bg} width={1200} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />

      {/* 책갈피 + 닉네임 */}
      <img src={ribbon} width={40} height={64} style={{ position: 'absolute', left: 84, top: 38 }} />
      <div style={{ position: 'absolute', left: 140, top: 62, display: 'flex', fontSize: nickFit.fontSize, color: '#7A5C3E', maxWidth: 460, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nickFit.text}
      </div>

      <div style={{ position: 'absolute', left: 92, top: 130, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: 720 }}>
        <div style={{ display: 'flex', fontFamily: FONT_STACK.b.title, fontSize: 42, color: OLIVE }}>
          {`${st.world} · 스테이지 ${st.no}`}
        </div>
        <div style={{ display: 'flex', position: 'relative', marginTop: 4 }}>
          <img src={wash} width={nameW + 160} height={nameH + 40} style={{ position: 'absolute', left: -80, top: -20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: FONT_STACK.b.title, fontSize: nameFit.fontSize, lineHeight: 1.2, color: INK }}>
            {nameFit.lines.map((l) => (
              <div key={l} style={{ display: 'flex', whiteSpace: 'nowrap' }}>{l}</div>
            ))}
          </div>
        </div>
        <img src={underline} width={nameW} height={28} style={{ marginTop: -14, marginLeft: 4 }} />
        <div style={{ display: 'flex', alignItems: 'center', marginTop: two ? 10 : 18 }}>
          <div style={{ display: 'flex', fontFamily: FONT_STACK.b.title, fontSize: two ? 66 : 86, color: TERRA, transform: 'rotate(-3deg)', marginRight: 26 }}>
            클리어!
          </div>
          <img src={stars} width={Math.ceil(starSize + 2 * starSize * 1.12 + 12)} height={starSize + 12} />
        </div>
        <div style={{ display: 'flex', fontSize: 30, marginTop: 10, color: '#5B4A36' }}>
          {st.stars >= st.maxStars ? `별 ${st.stars}개를 모두 모았어요. 다음 모험도 기대돼!` : `별 ${st.stars}개 획득! 다시 풀면 별을 더 모을 수 있어요.`}
        </div>
      </div>

      {/* 캐릭터 + 도장 */}
      <img src={puddle} width={440} height={120} style={{ position: 'absolute', left: 770, top: 442 }} />
      <img src={pybaem} width={360} height={360} style={{ position: 'absolute', left: 810, top: 196 }} />
      <div style={{ position: 'absolute', left: 742, top: 34, width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-14deg)' }}>
        <img src={stamp} width={210} height={210} style={{ position: 'absolute', left: 0, top: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONT_STACK.b.title, color: TERRA, opacity: 0.9 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>참</div>
          <div style={{ fontSize: 40, lineHeight: 1.05 }}>잘했어요</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 92, bottom: 52, display: 'flex', fontSize: 22, color: '#8C7458' }}>
        pyRoad 그림책 · 파이뱀과 함께 배우는 파이썬
      </div>
    </div>
  );

  return {
    element,
    families: ['Gaegu', 'Gowun Dodum'],
    text: `${nickFit.text} ${st.world} · 스테이지 ${st.no} ${nameFit.lines.join(' ')} 클리어! 별 ${st.stars}개를 모두 모았어요. 다음 모험도 기대돼! 획득 다시 풀면 별을 더 모을 수 있어요. 참 잘했어요 pyRoad 그림책 · 파이뱀과 함께 배우는 파이썬…`,
  };
}
