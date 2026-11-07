// 검토용 떠 있는 도구 막대 (아이가 아니라 검토자가 쓰는 도구)
// - 화면 탭(해시), 보기(전체 폭 / 모바일 390 / 태블릿 820), 연출 단계 full·lite·minimal, 동작 줄이기
// - 작고 방해되지 않게: 오른쪽 아래, 접으면 동그란 버튼 하나. 접힘 상태는 기억한다
import { useState } from 'react';
import { goScreen, setFrame, useFrame, type FrameMode } from './nav';
import { setMotion, useMotion, type MotionTier } from './motion';
import { CONCEPT_NAME, type Concept } from './tokens';
import './chrome.css';

export interface ChromeScreen {
  id: string;
  label: string;
}

const COLLAPSE_KEY = 'pyroad-proto-chrome-collapsed';

function initialCollapsed() {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* 무시 */
  }
  return window.innerWidth < 640;
}

export function PrototypeChrome({
  name,
  subtitle,
  concept,
  screens,
  current,
}: {
  name: string;
  subtitle?: string;
  concept: Concept;
  screens: readonly ChromeScreen[];
  current: string;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const frame = useFrame();
  const motion = useMotion();

  const toggle = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
    } catch {
      /* 무시 */
    }
  };

  if (collapsed) {
    return (
      <div className="pc-root pc-collapsed" data-proto-chrome="">
        <button type="button" className="pc-fab" onClick={() => toggle(false)} aria-label="검토 도구 열기" title="검토 도구 열기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2.2" />
            <circle cx="10" cy="17" r="2.2" />
          </svg>
          <span className="pc-fab-tier">{motion.reduced ? '줄임' : motion.tier}</span>
        </button>
      </div>
    );
  }

  const frames: { id: FrameMode; label: string }[] = [
    { id: 'full', label: '전체 폭' },
    { id: 'mobile', label: '모바일 390' },
    { id: 'tablet', label: '태블릿 820' },
  ];
  const tiers: MotionTier[] = ['full', 'lite', 'minimal'];

  return (
    <div className="pc-root" data-proto-chrome="" role="region" aria-label="시안 검토 도구">
      <div className="pc-head">
        <span className="pc-title">
          <b>{name}</b>
          <span className="pc-sub">{subtitle ?? `${concept === 'AB' ? 'A×B' : concept} · ${CONCEPT_NAME[concept]}`}</span>
        </span>
        <button type="button" className="pc-icon" onClick={() => toggle(true)} aria-label="검토 도구 접기" title="접기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {screens.length > 1 && (
        <div className="pc-row" role="group" aria-label="화면">
          <span className="pc-label">화면</span>
          <div className="pc-seg pc-wrap">
            {screens.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={current === s.id}
                onClick={() => goScreen(s.id)}
                title={`#${s.id}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pc-row" role="group" aria-label="보기">
        <span className="pc-label">보기</span>
        <div className="pc-seg">
          {frames.map((f) => (
            <button key={f.id} type="button" aria-pressed={frame === f.id} onClick={() => setFrame(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pc-row" role="group" aria-label="연출 단계">
        <span className="pc-label">연출</span>
        <div className="pc-seg">
          {tiers.map((t) => (
            <button key={t} type="button" aria-pressed={motion.tier === t} onClick={() => setMotion({ tier: t })}>
              {t}
            </button>
          ))}
        </div>
        <label className="pc-check">
          <input type="checkbox" checked={motion.reduced} onChange={(e) => setMotion({ reduced: e.target.checked })} />
          동작 줄이기
        </label>
      </div>
    </div>
  );
}
