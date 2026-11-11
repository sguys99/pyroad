import type { CSSProperties } from 'react';
import { Check, ShieldCheck, Sparkles, Sprout } from 'lucide-react';
import { LandingSection } from '../LandingSection';
import { ParentsReveal } from './parents/ParentsReveal';
import {
  LETTER,
  ROADMAP,
  WORLD1_STAGES,
  type LetterColumn,
} from './parents/parents';
// 스타일 `parents.css`는 여기서 import하지 않는다: 첫 화면 밖이라 렌더 차단 CSS에서 빼고 `../deferredCss.ts`가 늦게 받는다 (P4-12)

const ICON: Record<LetterColumn['id'], typeof ShieldCheck> = {
  safety: ShieldCheck,
  ai: Sparkles,
  learning: Sprout,
};

/** 순서 변수 (등장 시차) */
const order = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * 랜딩 `#parents` 보호자 섹션 (P4-07): 안전 · AI 튜터 원칙 · 배움을 담은 "편지" + 커리큘럼 로드맵(월드 1 → 2 → 3).
 * 최종 시안 `Landing.tsx` Parents(`f-letter`, 3단 글)를 옮기고 시안의 사실이 아닌 문구(스티커만·20분 알림·주간 카드)는 뺐다.
 *
 * - 서버 컴포넌트: 모든 글이 서버 HTML에 보이는 상태. 클라이언트는 등장 표시(`ParentsReveal`, data-in)뿐
 * - 문구는 `parents/parents.ts`(근거 주석과 함께). 아직 없는 기능은 "준비 중"으로만
 * - 앵커 id `parents`·제목 id `parents-title`은 바꾸지 않는다. 스타일은 `parents.css`(`ld-parents-`)
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function ParentsSection() {
  return (
    <LandingSection
      id="parents"
      deferredCss="parents"
      tone="surface"
      kicker="보호자께"
      title="아이가 안심하고 배우도록 만들었어요"
      lead="안전과 배움에 대해 짧게 말씀드릴게요."
    >
      <ParentsReveal className="ld-parents-letter">
        <div className="ld-parents-cols">
          {LETTER.map((col, i) => {
            const Icon = ICON[col.id];
            return (
              <div
                key={col.id}
                className="ld-parents-col"
                data-col={col.id}
                style={order(i)}
              >
                <span className="ld-parents-ic" aria-hidden>
                  <Icon strokeWidth={2.2} />
                </span>
                <h3 className="ld-parents-h3 font-display">{col.title}</h3>
                <ul className="ld-parents-list">
                  {col.items.map((item) => (
                    <li key={item}>
                      <Check aria-hidden className="ld-parents-check" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="ld-parents-foot">
          <p className="ld-parents-sign font-display">pyRoad 드림</p>
        </div>
      </ParentsReveal>

      <ParentsReveal className="ld-parents-road">
        <h3 className="ld-parents-h3 font-display">배우는 길</h3>
        <ol className="ld-parents-stops">
          {ROADMAP.map((stop, i) => (
            <li
              key={stop.world}
              className="ld-parents-stop"
              data-status={stop.status}
              style={order(i)}
            >
              <span className="ld-parents-pin font-display" aria-hidden>
                {stop.world}
              </span>
              <div className="ld-parents-stop-body">
                <p className="ld-parents-world">
                  <span>
                    월드 {stop.world} ·{' '}
                    <b className="font-display">{stop.name}</b>
                  </span>
                  <span className="ld-parents-tag" data-status={stop.status}>
                    {stop.status === 'open' ? '지금 배울 수 있어요' : '준비 중'}
                  </span>
                </p>
                <p className="ld-parents-sum">{stop.summary}</p>
                {stop.world === 1 && (
                  <ol
                    className="ld-parents-stages"
                    aria-label="파이썬 섬 스테이지"
                  >
                    {WORLD1_STAGES.map((name, n) => (
                      <li key={name}>
                        <span className="ld-parents-stage-n" aria-hidden>
                          {n + 1}
                        </span>
                        {name}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="ld-parents-note">
          월드 2·3의 이름과 내용은 바뀔 수 있어요.
        </p>
      </ParentsReveal>
    </LandingSection>
  );
}
