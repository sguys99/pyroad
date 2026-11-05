// 퀘스트 (#quest) — 책 펼침: 왼쪽 쪽 이야기(삽화 + 파이뱀 대사 + 해 볼 일 + 힌트), 오른쪽 쪽 줄 공책(에디터 + 결과)
// 모바일: 한 쪽씩 넘기는 구조 (이야기 → 공책 → 결과), 코드 키보드 툴바, "퀴즈로 보기" 토글
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { goScreen } from '../shared/app';
import { Icon, RewardIcon } from '../shared/icons';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { BugBug } from '../shared/characters/Friends';
import { quest as questText, STAGES } from '../shared/content';
import type { RigState } from '../shared/rig/params';
import { EXPECTED, GENERIC_HINTS, HINTS, KEY_CODE, QUIZ_SAMPLE, WRONG, tutorLine } from './data';
import { matches, runPython, type RunResult } from './fakePython';
import { MagicBoxScene, Landmark } from './art';
import { Bubble, Hud, InkButton, Sheet, Stars, pageTurn } from './ui';
import { getB, setB, toast, useB } from './state';
import { celebrate, countUp, inkReveal, onCelebrate, popIn } from './fx';

type Tab = 'story' | 'code' | 'result' | 'quiz';

function parseId(id: string) {
  const [s, q] = id.split('-');
  return { stage: Number(s), quest: q === 'q' ? null : Number(q) };
}

export function Quest() {
  const questId = useB((s) => s.questId);
  return <QuestInner key={questId} questId={questId} />;
}

