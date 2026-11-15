/**
 * 공유 카드 4종 (P2-19): 레벨업 · 스테이지 클리어 · 업적 · 주간 성장. 데이터 → satori 엘리먼트(1200×630).
 * 화면 하나에 핵심 정보 하나만 크게(레벨 숫자·별·메달·퀘스트 수), 캐릭터 정지 그림이 주인공.
 * 레이아웃·제약은 `layout.tsx`, 색·크기는 `tokens.ts`, 글자 규칙은 `text.ts`.
 */
import type { ReactElement } from 'react';
import { blend, COLOR } from '@/lib/design/tokens';
import { characterUri } from './characters';
import {
  CardFrame,
  STAGE_H,
  Digits,
  Kicker,
  NicknameLine,
  Stage,
  StarRow,
  StatTile,
} from './layout';
import { glyphSvg, iconUri, medalSvg, starSvg, tierPipsSvg } from './icons';
import { cleanText, fitLine, fitNumberRow, fitTitle, truncateEm } from './text';
import {
  CARD_RADIUS,
  FONT,
  STAGE_W,
  TEXT_W,
  TIER_COLOR,
  TIER_LABEL,
  TYPE,
  worldPalette,
} from './tokens';
import type {
  AchievementCardData,
  CreationCardData,
  LevelUpCardData,
  ShareCardData,
  StageClearCardData,
  WeeklyCardData,
} from './types';

/** 닉네임 뒤에 붙는 말. 10자 닉네임과 한 줄에 들어가야 한다(테스트가 확인) */
export const NICKNAME_SUFFIX: Record<ShareCardData['kind'], string> = {
  levelup: '님이',
  stage: '님이 깼어요',
  achievement: '님이 받았어요',
  weekly: '님은 이번 주',
  creation: '님이 만들었어요',
};

const heroText = {
  fontFamily: FONT.display,
  fontWeight: 400,
  lineHeight: 1,
  color: COLOR.text,
} as const;

export function LevelUpCard(d: LevelUpCardData) {
  const world = d.world ?? 1;
  const title = d.title ? cleanText(d.title) : '';
  const heroSize = fitNumberRow(d.level, TEXT_W, {
    max: TYPE.hero,
    unitSize: TYPE.heroUnit,
    before: '레벨',
    after: '달성!',
    gap: 14,
  });
  return (
    <CardFrame
      stage={
        <Stage
          world={world}
          hero={{
            id: 'pybaem',
            state: 'cheer',
            costume: d.avatar?.costume,
            skin: d.avatar?.skin,
          }}
          guest={{ id: 'byeolttongi', state: 'sparkle' }}
        />
      }
    >
      <Kicker color={COLOR.primaryText} background={COLOR.primarySoft}>
        레벨 업!
      </Kicker>
      <NicknameLine nickname={d.nickname} suffix={NICKNAME_SUFFIX.levelup} />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 14,
          marginTop: 14,
        }}
      >
        <div
          style={{ ...heroText, fontSize: TYPE.heroUnit, paddingBottom: 14 }}
        >
          레벨
        </div>
        <Digits value={d.level} size={heroSize} color={COLOR.primaryText} />
        <div
          style={{ ...heroText, fontSize: TYPE.heroUnit, paddingBottom: 14 }}
        >
          달성!
        </div>
      </div>
      {title ? (
        <div style={{ display: 'flex', marginTop: 26 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              maxWidth: TEXT_W,
              padding: '14px 24px',
              borderRadius: CARD_RADIUS.tile,
              backgroundColor: COLOR.accentSoft,
            }}
          >
            <div style={{ fontSize: TYPE.body, color: COLOR.accentText }}>
              새 칭호
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 40,
                color: COLOR.text,
                whiteSpace: 'nowrap',
              }}
            >
              {truncateEm(title, (TEXT_W - 200) / 40, 'display')}
            </div>
          </div>
        </div>
      ) : null}
    </CardFrame>
  );
}

