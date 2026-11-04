/**
 * 업적 획득 카드: 시안 A 계열(노을 팔레트). 성장 마인드셋 업적("에러 극복")에 버그버그를 함께 둡니다.
 * 메달은 티어(브론즈·실버·골드)별 그라디언트 + Lucide 아이콘 path.
 */
import { characterImg } from '../lib/characters';
import { LUCIDE, medal, sunburst, svg, rng } from '../lib/decor';
import { svgDataUri } from '../lib/svg';
import { fitText, normalizeNickname } from '../lib/text';
import { FONT_STACK } from '../lib/fontStack';
import type { CardData, RenderedCard } from './types';

const INK = '#2D2A4A';
const TIER_LABEL = { bronze: '브론즈', silver: '실버', gold: '골드' } as const;
const TIER_COLOR = { bronze: '#C9773A', silver: '#7A8797', gold: '#D99A00' } as const;

function sparkles(seed: number): string {
  const r = rng(seed);
  const items = Array.from({ length: 18 }, (_, i) => {
    const x = r() * 1200, y = r() * 630, s = 6 + r() * 12;
    const c = ['#FFFFFF', '#FFE36E', '#FF9FD0'][i % 3];
    return `<path d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z" fill="${c}" opacity="0.9"/>`;
  }).join('');
  return svg(1200, 630, items);
}

export function AchievementCardA(d: CardData): RenderedCard {
  const a = d.achievement!;
  const nick = normalizeNickname(d.nickname);
  const nameFit = fitText(a.name, 560, { max: 104, min: 56, family: 'Jua' });
  const nickFit = fitText(nick, 380, { max: 36, min: 24, family: 'Jua' });
  const rays = svgDataUri(sunburst(620, 24, '#FFFFFF', 0.28));
  const med = svgDataUri(medal(330, a.tier, LUCIDE[a.icon]));
  const bug = characterImg({ character: 'bugbug', expression: d.avatar.expression ?? 'fixed', size: 230 });
  const spark = svgDataUri(sparkles(3));
  const bubble = svgDataUri(svg(250, 110, '<path d="M14 8 H236 Q246 8 246 18 V70 Q246 80 236 80 H120 L96 104 L98 80 H14 Q4 80 4 70 V18 Q4 8 14 8Z" fill="#fff" stroke="#2D2A4A" stroke-width="4"/>'));

  const element = (
    <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: FONT_STACK.a.body, color: INK, background: 'linear-gradient(135deg, #B7A6FF 0%, #FFB8D2 55%, #FFE2A0 100%)' }}>
      <img src={spark} width={1200} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />
      <img src={rays} width={620} height={620} style={{ position: 'absolute', left: -20, top: 5 }} />
      <img src={med} width={330} height={330} style={{ position: 'absolute', left: 125, top: 130, transform: 'rotate(-6deg)' }} />

      <div style={{ position: 'absolute', left: 600, top: 70, width: 560, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', transform: 'rotate(-3deg)', background: 'linear-gradient(180deg, #8C7CFF 0%, #6A55F0 100%)', color: '#FFFFFF', fontFamily: FONT_STACK.a.title, fontSize: 42, letterSpacing: 2, padding: '6px 28px 4px', borderRadius: 999, border: '5px solid #FFFFFF', boxShadow: '0 8px 0 #4B3BC2, 0 16px 22px rgba(45,42,74,0.2)' }}>
          업적 획득!
        </div>
        <div style={{ display: 'flex', marginTop: 22, fontFamily: FONT_STACK.a.title, fontSize: nameFit.fontSize, lineHeight: 1.1, color: '#FFFFFF', WebkitTextStroke: `8px ${INK}`, textShadow: `0 9px 0 ${INK}`, whiteSpace: 'nowrap' }}>
          {nameFit.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
          <div style={{ display: 'flex', background: '#FFFFFF', color: TIER_COLOR[a.tier], fontWeight: 800, fontSize: 26, padding: '6px 18px', borderRadius: 999, boxShadow: `0 5px 0 ${TIER_COLOR[a.tier]}` }}>
            {`${TIER_LABEL[a.tier]} 업적`}
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontWeight: 700, fontSize: 32, lineHeight: 1.35, maxWidth: 540 }}>{a.desc}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 16 }}>
          <div style={{ display: 'flex', fontFamily: FONT_STACK.a.title, fontSize: nickFit.fontSize, whiteSpace: 'nowrap' }}>{nickFit.text}</div>
          <div style={{ display: 'flex', fontWeight: 800, fontSize: 26, marginLeft: 6 }}>님의 새 업적</div>
        </div>
      </div>

      <img src={bubble} width={250} height={110} style={{ position: 'absolute', left: 750, top: 486 }} />
      <div style={{ position: 'absolute', left: 750, top: 502, width: 250, display: 'flex', justifyContent: 'center', fontFamily: FONT_STACK.a.title, fontSize: 34 }}>버그 잡았다!</div>
      <img src={bug} width={230} height={230} style={{ position: 'absolute', left: 970, top: 396 }} />
      <div style={{ position: 'absolute', left: 48, bottom: 26, display: 'flex', fontFamily: FONT_STACK.a.title, fontSize: 30, color: '#FFFFFF' }}>pyRoad</div>
    </div>
  );

  return {
    element,
    families: ['Jua', 'Pretendard'],
    text: `업적 획득! ${nameFit.text} ${TIER_LABEL[a.tier]} 업적 ${a.desc} ${nickFit.text} 님의 새 업적 버그 잡았다! pyRoad…`,
  };
}
