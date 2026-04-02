'use client';

import { memo, useState, useMemo } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PybaemSvg } from './PybaemSvg';
import { BugBugSvg } from './BugBugSvg';
import { ByeolttongiSvg } from './ByeolttongiSvg';
import type { Character, Expression, AvatarSize, BugBugExpression, ByeolttongiExpression } from './expressions';
import { AVATAR_SIZE_MAP } from './expressions';

interface CharacterAvatarProps {
  character: Character;
  expression?: Expression;
  size?: AvatarSize;
  animated?: boolean;
  onHover?: Expression;
  className?: string;
}

const breatheAnimation = {
  scale: [1, 1.02, 1],
  transition: {
    duration: 3,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
};

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
  const shouldReduceMotion = useReducedMotion();
  const px = AVATAR_SIZE_MAP[size];
  const currentExpression = isHovered && onHover ? onHover : expression;

  const svgElement = useMemo(
    () => renderCharacter(character, currentExpression, px),
    [character, currentExpression, px],
  );

  const expressionTransition = (
    <AnimatePresence mode="wait">
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

  if (!animated && !onHover) {
    return <div className={className} data-testid={`character-avatar-${character}-${currentExpression}`}>{expressionTransition}</div>;
  }

  return (
    <m.div
      className={className}
      data-testid={`character-avatar-${character}-${currentExpression}`}
      animate={animated && !shouldReduceMotion ? breatheAnimation : undefined}
      whileHover={onHover ? hoverSpring : undefined}
      onHoverStart={onHover ? () => setIsHovered(true) : undefined}
      onHoverEnd={onHover ? () => setIsHovered(false) : undefined}
    >
      {expressionTransition}
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
