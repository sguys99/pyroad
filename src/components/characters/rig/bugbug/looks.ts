/**
 * 보스 버그버그 스테이지 외형 (P9-13). 리그 팔레트 덮어쓰기(`palette`) + 코스튬 모자(`costume`)만 써서 새 그림 없이 7종을 나눔.
 * 등딱지·더듬이 끝 색만 바꾸고 얼굴·볼터치는 그대로라 어느 색이어도 같은 "장난꾸러기 친구". 외곽선은 B(기본 스타일)의 몸색 진한 톤.
 */
import type { BossLook } from '@/lib/quest/boss';
import type { Costume } from '../costumes';
import type { BugBugPalette } from './Markup';

type Shell = Pick<
  BugBugPalette,
  'shell' | 'shellDark' | 'shellLight' | 'outline' | 'antTip'
>;

export const BOSS_LOOK: Record<
  BossLook,
  { palette?: Shell; costume?: Costume }
> = {
  // 1단계: 기본 빨간 무당벌레 그대로
  village: {},
  forest: {
    palette: {
      shell: '#6E9A4C',
      shellDark: '#4F7535',
      shellLight: '#93B972',
      outline: '#44662E',
      antTip: '#B5D38A',
    },
    costume: { hat: 'explorer' },
  },
  crossroad: {
    palette: {
      shell: '#D8963A',
      shellDark: '#AD7124',
      shellLight: '#EBB868',
      outline: '#8F5C1C',
      antTip: '#F2C57C',
    },
    costume: { hat: 'party' },
  },
  cave: {
    palette: {
      shell: '#7D62A8',
      shellDark: '#5C4785',
      shellLight: '#A189C6',
      outline: '#4C3A70',
      antTip: '#B9A3DD',
    },
  },
  lake: {
    palette: {
      shell: '#3F8EA6',
      shellDark: '#2D6C80',
      shellLight: '#6BB0C5',
      outline: '#255A6B',
      antTip: '#8CCBDC',
    },
  },
  tower: {
    palette: {
      shell: '#B45A80',
      shellDark: '#8C4062',
      shellLight: '#D07FA0',
      outline: '#763552',
      antTip: '#E3A0BB',
    },
    costume: { hat: 'wizard' },
  },
  kingdom: {
    palette: {
      shell: '#D4A62E',
      shellDark: '#A57F18',
      shellLight: '#E8C75F',
      outline: '#8A6912',
      antTip: '#F2D27A',
    },
    costume: { hat: 'crown' },
  },
};
