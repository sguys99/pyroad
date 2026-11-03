import { hud, tutor, quest, codeDemo, codeDemoOutput } from '@/content';

export const SYS_SANS =
  "-apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
export const SYS_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** 루트 레이아웃 공통 셸. 라우트 그룹마다 루트 레이아웃이 따로 있어서 폰트가 서로 섞이지 않는다. */
export function Doc({ stack = 'a', className, fonts, head, children }) {
  const style = {
    '--font-title': fonts?.title ?? `var(--sys-sans)`,
    '--font-body': fonts?.body ?? `var(--sys-sans)`,
    '--font-code': fonts?.code ?? `var(--sys-mono)`,
    ...(fonts?.titleWeight ? { '--title-weight': fonts.titleWeight } : {}),
  };
  return (
    <html lang="ko" data-stack={stack} className={className} style={style}>
      <head>{head}</head>
      <body>{children}</body>
    </html>
  );
}

export const Icon = {
  play: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.3 0-1.7L8.6 3.9C7.9 3.5 7 4 7 4.8z" /></svg>
  ),
  star: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>
  ),
  map: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>
  ),
  chat: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
  ),
  gift: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4.5 9 8 12 8zm0 0s2-5 4.5-3.5S15 8 12 8z" /></svg>
  ),
  phone: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M11 18h2" /></svg>
  ),
  check: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
  ),
  x: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
  ),
};

/** 파이뱀 (src/components/characters/PybaemSvg.tsx의 happy 표정을 정적으로 옮김) */
export function Mascot({ className = 'mascot' }) {
  return (
    <svg className={className} viewBox="0 0 128 128" fill="none" role="img" aria-label="파이뱀 선생님">
      <ellipse cx="64" cy="80" rx="40" ry="28" fill="#66BB6A" />
      <ellipse cx="64" cy="80" rx="40" ry="28" fill="url(#pbB)" />
      <ellipse cx="64" cy="84" rx="28" ry="18" fill="#A5D6A7" />
      <path d="M24 80 C16 72, 12 60, 20 52 C28 44, 36 48, 32 56" stroke="#66BB6A" strokeWidth="8" strokeLinecap="round" />
      <circle cx="20" cy="52" r="5" fill="#4CAF50" />
      <ellipse cx="64" cy="44" rx="28" ry="24" fill="#66BB6A" />
      <ellipse cx="64" cy="44" rx="28" ry="24" fill="url(#pbH)" />
      <ellipse cx="44" cy="50" rx="6" ry="4" fill="#FF8A80" opacity="0.45" />
      <ellipse cx="84" cy="50" rx="6" ry="4" fill="#FF8A80" opacity="0.45" />
      <ellipse cx="52" cy="40" rx="5" ry="5.5" fill="#2E7D32" />
      <ellipse cx="76" cy="40" rx="5" ry="5.5" fill="#2E7D32" />
      <circle cx="53.5" cy="38.5" r="2" fill="#fff" />
      <circle cx="77.5" cy="38.5" r="2" fill="#fff" />
      <path d="M56 52 Q64 60 72 52" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M62 58 Q64 66 66 58" fill="#FF8A80" />
      <defs>
        <radialGradient id="pbB" cx="0.4" cy="0.3"><stop offset="0%" stopColor="#81C784" stopOpacity="0.4" /><stop offset="100%" stopColor="#66BB6A" stopOpacity="0" /></radialGradient>
        <radialGradient id="pbH" cx="0.4" cy="0.3"><stop offset="0%" stopColor="#81C784" stopOpacity="0.5" /><stop offset="100%" stopColor="#66BB6A" stopOpacity="0" /></radialGradient>
      </defs>
    </svg>
  );
}

export function Topbar({ showHud = true }) {
  return (
    <header className="topbar">
      <div className="logo"><i>py</i>pyRoad</div>
      {showHud ? <Hud /> : <a className="btn ghost" href="#">로그인</a>}
    </header>
  );
}

export function Hud() {
  return (
    <div className="hud" aria-label="내 상태">
      <span className="pill"><span className="ico lv">{hud.level.replace('Lv. ', '')}</span>{hud.levelName}</span>
      <span className="pill"><span className="ico coin" aria-hidden /><span className="num">{hud.coins}</span></span>
      <span className="pill"><span className="ico star"><Icon.star /></span><span className="num">{hud.stars}</span></span>
    </div>
  );
}

export function XpBar() {
  return (
    <div className="xp">
      <small>{hud.level}</small>
      <div className="bar"><b /></div>
      <small>{hud.xp} / {hud.xpMax} XP</small>
    </div>
  );
}

export function Bubble() {
  const [first, second] = tutor.lines;
  const [pre, post] = first.split('print()');
  return (
    <div className="bubble">
      <div className="who"><Icon.chat width="18" height="18" />{tutor.name}</div>
      <p>{pre}<code>print()</code>{post}</p>
      <p style={{ marginTop: 6 }}>{second}</p>
    </div>
  );
}

export function QuestCard() {
  return (
    <article className="card quest">
      <span className="tag">{quest.tag}</span>
      <h3>{quest.title}</h3>
      <p>{quest.body}</p>
      <div className="row">
        <div className="reward">
          <span className="chip"><span className="stars"><Icon.star /><Icon.star /><Icon.star style={{ opacity: 0.3 }} /></span></span>
          <span className="chip">{quest.reward}</span>
          <span className="chip"><span className="ico coin" style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-block' }} />{quest.coins}</span>
        </div>
        <a className="btn alt" href="#"><Icon.play />{quest.cta}</a>
      </div>
    </article>
  );
}

/** 아주 단순한 파이썬 하이라이터 (문자열/주석/키워드) */
export function Py({ line }) {
  const parts = [];
  const re = /(#.*$)|("[^"]*"|'[^']*'|f"[^"]*")|\b(for|in|print|if|else|def|return)\b/g;
  let last = 0;
  let m;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const cls = m[1] ? 'tk-c' : m[2] ? 'tk-s' : 'tk-k';
    parts.push(<span key={m.index} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <>{parts}{'\n'}</>;
}

export function CodeDemo() {
  return (
    <div className="code">
      <div className="bar"><i /><i /><i /><span style={{ marginLeft: 6 }}>main.py</span></div>
      <pre>{codeDemo.map((l, i) => <Py key={i} line={l} />)}</pre>
      <div className="out">▶ {codeDemoOutput}</div>
    </div>
  );
}
