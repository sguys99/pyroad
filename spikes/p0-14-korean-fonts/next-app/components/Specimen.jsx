import { hero, parents, features, codeAlign, tableItems, gridRows } from '@/content';
import { Topbar, Mascot, Bubble, QuestCard, XpBar, Icon, Py } from './parts';

// 한글·전각 = 2칸, 나머지 = 1칸 (터미널 wcwidth와 같은 규칙의 단순판)
const isWide = (ch) => /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch);
const width = (s) => [...s].reduce((w, ch) => w + (isWide(ch) ? 2 : 1), 0);
const padW = (s, n) => s + ' '.repeat(Math.max(0, n - width(s)));
const padPy = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].length)); // 파이썬 str.ljust / f"{s:<n}"
const rjust = (s, n) => ' '.repeat(Math.max(0, n - [...String(s)].length)) + s;

const COMMENT_COL = 26;
const aligned = [
  ['점수 = 10', '# 점수를 저장해요'],
  ['이름 = "파이뱀"', '# 이름을 저장해요'],
  ['print("안녕, 파이뱀!")', '# 인사하기'],
].map(([code, cm]) => padW(code, COMMENT_COL) + cm);

const codeLines = [codeAlign[0], codeAlign[1], '', ...aligned, '', codeAlign[7], codeAlign[8]];
const outPy = tableItems.map(([n, c]) => `${padPy(n, 6)}|${rjust(c, 3)}`);
const outW = tableItems.map(([n, c]) => `${padW(n, 10)}|${rjust(c, 3)}`);

// 폰트가 적용된 뒤 각 패널에서 주석 '#'의 x 위치와 한글/영문 폭 비를 실측해 판정 문구를 채운다.
const measureScript = `
(function(){
  function run(){
    document.querySelectorAll('[data-mono]').forEach(function(panel){
      var pre = panel.querySelector('pre'); var xs = [];
      var walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      var node; while ((node = walker.nextNode())) {
        var i = node.data.indexOf('# ');
        if (i >= 0 && /저장|인사/.test(node.data)) { var r = document.createRange(); r.setStart(node, i); r.setEnd(node, i+1); xs.push(r.getBoundingClientRect().left); }
      }
      var cs = getComputedStyle(pre); var c = document.createElement('canvas').getContext('2d');
      c.font = cs.fontSize + ' ' + cs.fontFamily;
      var ratio = c.measureText('가').width / c.measureText('a').width;
      var spread = xs.length ? Math.max.apply(null, xs) - Math.min.apply(null, xs) : NaN;
      var ok = spread < 0.75 && Math.abs(ratio - 2) < 0.01;
      var v = panel.querySelector('.verdict');
      v.innerHTML = (ok ? '<b class="ok">정렬 OK</b>' : '<b class="ng">정렬 깨짐</b>') +
        '<span>한글/영문 폭 ' + ratio.toFixed(3) + '× · 주석 # 위치 차 ' + spread.toFixed(1) + 'px</span>';
      panel.setAttribute('data-ratio', ratio.toFixed(4)); panel.setAttribute('data-spread', spread.toFixed(2));
    });
    document.documentElement.setAttribute('data-measured', '1');
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function(){ setTimeout(run, 300); });
})();`;

function CodePanel({ name, family, note }) {
  return (
    <div className="code" data-mono={name}>
      <div className="bar"><i /><i /><i /><span style={{ marginLeft: 6 }}>{name}</span></div>
      <pre style={{ fontFamily: family }}>
        <span className="guide" style={{ left: `calc(16px + ${COMMENT_COL}ch)` }} aria-hidden />
        {codeLines.map((l, i) => <Py key={i} line={l} />)}
      </pre>
      <div className="verdict">측정 중…</div>
      {note ? <div className="verdict" style={{ opacity: 0.8 }}>{note}</div> : null}
    </div>
  );
}

/**
 * @param stack 'a' | 'b'
 * @param meta  { stackName, title, body, code } 표시용 이름
 * @param titleOptions [{ name, family, weight, note }]
 * @param monos [{ name, family, note }]
 * @param bodyAlt { name, family, weight } 본문 대안(예: 손글씨를 본문에 썼을 때)
 */
