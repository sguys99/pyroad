'use client';

import { m } from 'framer-motion';
import Image from 'next/image';
import { MessageCircle, Code, Map, Trophy } from 'lucide-react';
import worldMapImg from '@/../img/2.world-map.png';
import learningPageImg from '@/../img/3.learning-page.png';

const features = [
  {
    icon: MessageCircle,
    title: 'AI 튜터',
    description: '파이뱀 선생님이\n1:1로 친절하게 알려줘요',
    gradient: 'from-[#a8d5a2] to-[#7bc67e]',
  },
  {
    icon: Code,
    title: '브라우저 코딩',
    description: '설치 없이 바로\n파이썬 코드를 실행해요',
    gradient: 'from-[#8ecae6] to-[#5fa8d3]',
  },
  {
    icon: Map,
    title: '월드맵 모험',
    description: '스테이지를 하나씩\n깨며 앞으로 나아가요',
    gradient: 'from-[#f4b860] to-[#e89b3e]',
  },
  {
    icon: Trophy,
    title: '뱃지와 보상',
    description: '퀘스트를 완료하면\n멋진 뱃지를 받아요',
    gradient: 'from-[#d4a5e5] to-[#b07cc6]',
  },
] as const;

const screenshots = [
  { src: worldMapImg, alt: '월드맵 화면', caption: '월드맵' },
  { src: learningPageImg, alt: '학습 페이지 화면', caption: '학습 페이지' },
] as const;

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export function AboutSection() {
  return (
    <section id="about" className="w-full px-6 pt-32 pb-40">
      <m.div
        className="mx-auto max-w-3xl"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
      >
        {/* 서비스 소개 */}
        <m.h2
          className="mb-3 text-center text-xl font-bold text-primary"
          variants={fadeUp}
        >
          pyRoad를 소개해요
        </m.h2>
        <m.p
          className="mb-10 text-center text-sm text-muted-foreground"
          variants={fadeUp}
        >
          초등학생이 브라우저에서 바로 파이썬을 배우는
          <br />
          인터랙티브 학습 플랫폼이에요!
        </m.p>

        {/* 특징 카드 */}
        <div className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <m.div
              key={feature.title}
              className="rounded-2xl border border-white/80 bg-white/60 p-5 text-center backdrop-blur-[10px]"
              variants={fadeUp}
            >
              <div
                className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[11px] bg-gradient-to-br ${feature.gradient}`}
              >
                <feature.icon
                  size={22}
                  className="text-white"
                  strokeWidth={2}
                />
              </div>
              <h3 className="mb-1 text-[13px] font-bold text-primary">
                {feature.title}
              </h3>
              <p className="whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </m.div>
          ))}
        </div>

        {/* 스크린샷 갤러리 */}
        <m.h3
          className="mb-6 text-center text-base font-bold text-primary"
          variants={fadeUp}
        >
          이렇게 생겼어요
        </m.h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {screenshots.map((shot) => (
            <m.div key={shot.caption} variants={fadeUp}>
              <div className="overflow-hidden rounded-2xl border border-white/60 shadow-lg">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  className="w-full h-auto"
                  placeholder="blur"
                />
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {shot.caption}
              </p>
            </m.div>
          ))}
        </div>
      </m.div>
    </section>
  );
}
