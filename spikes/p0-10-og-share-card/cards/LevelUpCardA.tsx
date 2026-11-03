/**
 * 레벨업 카드: 시안 A(모험 섬) 방향.
 * 비비드 파스텔 하늘·섬, 통통한 클레이 버튼(아래쪽 단단한 그림자), Jua 제목 + Pretendard 본문.
 * 1200×630. 카카오 스크랩은 800×400(2:1)으로 스마트 크롭하므로 핵심 요소는 위아래 20px 안쪽에 둡니다.
 */
import { characterImg } from '../lib/characters';
import { islandBackground, svg } from '../lib/decor';
import { svgDataUri } from '../lib/svg';
import { fitText, normalizeNickname } from '../lib/text';
import { FONT_STACK } from '../lib/fontStack';
import type { CardData, RenderedCard } from './types';

const INK = '#22324F';

export function LevelUpCardA(d: CardData): RenderedCard {
  const lv = d.level?.value ?? 1;
  const nick = normalizeNickname(d.nickname);
  const nickFit = fitText(nick, 500, { max: 64, min: 34, family: 'Jua' });
  const bg = svgDataUri(islandBackground(7, 'sky'));
  const pybaem = characterImg({
    character: d.avatar.character,
    expression: d.avatar.expression ?? 'celebrating',
    size: 400,
    costumes: d.avatar.costumes,
  });
  const star = characterImg({ character: 'byeolttongi', expression: 'sparkling', size: 170 });
  const shadow = svgDataUri(svg(320, 50, '<ellipse cx="160" cy="25" rx="140" ry="18" fill="#2E8F5E" opacity="0.35"/>'));
  const title = d.level?.title;

  const element = (
    <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: FONT_STACK.a.body, color: INK }}>
      <img src={bg} width={1200} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />

      {/* 로고 */}
      <div style={{ position: 'absolute', left: 56, top: 44, display: 'flex', alignItems: 'center', background: '#FFFFFF', borderRadius: 999, padding: '10px 22px 10px 14px', boxShadow: '0 6px 0 #BDE6F5' }}>
        <div style={{ width: 26, height: 26, borderRadius: 999, background: '#5ED69A', marginRight: 10, display: 'flex' }} />
        <div style={{ fontFamily: FONT_STACK.a.title, fontSize: 30, color: INK }}>pyRoad</div>
      </div>

      {/* 왼쪽: 텍스트 */}
      <div style={{ position: 'absolute', left: 64, top: 118, width: 620, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', transform: 'rotate(-4deg)', background: 'linear-gradient(180deg, #FF9A8B 0%, #FF6F61 100%)', color: '#FFFFFF', fontFamily: FONT_STACK.a.title, fontSize: 46, letterSpacing: 3, padding: '8px 30px 6px', borderRadius: 999, border: '5px solid #FFFFFF', boxShadow: '0 9px 0 #D9534F, 0 18px 24px rgba(34,50,79,0.18)' }}>
          LEVEL UP!
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 6, fontFamily: FONT_STACK.a.title, color: '#FFFFFF', WebkitTextStroke: `9px ${INK}`, textShadow: `0 10px 0 ${INK}` }}>
          <div style={{ fontSize: 84, lineHeight: 1, marginBottom: 26, marginRight: 8 }}>Lv.</div>
          <div style={{ fontSize: 196, lineHeight: 1 }}>{String(lv)}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 4, maxWidth: 620 }}>
          <div style={{ fontFamily: FONT_STACK.a.title, fontSize: nickFit.fontSize, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 520 }}>
            {nickFit.text}
          </div>
          <div style={{ fontWeight: 800, fontSize: 34, marginLeft: 8 }}>님,</div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 36, marginTop: 2 }}>{`레벨 ${lv} 달성을 축하해요!`}</div>

        {title ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, background: '#FFE36E', borderRadius: 22, padding: '10px 22px', border: '4px solid #FFFFFF', boxShadow: '0 7px 0 #E6B800' }}>
            <div style={{ fontWeight: 700, fontSize: 24, color: '#8A6400', marginRight: 12 }}>새 칭호</div>
            <div style={{ fontFamily: FONT_STACK.a.title, fontSize: 34, color: INK }}>{title}</div>
          </div>
        ) : null}
      </div>

      {/* 오른쪽: 캐릭터 */}
      <img src={shadow} width={320} height={50} style={{ position: 'absolute', left: 710, top: 478 }} />
      <img src={pybaem} width={400} height={400} style={{ position: 'absolute', left: 670, top: 172 }} />
      <img src={star} width={170} height={170} style={{ position: 'absolute', left: 996, top: 14, transform: 'rotate(12deg)' }} />

      {/* 아래 */}
      <div style={{ position: 'absolute', right: 40, bottom: 22, display: 'flex', fontWeight: 700, fontSize: 21, color: '#FFFFFF' }}>
        파이뱀과 함께하는 파이썬 모험
      </div>
    </div>
  );

  return {
    element,
    families: ['Jua', 'Pretendard'],
    text: `pyRoad LEVEL UP! Lv.${lv} ${nickFit.text} 님, 레벨 ${lv} 달성을 축하해요! 새 칭호 ${title ?? ''} 파이뱀과 함께하는 파이썬 모험…`,
  };
}
