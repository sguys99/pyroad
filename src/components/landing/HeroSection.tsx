'use client';

import { m } from 'framer-motion';
import { Rocket } from 'lucide-react';
import { EASE, sec } from '@/lib/motion/tokens';
import { LoginSheetButton } from '@/components/auth/LoginSheetButton';
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
    transition: { duration: sec('slow'), ease: EASE.out },
  },
};

export function HeroSection() {
  return (
    <m.div
      className="flex flex-col items-center gap-6 text-center"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <m.div variants={fadeUp}>
        {/* 등장 연출 뒤 숨쉬기, 마우스를 올리면 웃음 (B32: Lottie 대신 정적 SVG + 1회성 연출) */}
        <LottieCharacter
          character="pybaem"
          animation="entrance"
          size={128}
          expression="waving"
          animated
          onHover="happy"
        />
      </m.div>

      <m.h1 className="text-4xl font-bold text-primary-text" variants={fadeUp}>
        pyRoad
      </m.h1>

      <m.p className="max-w-md text-lg text-foreground" variants={fadeUp}>
        안녕! 나는 파이뱀 선생님이야~
      </m.p>

      <m.p
        className="max-w-md text-base text-muted-foreground"
        variants={fadeUp}
      >
        함께 파이썬 모험을 떠나볼래?
      </m.p>

      <m.div variants={fadeUp}>
        {/* 로그인 시트(카카오·네이버·Google)를 연다. 분석 이벤트는 provider를 고를 때 (P3-05, P1-17) */}
        <LoginSheetButton
          cta="hero"
          size="lg"
          iconRight={<Rocket aria-hidden />}
        >
          모험 시작하기
        </LoginSheetButton>
      </m.div>
    </m.div>
  );
}
