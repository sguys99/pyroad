// 프로토타입 진입점 공용: 마운트, 해시 화면 이동, 뷰포트 프레임
// 시안 진입점은 mountPrototype({...})만 부르면 된다 (README "공유 모듈 API")
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { motionCssVars } from './motion';
import { cssVars, type Concept } from './tokens';
import { PrototypeChrome, type ChromeScreen } from './PrototypeChrome';
import { FRAME_SIZE, readHash, scrollToTop, useFrame, useHashScreen } from './nav';
import './base.css';

export * from './nav';

// ───────────── 마운트

export interface PrototypeOptions<T extends string> {
  concept: Concept;
  /** 검토 도구 막대에 보이는 이름 */
  name: string;
  /** 이름 아래 작은 글씨 (기본: "A · 모험 섬"처럼 시안 이름) */
  subtitle?: string;
  screens: readonly (ChromeScreen & { id: T })[];
  defaultScreen: T;
  /**
   * screens: 해시마다 한 화면만 그린다 (시안).
   * scroll: 한 페이지에 모든 절을 그리고 해시는 절로 스크롤 (무드보드).
   */
  mode?: 'screens' | 'scroll';
  render: (screen: T) => ReactNode;
}

export function mountPrototype<T extends string>(opts: PrototypeOptions<T>) {
  const root = document.documentElement;
  root.dataset.concept = opts.concept;
  root.lang = 'ko';
  const vars = { ...cssVars(opts.concept), ...motionCssVars() };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);

  let el = document.getElementById('root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
  }
  createRoot(el).render(<Shell {...opts} />);
}

function Shell<T extends string>({ name, subtitle, screens, defaultScreen, mode = 'screens', render, concept }: PrototypeOptions<T>) {
  const ids = screens.map((s) => s.id);
  const screen = useHashScreen(ids, defaultScreen);
  const f = useFrame();
  const [win, setWin] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    const on = () => setWin({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // 화면 모드: 해시가 바뀌면 맨 위로. 스크롤 모드: 해당 절로
  useEffect(() => {
    if (mode === 'screens') {
      scrollToTop();
      return;
    }
    const target = document.getElementById(screen);
    if (target && readHash()) target.scrollIntoView({ block: 'start' });
  }, [screen, mode, f]);

  const frameH = f === 'full' ? 0 : Math.max(560, Math.min(FRAME_SIZE[f].h, win.h - 120));
  // 시안의 <main>·<header> 랜드마크는 시안이 직접 둔다 (이 div는 반응형 컨테이너일 뿐)
  const content = (
    <div className="proto-viewport" data-screen={screen} style={f === 'full' ? undefined : ({ '--vp-h': `${frameH}px` } as CSSProperties)}>
      {render(screen)}
    </div>
  );

  return (
    <>
      {f === 'full' ? (
        <div className="proto-stage" data-frame="full">
          {content}
        </div>
      ) : (
        <div className="proto-stage" data-frame={f}>
          <div
            className="proto-frame"
            style={{ width: Math.min(FRAME_SIZE[f].w, win.w - 40), height: frameH }}
          >
            <div className="proto-scroller">{content}</div>
          </div>
        </div>
      )}
      <PrototypeChrome name={name} subtitle={subtitle} concept={concept} screens={screens} current={screen} />
    </>
  );
}
