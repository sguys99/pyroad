// 퀘스트 화면 (#quest): 게임 대사창 + 클레이 에디터 + 큼직한 3D 버튼
// - 데스크톱: 왼쪽 대사창·미션 / 오른쪽 에디터·버튼·출력
// - 모바일: 위에 대사창(작게) 고정 + [미션 | 코드 | 결과] 탭 + 아래 버튼 막대, 코드 탭에 코드 키보드 툴바(§12-Q3 C안)
// - "퀴즈로 보기" 토글: 같은 화면에서 객관식 퀴즈 예시 (보기 섞기, 3번 틀리면 해설, §12-Q17)
import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, quest } from '../shared/content';
import { Icon, RewardIcon } from '../shared/icons';
import { play } from '../shared/motion';
import { BugBug } from '../shared/characters/Friends';
import { celebrate, jelly } from './celebrate';
import { runPython, tokenize, type RunResult } from './pyfake';
import { PLAYABLE, getStore, setStore, useStore } from './store';
import { CelebrationLayer, ClayButton, Dialogue, Hud, Sheet, Stars, toast, type Speaker } from './ui';

const ORDER = Object.keys(PLAYABLE);

export function QuestScreen() {
  const s = useStore();
  const key = PLAYABLE[s.quest] ? s.quest : '2-1';
  const [so, qo] = key.split('-').map(Number);
  const q = quest(so, qo);
  const stage = STAGES.find((x) => x.order === so)!;
  const next = () => {
    const i = ORDER.indexOf(key);
    setStore({ quest: ORDER[(i + 1) % ORDER.length], quiz: false });
  };
  return (
    <div className="a-screen a-quest-screen">
      <Hud back={{ label: '스테이지로 돌아가기', to: 'stage' }} sub={`스테이지 ${so} · ${stage.title}`} title={s.quiz ? '상자 속 글자 맞히기' : `${so}-${qo} ${q.title}`} />
      <div className="a-qbar">
        <span className="a-qbar-type">
          <span className={`a-tag a-tag-${s.quiz ? 'quiz' : 'code'}`}>{s.quiz ? '퀴즈' : '코드'}</span>
          <span className="a-qbar-xp">
            <RewardIcon kind="gem" size={20} style="A" /> +{s.quiz ? 20 : q.xp} 경험치
          </span>
        </span>
        <button type="button" className={`a-switch${s.quiz ? ' is-on' : ''}`} role="switch" aria-checked={s.quiz} onClick={() => setStore({ quiz: !s.quiz })}>
          <span className="a-switch-track" aria-hidden>
            <span className="a-switch-knob" />
          </span>
          퀴즈로 보기
        </button>
      </div>
      {s.quiz ? <QuizView key="quiz" /> : <CodeQuest key={key} qkey={key} />}
      <CelebrationLayer onNext={next} />
    </div>
  );
}

// ───────────── 코드 퀘스트

type Phase = 'idle' | 'running' | 'ok' | 'error' | 'wrong' | 'hint';
type Tab = 'story' | 'code' | 'result';

const INTRO: Record<string, string> = {
  '2-1': '여기는 변수의 숲! 이 마법 상자에 이름표를 붙이면, 안에 넣은 걸 언제든 꺼낼 수 있어. name 상자에 내 이름 "파이뱀"을 넣어 줄래?',
  '2-2': '숲에 상자가 두 종류 있어! 숫자는 따옴표 없이, 글자는 따옴표로 감싸서 넣는 거야.',
  '2-3': '상자 안의 색깔을 바꿀 수 있을까? 같은 이름에 새 값을 넣으면 바뀌어!',
  '1-1': '파이썬 마을에 온 걸 환영해! print()로 마을 사람들에게 첫 인사를 해 보자.',
  '1-2': '마을 사람들이 네 소개를 기다려! print()를 두 번 쓰면 두 줄이 나와.',
};
const HINTS = [
  '상자에 값을 넣을 때는 이름 = 값 모양으로 써. 왼쪽이 상자 이름, 오른쪽이 넣을 값이야.',
  '글자는 꼭 따옴표로 감싸야 해! "파이뱀"처럼 말이야.',
  '거의 다 왔어! name = "파이뱀" 이라고 쓰고, 다음 줄은 그대로 두면 돼.',
];

