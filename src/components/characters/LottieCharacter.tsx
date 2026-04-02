'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'framer-motion';
import { CharacterAvatar } from './CharacterAvatar';
import type { Character, Expression } from './expressions';

const LottiePlayer = dynamic(() => import('lottie-react'), { ssr: false });

interface LottieCharacterProps {
  character: Character;
  animation: string;
  size: number;
  autoplay?: boolean;
  loop?: boolean;
  fallbackExpression?: Expression;
  onComplete?: () => void;
}

export function LottieCharacter({
  character,
  animation,
  size,
  autoplay = true,
  loop = false,
  fallbackExpression = 'celebrating',
  onComplete,
}: LottieCharacterProps) {
  const shouldReduceMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) return;

    let cancelled = false;

    fetch(`/characters/${character}/lottie/${animation}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [character, animation, shouldReduceMotion]);

  // reduced-motion 또는 로딩 실패 시 정적 SVG 폴백
  if (shouldReduceMotion || loadFailed) {
    const avatarSize = size <= 32 ? 'sm' : size <= 64 ? 'md' : 'lg';
    return (
      <CharacterAvatar
        character={character}
        expression={fallbackExpression}
        size={avatarSize}
      />
    );
  }

  // 로딩 중 폴백
  if (!animationData) {
    const avatarSize = size <= 32 ? 'sm' : size <= 64 ? 'md' : 'lg';
    return (
      <CharacterAvatar
        character={character}
        expression={fallbackExpression}
        size={avatarSize}
        animated
      />
    );
  }

  return (
    <div data-testid={`lottie-character-${character}`}>
      <LottiePlayer
        animationData={animationData}
        autoplay={autoplay}
        loop={loop}
        style={{ width: size, height: size }}
        onComplete={onComplete}
      />
    </div>
  );
}
