'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LoginButton } from '@/components/LoginButton';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { LottieCharacter } from '@/components/characters/LottieCharacter';

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export function HeroSection() {
  const [entranceDone, setEntranceDone] = useState(false);

  return (
    <motion.div
      className="flex flex-col items-center gap-6 text-center"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp}>
        {entranceDone ? (
          <CharacterAvatar
            character="pybaem"
            expression="waving"
            size="lg"
            animated
            onHover="happy"
          />
        ) : (
          <LottieCharacter
            character="pybaem"
            animation="entrance"
            size={128}
            fallbackExpression="waving"
            onComplete={() => setEntranceDone(true)}
          />
        )}
      </motion.div>

      <motion.h1
        className="text-4xl font-bold text-primary"
        variants={fadeUp}
      >
        pyRoad
      </motion.h1>

      <motion.p className="max-w-md text-lg text-foreground" variants={fadeUp}>
        안녕! 나는 파이뱀 선생님이야~
      </motion.p>

      <motion.p
        className="max-w-md text-base text-muted-foreground"
        variants={fadeUp}
      >
        함께 파이썬 모험을 떠나볼래?
      </motion.p>

      <motion.div variants={fadeUp}>
        <LoginButton />
      </motion.div>
    </motion.div>
  );
}
