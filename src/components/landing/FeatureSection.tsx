'use client';

import { m } from 'framer-motion';
import { MessageCircle, Code, Star } from 'lucide-react';

const features = [
  {
    icon: MessageCircle,
    title: 'AI 튜터',
    description: '파이뱀 선생님이\n1:1로 도와줘요',
    gradient: 'from-[#a8d5a2] to-[#7bc67e]',
  },
  {
    icon: Code,
    title: '코드 실행',
    description: '브라우저에서 바로\n파이썬을 실행해요',
    gradient: 'from-[#8ecae6] to-[#5fa8d3]',
  },
  {
    icon: Star,
    title: '퀘스트 모험',
    description: '7개 스테이지를\n깨며 성장해요',
    gradient: 'from-[#f4b860] to-[#e89b3e]',
  },
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

export function FeatureSection() {
  return (
    <section className="w-full px-6 pt-40 pb-50">
      <m.div
        className="mx-auto max-w-3xl"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
      >
        <m.h2
          className="mb-10 text-center text-base font-bold text-primary"
          variants={fadeUp}
        >
          이렇게 배워요
        </m.h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <m.div
              key={feature.title}
              className="rounded-2xl border border-white/80 bg-white/60 p-5 text-center backdrop-blur-[10px]"
              variants={fadeUp}
            >
              <div
                className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[11px] bg-gradient-to-br ${feature.gradient}`}
              >
                <feature.icon size={22} className="text-white" strokeWidth={2} />
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
      </m.div>
    </section>
  );
}