function CodeQuest({ qkey }: { qkey: string }) {
  const [so, qo] = qkey.split('-').map(Number);
  const q = quest(so, qo);
  const play_ = PLAYABLE[qkey];
  const [code, setCode] = useState(q.starter);
  const [phase, setPhase] = useState<Phase>('idle');
  const [res, setRes] = useState<RunResult | null>(null);
  const [hints, setHints] = useState(0);
  const [usedKey, setUsedKey] = useState(false);
  const [keySheet, setKeySheet] = useState(false);
  const [tab, setTab] = useState<Tab>('story');
  const [size, setSize] = useState(16);
  const runBtn = useRef<HTMLButtonElement | null>(null);
  const ta = useRef<HTMLTextAreaElement | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);
  const store = useStore();

  const run = (src = code) => {
    setPhase('running');
    setRes(null);
    window.setTimeout(() => {
      const r = runPython(src);
      setRes(r);
      setTab('result');
      if (r.error) {
        setPhase('error');
        play(outRef.current, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 300 }, { minimal: null });
        return;
      }
      const got = r.out.join('\n');
      if (got.trim() === play_.expected) {
        setPhase('ok');
        const stars = usedKey ? 1 : hints === 0 ? 3 : hints === 1 ? 2 : 1;
        window.setTimeout(() => celebrate('quest-clear', { from: runBtn.current, stars, xp: q.xp, coins: 10 + stars * 5 }), 700);
      } else setPhase('wrong');
    }, 650);
  };

  const speaker: Speaker = phase === 'error' || phase === 'wrong' ? 'bugbug' : 'pybaem';
  const line = (() => {
    if (phase === 'running') return '두근두근… 코드를 돌리는 중이야!';
    if (phase === 'ok') return `우와, 출력 창에 "${play_.expected.split('\n')[0]}"이(가) 나왔어! 완벽해!`;
    if (phase === 'error' && res?.error) return `${res.error.say} (${res.error.line}번째 줄)`;
    if (phase === 'wrong') return `코드는 돌아갔는데 결과가 달라! 나와야 할 글자: ${play_.expected.replace(/\n/g, ' / ')}`;
    if (phase === 'hint') return HINTS[Math.min(hints, HINTS.length) - 1];
    return INTRO[qkey] ?? q.story;
  })();
  const rigState = phase === 'running' || phase === 'hint' ? 'think' : phase === 'ok' ? 'cheer' : 'talk';

  const insert = (txt: string) => {
    const el = ta.current;
    if (!el) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    const pair = txt === '(' ? ')' : txt === '"' ? '"' : txt === '[' ? ']' : '';
    const v = code.slice(0, a) + txt + pair + code.slice(b);
    setCode(v);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + txt.length, a + txt.length);
    });
  };

  const useHint = () => {
    if (hints >= HINTS.length) {
      toast('힌트를 모두 봤어요! 황금키를 써 볼까요?', 'hint');
      return;
    }
    setHints(hints + 1);
    setPhase('hint');
    setTab('story');
  };
  const wrongDemo = () => {
    setCode(play_.wrong);
    run(play_.wrong);
  };
  const errLine = phase === 'error' ? res?.error?.line : undefined;

  return (
    <main className={`a-qmain a-tab-${tab}`}>
      <div className="a-q-left">
        <Dialogue speaker={speaker} text={line} rigState={rigState} className="a-q-dlg" />
        <div className="a-qtabs" role="tablist" aria-label="퀘스트 보기">
          {(
            [
              ['story', '미션', 'flag'],
              ['code', '코드', 'code'],
              ['result', '결과', 'play'],
            ] as const
          ).map(([id, label, icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`a-qtab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>
              <Icon name={icon} size={20} strokeWidth={2.6} />
              {label}
              {id === 'result' && (phase === 'error' || phase === 'wrong') && <span className="a-qtab-dot" aria-label="버그 있음" />}
            </button>
          ))}
        </div>
        <section className="a-card a-mission a-q-panel a-q-story" aria-labelledby="a-mission-title">
          <h2 id="a-mission-title" className="a-mission-title">
            <span className="a-mission-ic" aria-hidden>
              <Icon name="flag" size={20} strokeWidth={2.6} />
            </span>
            미션
          </h2>
          <p className="a-mission-task">{q.task}</p>
          <ul className="a-goals">
            {q.goals.map((g) => (
              <li key={g}>
                <Icon name="check" size={18} strokeWidth={3} />
                {g}
              </li>
            ))}
          </ul>
          <div className="a-expect">
            <span className="a-expect-label">이렇게 나오면 성공</span>
            <code>{play_.expected}</code>
          </div>
          <div className="a-mission-foot">
            <span className="a-mission-stars">
              <Stars n={usedKey ? 1 : 3 - Math.min(hints, 2)} size={22} />
              <span>{hints === 0 && !usedKey ? '힌트 없이 풀면 별 3개' : `지금 풀면 별 ${usedKey ? 1 : 3 - Math.min(hints, 2)}개`}</span>
            </span>
            <ClayButton variant="secondary" size="sm" iconRight="arrowRight" className="a-only-mobile" onClick={() => setTab('code')}>
              코드 쓰러 가기
            </ClayButton>
          </div>
        </section>
      </div>

      <div className="a-q-right">
        <section className="a-editor a-q-panel a-q-code" aria-label="코드 에디터">
          <div className="a-editor-head">
            <span className="a-editor-file">
              <Icon name="code" size={18} strokeWidth={2.6} />
              main.py
            </span>
            <span className="a-editor-tools">
              <button type="button" className="a-ibtn" onClick={() => setSize((v) => Math.max(14, v - 2))} aria-label="글자 작게" disabled={size <= 14}>
                가<small>-</small>
              </button>
              <button type="button" className="a-ibtn" onClick={() => setSize((v) => Math.min(20, v + 2))} aria-label="글자 크게" disabled={size >= 20}>
                가<small>+</small>
              </button>
              <button
                type="button"
                className="a-ibtn"
                onClick={() => {
                  setCode(q.starter);
                  setPhase('idle');
                  setRes(null);
                }}
                aria-label="처음 코드로 되돌리기"
              >
                <Icon name="refresh" size={18} strokeWidth={2.6} />
              </button>
            </span>
          </div>
          <CodeEditor value={code} onChange={setCode} errorLine={errLine} taRef={ta} size={size} />
          <div className="a-kbd" role="toolbar" aria-label="코드 키보드">
            {['(', ')', '"', ':', '=', '+', '[', ']', '#'].map((k) => (
              <button key={k} type="button" className="a-key" onPointerDown={(e) => e.preventDefault()} onClick={() => insert(k)} aria-label={`${k} 넣기`}>
                {k}
              </button>
            ))}
            <button type="button" className="a-key a-key-wide" onPointerDown={(e) => e.preventDefault()} onClick={() => insert('    ')} aria-label="들여쓰기 넣기">
              <Icon name="arrowRight" size={16} strokeWidth={2.8} />
              들여쓰기
            </button>
            <button type="button" className="a-key a-key-wide" onPointerDown={(e) => e.preventDefault()} onClick={() => insert('print(')} aria-label="print 넣기">
              print
            </button>
          </div>
        </section>

        <section ref={outRef} className={`a-out a-q-panel a-q-result a-out-${phase}`} aria-labelledby="a-out-title" aria-live="polite">
          <div className="a-out-head">
            <h2 id="a-out-title">실행 결과</h2>
            {phase === 'ok' && (
              <span className="a-status a-status-ok">
                <Icon name="check" size={18} strokeWidth={3} />
                성공
              </span>
            )}
            {(phase === 'error' || phase === 'wrong') && (
              <span className="a-status a-status-bug">
                <Icon name="close" size={18} strokeWidth={3} />
                버그 발견
              </span>
            )}
          </div>
          <div className="a-out-body">
            {phase === 'running' && <p className="a-out-wait">실행 중…</p>}
            {phase !== 'running' && !res && <p className="a-out-empty">아직 실행 전이에요. ‘코드 돌려보기’를 눌러 봐요!</p>}
            {res && (
              <pre className="a-out-pre">
                {res.out.map((l, i) => (
                  <span key={i} className="a-out-line">
                    {l || ' '}
                  </span>
                ))}
                {res.error && (
                  <span className="a-out-err">
                    {res.error.line}번째 줄 · {res.error.kind}
                  </span>
                )}
              </pre>
            )}
            {(phase === 'error' || phase === 'wrong') && (
              <div className="a-bugnote">
                <BugBug style="A" mood="found" size={72} motion="appear" />
                <p>
                  {phase === 'error' && res?.error ? (
                    <>
                      에디터의 빨간 줄({res.error.line}번째 줄)을 봐! <code className="a-bugnote-code">{code.split('\n')[res.error.line - 1]?.trim()}</code>
                    </>
                  ) : (
                    `나와야 할 글자는 “${play_.expected.replace(/\n/g, ' / ')}”인데, 다른 글자가 나왔어!`
                  )}
                </p>
              </div>
            )}
            {phase === 'ok' && (
              <div className="a-bugnote a-bugnote-ok">
                <BugBug style="A" mood="fixed" size={72} motion="appear" />
                <p>버그버그도 깜짝 놀랐어요. 버그 하나도 없음!</p>
              </div>
            )}
          </div>
        </section>

        <div className="a-actions">
          <ClayButton variant="lemon" size="md" icon="hint" onClick={useHint} label={`힌트 보기, ${HINTS.length}개 중 ${hints}개 봄`} className="a-act-hint">
            <span className="a-hide-xs">힌트</span> {hints}/{HINTS.length}
          </ClayButton>
          <ClayButton variant="white" size="md" onClick={() => setKeySheet(true)} label={`황금키 쓰기, ${store.keys}개 있음`} className="a-act-key">
            <RewardIcon kind="key" size={26} style="A" />
            <span className="a-hide-xs">황금키</span> ×{store.keys}
          </ClayButton>
          <ClayButton ref={runBtn} variant="primary" size="lg" icon="play" onClick={() => run()} disabled={phase === 'running'} className="a-act-run" label="코드 돌려보기">
            <span className="a-run-long">코드 </span>돌려보기
          </ClayButton>
        </div>
        <button type="button" className="a-linkbtn a-wrongdemo" onClick={wrongDemo}>
          <Icon name="refresh" size={18} strokeWidth={2.6} />
          틀린 코드로 해 보기
        </button>
      </div>

      <Sheet open={keySheet} onClose={() => setKeySheet(false)} title="황금키를 쓸까요?">
        <div className="a-keysheet">
          <RewardIcon kind="key" size={72} style="A" />
          <p>황금키를 쓰면 정답 코드를 볼 수 있어요. 이 퀘스트는 별 1개로 끝나요.</p>
          <p className="a-keysheet-note">아껴 두었다가 정말 어려울 때 써도 좋아요!</p>
          <div className="a-keysheet-actions">
            <ClayButton variant="white" size="md" onClick={() => setKeySheet(false)}>
              조금 더 해 볼래
            </ClayButton>
            <ClayButton
              variant="lemon"
              size="md"
              onClick={() => {
                setKeySheet(false);
                if (getStore().keys <= 0) return;
                setStore((s) => ({ keys: s.keys - 1 }));
                setUsedKey(true);
                setCode(play_.answer);
                setPhase('idle');
                setTab('code');
                toast('황금키로 정답 코드를 열었어요!', 'unlock');
              }}
            >
              황금키 쓰기
            </ClayButton>
          </div>
        </div>
      </Sheet>
    </main>
  );
}

// ───────────── 코드 에디터 (textarea + 구문 색 겹치기, D2Coding 짝수 px)

function CodeEditor({
  value,
  onChange,
  errorLine,
  taRef,
  size,
}: {
  value: string;
  onChange: (v: string) => void;
  errorLine?: number;
  taRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  size: number;
}) {
  const pre = useRef<HTMLPreElement | null>(null);
  const gut = useRef<HTMLDivElement | null>(null);
  const lines = value.split('\n');
  const sync = () => {
    const t = taRef.current;
    if (!t) return;
    if (pre.current) {
      pre.current.scrollTop = t.scrollTop;
      pre.current.scrollLeft = t.scrollLeft;
    }
    if (gut.current) gut.current.scrollTop = t.scrollTop;
  };
  useEffect(sync, [value]);
  return (
    <div className="a-code" style={{ '--code-size': `${size}px` } as React.CSSProperties}>
      <div className="a-gutter" ref={gut} aria-hidden>
        {lines.map((_, i) => (
          <span key={i} className={errorLine === i + 1 ? 'is-err' : undefined}>
            {errorLine === i + 1 ? <span className="a-gutter-bug" /> : i + 1}
          </span>
        ))}
      </div>
      <div className="a-code-area">
        <pre className="a-code-pre" ref={pre} aria-hidden>
          {lines.map((l, i) => (
            <span key={i} className={`a-code-line${errorLine === i + 1 ? ' is-err' : ''}`}>
              {tokenize(l).map((t, j) => (
                <span key={j} className={`tk-${t.t}`}>
                  {t.s}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </pre>
        <textarea
          ref={taRef}
          className="a-code-ta"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={sync}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          aria-label="파이썬 코드"
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey) {
              e.preventDefault();
              const el = e.currentTarget;
              const a = el.selectionStart;
              const v = value.slice(0, a) + '    ' + value.slice(el.selectionEnd);
              onChange(v);
              requestAnimationFrame(() => el.setSelectionRange(a + 4, a + 4));
            }
          }}
        />
      </div>
    </div>
  );
}

// ───────────── 퀴즈 (객관식, 보기 섞기, 3번 틀리면 해설)

const QUIZ = {
  code: 'name = "파이뱀"\nprint("name")',
  ask: '이 코드를 실행하면 무엇이 출력될까요?',
  options: [
    { id: 'a', text: 'name', correct: true, why: '' },
    { id: 'b', text: '파이뱀', correct: false, why: '앗! print 안의 name에 따옴표가 있지? 따옴표 안은 글자 그대로 나와.' },
    { id: 'c', text: '"파이뱀"', correct: false, why: '따옴표는 화면에 나오지 않아. print 괄호 안을 다시 볼까?' },
    { id: 'd', text: '오류가 나요', plain: true, correct: false, why: '오류는 안 나! 따옴표로 감싼 건 그냥 글자일 뿐이야.' },
  ],
  explain: 'print("name")은 따옴표 안의 글자 name을 그대로 보여 줘요. 상자 안의 값을 꺼내려면 따옴표 없이 print(name)이라고 써요.',
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizView() {
  const [round, setRound] = useState(0);
  const opts = useMemo(() => shuffle(QUIZ.options), [round]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState<'ok' | 'reveal' | null>(null);
  const btns = useRef<Record<string, HTMLButtonElement | null>>({});
  const lives = 3 - wrong.length;

  const choose = (id: string) => {
    if (solved || wrong.includes(id)) return;
    const o = QUIZ.options.find((x) => x.id === id)!;
    setPicked(id);
    const el = btns.current[id];
    if (o.correct) {
      setSolved('ok');
      jelly(el);
      const stars = 3 - wrong.length;
      window.setTimeout(() => celebrate('quiz-clear', { from: el, stars, xp: 20, coins: 5 + stars * 5 }), 600);
      return;
    }
    const w = [...wrong, id];
    setWrong(w);
    play(el, [{ transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 320 }, { minimal: null });
    if (w.length >= 3) setSolved('reveal');
  };
  const reset = () => {
    setRound((r) => r + 1);
    setWrong([]);
    setPicked(null);
    setSolved(null);
  };
  const last = picked ? QUIZ.options.find((x) => x.id === picked) : null;
  const speaker: Speaker = last && !last.correct && solved !== 'reveal' ? 'bugbug' : 'pybaem';
  const text =
    solved === 'ok'
      ? '정답! 따옴표 안은 글자 그대로 나온다는 걸 알고 있었구나!'
      : solved === 'reveal'
        ? QUIZ.explain
        : last && !last.correct
          ? last.why
          : '상자 속 글자 맞히기! 코드를 잘 읽고 무엇이 나올지 골라 봐.';

  return (
    <main className="a-qmain a-quiz">
      <div className="a-q-left">
        <Dialogue speaker={speaker} text={text} rigState={solved === 'ok' ? 'cheer' : solved === 'reveal' ? 'talk' : 'think'} className="a-q-dlg" />
      </div>
      <div className="a-q-right">
        <section className="a-card a-quizcard" aria-labelledby="a-quiz-q">
          <div className="a-quiz-top">
            <h2 id="a-quiz-q" className="a-quiz-ask">
              {QUIZ.ask}
            </h2>
            <span className="a-lives" role="img" aria-label={`기회 ${lives}번 남음`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < lives ? '' : 'is-off'}>
                  <RewardIcon kind="heart" size={26} style="A" />
                </span>
              ))}
            </span>
          </div>
          <pre className="a-quiz-code">
            {QUIZ.code.split('\n').map((l, i) => (
              <span key={i} className="a-code-line">
                <span className="a-quiz-ln" aria-hidden>
                  {i + 1}
                </span>
                {tokenize(l).map((t, j) => (
                  <span key={j} className={`tk-${t.t}`}>
                    {t.s}
                  </span>
                ))}
                {'\n'}
              </span>
            ))}
          </pre>
          <div className="a-opts" role="group" aria-label="보기">
            {opts.map((o, i) => {
              const isWrong = wrong.includes(o.id);
              const isRight = (solved === 'ok' && o.correct) || (solved === 'reveal' && o.correct);
              return (
                <button
                  key={o.id}
                  ref={(el) => {
                    btns.current[o.id] = el;
                  }}
                  type="button"
                  className={`a-opt${isWrong ? ' is-wrong' : ''}${isRight ? ' is-right' : ''}`}
                  onClick={() => choose(o.id)}
                  disabled={isWrong || (solved !== null && !isRight)}
                  aria-label={`${i + 1}번 ${o.text}${isWrong ? ', 틀림' : ''}${isRight ? ', 정답' : ''}`}
                >
                  <span className="a-opt-no" aria-hidden>
                    {isWrong ? <Icon name="close" size={18} strokeWidth={3} /> : isRight ? <Icon name="check" size={18} strokeWidth={3} /> : i + 1}
                  </span>
                  {'plain' in o ? <span className="a-opt-text a-opt-plain">{o.text}</span> : <code className="a-opt-text">{o.text}</code>}
                </button>
              );
            })}
          </div>
          {solved === 'reveal' && (
            <div className="a-explain">
              <h3>
                <Icon name="book" size={20} strokeWidth={2.6} /> 해설
              </h3>
              <p>{QUIZ.explain}</p>
              <div className="a-explain-actions">
                <span className="a-explain-star">
                  <Stars n={1} size={22} /> 별 1개로 통과
                </span>
                <ClayButton variant="primary" size="md" iconRight="arrowRight" onClick={() => celebrate('quiz-clear', { stars: 1, xp: 20, coins: 10, title: '해설까지 읽었어요!' })}>
                  통과하기
                </ClayButton>
              </div>
            </div>
          )}
          <div className="a-quiz-foot">
            <button type="button" className="a-linkbtn" onClick={reset}>
              <Icon name="refresh" size={18} strokeWidth={2.6} />
              다시 풀기 (보기 섞기)
            </button>
            <button type="button" className="a-linkbtn" onClick={() => setStore({ quiz: false })}>
              <Icon name="code" size={18} strokeWidth={2.6} />
              코드 퀘스트로
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