function QuestInner({ questId }: { questId: string }) {
  const { stage, quest: qn } = parseId(questId);
  const q = questText(stage, qn ?? 1);
  const id = qn ? `${stage}-${qn}` : questId;
  const stageTitle = STAGES.find((s) => s.order === stage)?.title ?? '';
  const [mode, setMode] = useState<'code' | 'quiz'>(qn ? 'code' : 'quiz');

  const wrap = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 980);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= 940);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 코드 퀘스트 상태
  const [code, setCode] = useState(q.starter);
  const [result, setResult] = useState<(RunResult & { pass: boolean }) | null>(null);
  const [runs, setRuns] = useState(0);
  const [hints, setHints] = useState(0);
  const [keyUsed, setKeyUsed] = useState(false);
  const [py, setPy] = useState<{ state: RigState; text: string }>({ state: 'idle', text: tutorLine(q) });
  const [reward, setReward] = useState<null | { stars: number; xp: number; coins: number }>(null);
  const [tab, setTab] = useState<Tab>(qn ? 'story' : 'quiz');
  const paperRef = useRef<HTMLDivElement | null>(null);
  const stampRef = useRef<HTMLDivElement | null>(null);
  const pageHost = useRef<HTMLDivElement | null>(null);
  const prevTab = useRef<Tab>(tab);

  const maxStars = keyUsed ? 1 : hints === 0 ? 3 : hints === 1 ? 2 : 1;
  const hintList = HINTS[id] ?? GENERIC_HINTS;

  // 모바일 쪽 넘김
  useLayoutEffect(() => {
    const order: Tab[] = ['story', 'code', 'quiz', 'result'];
    const p = prevTab.current;
    prevTab.current = tab;
    if (p === tab || wide) return;
    pageTurn(pageHost.current, { dir: order.indexOf(tab) >= order.indexOf(p) ? 1 : -1, ms: 560 });
  }, [tab]);

  // 축하 카드 (celebrate 이벤트를 듣는다)
  useEffect(
    () =>
      onCelebrate((kind, d) => {
        if (kind === 'success' || kind === 'quiz-right') {
          const stars = d.stars ?? 3;
          window.setTimeout(() => setReward({ stars, xp: d.xp ?? q.xp, coins: d.coins ?? 10 + stars * 5 }), kind === 'success' ? 900 : 700);
        }
      }),
    [q.xp],
  );

  const run = (src = code) => {
    const r = runPython(src);
    const pass = !r.error && matches(r.output, EXPECTED[id]);
    setResult({ ...r, pass });
    setRuns((n) => n + 1);
    if (pass) {
      setPy({ state: 'cheer', text: id === '2-1' ? '해냈다! 상자에 "파이뱀" 이름표가 딱 붙었어요. 통과 도장 쾅!' : '해냈어요! 나온 글자가 해 볼 일과 딱 맞아요. 통과 도장 쾅!' });
      window.setTimeout(() => setPy((p) => (p.state === 'cheer' ? { ...p, state: 'happy' } : p)), 1600);
    } else if (r.error) {
      setPy({ state: 'think', text: '괜찮아요, 버그는 고치라고 있는 거예요. 버그버그가 준 단서를 같이 볼까요?' });
    } else {
      setPy({ state: 'think', text: '돌아가긴 했는데 나온 글자가 조금 달라요. 해 볼 일을 다시 읽어 봐요!' });
    }
    if (!wide) setTab('result');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (pass) celebrate('success', { stamp: stampRef.current, paper: paperRef.current, stars: maxStars, xp: q.xp });
        else celebrate('fail', { paper: paperRef.current });
      }),
    );
  };

  const useHint = () => {
    if (hints >= hintList.length) return;
    setHints((h) => h + 1);
    setPy({ state: 'talk', text: hints === 0 ? '힌트를 하나 꺼냈어요! 힌트를 쓰면 받을 수 있는 별이 줄지만, 그래도 괜찮아요.' : `힌트 ${hints + 1}번이에요. 천천히 읽어 봐요.` });
    window.setTimeout(() => setPy((p) => ({ ...p, state: 'idle' })), 1800);
  };
  const useKey = () => {
    const b = getB();
    if (b.keys <= 0) {
      toast('황금 열쇠가 없어요', 'warn');
      return;
    }
    const filled = KEY_CODE[id];
    if (!filled) {
      toast('이 퀘스트의 황금 열쇠는 진짜 앱에서 써요 (프로토타입은 2-1만)', 'info');
      return;
    }
    setB({ keys: b.keys - 1 });
    setKeyUsed(true);
    setCode(filled);
    setPy({ state: 'talk', text: '황금 열쇠로 정답 주문을 펼쳤어요! 한 줄씩 읽어 보고 "코드 돌려보기"를 눌러 봐요.' });
    if (!wide) setTab('code');
  };
  const tryWrong = () => {
    const w = WRONG[id] ?? q.starter.replace('"', '');
    setCode(w);
    run(w);
  };

  const story = (
    <StoryPage
      kicker={`1권 · ${stageTitle} · 퀘스트 ${qn ? id : '퀴즈'}`}
      title={mode === 'quiz' ? QUIZ_SAMPLE.title : q.title}
      story={q.story}
      task={mode === 'quiz' ? '코드를 읽고 나올 글자를 골라 보세요. 처음에 맞히면 별 3개!' : q.task}
      stage={stage}
      py={py}
      hints={mode === 'code' ? { list: hintList, used: hints, onUse: useHint, maxStars, keyUsed, onKey: useKey } : null}
      showRig={wide || tab === 'story'}
      onNext={!wide ? () => setTab(mode === 'quiz' ? 'quiz' : 'code') : undefined}
      nextLabel={mode === 'quiz' ? '퀴즈 풀기' : '공책 펼치기'}
    />
  );

  const notebook = (
    <NotebookPage
      paperRef={paperRef}
      stampRef={stampRef}
      code={code}
      setCode={setCode}
      starter={q.starter}
      errLine={result?.error?.line ?? null}
      onRun={() => run()}
      onWrong={tryWrong}
      showToolbar={!wide}
      passed={!!result?.pass}
    >
      {wide && <ResultSlip result={result} runs={runs} id={id} />}
    </NotebookPage>
  );

  const quiz = <QuizPage paperRef={paperRef} stampRef={stampRef} onReward={(s) => setReward({ stars: s, xp: 30, coins: 10 + s * 5 })} />;

  const tabs: { id: Tab; label: string }[] =
    mode === 'quiz'
      ? [
          { id: 'story', label: '이야기' },
          { id: 'quiz', label: '퀴즈' },
        ]
      : [
          { id: 'story', label: '이야기' },
          { id: 'code', label: '공책' },
          { id: 'result', label: '결과' },
        ];

  const switchMode = (m: 'code' | 'quiz') => {
    setMode(m);
    setTab(m === 'quiz' ? (wide ? 'quiz' : 'quiz') : wide ? 'story' : 'code');
    setPy({ state: 'talk', text: m === 'quiz' ? '이번엔 퀴즈! 코드를 읽기만 하고 답을 골라요. 키보드가 없어도 돼요.' : tutorLine(q) });
    window.setTimeout(() => setPy((p) => ({ ...p, state: 'idle' })), 1500);
  };

  return (
    <>
      <Hud back={{ to: 'stage', label: '차례' }} />
      <main className="b-quest" ref={wrap}>
        <div className="b-quest-bar">
          <span className="b-quest-crumb">
            <Icon name="book" size={20} strokeWidth={2.4} /> 1권 · {stageTitle}
          </span>
          <div className="b-seg" role="group" aria-label="퀘스트 보기 방식">
            <button type="button" aria-pressed={mode === 'code'} onClick={() => switchMode('code')}>
              <Icon name="code" size={18} strokeWidth={2.4} /> 코드
            </button>
            <button type="button" aria-pressed={mode === 'quiz'} onClick={() => switchMode('quiz')}>
              <Icon name="hint" size={18} strokeWidth={2.4} /> 퀴즈로 보기
            </button>
          </div>
        </div>
        {wide ? (
          <div className="b-spread">
            <div className="b-spread-l">{story}</div>
            <div className="b-spread-spine" aria-hidden />
            <div className="b-spread-r">{mode === 'quiz' ? quiz : notebook}</div>
            <span className="b-spread-no b-spread-no-l" aria-hidden>
              {stage * 10 + (qn ?? 0) * 2}
            </span>
            <span className="b-spread-no b-spread-no-r" aria-hidden>
              {stage * 10 + (qn ?? 0) * 2 + 1}
            </span>
          </div>
        ) : (
          <div className="b-onepage">
            <div className="b-ribbons" role="tablist" aria-label="쪽 고르기">
              {tabs.map((t, i) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="b-ribbon-tab" onClick={() => setTab(t.id)}>
                  <span className="b-ribbon-n">{i + 1}</span>
                  {t.label}
                  {t.id === 'result' && result && <span className={`b-ribbon-dot ${result.pass ? 'is-good' : 'is-bad'}`} aria-label={result.pass ? '통과' : '버그 있음'} />}
                </button>
              ))}
            </div>
            <div className="b-page-host" ref={pageHost} role="tabpanel">
              {tab === 'story' && story}
              {tab === 'code' && notebook}
              {tab === 'quiz' && quiz}
              {tab === 'result' && (
                <div className="b-page b-result-page" ref={paperRef}>
                  <div className="b-result-top">
                    <PybaemRig style="B" state={py.state} size={92} talking={false} />
                    <Bubble text={py.text} tone={result?.pass ? 'good' : 'tutor'} />
                  </div>
                  <div className="b-result-stampzone">
                    <ResultSlip result={result} runs={runs} id={id} />
                    {result?.pass && (
                      <div className="b-stamp b-stamp-big b-result-stamp" ref={stampRef} aria-hidden>
                        <span>통과!</span>
                      </div>
                    )}
                  </div>
                  <div className="b-result-actions">
                    {result?.pass ? (
                      <InkButton variant="primary" iconRight="arrowRight" onClick={() => setReward({ stars: maxStars, xp: q.xp, coins: 10 + maxStars * 5 })}>
                        보상 받기
                      </InkButton>
                    ) : (
                      <InkButton variant="primary" icon="code" onClick={() => setTab('code')}>
                        공책으로 돌아가 고치기
                      </InkButton>
                    )}
                    {!result && <p className="b-muted">공책에서 “코드 돌려보기”를 누르면 여기에 결과가 나와요.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <RewardSheet reward={reward} onClose={() => setReward(null)} title={mode === 'quiz' ? QUIZ_SAMPLE.title : q.title} />
    </>
  );
}

// ───────────── 왼쪽 쪽: 이야기

interface HintCtl {
  list: string[];
  used: number;
  onUse: () => void;
  maxStars: number;
  keyUsed: boolean;
  onKey: () => void;
}

function StoryPage({
  kicker,
  title,
  story,
  task,
  stage,
  py,
  hints,
  showRig,
  onNext,
  nextLabel,
}: {
  kicker: string;
  title: string;
  story: string;
  task: string;
  stage: number;
  py: { state: RigState; text: string };
  hints: HintCtl | null;
  showRig: boolean;
  onNext?: () => void;
  nextLabel: string;
}) {
  const artRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => inkReveal(artRef.current, '50% 60%', 900), []);
  const keys = useB((s) => s.keys);
  return (
    <article className="b-page b-story">
      <span className="b-kicker">{kicker}</span>
      <h1 className="b-h1 b-story-t">{title}</h1>
      <div className="b-story-art" ref={artRef}>
        {stage === 2 ? (
          <MagicBoxScene />
        ) : (
          <svg viewBox="-160 -120 320 140" className="b-quest-art" aria-hidden>
            <rect x="-160" y="-120" width="320" height="140" fill="#EAF1DA" />
            <Landmark stage={stage} mode="ink" />
          </svg>
        )}
      </div>
      <p className="b-story-p">{story}</p>
      <div className="b-task">
        <span className="b-task-k">해 볼 일</span>
        <p>{task}</p>
      </div>
      {showRig && (
        <div className="b-tutor">
          <div className="b-tutor-rig">
            <PybaemRig style="B" state={py.state} size={112} talking={false} />
          </div>
          <Bubble key={py.text} text={py.text} />
        </div>
      )}
      {hints && (
        <div className="b-hints">
          <div className="b-hints-head">
            <span className="b-hints-k">
              지금 받을 수 있는 별 <Stars n={hints.maxStars} size={20} />
            </span>
            <div className="b-hints-btns">
              <InkButton variant="paper" size="sm" icon="hint" onClick={hints.onUse} disabled={hints.used >= hints.list.length}>
                힌트 {hints.used}/{hints.list.length}
              </InkButton>
              <InkButton variant="gold" size="sm" onClick={hints.onKey} disabled={hints.keyUsed} aria-label={`황금 열쇠 쓰기, ${keys}개 남음`}>
                <RewardIcon kind="key" style="B" size={22} /> 황금 열쇠
              </InkButton>
            </div>
          </div>
          {hints.used > 0 && (
            <ol className="b-notes">
              {hints.list.slice(0, hints.used).map((h, i) => (
                <HintNote key={i} n={i + 1} total={hints.list.length} text={h} />
              ))}
            </ol>
          )}
        </div>
      )}
      {onNext && (
        <div className="b-story-next">
          <InkButton variant="primary" iconRight="arrowRight" onClick={onNext}>
            {nextLabel}
          </InkButton>
        </div>
      )}
    </article>
  );
}

function HintNote({ n, total, text }: { n: number; total: number; text: string }) {
  const ref = useRef<HTMLLIElement | null>(null);
  useEffect(() => popIn(ref.current), []);
  return (
    <li className="b-note" ref={ref} style={{ ['--r' as string]: `${n % 2 ? -1.6 : 1.2}deg` }}>
      <span className="b-note-k">
        힌트 {n}/{total}
      </span>
      {text}
    </li>
  );
}

// ───────────── 오른쪽 쪽: 줄 공책 에디터

const PY_KW = /\b(if|elif|else|for|while|def|return|and|or|not|in|True|False|None)\b/;
function highlight(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  src.split('\n').forEach((line, li) => {
    const re = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([\p{L}_][\p{L}\p{N}_]*)|([^\s\p{L}\d#"'_]+|\s+)/gu;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(line))) {
      const [t] = m;
      let cls = '';
      if (m[1]) cls = 'tk-c';
      else if (m[2]) cls = 'tk-s';
      else if (m[3]) cls = 'tk-n';
      else if (m[4]) cls = PY_KW.test(t) && new RegExp(`^${PY_KW.source}$`).test(t) ? 'tk-k' : /^(print|int|str|len|input|range)$/.test(t) && line.slice(re.lastIndex).trimStart().startsWith('(') ? 'tk-f' : '';
      out.push(
        cls ? (
          <span key={`${li}-${k++}`} className={cls}>
            {t}
          </span>
        ) : (
          t
        ),
      );
    }
    out.push('\n');
  });
  return out;
}

const KEYS: { label: string; ins: string; caret?: number; aria?: string }[] = [
  { label: '" "', ins: '""', caret: 1, aria: '따옴표 한 쌍' },
  { label: '( )', ins: '()', caret: 1, aria: '괄호 한 쌍' },
  { label: ')', ins: ')', aria: '닫는 괄호' },
  { label: '=', ins: ' = ', aria: '등호' },
  { label: ':', ins: ':', aria: '쌍점' },
  { label: '+', ins: ' + ', aria: '더하기' },
  { label: '#', ins: '# ', aria: '주석' },
  { label: '⇥', ins: '    ', aria: '들여쓰기 4칸' },
  { label: 'print', ins: 'print()', caret: 6, aria: 'print 괄호' },
];

function NotebookPage({
  paperRef,
  stampRef,
  code,
  setCode,
  starter,
  errLine,
  onRun,
  onWrong,
  showToolbar,
  passed,
  children,
}: {
  paperRef: MutableRefObject<HTMLDivElement | null>;
  stampRef: MutableRefObject<HTMLDivElement | null>;
  code: string;
  setCode: (s: string) => void;
  starter: string;
  errLine: number | null;
  onRun: () => void;
  onWrong: () => void;
  showToolbar: boolean;
  passed: boolean;
  children?: ReactNode;
}) {
  const ta = useRef<HTMLTextAreaElement | null>(null);
  const lines = code.split('\n').length;
  const insert = (k: (typeof KEYS)[number]) => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart ?? code.length;
    const e = el.selectionEnd ?? s;
    const next = code.slice(0, s) + k.ins + code.slice(e);
    setCode(next);
    const pos = s + (k.caret ?? k.ins.length);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };
  return (
    <div className="b-page b-notebook" ref={paperRef}>
      <div className="b-notebook-head">
        <span className="b-notebook-t">
          <Icon name="code" size={22} strokeWidth={2.4} /> 나의 주문 공책
        </span>
        <button type="button" className="b-textbtn" onClick={() => setCode(starter)}>
          <Icon name="refresh" size={18} strokeWidth={2.4} /> 처음 코드로
        </button>
      </div>
      <div className="b-editor">
        <div className="b-gutter" aria-hidden>
          {Array.from({ length: Math.max(lines, 6) }, (_, i) => (
            <span key={i} className={errLine === i + 1 ? 'is-err' : ''}>
              {i + 1}
            </span>
          ))}
        </div>
        <div className="b-code">
          <div className="b-code-box">
            {errLine && <span className="b-errband" style={{ top: `calc(var(--b-pad) + ${(errLine - 1) * 26}px)` }} aria-hidden />}
            <pre className="b-code-hl" aria-hidden>
              {highlight(code)}
            </pre>
            <textarea
              ref={ta}
              className="b-code-ta"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && !e.shiftKey) {
                  e.preventDefault();
                  insert(KEYS[7]);
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onRun();
                }
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="파이썬 코드 공책"
              rows={Math.max(lines, 6)}
            />
          </div>
        </div>
        {passed && (
          <div className="b-stamp b-stamp-big b-notebook-stamp" ref={stampRef} aria-hidden>
            <span>통과!</span>
          </div>
        )}
      </div>
      {showToolbar && (
        <div className="b-keys" role="toolbar" aria-label="코드 키보드">
          {KEYS.map((k) => (
            <button key={k.label} type="button" className="b-key" aria-label={k.aria} onPointerDown={(e) => e.preventDefault()} onClick={() => insert(k)}>
              {k.label}
            </button>
          ))}
        </div>
      )}
      <div className="b-run-row">
        <InkButton variant="primary" size="lg" icon="play" onClick={onRun} className="b-run">
          코드 돌려보기
        </InkButton>
        <button type="button" className="b-textbtn b-wrongbtn" onClick={onWrong}>
          <Icon name="close" size={18} strokeWidth={2.6} /> 틀린 코드로 해 보기
        </button>
      </div>
      {children}
    </div>
  );
}

// ───────────── 결과 쪽지 (출력 창 + 버그버그)

function ResultSlip({ result, runs, id }: { result: (RunResult & { pass: boolean }) | null; runs: number; id: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (runs) inkReveal(ref.current, '8% 30%', 700);
  }, [runs]);
  const exp = EXPECTED[id];
  return (
    <div className="b-result">
      <div className={`b-slip ${result?.error ? 'is-err' : result?.pass ? 'is-good' : ''}`} ref={ref} aria-live="polite">
        <span className="b-slip-k">
          <Icon name="flag" size={18} strokeWidth={2.4} /> 나온 글자
        </span>
        {!result && <span className="b-slip-empty">아직 돌려 보지 않았어요. 주문을 쓰고 “코드 돌려보기”를 눌러요!</span>}
        {result && (
          <pre className="b-slip-out">
            {result.output.length ? result.output.join('\n') : result.error ? '' : '(아무것도 나오지 않았어요)'}
            {result.error && (
              <span className="b-slip-err">
                {result.output.length ? '\n' : ''}
                {result.error.line}번째 줄 · {result.error.kind}: {result.error.message}
              </span>
            )}
          </pre>
        )}
      </div>
      {result && !result.pass && (
        <div className="b-bugzone" key={runs}>
          <BugBug style="B" mood="found" size={92} motion="appear-bob" label="버그버그" />
          <Bubble
            who="버그버그"
            tone="bug"
            text={
              result.error
                ? `히히, ${result.error.line}번째 줄에서 버그 발견! ${result.error.kid}`
                : `돌아가긴 했는데 글자가 달라요! ${typeof exp === 'string' ? `해 볼 일에서는 “${exp.split('\n')[0]}”${exp.includes('\n') ? ' …' : ''}가 나와야 해요.` : '해 볼 일을 다시 읽어 볼까?'}`
            }
          />
        </div>
      )}
      {result?.pass && (
        <div className="b-bugzone is-fixed" key={`ok${runs}`}>
          <BugBug style="B" mood="fixed" size={80} motion="appear" label="버그버그" />
          <p className="b-good b-bugzone-ok">버그버그도 “졌다!” 하고 웃어요. 버그 0개!</p>
        </div>
      )}
    </div>
  );
}