export function StageClearCard(d: StageClearCardData) {
  const w = worldPalette(d.world);
  const max = d.maxStars ?? 3;
  const title = fitTitle(d.stageName, TEXT_W, TYPE.title);
  const kicker = fitLine(
    `${d.world}권 ${cleanText(d.worldName)} · 스테이지 ${d.stageNo}`,
    TEXT_W - 60,
    { max: TYPE.kicker, min: TYPE.kicker, font: 'sans' },
  ).text;
  return (
    <CardFrame
      stage={
        <Stage
          world={d.world}
          hero={{
            id: 'pybaem',
            state: 'proud',
            costume: d.avatar?.costume,
            skin: d.avatar?.skin,
          }}
        />
      }
    >
      <Kicker color={w.ink} background={COLOR.surface}>
        {kicker}
      </Kicker>
      <div
        style={{
          display: 'block',
          marginTop: 24,
          width: TEXT_W,
          fontFamily: FONT.display,
          fontWeight: 400,
          fontSize: title.fontSize,
          lineHeight: 1.18,
          color: COLOR.text,
          lineClamp: 2,
          overflow: 'hidden',
        }}
      >
        {title.text}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          marginTop: 26,
        }}
      >
        <StarRow
          count={d.stars}
          max={max}
          size={title.lines === 2 ? 84 : 100}
        />
      </div>
      <NicknameLine
        nickname={d.nickname}
        suffix={NICKNAME_SUFFIX.stage}
        marginTop={24}
      />
    </CardFrame>
  );
}

export function AchievementCard(d: AchievementCardData) {
  const t = TIER_COLOR[d.tier];
  const title = fitTitle(d.name, TEXT_W - 180, {
    max: 72,
    oneLineMin: 56,
    max2: 56,
    min: 44,
  });
  const desc = truncateEm(
    cleanText(d.desc),
    ((TEXT_W - 10) / TYPE.body) * 2 * 0.9,
  );
  // 에러·버그 업적은 버그버그가 "화해" 얼굴로 함께 (성장 마인드셋, P0-10 §4.1)
  const guest =
    d.icon === 'bug' ? ({ id: 'bugbug', state: 'makeup' } as const) : undefined;
  return (
    <CardFrame
      stage={
        <Stage
          world={d.world ?? 1}
          hero={{
            id: 'pybaem',
            state: 'happy',
            costume: d.avatar?.costume,
            skin: d.avatar?.skin,
          }}
          guest={guest}
        />
      }
    >
      <Kicker color={t.ink} background={t.soft}>
        {`업적 달성 · ${TIER_LABEL[d.tier]}`}
      </Kicker>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            width: 164,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUri(medalSvg(d.tier, d.icon))}
            width={160}
            height={176}
            alt=""
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUri(tierPipsSvg(d.tier))}
            width={91}
            height={28}
            alt=""
          />
        </div>
        <div
          style={{
            display: 'block',
            width: TEXT_W - 180,
            fontFamily: FONT.display,
            fontWeight: 400,
            fontSize: title.fontSize,
            lineHeight: 1.18,
            color: COLOR.text,
            lineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {title.text}
        </div>
      </div>
      <div
        style={{
          display: 'block',
          marginTop: 16,
          width: TEXT_W,
          fontSize: TYPE.body,
          lineHeight: 1.4,
          color: COLOR.textMuted,
          lineClamp: 2,
          overflow: 'hidden',
        }}
      >
        {desc}
      </div>
      <NicknameLine
        nickname={d.nickname}
        suffix={NICKNAME_SUFFIX.achievement}
        marginTop={18}
      />
    </CardFrame>
  );
}

