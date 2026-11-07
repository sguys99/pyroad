import {
  Check,
  CircleCheck,
  Lightbulb,
  Lock,
  MessageCircleQuestion,
  Play,
  Pointer,
} from 'lucide-react';
import { PybaemStatic } from '@/components/characters/rig';
import { RewardIcon } from '@/components/ui/reward-icon';
import { skinPalette, type SkinId } from '@/lib/avatar/skins';
import { OnboardingStamp } from './OnboardingStamp';

/**
 * 30초 튜토리얼의 작은 장면 4개 (P3-11). Pyodide 를 불러오지 않고 모양만 흉내 낸다(진짜 실행 없음).
 * 연출은 `onboarding.css`의 1회성 키프레임(transform·opacity만)이고, 장면이 다시 그려질 때(`key`)마다 처음부터 한 번 돈다.
 * lite는 70% 길이, minimal·동작 줄이기는 연출 없이 끝 상태 그대로 (`.ob-scene` 규칙). 반복은 "지금 여기" 고리 하나뿐(`.m-loop`).
 * 장면은 장식(`aria-hidden`)이고 같은 내용을 제목·파이뱀 대사가 글자로 말한다.
 */

export function MapScene() {
  return (
    <div
      className="ob-scene ob-scene-map"
      aria-hidden
      data-testid="tutorial-scene-map"
    >
      <svg
        className="ob-map-path"
        viewBox="0 0 320 180"
        preserveAspectRatio="none"
      >
        <path d="M40 140 C 100 140, 110 70, 160 76 S 240 130, 282 48" />
      </svg>
      <span
        className="ob-node"
        data-state="done"
        style={{ left: '12.5%', top: '77%' }}
      >
        <Check strokeWidth={3} />
      </span>
      <span
        className="ob-node"
        data-state="now"
        style={{ left: '50%', top: '42%' }}
      >
        <span className="ob-node-ring m-loop" />
        <span className="font-display">2</span>
      </span>
      <span
        className="ob-node"
        data-state="locked"
        style={{ left: '88%', top: '27%' }}
      >
        <Lock />
      </span>
      <span className="ob-map-tag" style={{ left: '50%', top: '42%' }}>
        변수의 숲
      </span>
      <span className="ob-tap" style={{ left: '50%', top: '42%' }}>
        <Pointer />
      </span>
    </div>
  );
}

export function CodeScene() {
  return (
    <div
      className="ob-scene ob-scene-code"
      aria-hidden
      data-testid="tutorial-scene-code"
    >
      <div className="ob-mini-editor">
        <div className="ob-mini-bar">
          <span className="ob-mini-dot" />
          <span className="ob-mini-dot" />
          <span className="ob-mini-dot" />
          <span className="ob-mini-file">내 코드</span>
        </div>
        <div className="ob-mini-code font-mono">
          <span className="ob-mini-ln">1</span>
          <span className="ob-mini-typed">
            <span className="text-code-func">print</span>(
            <span className="text-code-string">&quot;안녕!&quot;</span>)
          </span>
        </div>
      </div>
      <div className="ob-mini-row">
        <span className="ob-mini-run font-display">
          <Play aria-hidden />
          실행
        </span>
        <div className="ob-mini-out">
          <span className="ob-mini-out-k">결과</span>
          <span className="ob-mini-out-v font-mono">안녕!</span>
          <CircleCheck className="ob-mini-out-ok" />
        </div>
      </div>
    </div>
  );
}

export function HintScene({ skin }: { skin: SkinId }) {
  return (
    <div
      className="ob-scene ob-scene-hint"
      aria-hidden
      data-testid="tutorial-scene-hint"
    >
      <div className="ob-chips">
        <span className="ob-chip" data-kind="hint">
          <Lightbulb />
          힌트 보기
        </span>
        <span className="ob-chip">
          <MessageCircleQuestion />
          파이뱀에게 질문
        </span>
      </div>
      <p className="ob-chat-q">print가 뭐예요?</p>
      <div className="ob-chat-a">
        <span className="ob-chat-face">
          <PybaemStatic
            state="teach"
            size={40}
            palette={skinPalette(skin)}
            framing="avatar"
            label=""
            filters={false}
          />
        </span>
        <p className="ob-chat-a-t">
          화면에 글자를 보여 주는 주문이야. 따옴표 안을 바꿔 봐!
        </p>
      </div>
    </div>
  );
}

export function RewardScene() {
  return (
    <div
      className="ob-scene ob-scene-reward"
      aria-hidden
      data-testid="tutorial-scene-reward"
    >
      <div className="ob-quest-card">
        <div className="min-w-0">
          <p className="text-caption font-semibold text-primary-text">
            퀘스트 1-1
          </p>
          <p className="font-display text-h3 text-foreground">첫 번째 인사</p>
          <div className="ob-quest-stars">
            <span className="ob-star" style={{ ['--i' as string]: 0 }}>
              <RewardIcon kind="star" size={30} />
            </span>
            <span className="ob-star" style={{ ['--i' as string]: 1 }}>
              <RewardIcon kind="star" size={30} />
            </span>
            <span className="ob-star" style={{ ['--i' as string]: 2 }}>
              <RewardIcon kind="star" size={30} />
            </span>
          </div>
        </div>
        <OnboardingStamp stamped text="완료" className="ob-quest-stamp" />
      </div>
      <p className="ob-legend">
        <span>
          <RewardIcon kind="star" size={18} /> 별 = 점수
        </span>
        <span>
          <span className="ob-legend-stamp" /> 도장 = 완료 기록
        </span>
      </p>
    </div>
  );
}