// ───────────── 퀴즈 (객관식, 보기 섞기, 3번 틀리면 해설)

function QuizPage({
  paperRef,
  stampRef,
  onReward,
}: {
  paperRef: MutableRefObject<HTMLDivElement | null>;
  stampRef: MutableRefObject<HTMLDivElement | null>;
  onReward: (stars: number) => void;
}) {
  const choices = useMemo(() => [...QUIZ_SAMPLE.choices].sort(() => Math.random() - 0.5), []);
  const [wrong, setWrong] = useState<string[]>([]);
  const [solved, setSolved] = useState<null | number>(null);
  const [last, setLast] = useState<string | null>(null);
  const revealed = wrong.length >= 3 && solved === null;
  const pick = (c: (typeof choices)[number]) => {
    if (solved !== null || revealed || wrong.includes(c.id)) return;
    setLast(c.id);
    if (c.correct) {
      const stars = wrong.length === 0 ? 3 : wrong.length === 1 ? 2 : 1;
      setSolved(stars);
      requestAnimationFrame(() => celebrate('quiz-right', { stamp: stampRef.current, paper: paperRef.current, stars, xp: 30 }));
    } else {
      setWrong((w) => [...w, c.id]);
      celebrate('quiz-wrong', { paper: paperRef.current });
    }
  };
  const lastWrong = choices.find((c) => c.id === last && !c.correct);
  return (
    <div className="b-page b-quiz" ref={paperRef}>
      <div className="b-notebook-head">
        <span className="b-notebook-t">
          <Icon name="hint" size={22} strokeWidth={2.4} /> {QUIZ_SAMPLE.title}
        </span>
        <span className="b-quiz-try">기회 {Math.max(0, 3 - wrong.length)}번</span>
      </div>
      <p className="b-quiz-q">{QUIZ_SAMPLE.question}</p>
      <pre className="b-quiz-code">{highlight(QUIZ_SAMPLE.code)}</pre>
      <ul className="b-choices">
        {choices.map((c, i) => {
          const isWrong = wrong.includes(c.id);
          const isRight = c.correct && (solved !== null || revealed);
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`b-choice ${isWrong ? 'is-wrong' : ''} ${isRight ? 'is-right' : ''}`}
                onClick={() => pick(c)}
                aria-disabled={isWrong || solved !== null || revealed}
              >
                <span className="b-choice-n">{'가나다라'[i]}</span>
                <code className="b-choice-t">{c.text}</code>
                {isWrong && <Icon name="close" size={22} strokeWidth={2.8} label="틀림" />}
                {isRight && <Icon name="check" size={22} strokeWidth={2.8} label="정답" />}
              </button>
            </li>
          );
        })}
      </ul>
      {lastWrong && solved === null && !revealed && (
        <div className="b-bugzone" key={lastWrong.id}>
          <BugBug style="B" mood="found" size={76} motion="appear-bob" label="버그버그" />
          <Bubble who="버그버그" tone="bug" text={`앗, 그건 아니야! ${lastWrong.why}`} />
        </div>
      )}
      {revealed && (
        <div className="b-explain">
          <b>정답은 “보물”이에요</b>
          <p>{QUIZ_SAMPLE.explain}</p>
          <InkButton variant="primary" iconRight="arrowRight" onClick={() => onReward(1)}>
            별 1개 받고 넘어가기
          </InkButton>
        </div>
      )}
      {solved !== null && (
        <>
          <div className="b-explain is-good">
            <b>정답! {solved === 3 ? '한 번에 맞혔어요' : '끝까지 찾아냈어요'}</b>
            <p>{QUIZ_SAMPLE.explain}</p>
          </div>
          <div className="b-stamp b-stamp-big b-quiz-stamp" ref={stampRef} aria-hidden>
            <span>정답!</span>
          </div>
        </>
      )}
    </div>
  );
}

