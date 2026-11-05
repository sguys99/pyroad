'use client';

import { memo } from 'react';
import {
  m,
  MotionConfig,
  type TargetAndTransition,
  type Transition,
} from 'framer-motion';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { CharacterAvatar } from './CharacterAvatar';
import type { Character, Expression } from './expressions';

/**
 * 축하·등장 자리의 캐릭터.
 *
 * B32: `public/characters/pybaem/lottie/*.json`이 lottie-web에서 아무것도 그리지 않아
 * Lottie 재생을 그만두고, 표정이 있는 정적 `CharacterAvatar`에 Framer Motion 1회성 연출을 입힘.
 * 이름과 `animation` 값은 예전 Lottie 파일 이름을 그대로 써서 호출부를 바꾸지 않음.
 * P6-08·P6-13에서 SVG 리그로 교체 (P0-07).
 *
 * - 연출은 한 번만 재생 (반복 연출은 `CharacterAvatar animated`의 CSS 숨쉬기만, §2.10)
 * - transform만 움직이므로 서버 렌더링 때도 캐릭터가 보임 (opacity:0으로 시작하지 않음)
 * - 동작 줄이기(기기·사용자 설정, P2-15)면 `MotionConfig reducedMotion="always"`가 transform 애니메이션을 즉시 끝냄 → 움직임 0, 표정만
 * - minimal 단계는 착지 빛 고리(곁가지 이펙트)를 그리지 않음
 */
export type CharacterMotion =
  | 'entrance'
  | 'level-up'
  | 'project-complete'
  | 'celebrating';

interface MotionPreset {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
  /** 발밑 기준으로 찌그러지거나 기울도록 */
  origin: string;
  /** 착지 순간 뒤에서 한 번 퍼지는 빛 고리의 시작 시각(초). 없으면 고리 없음 */
  burstAt?: number;
}

const JUMP_TIMES = [0, 0.14, 0.42, 0.62, 0.8, 1];
// 올라갈 때 감속, 떨어질 때 가속
const JUMP_EASE = [
  'easeOut',
  'easeOut',
  'easeIn',
  'easeOut',
  'easeIn',
] as const;

/** 웅크림 → 점프(늘어남) → 착지(찌그러짐) → 작은 반동 → 제자리 */
function jumpPreset(
  delay: number,
  height: number,
  extra?: TargetAndTransition,
): MotionPreset {
  const duration = 1;
  return {
    initial: { y: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    animate: {
      y: [0, 3, -height, 0, -height * 0.3, 0],
      scaleX: [1, 1.08, 0.95, 1.1, 0.98, 1],
      scaleY: [1, 0.9, 1.07, 0.88, 1.02, 1],
      ...extra,
    },
    transition: { duration, delay, times: JUMP_TIMES, ease: [...JUMP_EASE] },
    origin: '50% 100%',
    burstAt: delay + duration * JUMP_TIMES[3] - 0.05,
  };
}

const PRESETS: Record<CharacterMotion, MotionPreset> = {
  // 랜딩 히어로: 살짝 아래에서 스프링으로 올라온 뒤 손 흔들듯 좌우로 기울기
  entrance: {
    initial: { y: 18, scale: 0.86, rotate: 0 },
    animate: { y: 0, scale: 1, rotate: [0, -7, 6, -3, 0] },
    transition: {
      y: { type: 'spring', stiffness: 260, damping: 15, delay: 0.2 },
      scale: { type: 'spring', stiffness: 260, damping: 15, delay: 0.2 },
      rotate: { duration: 0.9, delay: 0.75, ease: 'easeInOut' },
    },
    origin: '50% 90%',
  },
  // 축하 카드: 바깥 카드의 팝(약 0.2~0.7초)이 끝날 즈음 기쁨 점프
  'level-up': jumpPreset(0.6, 16),
  celebrating: jumpPreset(0.6, 16),
  // 프로젝트 완성: 조금 더 높이 뛰며 고개를 갸웃
  'project-complete': jumpPreset(0.6, 20, { rotate: [0, 0, -6, 0, 5, 0] }),
};

interface LottieCharacterProps {
  character: Character;
  animation: CharacterMotion;
  /** 픽셀 크기 */
  size: number;
  expression?: Expression;
  /** 연출이 끝난 뒤에도 CSS로 숨쉬기 */
  animated?: boolean;
  /** 마우스를 올리면 바뀔 표정 */
  onHover?: Expression;
}

export const LottieCharacter = memo(function LottieCharacter({
  character,
  animation,
  size,
  expression = 'celebrating',
  animated = false,
  onHover,
}: LottieCharacterProps) {
  const { reduced, budget } = useMotionTier();
  const preset = PRESETS[animation];
  const showBurst = preset.burstAt !== undefined && budget.springs;

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
        data-testid={`character-motion-${animation}`}
      >
        {showBurst && (
          <m.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.55)_0%,rgba(253,224,71,0.2)_45%,transparent_70%)]"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.6], opacity: [0, 1, 0] }}
            transition={{
              duration: 0.8,
              delay: preset.burstAt,
              ease: 'easeOut',
            }}
          />
        )}
        <m.div
          className="relative"
          style={{ transformOrigin: preset.origin }}
          initial={preset.initial}
          animate={preset.animate}
          transition={preset.transition}
        >
          <CharacterAvatar
            character={character}
            expression={expression}
            size={size}
            animated={animated}
            onHover={onHover}
          />
        </m.div>
      </div>
    </MotionConfig>
  );
});