export function WeeklyCard(d: WeeklyCardData) {
  const heroSize = fitNumberRow(d.quests, TEXT_W, {
    max: 124,
    unitSize: TYPE.heroUnit,
    before: '퀘스트',
    after: '개',
    gap: 16,
  });
  return (
    <CardFrame
      stage={
        <Stage
          world={d.world ?? 1}
          hero={{
            id: 'pybaem',
            state: 'teach',
            costume: d.avatar?.costume,
            skin: d.avatar?.skin,
          }}
        />
      }
    >
      <Kicker color={COLOR.primaryText} background={COLOR.primarySoft}>
        {
          fitLine(`이번 주 성장 · ${cleanText(d.weekLabel)}`, TEXT_W - 60, {
            max: TYPE.kicker,
            min: TYPE.kicker,
          }).text
        }
      </Kicker>
      <NicknameLine
        nickname={d.nickname}
        suffix={NICKNAME_SUFFIX.weekly}
        marginTop={22}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 16,
          marginTop: 6,
        }}
      >
        <div
          style={{ ...heroText, fontSize: TYPE.heroUnit, paddingBottom: 10 }}
        >
          퀘스트
        </div>
        <Digits value={d.quests} size={heroSize} color={COLOR.primaryText} />
        <div
          style={{ ...heroText, fontSize: TYPE.heroUnit, paddingBottom: 10 }}
        >
          개
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 22, width: TEXT_W }}>
        <StatTile
          icon={iconUri(starSvg(true))}
          value={d.stars}
          unit="개"
          label="모은 별"
        />
        <StatTile
          icon={iconUri(glyphSvg('bolt', COLOR.accentLip, 2.4))}
          value={d.xp}
          unit="XP"
          label="얻은 경험치"
        />
      </div>
    </CardFrame>
  );
}

/** 박람회 삼각 깃발 줄 (갤러리 `/gallery` 배너와 같은 네 색) */
function buntingSvg(): string {
  const colors = [
    COLOR.accent,
    COLOR.w3Brick,
    COLOR.w3Blueprint,
    COLOR.primaryBright,
  ];
  const flags = Array.from({ length: 9 }, (_, i) => {
    const x = 18 + i * 54;
    return `<path d="M${x} 12 L${x + 40} 12 L${x + 20} 44 Z" fill="${colors[i % 4]}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 52"><path d="M0 8 Q250 22 500 8" fill="none" stroke="${COLOR.w3Ink}" stroke-width="3"/>${flags}</svg>`;
}

/** 학생이 쓴 글자(작품 이름·대화)의 그림 문자는 뺀다: 카드 폰트에 이모지가 없다(외부 이모지 CDN 도 쓰지 않음, P0-10 §4.5) */
const noEmoji = (t: string) =>
  cleanText(t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ''));

const FRAME = { left: 34, top: 74, size: 356, border: 18 } as const;
const ART = FRAME.size - FRAME.border * 2 - 16;

/** 액자 안: 그림(썸네일) · 대화 말풍선 · 그림이 없으면 별 */
function CreationArt({ d }: { d: CreationCardData }) {
  if (d.lines?.length) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 8,
          width: ART,
          height: ART,
          padding: '0 6px',
        }}
      >
        {d.lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'block',
              alignSelf: l.answer ? 'flex-end' : 'flex-start',
              maxWidth: ART - 24,
              padding: '8px 14px',
              borderRadius: l.answer
                ? '18px 18px 4px 18px'
                : '18px 18px 18px 4px',
              backgroundColor: l.answer ? COLOR.primary : COLOR.surface2,
              color: l.answer ? COLOR.onPrimary : COLOR.text,
              fontSize: 21,
              lineHeight: 1.25,
              lineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {/* 2줄 분량에서 자름 (낱말 경계 손실은 fitTitle 처럼 90%로 어림) */}
            {truncateEm(noEmoji(l.text), ((ART - 52) / 21) * 2 * 0.9)}
          </div>
        ))}
      </div>
    );
  }
  return d.thumbnail ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={d.thumbnail}
      width={ART}
      height={ART}
      alt=""
      style={{ objectFit: 'contain' }}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={iconUri(starSvg(true))} width={140} height={140} alt="" />
  );
}

/**
 * 작품 카드 (P11-08): 왼쪽 무대 = 메이커 박람회 벽(3월드 모래 벽 + 삼각 깃발) 위 압정 꽂은 액자, 안에 작품(그림 또는 대화 앞 4줄),
 * 파이뱀이 액자 옆에서 자랑. 오른쪽 = 출품작 이름표(작품 이름 크게 + 닉네임). 코드는 그리지 않는다
 */
