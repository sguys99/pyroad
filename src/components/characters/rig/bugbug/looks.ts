/**
 * 보스 버그버그 스테이지 외형 (P9-13). 리그 팔레트 덮어쓰기(`palette`) + 코스튬 모자(`costume`)만 써서 새 그림 없이 7종을 나눔.
 * 2월드 7종(P10-04)은 바다 소품(`costume.gear`, `gear.tsx`)을 더함: 산호·털모자·튜브·해적 모자·붕대·아귀 초롱·선장 모자 + 문어 다리.
 * 등딱지·더듬이 끝 색만 바꾸고 얼굴·볼터치는 그대로라 어느 색이어도 같은 "장난꾸러기 친구". 외곽선은 B(기본 스타일)의 몸색 진한 톤.
 */
import type { BossLook } from '@/lib/quest/boss';
import type { Costume } from '../costumes';
import type { BugBugPalette } from './Markup';

/** 등딱지 색 다섯 개는 1월드처럼 함께, 점(spot)만 선택 (2월드 금단추·옅은 점) */
type Shell = Pick<
  BugBugPalette,
  'shell' | 'shellDark' | 'shellLight' | 'outline' | 'antTip'
> &
  Partial<Pick<BugBugPalette, 'spot'>>;

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
  // ── 2월드 코드 바다 (P10-04): 바다 색 등딱지 + 바다 소품(`gear.tsx`)
  // 2-1 산호 문자열 공방: 산호색 + 머리 위 산호 가지
  workshop: {
    palette: {
      shell: '#E07B67',
      shellDark: '#B95A48',
      shellLight: '#F0A08E',
      outline: '#9E4A3B',
      antTip: '#F6C1A8',
    },
    costume: { gear: 'coral' },
  },
  // 2-2 등대 도서관: 바다풀 초록 + 등대지기 줄무늬 털모자, 더듬이 끝은 등불 금색
  library: {
    palette: {
      shell: '#3B8A74',
      shellDark: '#2B6857',
      shellLight: '#67AE97',
      outline: '#23574A',
      antTip: '#F2D27A',
    },
    costume: { gear: 'beanie' },
  },
  // 2-3 소용돌이 미로: 깊은 파랑 + 허리에 줄무늬 튜브 (소용돌이에 빙글빙글)
  maze: {
    palette: {
      shell: '#4F67B5',
      shellDark: '#3A4F95',
      shellLight: '#7F93D2',
      outline: '#33447F',
      antTip: '#A9B9EC',
    },
    costume: { gear: 'tube' },
  },
  // 2-4 해적선 놀이공원: 포도주색 + 해적 모자, 점은 금화
  pirate: {
    palette: {
      shell: '#8E3B46',
      shellDark: '#6E2A33',
      shellLight: '#B5606A',
      outline: '#5E232B',
      antTip: '#E8B84A',
    },
    costume: { gear: 'tricorn' },
  },
  // 2-5 버그 병원선: 배탈 난 환자 — 환자복 민트 + 머리 붕대·볼 반창고, 점도 옅게
  hospital: {
    palette: {
      shell: '#8FCBB5',
      shellDark: '#66A891',
      shellLight: '#B6E0D0',
      outline: '#4F8A75',
      antTip: '#F3E9D2',
      spot: '#5E9C86',
    },
    costume: { gear: 'bandage' },
  },
  // 2-6 해저 산맥: 깊은 바다 남청 + 아귀 초롱
  ridge: {
    palette: {
      shell: '#2F6278',
      shellDark: '#224A5C',
      shellLight: '#4F8BA3',
      outline: '#1C3E4D',
      antTip: '#FFE48A',
    },
    costume: { gear: 'lure' },
  },
  // 2-F 버그버그 선장 (최종 보스): 남색 제복 + 금단추 점 + 선장 모자 + 문어 다리
  captain: {
    palette: {
      shell: '#34507A',
      shellDark: '#263B5C',
      shellLight: '#5674A0',
      outline: '#1F3150',
      antTip: '#E8C35A',
      spot: '#E2B23C',
    },
    costume: { gear: 'captain' },
  },
};