// ───────────── 축하 카드 (최소: 별 + 보상 숫자. P2-05에서 풍성하게)

function RewardSheet({ reward, onClose, title }: { reward: null | { stars: number; xp: number; coins: number }; onClose: () => void; title: string }) {
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const starsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!reward) return;
    setCoins(0);
    setXp(0);
    const t = window.setTimeout(() => {
      starsRef.current?.querySelectorAll('svg').forEach((s, i) => popIn(s, i * 160));
      countUp(0, reward.coins, 700, setCoins);
      countUp(0, reward.xp, 700, setXp);
    }, 120);
    return () => window.clearTimeout(t);
  }, [reward]);
  const finish = (to: 'next' | 'map') => {
    if (reward) setB((s) => ({ coins: s.coins + reward.coins, xp: Math.min(s.xpNext, s.xp + reward.xp) }));
    onClose();
    if (to === 'map') goScreen('world');
    else {
      setB({ questId: '2-2' });
      toast('다음 퀘스트: 숫자 상자와 글자 상자', 'good');
    }
  };
  return (
    <Sheet open={!!reward} onClose={() => finish('next')} label="퀘스트 통과 보상">
      {reward && (
        <div className="b-reward">
          <span className="b-kicker">퀘스트 통과</span>
          <h2 className="b-h2">{title}</h2>
          <div className="b-reward-stars" ref={starsRef}>
            <Stars n={reward.stars} size={54} />
          </div>
          <div className="b-reward-row">
            <span className="b-reward-item">
              <RewardIcon kind="coin" style="B" size={34} />
              <b className="b-num">+{coins}</b>
              <span>코인</span>
            </span>
            <span className="b-reward-item">
              <Icon name="sparkle" size={30} strokeWidth={2.2} />
              <b className="b-num">+{xp}</b>
              <span>경험치</span>
            </span>
          </div>
          {reward.stars < 3 && <p className="b-muted">힌트 없이 다시 풀면 별을 더 모을 수 있어요. 차례에서 “별 채우기”를 눌러요!</p>}
          <div className="b-reward-actions">
            <InkButton variant="primary" size="lg" iconRight="arrowRight" onClick={() => finish('next')} data-autofocus>
              다음 퀘스트
            </InkButton>
            <InkButton variant="paper" icon="map" onClick={() => finish('map')}>
              지도로
            </InkButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}
