/**
 * 공유 카드 한 줄 요약 (P9-08): 공유 페이지 제목·축하 문구·og 제목·이미지 대체 글.
 * 카드 스냅샷(공개 정보: 닉네임 + 성과 숫자·이름)만 쓴다 — 쿼리 문자열·다른 값은 받지 않는다.
 */
import { cleanText } from './text';
import { TIER_LABEL } from './tokens';
import type { ShareCardData } from './types';

export interface ShareCardSummary {
  /** 축하 문구·og 제목: "파이뱀님이 레벨 7에 올랐어요!" */
  headline: string;
  /** 카드 그림 대체 글 (그림에 적힌 정보를 빠짐없이) */
  alt: string;
}

export function shareCardSummary(d: ShareCardData): ShareCardSummary {
  const nick = cleanText(d.nickname);
  switch (d.kind) {
    case 'levelup': {
      const headline = `${nick}님이 레벨 ${d.level}에 올랐어요!`;
      const title = d.title ? ` 새 칭호: ${cleanText(d.title)}.` : '';
      return {
        headline,
        alt: `레벨업 카드. ${nick}님 레벨 ${d.level} 달성!${title}`,
      };
    }
    case 'stage': {
      const name = `「${cleanText(d.stageName)}」 스테이지`;
      return {
        headline: `${nick}님이 ${name}를 깼어요!`,
        alt: `스테이지 클리어 카드. ${nick}님이 ${cleanText(d.worldName)} ${d.stageNo}번째 ${name}를 깼어요. 별 ${d.stars}개 / ${d.maxStars ?? 3}개.`,
      };
    }
    case 'achievement': {
      const name = cleanText(d.name);
      return {
        headline: `${nick}님이 「${name}」 업적을 받았어요!`,
        alt: `업적 카드. ${nick}님이 ${TIER_LABEL[d.tier]} 업적 「${name}」 메달을 받았어요. ${cleanText(d.desc)}`,
      };
    }
    case 'weekly': {
      const week = cleanText(d.weekLabel);
      return {
        headline: `${nick}님은 ${week}에 퀘스트 ${d.quests}개를 끝냈어요!`,
        alt: `주간 성장 카드. ${nick}님의 ${week}: 퀘스트 ${d.quests}개, ${d.xp} XP, 별 ${d.stars}개.`,
      };
    }
  }
}