export default function Specimen({ stack, meta, titleOptions, monos, bodyAlt }) {
  return (
    <div className="wrap">
      <Topbar />
      <div className="spec-head">
        <span className="spec-kicker">P0-14 TYPE SPECIMEN · {meta.stackName}</span>
        <span className="spec-kicker">제목 {meta.title} · 본문 {meta.body} · 코드 {meta.code}</span>
      </div>

      <section className="hero">
        <div>
          <span className="eyebrow">{hero.eyebrow}</span>
          <h1 className="display" id="hero-title">{hero.title[0]}<br /><em>{hero.title[1]}</em></h1>
          <p className="lead">{hero.subtitle}</p>
          <div className="cta">
            <a className="btn" href="#"><Icon.play />{hero.ctaPrimary}</a>
            <a className="btn alt" href="#">퀘스트 이어하기</a>
            <a className="btn ghost" href="#">{hero.ctaSecondary}</a>
          </div>
          <div style={{ marginTop: 22, maxWidth: 520 }}><XpBar /></div>
        </div>
        <div className="stage">
          <Bubble />
          <div style={{ position: 'relative', width: '100%', display: 'grid', justifyItems: 'center' }}>
            <div className="island" />
            <Mascot />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid two">
          <QuestCard />
          <article className="card">
            <span className="badge b-coral"><Icon.chat /></span>
            <h3>{features[1].title}</h3>
            <p>{features[1].body}</p>
            <p style={{ marginTop: 10 }}>{features[2].body}</p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2>타입 스케일</h2>
        <div className="scale">
          <div className="row"><span className="spec-label">Display · {meta.title} · {stack === 'a' ? '36–64px / 1.16' : '42–76px / 1.06'}</span><span className="title" style={{ fontSize: 'var(--display-size)', lineHeight: 'var(--display-lh)' }}>섬이 열렸어요!</span></div>
          <div className="row"><span className="spec-label">H2 · {meta.title} · {stack === 'a' ? '24–34px' : '30–42px'}</span><span className="title" style={{ fontSize: 'var(--h2-size)', lineHeight: 1.2 }}>스테이지 2 · 변수의 숲</span></div>
          <div className="row"><span className="spec-label">HUD · {meta.title} · 18px</span><span className="title" style={{ fontSize: 28 }}>Lv. 7 · 코인 1,280 · 별 42 · 340/500 XP</span></div>
          <div className="row"><span className="spec-label">Body L · {meta.body} · 18/1.7</span><p style={{ fontSize: 18, lineHeight: 1.7 }}>{hero.subtitle}</p></div>
          <div className="row"><span className="spec-label">Body · {meta.body} · 17/{stack === 'a' ? '1.7' : '1.8'} · keep-all</span><p>{parents.body}</p></div>
          <div className="row"><span className="spec-label">Caption · {meta.body} · 14/1.6</span><p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)' }}>힌트를 쓰지 않고 성공하면 별 3개! 힌트는 언제든 다시 볼 수 있어요.</p></div>
          <div className="row"><span className="spec-label">Bold 강조 · {meta.body} 700</span><p><strong>정답을 바로 알려 주지 않고</strong>, 스스로 찾도록 힌트를 줘요.</p></div>
        </div>
      </section>

      <section className="section">
        <h2>제목 폰트 후보</h2>
        <div className="titles">
          {titleOptions.map((t) => (
            <article className="card" key={t.name}>
              <span className="spec-label">{t.name}</span>
              <span className="sample" style={{ fontFamily: t.family, fontWeight: t.weight }}>파이썬 모험!</span>
              <span style={{ fontFamily: t.family, fontWeight: t.weight, fontSize: 24 }}>Lv. 12 · 1,280 코인 · 퀘스트 완료</span>
              <span style={{ fontFamily: t.family, fontWeight: t.weight, fontSize: 24 }}>희귀 글자: <mark>똠</mark>방각하 · <mark>햏</mark> · <mark>뷁</mark> · <mark>쌰</mark></span>
              {t.note ? <span className="note">{t.note}</span> : null}
            </article>
          ))}
        </div>
        {bodyAlt ? (
          <div className="grid two" style={{ marginTop: 16 }}>
            <article className="card">
              <span className="spec-label">본문 {meta.body} · 17px</span>
              <p>{features[3].body} {features[0].body}</p>
            </article>
            <article className="card">
              <span className="spec-label">{bodyAlt.name} · 17px (본문으로 썼을 때)</span>
              <p style={{ fontFamily: bodyAlt.family, fontWeight: bodyAlt.weight, fontSize: bodyAlt.size ?? 17 }}>{features[3].body} {features[0].body}</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="section">
        <h2>코드 글꼴: 한글 정렬</h2>
        <p className="note" style={{ marginBottom: 12 }}>
          세로 격자 = 1ch(그 글꼴의 &apos;0&apos; 폭). 빨간 선 = 주석 열({COMMENT_COL}칸). 한글이 정확히 2칸이어야 주석과 표가 맞습니다.
        </p>
        <div className="cmp">
          {monos.map((m) => <CodePanel key={m.name} {...m} />)}
        </div>
        <div className="grid two out-table" style={{ marginTop: 16 }}>
          <div className="code">
            <div className="bar"><i /><i /><i /><span style={{ marginLeft: 6 }}>실행 결과 · f&quot;{'{name:<6}'}&quot; (글자 수 기준)</span></div>
            <pre>{outPy.join('\n')}{'\n'}</pre>
            <div className="verdict"><b className="ng">D2Coding에서도 어긋남</b><span>파이썬은 한글도 1글자로 셈</span></div>
          </div>
          <div className="code">
            <div className="bar"><i /><i /><i /><span style={{ marginLeft: 6 }}>실행 결과 · 표시 폭 기준으로 채움 / 괘선 표</span></div>
            <pre>{outW.join('\n')}{'\n\n'}{gridRows.join('\n')}{'\n'}</pre>
            <div className="verdict"><b className="ok">정렬 OK</b><span>한글 = 2칸 가정 (D2Coding 계열)</span></div>
          </div>
        </div>
      </section>

      <footer className="footer">pyRoad · P0-14 한글 웹폰트 스파이크 · 모든 글꼴 SIL OFL 1.1</footer>
      <script dangerouslySetInnerHTML={{ __html: measureScript }} />
    </div>
  );
}
