/**
 * 스테이지 클리어 카드: 시안 A(모험 섬). B안과 같은 내용을 A 스타일로 그려 Phase 2 비교용으로 씁니다.
 */
import { characterImg } from '../lib/characters';
import { islandBackground, starPoints, svg } from '../lib/decor';
import { svgDataUri } from '../lib/svg';
import { fitText, fitTitle, normalizeNickname } from '../lib/text';
import { FONT_STACK } from '../lib/fontStack';
import type { CardData, RenderedCard } from './types';

const INK = '#22324F';

function chunkyStars(got: number, total: number, size: number): string {
  const gap = size * 1.05;
  const body = Array.from({ length: total }, (_, i) => {
    const cx = size / 2 + i * gap + 6, cy = size / 2 + (i === 1 ? 0 : size * 0.12) + 4;
    const R = (i === 1 ? size * 0.5 : size * 0.42);
    const on = i < got;
    return `<polygon points="${starPoints(cx, cy + size * 0.07, R)}" fill="${on ? '#E09A00' : '#7FA7C9'}" stroke="${on ? '#E09A00' : '#7FA7C9'}" stroke-width="${size * 0.12}" stroke-linejoin="round"/>
      <polygon points="${starPoints(cx, cy, R)}" fill="${on ? 'url(#g)' : '#D7ECFA'}" stroke="${on ? '#FFFFFF' : '#FFFFFF'}" stroke-width="${size * 0.1}" stroke-linejoin="round"/>
      ${on ? `<ellipse cx="${cx - R * 0.2}" cy="${cy - R * 0.25}" rx="${R * 0.22}" ry="${R * 0.12}" fill="#fff" opacity="0.7" transform="rotate(-25 ${cx} ${cy})"/>` : ''}`;
  }).join('');
  return svg(Math.ceil(size + (total - 1) * gap + 12), Math.ceil(size * 1.3), body,
    '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF07A"/><stop offset="1" stop-color="#FFC21A"/></linearGradient>');
}

export function StageClearCardA(d: CardData): RenderedCard {
  const st = d.stage!;
  const nick = normalizeNickname(d.nickname);
  const nameFit = fitTitle(st.name, 600, { max: 104, min: 60, family: 'Jua' });
  const two = nameFit.lines.length > 1;
  const nickFit = fitText(nick, 380, { max: 40, min: 26, family: 'Jua' });
  const starSize = two ? 96 : 120;
  const bg = svgDataUri(islandBackground(19, 'sky'));
  const shadow = svgDataUri(svg(320, 50, '<ellipse cx="160" cy="25" rx="140" ry="18" fill="#2E8F5E" opacity="0.35"/>'));
  const stars = svgDataUri(chunkyStars(st.stars, st.maxStars, starSize));
  const pybaem = characterImg({ character: d.avatar.character, expression: d.avatar.expression ?? 'proud', size: 400, costumes: d.avatar.costumes });
  const star = characterImg({ character: 'byeolttongi', expression: 'flying', size: 190 });

  const element = (
    <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: FONT_STACK.a.body, color: INK }}>
      <img src={bg} width={1200} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />

      <div style={{ position: 'absolute', left: 64, top: 52, width: 640, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', borderRadius: 999, padding: '8px 22px', boxShadow: '0 6px 0 #BDE6F5' }}>
          <div style={{ display: 'flex', fontWeight: 800, fontSize: 26, color: '#2FA9D6' }}>{st.world}</div>
          <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 99, background: '#BDE6F5', margin: '0 12px' }} />
          <div style={{ display: 'flex', fontWeight: 800, fontSize: 26 }}>{`스테이지 ${st.no}`}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22, fontFamily: FONT_STACK.a.title, fontSize: nameFit.fontSize, lineHeight: 1.1, color: '#FFFFFF', WebkitTextStroke: `8px ${INK}`, textShadow: `0 9px 0 ${INK}` }}>
          {nameFit.lines.map((l) => (
            <div key={l} style={{ display: 'flex', whiteSpace: 'nowrap' }}>{l}</div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 18, transform: 'rotate(-3deg)', background: 'linear-gradient(180deg, #7BE3B5 0%, #3FC48C 100%)', color: '#FFFFFF', fontFamily: FONT_STACK.a.title, fontSize: 52, letterSpacing: 2, padding: '6px 34px 4px', borderRadius: 999, border: '5px solid #FFFFFF', boxShadow: '0 9px 0 #2A9D6A, 0 18px 24px rgba(34,50,79,0.18)' }}>
          스테이지 클리어!
        </div>
        <img src={stars} width={Math.ceil(starSize + 2 * starSize * 1.05 + 12)} height={Math.ceil(starSize * 1.3)} style={{ marginTop: two ? 12 : 20, marginLeft: -6 }} />
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 6 }}>
          <div style={{ display: 'flex', fontFamily: FONT_STACK.a.title, fontSize: nickFit.fontSize, whiteSpace: 'nowrap' }}>{nickFit.text}</div>
          <div style={{ display: 'flex', fontWeight: 800, fontSize: 28, marginLeft: 6 }}>{`님이 별 ${st.stars}개를 모았어요!`}</div>
        </div>
      </div>

      <img src={shadow} width={320} height={50} style={{ position: 'absolute', left: 710, top: 478 }} />
      <img src={pybaem} width={400} height={400} style={{ position: 'absolute', left: 670, top: 172 }} />
      <img src={star} width={190} height={190} style={{ position: 'absolute', left: 990, top: 8 }} />
      <div style={{ position: 'absolute', right: 40, bottom: 22, display: 'flex', fontFamily: FONT_STACK.a.title, fontSize: 30, color: '#FFFFFF' }}>pyRoad</div>
    </div>
  );

  return {
    element,
    families: ['Jua', 'Pretendard'],
    text: `${st.world} 스테이지 ${st.no} ${nameFit.lines.join(' ')} 스테이지 클리어! ${nickFit.text} 님이 별 ${st.stars}개를 모았어요! pyRoad…`,
  };
}
