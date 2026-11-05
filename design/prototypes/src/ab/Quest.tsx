// 퀘스트 #quest: A의 게임 대사창 구조 + B의 종이·잉크 질감. 에디터는 종이 카드 위 코드.
// 데스크톱: 왼쪽 미션 카드 + 대사창 / 오른쪽 에디터 + 실행 + 출력
// 모바일: 이야기 → 코드 → 결과 탭 + 코드 키보드 툴바(§12-Q3 C안), "퀴즈로 보기" 토글로 퀴즈 예시(§4, §12-Q17)
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { goScreen } from '../shared/app';
import { BugBug } from '../shared/characters/Friends';
import { Icon, RewardIcon } from '../shared/icons';
import { getMotion, play, springTiming } from '../shared/motion';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { STAGES, quest as getQuest } from '../shared/content';
import type { RigState } from '../shared/rig/params';
import { PaperIsland } from './art';
import { celebrate } from './celebrate';
import { CodeEditor, highlight, type EditorHandle } from './Editor';
import { BUGGY_CODE, DEFAULT_HINTS, EXPECTED, HINTS, INTRO, KEY_CODE, QUIZ, STAGE_BUILDING, questProgress, shuffle } from './data';
import { fakeRun, type RunError } from './fakeRun';
import { setAb, toast, useAb } from './store';
import { Dialogue, GameButton, Hud, KindBadge, Stars } from './ui';

type Tab = 'story' | 'code' | 'result';
type Outcome = { kind: 'ok'; out: string[] } | { kind: 'wrong'; out: string[]; expected: string } | { kind: 'error'; out: string[]; err: RunError } | null;

function useWide(min: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWide(el.clientWidth >= min));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, wide };
}

export function Quest() {
  const qsel = useAb((s) => s.quest);
  const q = getQuest(qsel.stage, qsel.order);
  const stage = STAGES.find((s) => s.order === qsel.stage)!;
  const prog = questProgress(qsel.stage, q);
  const [mode, setMode] = useState<'code' | 'quiz'>(prog.kind === 'quiz' ? 'quiz' : 'code');
  useEffect(() => setMode(prog.kind === 'quiz' ? 'quiz' : 'code'), [qsel.stage, qsel.order, prog.kind]);
  const { ref, wide } = useWide(900);
  const id = `${qsel.stage}-${qsel.order}`;

  return (
    <div className="ab-page ab-questpage" ref={ref}>
      <Hud back={{ label: '섬으로', onPress: () => (setAb({ stage: qsel.stage }), goScreen('stage')) }} />
      <main className="ab-quest-main-wrap">
        <div className="ab-quest-bar">
          <div className="ab-quest-bar-title">
            <span className="ab-quest-bar-no">{id}</span>
            <div>
              <p className="ab-quest-bar-stage">
                {stage.title} · <KindBadge kind={mode === 'quiz' ? 'quiz' : prog.kind === 'quiz' ? 'code' : prog.kind} />
              </p>
              <h1 className="ab-display ab-quest-h1">{mode === 'quiz' ? QUIZ.title : q.title}</h1>
            </div>
          </div>
          <div className="ab-mode-toggle" role="group" aria-label="문제 유형 보기">
            <button type="button" aria-pressed={mode === 'code'} onClick={() => setMode('code')}>
              <Icon name="code" size={18} strokeWidth={2.4} /> 코드
            </button>
            <button type="button" aria-pressed={mode === 'quiz'} onClick={() => setMode('quiz')}>
              <Icon name="chat" size={18} strokeWidth={2.4} /> 퀴즈로 보기
            </button>
          </div>
        </div>
        {mode === 'code' ? <CodeQuest key={id} id={id} wide={wide} /> : <QuizQuest key={`quiz${id}`} wide={wide} />}
      </main>
    </div>
  );
}

// ───────────── 코드 퀘스트

const KEYS: { label: string; text: string; back?: number; aria?: string }[] = [
  { label: '( )', text: '()', back: 1, aria: '괄호' },
  { label: '" "', text: '""', back: 1, aria: '따옴표' },
  { label: '=', text: ' = ', aria: '같다 기호' },
  { label: ':', text: ':', aria: '쌍점' },
  { label: '⇥', text: '    ', aria: '들여쓰기' },
  { label: 'print', text: 'print()', back: 1 },
  { label: '#', text: '# ', aria: '주석' },
  { label: '+', text: ' + ', aria: '더하기' },
];

