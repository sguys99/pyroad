import { ArrowRight, Code } from 'lucide-react';
import { LoginSheetButton } from '@/components/auth/LoginSheetButton';
import { ScrollButton } from '../ScrollLink';
import { HeroArt } from './HeroArt';
import { PybaemStatic } from '@/components/characters/rig/RigStatic';
import { HeroMascot } from './HeroMascot';
import { HERO_MASCOT_SIZE } from './mascotReactions';
import { HeroParallax } from './HeroParallax';
import './hero.css';

/**
 * 랜딩 히어로 (P4-01): 풀스크린 "월드 1 · 파이썬 섬" 일러스트(5개 레이어) + 다층 패럴랙스 + 살아 있는 파이뱀.
 * 최종 시안 `Landing.tsx` Hero를 풀스크린 장면으로 옮겼다. 스타일 hero.css, 연출 단계 규칙은 그 머리 주석.
 *
 * - 서버 컴포넌트: 제목·부제·버튼·그림은 서버 HTML에 처음부터 보이는 상태(opacity 1). LCP = 제목 글자
 * - 클라이언트 섬은 셋뿐: 버튼(로그인 시트·바로가기), 파이뱀(HeroMascot), 패럴랙스(HeroParallax, 그리는 것 없음)
 * - "이미 모험가라면" 소셜 버튼 줄은 로그인 시트(P4-09) 담당이라 여기 두지 않는다
 */
export function HeroSection() {
  return (
    <section
      id="hero"
      className="hero"
      aria-labelledby="hero-title"
      data-world="1"
    >
      <div className="hero-scene" aria-hidden>
        <HeroArt />
      </div>

      <div className="hero-in">
        <div className="hero-copy">
          <p className="hero-kicker">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"
                className="hero-pin"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle className="hero-pin-dot" cx="12" cy="10" r="2.4" />
            </svg>
            월드 1 · 파이썬 섬
          </p>
          <h1 id="hero-title" className="hero-title font-display">
            코드 주문으로
            <br />
            <span className="ld-ink-mark">모험 지도</span>를 채워라!
          </h1>
          <p className="hero-sub">
            파이뱀 선생님과 퀘스트를 깨며 진짜 파이썬을 배워요. 하나씩 깰 때마다
            섬 지도에 새 길이 열려요.
          </p>
          <div className="hero-cta">
            {/* 로그인 시트(카카오·네이버·Google)를 연다. 분석 이벤트는 provider를 고를 때 (P3-05, P1-17) */}
            <LoginSheetButton
              cta="hero"
              size="lg"
              iconRight={<ArrowRight aria-hidden />}
            >
              모험 시작!
            </LoginSheetButton>
            <ScrollButton
              target="try"
              variant="secondary"
              size="lg"
              icon={<Code aria-hidden />}
            >
              30초 체험
            </ScrollButton>
          </div>
        </div>
      </div>

      {/* 정지 그림은 여기(서버)서 그려 넘긴다: 리그 코드가 첫 JS에 실리지 않는다 (P4-12) */}
      <HeroMascot
        still={
          <PybaemStatic
            state="idle"
            size={HERO_MASCOT_SIZE}
            framing="stage"
            label=""
            className="hero-mascot-svg"
          />
        }
      />
      <HeroParallax targetId="hero" />

      <svg
        className="hero-edge"
        viewBox="0 0 1600 60"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 34C200 8 420 6 640 26C860 46 1060 48 1260 24C1400 8 1520 12 1600 26V60H0Z" />
      </svg>
    </section>
  );
}
