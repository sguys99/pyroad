'use client';

import { memo, useState, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { PybaemSvg } from './PybaemSvg';
import { BugBugSvg } from './BugBugSvg';
import { ByeolttongiSvg } from './ByeolttongiSvg';
import type { Character, Expression, AvatarSize, BugBugExpression, ByeolttongiExpression } from './expressions';
import { AVATAR_SIZE_MAP } from './expressions';

interface CharacterAvatarProps {
  character: Character;
  expression?: Expression;
  /** 프리셋(sm·md·lg) 또는 픽셀 값 */
  size?: AvatarSize | number;
  /** 숨쉬기 연출. 반복 연출이라 CSS 키프레임으로만 그림 (§2.10, reduced-motion이면 멈춤) */
  animated?: boolean;
  onHover?: Expression;
  className?: string;
}

const hoverSpring = { scale: 1.08, transition: { type: 'spring' as const, stiffness: 400, damping: 17 } };
const expressionTransitionConfig = { duration: 0.2 };
const expressionInitial = { opacity: 0, scale: 0.95 };
const expressionAnimate = { opacity: 1, scale: 1 };

export const CharacterAvatar = memo(function CharacterAvatar({
  character,
  expression = 'happy',
  size = 'md',
  animated = false,
  onHover,
  className,
}: CharacterAvatarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const px = typeof size === 'number' ? size : AVATAR_SIZE_MAP[size];
  const currentExpression = isHovered && onHover ? onHover : expression;

  const svgElement = useMemo(
    () => renderCharacter(character, currentExpression, px),
    [character, currentExpression, px],
  );

  // initial={false}: 처음 그릴 때는 바로 보이고(opacity:0으로 서버 렌더링하지 않음),
  // 표정이 바뀔 때만 교차 전환
  const expressionTransition = (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={currentExpression}
        initial={expressionInitial}
        animate={expressionAnimate}
        exit={expressionInitial}
        transition={expressionTransitionConfig}
      >
        {svgElement}
      </m.div>
    </AnimatePresence>
  );

  // 숨쉬기(CSS)와 hover 스프링(Framer)이 같은 요소의 transform을 다투지 않도록 감싸는 요소를 나눔
  const content = animated ? (
    <div className="character-breathe">{expressionTransition}</div>
  ) : (
    expressionTransition
  );

  if (!onHover) {
    return <div className={className} data-testid={`character-avatar-${character}-${currentExpression}`}>{content}</div>;
  }

  return (
    <m.div
      className={className}
      data-testid={`character-avatar-${character}-${currentExpression}`}
      whileHover={hoverSpring}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {content}
    </m.div>
  );
});

function renderCharacter(
  character: Character,
  expression: Expression,
  size: number,
) {
  switch (character) {
    case 'pybaem':
      return <PybaemSvg expression={expression as Parameters<typeof PybaemSvg>[0]['expression']} size={size} />;
    case 'bugbug':
      return <BugBugSvg expression={expression as BugBugExpression} size={size} />;
    case 'byeolttongi':
      return <ByeolttongiSvg expression={expression as ByeolttongiExpression} size={size} />;
  }
}
