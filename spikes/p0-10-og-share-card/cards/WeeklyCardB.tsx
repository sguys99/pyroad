/**
 * 주간 성장 카드 "부모님께 자랑하기": 시안 B(마법 그림책).
 * 요일별 퀘스트 수(손그림 막대), 스티커형 통계 3개, 이번 주 배운 개념, 파이뱀 말풍선.
 * 공개 정보 원칙: 닉네임 + 캐릭터 + 집계 숫자만. 학습 시각(몇 시에 했는지), 학교·학년은 넣지 않습니다.
 */
import { characterImg } from '../lib/characters';
import { blobPath, handBars, paperBackground, svg, wobblyRectPath } from '../lib/decor';
import { svgDataUri } from '../lib/svg';
import { fitText, normalizeNickname } from '../lib/text';
import { FONT_STACK } from '../lib/fontStack';
import type { CardData, RenderedCard } from './types';

const INK = '#3B3226';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

function sticker(color: string, seed: number): string {
  return svgDataUri(svg(150, 150, `<path d="${blobPath(75, 77, 66, 0.12, seed, 10)}" fill="${color}" opacity="0.55"/><path d="${blobPath(75, 75, 64, 0.1, seed + 9, 10)}" fill="none" stroke="#5B4321" stroke-width="3"/>`));
}

export function WeeklyCardB(d: CardData): RenderedCard {
  const w = d.weekly!;
  const nick = normalizeNickname(d.nickname);
  const nickFit = fitText(`${nick}의`, 420, { max: 40, min: 26, family: 'Gaegu' });
  const bg = svgDataUri(paperBackground(23));
  const bars = svgDataUri(handBars(w.days, 420, 150, 31));
  const pybaem = characterImg({ character: d.avatar.character, expression: d.avatar.expression ?? 'encouraging', size: 250, costumes: d.avatar.costumes });
  const star = characterImg({ character: 'byeolttongi', expression: 'landing', size: 110 });
  const bubble = svgDataUri(svg(330, 150, `<path d="${wobblyRectPath(8, 8, 314, 104, 4, 77)}" fill="#FFFDF6" stroke="#5B4321" stroke-width="3"/><path d="M200 110 L190 146 L232 110Z" fill="#FFFDF6" stroke="#5B4321" stroke-width="3" stroke-linejoin="round"/><path d="M196 108 H236" stroke="#FFFDF6" stroke-width="6"/>`));
  const panel = svgDataUri(svg(500, 270, `<path d="${wobblyRectPath(6, 6, 488, 258, 5, 41)}" fill="#FFFDF6" fill-opacity="0.7" stroke="#7A5C3E" stroke-width="2.5"/>`));

  const stats: { label: string; value: string; color: string }[] = [
    { label: '퀘스트', value: `${w.quests}개`, color: '#8EC5E8' },
    { label: '모은 별', value: `${w.stars}개`, color: '#F2C14E' },
    { label: '연속 출석', value: `${w.streak}일`, color: '#E99A7A' },
  ];

  const element = (
    <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: FONT_STACK.b.body, color: INK }}>
      <img src={bg} width={1200} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />

      {/* 제목 */}
      <div style={{ position: 'absolute', left: 84, top: 54, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', fontFamily: FONT_STACK.b.title, fontSize: nickFit.fontSize, color: '#7A5C3E', whiteSpace: 'nowrap' }}>{nickFit.text}</div>
          <div style={{ display: 'flex', fontSize: 24, color: '#8C7458', marginLeft: 16 }}>{w.range}</div>
        </div>
        <div style={{ display: 'flex', fontFamily: FONT_STACK.b.title, fontSize: 76, lineHeight: 1.05, color: INK }}>이번 주 성장 일기</div>
      </div>

      {/* 왼쪽: 막대 그래프 */}
      <img src={panel} width={500} height={270} style={{ position: 'absolute', left: 74, top: 210 }} />
      <div style={{ position: 'absolute', left: 104, top: 226, display: 'flex', fontFamily: FONT_STACK.b.title, fontSize: 30, color: '#6B7A3A' }}>요일별 푼 퀘스트</div>
      <img src={bars} width={420} height={154} style={{ position: 'absolute', left: 114, top: 272 }} />
      <div style={{ position: 'absolute', left: 114, top: 430, width: 420, display: 'flex' }}>
        {DAYS.map((day) => (
          <div key={day} style={{ width: 60, display: 'flex', justifyContent: 'center', fontSize: 22, color: '#5B4A36' }}>{day}</div>
        ))}
      </div>

      {/* 가운데: 스티커 통계 */}
      <div style={{ position: 'absolute', left: 600, top: 206, display: 'flex' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ width: 150, height: 150, marginRight: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', transform: `rotate(${[-4, 3, -2][i]}deg)` }}>
            <img src={sticker(s.color, 60 + i)} width={150} height={150} style={{ position: 'absolute', left: 0, top: 0 }} />
            <div style={{ display: 'flex', fontSize: 22, color: '#5B4A36' }}>{s.label}</div>
            <div style={{ display: 'flex', fontFamily: FONT_STACK.b.title, fontSize: 50, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 배운 것 */}
      <div style={{ position: 'absolute', left: 604, top: 384, width: 520, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontFamily: FONT_STACK.b.title, fontSize: 30, color: '#6B7A3A' }}>이번 주에 배운 것</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 8 }}>
          {w.learned.slice(0, 4).map((t) => (
            <div key={t} style={{ display: 'flex', fontSize: 25, padding: '6px 16px', marginRight: 10, marginBottom: 8, borderRadius: 14, border: '2.5px dashed #7A5C3E', background: 'rgba(255,253,246,0.8)' }}>{t}</div>
          ))}
        </div>
      </div>

      {/* 파이뱀 말풍선 */}
      <img src={bubble} width={330} height={150} style={{ position: 'absolute', left: 820, top: 36 }} />
      <div style={{ position: 'absolute', left: 836, top: 50, width: 298, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: FONT_STACK.b.title, fontSize: 31, lineHeight: 1.1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex' }}>꾸준히 하는 모습이</div>
          <div style={{ display: 'flex' }}>정말 멋져요!</div>
        </div>
      </div>
      <img src={pybaem} width={215} height={215} style={{ position: 'absolute', left: 985, top: 392 }} />
      <img src={star} width={104} height={104} style={{ position: 'absolute', left: 1078, top: 296, transform: 'rotate(10deg)' }} />

      <div style={{ position: 'absolute', left: 84, bottom: 50, display: 'flex', fontSize: 21, color: '#8C7458' }}>
        pyRoad · 초등학생을 위한 파이썬 모험
      </div>
    </div>
  );

  return {
    element,
    families: ['Gaegu', 'Gowun Dodum'],
    text: `${nickFit.text} ${w.range} 이번 주 성장 일기 요일별 푼 퀘스트 ${DAYS.join('')} 퀘스트 모은 별 연속 출석 ${w.quests}개 ${w.stars}개 ${w.streak}일 이번 주에 배운 것 ${w.learned.join(' ')} 꾸준히 하는 모습이 정말 멋져요! pyRoad · 초등학생을 위한 파이썬 모험…`,
  };
}