function CodeQuest({ id, wide }: { id: string; wide: boolean }) {
  const qsel = useAb((s) => s.quest);
  const keys = useAb((s) => s.keys);
  const q = getQuest(qsel.stage, qsel.order);
  const [code, setCode] = useState(q.starter);
  const [tab, setTab] = useState<Tab>('story');
  const [hints, setHints] = useState(0);
  const [keyUsed, setKeyUsed] = useState(false);
  const [keyAsk, setKeyAsk] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [running, setRunning] = useState(false);
  const editor = useRef<EditorHandle | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);
  const hintList = HINTS[id] ?? DEFAULT_HINTS;

  const talk = useMemo(() => {
    if (outcome?.kind === 'ok') return { who: '파이뱀', text: '해냈어! 숫자 상자에는 10, 글자 상자에는 "안녕"이 쏙 들어갔어.', state: 'cheer' as RigState };
    if (outcome?.kind === 'error') return { who: '파이뱀', text: '버그버그가 뭔가 찾았나 봐. 빨간 줄을 같이 볼까?', state: 'think' as RigState };
    if (outcome?.kind === 'wrong') return { who: '파이뱀', text: '거의 다 왔어! 나온 글자와 기대한 글자를 비교해 보자.', state: 'think' as RigState };
    if (hints > 0) return { who: '파이뱀', text: `힌트 ${hints}: ${hintList[hints - 1]}`, state: 'think' as RigState };
    return { who: '파이뱀', text: INTRO[id] ?? `${q.title}! 미션을 읽고 빈칸을 채워 봐. 막히면 힌트를 눌러도 돼.`, state: 'talk' as RigState };
  }, [outcome, hints, q, hintList, id]);

  const starsNow = keyUsed ? 1 : hints === 0 ? 3 : hints <= 1 ? 2 : 1;

  const run = () => {
    if (running) return;
    setRunning(true);
    const m = getMotion();
    window.setTimeout(
      () => {
        const r = fakeRun(code);
        const expected = EXPECTED[id];
        let o: Outcome;
        if (r.error) o = { kind: 'error', out: r.out, err: r.error };
        else if (expected !== undefined && r.out.join('\n') !== expected) o = { kind: 'wrong', out: r.out, expected };
        else if (!r.out.length) o = { kind: 'wrong', out: r.out, expected: expected ?? '(무언가 출력하기)' };
        else o = { kind: 'ok', out: r.out };
        setOutcome(o);
        setRunning(false);
        if (!wide) setTab('result');
        requestAnimationFrame(() => {
          play(outRef.current, [{ transform: 'translateY(10px)' }, { transform: 'none' }], springTiming('prop'));
          if (o?.kind === 'error' || o?.kind === 'wrong') {
            const card = outRef.current;
            if (card && m.tier === 'full' && !m.reduced) card.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 260 });
          }
        });
        if (o.kind === 'ok') {
          window.setTimeout(
            () =>
              celebrate('quest', {
                title: q.title,
                stars: starsNow,
                xp: q.xp,
                coins: 10 + starsNow * 5,
                note: keyUsed ? '황금키로 통과했어요. 다음에 직접 풀면 별을 더 받을 수 있어요.' : hints ? `힌트 ${hints}번으로 통과! 힌트 없이 풀면 별 3개예요.` : '힌트 없이 한 번에! 별 3개 모두 받았어요.',
                onNext: () => {
                  const next = STAGES.find((s) => s.order === qsel.stage)!.quests.find((x) => x.order === qsel.order + 1);
                  if (next) setAb({ quest: { stage: qsel.stage, order: qsel.order + 1 } });
                  else goScreen('stage');
                },
                onMap: () => goScreen('world'),
              }),
            m.reduced ? 0 : 500,
          );
        }
      },
      m.reduced || m.tier === 'minimal' ? 0 : 450,
    );
  };

  const onHint = () => {
    if (hints >= hintList.length) {
      toast('힌트를 모두 봤어요. 황금키를 써도 돼요!');
      return;
    }
    setHints(hints + 1);
    setOutcome(null);
    if (!wide) setTab('story');
  };
  const onKey = () => {
    setKeyAsk(false);
    if (keys <= 0) return toast('황금키가 없어요');
    setAb({ keys: keys - 1 });
    setKeyUsed(true);
    setCode(KEY_CODE[id] ?? q.starter);
    setOutcome(null);
    toast('황금키로 예시 코드를 채웠어요. 돌려 볼까요?', 'good');
    if (!wide) setTab('code');
  };

  const mission = (
    <section className="ab-mission" aria-labelledby="ab-mission-title">
      <div className="ab-mission-art" aria-hidden>
        <PaperIsland kind={STAGE_BUILDING[qsel.stage - 1]} />
      </div>
      <p className="ab-mission-kicker">이야기</p>
      <p className="ab-mission-story">{q.story}</p>
      <div className="ab-mission-task">
        <h2 id="ab-mission-title" className="ab-display ab-h3">
          <Icon name="flag" size={22} strokeWidth={2.6} /> 미션
        </h2>
        <p>{q.task}</p>
      </div>
      <ul className="ab-goals" aria-label="배울 것">
        {q.goals.map((g) => (
          <li key={g}>
            <Icon name="check" size={18} strokeWidth={2.8} /> {g}
          </li>
        ))}
      </ul>
      <div className="ab-mission-tools">
        <button type="button" className="ab-tool" onClick={onHint}>
          <Icon name="hint" size={22} strokeWidth={2.4} />
          <span>
            힌트 <b>{hints}</b>/{hintList.length}
          </span>
        </button>
        <div className="ab-key-wrap">
          <button type="button" className="ab-tool ab-tool-key" aria-expanded={keyAsk} onClick={() => setKeyAsk(!keyAsk)}>
            <RewardIcon kind="key" style="AB" size={26} />
            <span>
              황금키 <b>{keys}</b>
            </span>
          </button>
          {keyAsk && (
            <div className="ab-key-pop" role="dialog" aria-label="황금키 쓰기">
              <p>황금키를 쓰면 예시 코드가 채워지고, 이 퀘스트의 별은 1개가 돼요.</p>
              <div className="ab-key-pop-row">
                <GameButton variant="lemon" size="sm" onPress={onKey}>
                  쓸래요
                </GameButton>
                <GameButton variant="paper" size="sm" onPress={() => setKeyAsk(false)}>
                  아니요
                </GameButton>
              </div>
            </div>
          )}
        </div>
        <span className="ab-star-goal" aria-label={`지금 풀면 별 ${starsNow}개`}>
          <Stars n={starsNow} size={20} label={`지금 풀면 별 ${starsNow}개`} />
        </span>
      </div>
      {hints > 0 && (
        <ol className="ab-hint-list" aria-label="본 힌트">
          {hintList.slice(0, hints).map((h, i) => (
            <li key={i}>
              <span className="ab-hint-no">{i + 1}</span>
              {h}
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  const dialogue = (
    <Dialogue
      who={talk.who}
      text={talk.text}
      portrait={<PybaemRig style="AB" state={talk.state} talking size={wide ? 132 : 104} framing="avatar" />}
    />
  );

  const editorCard = (
    <section className="ab-codecard" aria-label="코드 쓰기">
      <div className="ab-codecard-head">
        <span className="ab-codecard-tab">
          <Icon name="code" size={18} strokeWidth={2.4} /> quest_{id.replace('-', '_')}.py
        </span>
        <button type="button" className="ab-textbtn" onClick={() => (setCode(q.starter), setOutcome(null))}>
          <Icon name="refresh" size={20} strokeWidth={2.4} /> 처음 코드로
        </button>
      </div>
      <CodeEditor ref={editor} value={code} onChange={setCode} label={`${q.title} 코드`} errorLine={outcome?.kind === 'error' ? outcome.err.line : null} />
      <div className="ab-codekeys" role="toolbar" aria-label="코드 키보드">
        {KEYS.map((k) => (
          <button key={k.label} type="button" className="ab-codekey" aria-label={k.aria ? `${k.aria} 넣기` : `${k.label} 넣기`} onPointerDown={(e) => e.preventDefault()} onClick={() => editor.current?.insert(k.text, k.back)}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="ab-run-row">
        <GameButton variant="primary" size="lg" icon="play" onPress={run} className="ab-run-btn" aria-busy={running}>
          {running ? '돌리는 중…' : '코드 돌려보기'}
        </GameButton>
        <GameButton variant="paper" size="sm" icon="close" onPress={() => (setCode(BUGGY_CODE[id] ?? 'print("안녕)'), setOutcome(null))}>
          틀린 코드로 해 보기
        </GameButton>
      </div>
    </section>
  );

  const output = (
    <section className={`ab-output ${outcome ? `is-${outcome.kind}` : ''}`} aria-label="실행 결과" ref={outRef}>
      <div className="ab-output-head">
        <span className="ab-out-label">출력</span>
        {outcome?.kind === 'ok' && (
          <span className="ab-status ab-status-ok">
            <Icon name="check" size={18} strokeWidth={3} /> 성공
          </span>
        )}
        {outcome?.kind === 'error' && (
          <span className="ab-status ab-status-err">
            <Icon name="close" size={18} strokeWidth={3} /> 버그 발견
          </span>
        )}
        {outcome?.kind === 'wrong' && <span className="ab-status ab-status-warn">출력이 달라요</span>}
      </div>
      <pre className="ab-out-text" aria-live="polite">
        {running ? '파이썬이 코드를 읽고 있어요…' : outcome ? [...outcome.out, ...(outcome.kind === 'error' ? [outcome.err.short] : [])].join('\n') || '(출력 없음)' : '코드를 돌리면 여기에 결과가 나와요'}
      </pre>
      {outcome && outcome.kind !== 'ok' && (
        <div className="ab-bugtalk">
          <div className="ab-bughole">
            <span className="ab-paper-hole" aria-hidden />
            <BugBug style="AB" mood="found" size={wide ? 96 : 84} motion="appear-bob" />
          </div>
          <div className="ab-bugbubble">
            <span className="ab-nametag ab-nametag-red">버그버그</span>
            <p>
              {outcome.kind === 'error'
                ? outcome.err.talk
                : `기대한 출력은 "${outcome.expected.replace('\n', ' / ')}"인데, 나온 건 "${outcome.out.join(' / ') || '없음'}"이야. 어디가 다른지 찾아봐!`}
            </p>
          </div>
        </div>
      )}
      {outcome?.kind === 'ok' && (
        <p className="ab-ok-line">
          <Icon name="sparkle" size={20} strokeWidth={2.4} /> 기대한 출력과 똑같아요!
        </p>
      )}
    </section>
  );

  if (wide)
    return (
      <div className="ab-quest-grid">
        <div className="ab-quest-left">
          {mission}
          {dialogue}
        </div>
        <div className="ab-quest-right">
          {editorCard}
          {output}
        </div>
      </div>
    );

  return (
    <div className="ab-quest-mobile">
      <div className="ab-tabs" role="tablist" aria-label="퀘스트 단계">
        {(
          [
            ['story', '이야기', 'book'],
            ['code', '코드', 'code'],
            ['result', '결과', 'play'],
          ] as const
        ).map(([t, label, icon], i) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`ab-tab ${tab === t ? 'is-on' : ''}`} onClick={() => setTab(t)}>
            <span className="ab-tab-no">{i + 1}</span>
            <Icon name={icon} size={18} strokeWidth={2.4} />
            {label}
            {t === 'result' && outcome && <span className={`ab-tab-dot is-${outcome.kind}`} aria-label={outcome.kind === 'ok' ? '성공' : '확인 필요'} />}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab === 'story' ? '이야기' : tab === 'code' ? '코드' : '결과'} className="ab-tabpanel">
        {tab === 'story' && (
          <>
            {dialogue}
            {mission}
            <GameButton variant="primary" size="lg" block iconRight="arrowRight" onPress={() => setTab('code')}>
              코드 쓰러 가기
            </GameButton>
          </>
        )}
        {tab === 'code' && editorCard}
        {tab === 'result' && (
          <>
            {output}
            {outcome?.kind !== 'ok' && (
              <GameButton variant="secondary" size="md" block icon="code" onPress={() => setTab('code')}>
                코드 고치러 가기
              </GameButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ───────────── 퀴즈 퀘스트 (객관식, 보기 섞기, 3번 틀리면 해설 + ⭐)

function QuizQuest({ wide }: { wide: boolean }) {
  const [seed, setSeed] = useState(() => Date.now());
  const choices = useMemo(() => shuffle(QUIZ.choices, seed), [seed]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState<'correct' | 'reveal' | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const attempts = wrong.length;
  const starsFor = (w: number) => (w === 0 ? 3 : w === 1 ? 2 : 1);

  const pick = (id: string) => {
    if (done || wrong.includes(id)) return;
    const c = QUIZ.choices.find((x) => x.id === id)!;
    const btn = listRef.current?.querySelector<HTMLElement>(`[data-choice='${id}']`);
    if (c.correct) {
      setDone('correct');
      play(btn, [{ transform: 'scale(1.06)' }, { transform: 'none' }], springTiming('jellyAB'));
      const stars = starsFor(attempts);
      window.setTimeout(
        () => celebrate('quiz', { title: QUIZ.title, stars, xp: 30, coins: 10 + stars * 5, note: attempts === 0 ? '첫 번에 맞혔어요! 별 3개.' : `${attempts + 1}번째에 맞혔어요.`, nextLabel: '다시 풀어 보기', onNext: () => reset(), onMap: () => goScreen('world') }),
        getMotion().reduced ? 0 : 600,
      );
      return;
    }
    const w = [...wrong, id];
    setWrong(w);
    const m = getMotion();
    if (btn && !m.reduced && m.tier !== 'minimal') btn.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 280 });
    if (w.length >= 3) setDone('reveal');
  };
  const reset = () => {
    setSeed(Date.now() + 7);
    setWrong([]);
    setDone(null);
  };
  const talk =
    done === 'correct'
      ? '정답! 상자에는 마지막에 넣은 값만 남아.'
      : done === 'reveal'
        ? `괜찮아, 같이 보자. ${QUIZ.explain}`
        : attempts > 0
          ? QUIZ.wrongTalk[Math.min(attempts - 1, QUIZ.wrongTalk.length - 1)]
          : '코드를 한 줄씩 읽어 보고, 무엇이 나올지 골라 봐!';

  return (
    <div className={`ab-quiz ${wide ? 'is-wide' : ''}`}>
      <Dialogue
        who="파이뱀"
        text={talk}
        portrait={<PybaemRig style="AB" state={done === 'correct' ? 'cheer' : done === 'reveal' ? 'think' : attempts ? 'think' : 'talk'} talking size={wide ? 120 : 96} framing="avatar" />}
      />
      <section className="ab-quiz-card" aria-labelledby="ab-quiz-q">
        <div className="ab-quiz-top">
          <h2 id="ab-quiz-q" className="ab-quiz-q">
            {QUIZ.question}
          </h2>
          <span className="ab-quiz-tries" aria-label={`틀린 횟수 ${attempts}번, 3번 틀리면 해설`}>
            {[0, 1, 2].map((i) => (
              <RewardIcon key={i} kind="heart" style="AB" size={24} className={i < 3 - attempts ? '' : 'is-lost'} />
            ))}
          </span>
        </div>
        <pre className="ab-quiz-code">{highlight(QUIZ.code)}</pre>
        <div className="ab-choices" ref={listRef}>
          {choices.map((c, i) => {
            const isWrong = wrong.includes(c.id);
            const show = (done === 'correct' || done === 'reveal') && c.correct;
            return (
              <button
                key={c.id}
                type="button"
                data-choice={c.id}
                className={`ab-choice ${isWrong ? 'is-wrong' : ''} ${show ? 'is-right' : ''}`}
                aria-disabled={isWrong || !!done}
                onClick={() => pick(c.id)}
              >
                <span className="ab-choice-key">{'ABCD'[i]}</span>
                <span className="ab-choice-text">{c.text}</span>
                {isWrong && <Icon name="close" size={22} strokeWidth={3} label="틀림" />}
                {show && <Icon name="check" size={22} strokeWidth={3} label="정답" />}
              </button>
            );
          })}
        </div>
        {done === 'reveal' && (
          <div className="ab-explain" role="status">
            <h3 className="ab-display ab-h3">해설</h3>
            <p>{QUIZ.explain}</p>
            <div className="ab-explain-row">
              <Stars n={1} size={22} label="별 1개로 클리어" />
              <GameButton
                variant="primary"
                size="md"
                iconRight="arrowRight"
                onPress={() => celebrate('quiz', { title: QUIZ.title, stars: 1, xp: 30, coins: 15, note: '해설을 보고 클리어했어요. 내일 다시 풀면 별을 더 받을 수 있어요.', nextLabel: '다시 풀어 보기', onNext: reset, onMap: () => goScreen('world') })}
              >
                알겠어요, 클리어!
              </GameButton>
            </div>
          </div>
        )}
        <p className="ab-quiz-rule">첫 번에 맞히면 ★3 · 두 번째 ★2 · 그다음 ★1 · 3번 틀리면 해설을 보고 ★1</p>
      </section>
    </div>
  );
}
