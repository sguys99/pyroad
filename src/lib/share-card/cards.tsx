/**
 * 공유 카드 4종 (P2-19): 레벨업 · 스테이지 클리어 · 업적 · 주간 성장. 데이터 → satori 엘리먼트(1200×630).
 * 화면 하나에 핵심 정보 하나만 크게(레벨 숫자·별·메달·퀘스트 수), 캐릭터 정지 그림이 주인공.
 * 레이아웃·제약은 `layout.tsx`, 색·크기는 `tokens.ts`, 글자 규칙은 `text.ts`.
 */
import type { ReactElement } from 'react';
import { COLOR } from '@/lib/design/tokens';
import {
  CardFrame,
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
  TEXT_W,
  TIER_COLOR,
  TIER_LABEL,
  TYPE,
  worldPalette,
} from './tokens';
import type {
  AchievementCardData,
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
          hero={{ id: 'pybaem', state: 'cheer', costume: d.avatar?.costume }}
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
          hero={{ id: 'pybaem', state: 'proud', costume: d.avatar?.costume }}
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
          hero={{ id: 'pybaem', state: 'happy', costume: d.avatar?.costume }}
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
  const learned = d.learned.map(cleanText).filter(Boolean);
  const shown = learned.slice(0, 3);
  const more = learned.length - shown.length;
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
          hero={{ id: 'pybaem', state: 'teach', costume: d.avatar?.costume }}
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
          icon={iconUri(glyphSvg('flame', COLOR.accentLip, 2.4))}
          value={d.streak}
          unit="일"
          label="연속 공부"
        />
      </div>
      {shown.length ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 18,
            width: TEXT_W,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: COLOR.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            배운 것
          </div>
          {shown.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                padding: '6px 16px',
                borderRadius: CARD_RADIUS.chip,
                backgroundColor: COLOR.surface2,
                fontSize: 24,
                color: COLOR.text,
                whiteSpace: 'nowrap',
              }}
            >
              {truncateEm(l, 6)}
            </div>
          ))}
          {more > 0 ? (
            <div
              style={{ fontSize: 24, color: COLOR.textMuted }}
            >{`+${more}`}</div>
          ) : null}
        </div>
      ) : null}
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
  }
}

/** "이미지 저장" 파일 이름 (P9-08 `Content-Disposition`) */
export const SHARE_CARD_FILENAME: Record<ShareCardData['kind'], string> = {
  levelup: 'pyroad-levelup.png',
  stage: 'pyroad-stage-clear.png',
  achievement: 'pyroad-achievement.png',
  weekly: 'pyroad-weekly.png',
};
