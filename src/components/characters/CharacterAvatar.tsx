'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PybaemSvg } from './PybaemSvg';
import type { Character, Expression, AvatarSize } from './expressions';
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

export function CharacterAvatar({
  character,
  expression = 'happy',
  size = 'md',
  animated = false,
  onHover,
  className,
}: CharacterAvatarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const px = AVATAR_SIZE_MAP[size];
  const currentExpression = isHovered && onHover ? onHover : expression;

  const svgElement = renderCharacter(character, currentExpression, px);

  if (!animated && !onHover) {
    return <div className={className}>{svgElement}</div>;
  }

  return (
    <motion.div
      className={className}
      animate={animated ? breatheAnimation : undefined}
      whileHover={
        onHover ? { scale: 1.08, transition: { type: 'spring', stiffness: 400, damping: 17 } } : undefined
      }
      onHoverStart={onHover ? () => setIsHovered(true) : undefined}
      onHoverEnd={onHover ? () => setIsHovered(false) : undefined}
    >
      {svgElement}
    </motion.div>
  );
}

function renderCharacter(
  character: Character,
  expression: Expression,
  size: number,
) {
  switch (character) {
    case 'pybaem':
      return <PybaemSvg expression={expression as Parameters<typeof PybaemSvg>[0]['expression']} size={size} />;
    case 'bugbug':
    case 'byeolttongi':
      // Phase 4에서 구현 예정, 현재는 파이뱀으로 폴백
      return <PybaemSvg expression="happy" size={size} />;
  }
}