export function CreationCard(d: CreationCardData) {
  const w = worldPalette(3);
  const title = fitTitle(noEmoji(d.name) || '내 작품', TEXT_W, TYPE.title);
  const heroSize = 190;
  return (
    <CardFrame
      stage={
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
          {/* 바닥 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 86,
              backgroundColor: w.ground,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUri(buntingSvg())}
            width={STAGE_W}
            height={52}
            alt=""
            style={{ position: 'absolute', left: 0, top: 10 }}
          />
          {/* 액자 아랫면 (그림자 대신 단색 도형, satori 제약) */}
          <div
            style={{
              position: 'absolute',
              left: FRAME.left,
              top: FRAME.top + 8,
              width: FRAME.size,
              height: FRAME.size,
              borderRadius: CARD_RADIUS.tile,
              backgroundColor: blend(COLOR.w3Ink, w.tint, 0.35),
            }}
          />
          {/* 액자: 나무 틀(3월드 모래색) → 흰 도화지 → 작품 */}
          <div
            style={{
              position: 'absolute',
              left: FRAME.left,
              top: FRAME.top,
              width: FRAME.size,
              height: FRAME.size,
              display: 'flex',
              padding: FRAME.border,
              borderRadius: CARD_RADIUS.tile,
              backgroundColor: w.tint,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: COLOR.surface,
              }}
            >
              <CreationArt d={d} />
            </div>
          </div>
          {/* 압정 (아랫면 + 머리) */}
          <div
            style={{
              position: 'absolute',
              left: FRAME.left + FRAME.size / 2 - 14,
              top: FRAME.top - 8,
              width: 28,
              height: 28,
              borderRadius: 9999,
              backgroundColor: COLOR.accentLip,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: FRAME.left + FRAME.size / 2 - 14,
              top: FRAME.top - 12,
              width: 28,
              height: 28,
              borderRadius: 9999,
              backgroundColor: COLOR.w3Brick,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={characterUri(
              {
                id: 'pybaem',
                state: 'proud',
                costume: d.avatar?.costume,
                skin: d.avatar?.skin,
              },
              'card-hero-',
            )}
            width={heroSize}
            height={heroSize}
            alt=""
            style={{
              position: 'absolute',
              left: STAGE_W - heroSize + 14,
              bottom: -4,
            }}
          />
        </div>
      }
    >
      <Kicker color={w.ink} background={COLOR.surface}>
        메이커 박람회 출품작
      </Kicker>
      <div
        style={{
          display: 'block',
          marginTop: 24,
          width: TEXT_W,
          fontFamily: FONT.display,
          fontWeight: 400,
          fontSize: title.fontSize,
          lineHeight: 1.18,
          color: COLOR.text,
          lineClamp: 2,
          overflow: 'hidden',
        }}
      >
        {title.text}
      </div>
      <NicknameLine
        nickname={d.nickname}
        suffix={NICKNAME_SUFFIX.creation}
        marginTop={24}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 18,
          fontSize: TYPE.body,
          color: COLOR.textMuted,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUri(glyphSvg('code', w.ink))}
          width={34}
          height={34}
          alt=""
        />
        {d.lines?.length
          ? '파이썬으로 만든 대화 프로그램'
          : '파이썬 거북이로 그린 그림'}
      </div>
    </CardFrame>
  );
}

/** 데이터 → 카드 엘리먼트 */
export function renderShareCard(d: ShareCardData): ReactElement {
  switch (d.kind) {
    case 'levelup':
      return <LevelUpCard {...d} />;
    case 'stage':
      return <StageClearCard {...d} />;
    case 'achievement':
      return <AchievementCard {...d} />;
    case 'weekly':
      return <WeeklyCard {...d} />;
    case 'creation':
      return <CreationCard {...d} />;
  }
}

/** "이미지 저장" 파일 이름 (P9-08 `Content-Disposition`) */
export { SHARE_CARD_FILENAME } from './share';
