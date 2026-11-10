/**
 * 공유 카드 샘플 데이터 (P2-19): 렌더 스크립트(`scripts/share-card/render-samples.tsx`)·테스트·P2-12 카탈로그용.
 * 닉네임은 지어낸 예시다(실제 아이 정보 아님). 대표 상태: 긴 닉네임(10자)·긴 제목(2줄)·빈 별·티어 3종·월드 1/2/3
 */
import type { ShareCardData } from './types';

export interface ShareCardSample {
  /** 파일 이름 (docs/design/img/share-card/<id>.png) */
  id: string;
  note: string;
  data: ShareCardData;
}

export const SHARE_CARD_SAMPLES: ShareCardSample[] = [
  {
    id: 'levelup',
    note: '레벨업 기본 (새 칭호, 월드 1)',
    data: {
      kind: 'levelup',
      nickname: '코딩왕민준',
      level: 12,
      title: '리스트 정리왕',
    },
  },
  {
    id: 'levelup-long',
    note: '레벨업 긴 닉네임 10자 + 세 자리 레벨 + 코스튬, 월드 3',
    data: {
      kind: 'levelup',
      nickname: '파이썬마스터김하늘별',
      level: 128,
      world: 3,
      avatar: { costume: { hat: 'explorer' } },
    },
  },
  {
    id: 'stage-w1-3stars',
    note: '스테이지 클리어 별 3개, 월드 1',
    data: {
      kind: 'stage',
      nickname: '코딩왕민준',
      world: 1,
      worldName: '숲 마을',
      stageNo: 3,
      stageName: '반복문 숲길',
      stars: 3,
    },
  },
  {
    id: 'stage-w2-long-1star',
    note: '스테이지 클리어 긴 제목(2줄) + 빈 별 2개, 월드 2',
    data: {
      kind: 'stage',
      nickname: 'Minjun2016',
      world: 2,
      worldName: '바다 여행',
      stageNo: 12,
      stageName: '리스트와 딕셔너리로 보물 지도 정리하기 대작전',
      stars: 1,
    },
  },
  {
    id: 'stage-w3-0stars',
    note: '스테이지 클리어 별 0개(모두 빈 별) + 긴 닉네임, 월드 3',
    data: {
      kind: 'stage',
      nickname: '발명가하늘이와친구들',
      world: 3,
      worldName: '발명가의 공방',
      stageNo: 5,
      stageName: '함수 공장',
      stars: 0,
    },
  },
  {
    id: 'achievement-gold',
    note: '업적 골드 (버그 업적 → 버그버그 손님)',
    data: {
      kind: 'achievement',
      nickname: '코딩왕민준',
      name: '에러 극복왕',
      desc: '에러를 10번 고치고 다시 도전했어요',
      tier: 'gold',
      icon: 'bug',
    },
  },
  {
    id: 'achievement-silver',
    note: '업적 실버, 월드 2',
    data: {
      kind: 'achievement',
      nickname: '하늘별',
      name: '7일 연속 공부',
      desc: '일주일 동안 하루도 빠지지 않고 퀘스트를 풀었어요',
      tier: 'silver',
      icon: 'flame',
      world: 2,
    },
  },
  {
    id: 'achievement-bronze-long',
    note: '업적 브론즈 + 긴 이름(2줄)·긴 설명(2줄 말줄임) + 긴 닉네임',
    data: {
      kind: 'achievement',
      nickname: '파이썬마스터김하늘별',
      name: '힌트 없이 끝까지 풀어낸 끈기 있는 탐험가',
      desc: '힌트를 한 번도 열지 않고 스테이지 하나를 모두 풀었어요. 스스로 생각하는 힘이 쑥쑥 자라고 있어요!',
      tier: 'bronze',
      icon: 'bulb',
      world: 3,
    },
  },
  {
    id: 'weekly',
    note: '주간 성장 (집계 숫자만, 배운 것 3개 + 더 있음)',
    data: {
      kind: 'weekly',
      nickname: '코딩왕민준',
      weekLabel: '11월 첫째 주',
      quests: 12,
      stars: 31,
      streak: 5,
      learned: ['print', '변수', '반복문', '조건문'],
    },
  },
  {
    id: 'weekly-long',
    note: '주간 성장 긴 닉네임 + 큰 숫자, 월드 2',
    data: {
      kind: 'weekly',
      nickname: '파이썬마스터김하늘별',
      weekLabel: '12월 셋째 주',
      quests: 108,
      stars: 256,
      streak: 21,
      learned: ['딕셔너리', '함수'],
      world: 2,
    },
  },
];
