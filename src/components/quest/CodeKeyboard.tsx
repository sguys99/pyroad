'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, IndentIncrease, Undo2 } from 'lucide-react';
import type { CodeEditorHandle } from './CodeEditor';
import { setKeyboardInset } from '@/lib/editor/keyboardInset';
import './codeKeyboard.css';

type Key = {
  label: string;
  /** 낭독기 이름 ("따옴표 넣기") */
  name: string;
  /** 넣을 글자와 넣은 뒤 커서 자리(기본: 끝) */
  text?: string;
  caret?: number;
  /** 넣기 대신 할 일 */
  run?: (editor: CodeEditorHandle) => void;
  icon?: React.ReactNode;
};

type Group = { name: string; keys: Key[] };

// 1월드 1~2스테이지(print·주석·따옴표·\n·변수·+·-·str()·int())를 폰 키보드 기호판 없이 쓸 수 있는 묶음. 글자·숫자·띄어쓰기는 폰 키보드로.
// 짝 기호는 한 쌍을 넣고 커서를 가운데에 둔다(시안 Quest.tsx KEYS). 닫는 짝을 건너갈 때는 → 키.
// 360px에서 띠를 넘기지 않고 보이는 앞자리는 가장 자주 쓰는 print() · " " · ( )
const FRONT: Group = {
  name: '자주 쓰는 것',
  keys: [
    { label: 'print()', name: 'print 주문 넣기', text: 'print()', caret: 6 },
    { label: '" "', name: '따옴표 한 쌍 넣기', text: '""', caret: 1 },
    { label: '( )', name: '괄호 한 쌍 넣기', text: '()', caret: 1 },
    { label: '=', name: '같다 기호 넣기', text: '=' },
  ],
};

const SYMBOLS: Group = {
  name: '기호',
  keys: [
    { label: '+', name: '더하기 기호 넣기', text: '+' },
    { label: '-', name: '빼기 기호 넣기', text: '-' },
    { label: '*', name: '곱하기 기호 넣기', text: '*' },
    { label: '/', name: '나누기 기호 넣기', text: '/' },
    { label: '%', name: '나머지 기호 넣기', text: '%' },
    { label: '<', name: '작다 기호 넣기', text: '<' },
    { label: '>', name: '크다 기호 넣기', text: '>' },
    { label: '_', name: '밑줄 넣기', text: '_' },
    { label: ',', name: '쉼표 넣기', text: ',' },
    { label: ':', name: '쌍점 넣기', text: ':' },
    { label: "'", name: '작은따옴표 넣기', text: "'" },
    { label: '#', name: '메모 기호 넣기', text: '#' },
    { label: '\\n', name: '줄바꿈 글자 넣기', text: '\\n' },
    { label: ')', name: '닫는 괄호 넣기', text: ')' },
  ],
};

// 1월드 3스테이지부터 쓰는 주문 (정답 코드 기준: if·elif·else, for·in·range()·while·break, [ ]·append·len, def·return, True·False).
// 낱말은 폰 키보드로도 치지만 띄어쓰기·쌍점까지 한 번에 넣어 준다. stages = 그 개념을 배우는 스테이지(7 = 프로젝트, 모두 섞어 씀) →
// 지금 스테이지 것은 앞자리 바로 뒤 "이번 스테이지" 묶음으로 당겨 오고, 나머지는 "주문" 묶음에
type SpellKey = Key & { stages?: number[] };
const SPELLS: SpellKey[] = [
  { label: 'str()', name: 'str 주문 넣기', text: 'str()', caret: 4 },
  { label: 'int()', name: 'int 주문 넣기', text: 'int()', caret: 4 },
  { label: 'input()', name: 'input 주문 넣기', text: 'input()', caret: 6 },
  { label: 'if', name: 'if 주문 넣기', text: 'if ', stages: [3, 7] },
  { label: 'elif', name: 'elif 주문 넣기', text: 'elif ', stages: [3] },
  { label: 'else:', name: 'else 주문 넣기', text: 'else:', stages: [3, 7] },
  { label: '==', name: '같은지 묻는 기호 넣기', text: ' == ', stages: [3, 7] },
  { label: '!=', name: '다른지 묻는 기호 넣기', text: ' != ', stages: [3] },
  { label: '>=', name: '크거나 같다 기호 넣기', text: ' >= ', stages: [3] },
  { label: '<=', name: '작거나 같다 기호 넣기', text: ' <= ', stages: [3] },
  { label: 'for', name: 'for 주문 넣기', text: 'for ', stages: [4, 5, 7] },
  { label: 'in', name: 'in 주문 넣기', text: ' in ', stages: [4, 5, 7] },
  {
    label: 'range()',
    name: 'range 주문 넣기',
    text: 'range()',
    caret: 6,
    stages: [4, 7],
  },
  { label: 'while', name: 'while 주문 넣기', text: 'while ', stages: [4] },
  { label: 'break', name: 'break 주문 넣기', text: 'break', stages: [4] },
  {
    label: '[ ]',
    name: '대괄호 한 쌍 넣기',
    text: '[]',
    caret: 1,
    stages: [5, 7],
  },
  {
    label: '.append()',
    name: 'append 주문 넣기',
    text: '.append()',
    caret: 8,
    stages: [5, 7],
  },
  {
    label: 'len()',
    name: 'len 주문 넣기',
    text: 'len()',
    caret: 4,
    stages: [5],
  },
  { label: 'def', name: 'def 주문 넣기', text: 'def ', stages: [6, 7] },
  {
    label: 'return',
    name: 'return 주문 넣기',
    text: 'return ',
    stages: [6, 7],
  },
  { label: 'True', name: 'True 넣기', text: 'True' },
  { label: 'False', name: 'False 넣기', text: 'False' },
];

const FIX: Group = {
  name: '고치기',
  keys: [
    {
      label: '들여쓰기',
      name: '들여쓰기 (4칸 띄우기)',
      text: '    ',
      icon: <IndentIncrease aria-hidden />,
    },
    {
      label: '되돌리기',
      name: '되돌리기',
      run: (e) => e.undo(),
      icon: <Undo2 aria-hidden />,
    },
  ],
};

/** 띠 묶음 차례: 앞자리 · (이번 스테이지 주문) · 기호 · 주문 · 고치기 */
export function keyGroups(stage?: number): Group[] {
  const now = SPELLS.filter((k) => stage && k.stages?.includes(stage));
  const rest = SPELLS.filter((k) => !now.includes(k));
  return [
    FRONT,
    ...(now.length ? [{ name: '이번 스테이지 주문', keys: now }] : []),
    SYMBOLS,
    { name: '주문', keys: rest },
    FIX,
  ];
}

// 커서 옮기기는 자주 쓰므로 띠 오른쪽에 고정 (띠를 넘기지 않아도 보임)
const MOVES: Group = {
  name: '커서 옮기기',
  keys: [
    {
      label: '왼쪽',
      name: '커서 왼쪽으로',
      run: (e) => e.moveCursor(-1),
      icon: <ArrowLeft aria-hidden />,
    },
    {
      label: '오른쪽',
      name: '커서 오른쪽으로',
      run: (e) => e.moveCursor(1),
      icon: <ArrowRight aria-hidden />,
    },
  ],
};

/**
 * 모바일 코드 키보드 (P6-04, 최종 시안 NotebookPage `.f-keys`). 공책 에디터 바로 아래에 붙어,
 * 폰 키보드에서 찾기 어려운 기호와 주문을 한 번 눌러 커서 자리에 넣는다.
 * 누를 때 포커스를 뺏지 않아(pointerdown 기본 동작 막기) 폰 키보드가 닫히지 않고, 닫혀 있으면 에디터에 포커스를 주며 넣는다.
 * role=toolbar + 화살표 키 roving(Home·End), 각 키는 한국어 이름. CodePanel이 좁은 화면·터치에서만 지연 로드.
 * 폰 키보드가 올라와 있고 에디터에 커서가 있으면 키보드 바로 위에 붙는다 (P6-11, `useDockAboveKeyboard`)
 */
export default function CodeKeyboard({
  editor,
  stage,
}: {
  editor: RefObject<CodeEditorHandle | null>;
  /** 지금 스테이지 차례 (그 스테이지 주문을 앞으로, P6-11) */
  stage?: number;
}) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const dock = useDockAboveKeyboard(editor, bar);
  const groups = keyGroups(stage);
  const keyCount = [...groups, MOVES].reduce((n, g) => n + g.keys.length, 0);

  const press = (key: Key) => {
    const handle = editor.current;
    if (!handle) return;
    if (key.run) key.run(handle);
    else handle.insert(key.text!, key.caret);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = keyCount - 1;
    const next =
      e.key === 'ArrowRight'
        ? Math.min(active + 1, last)
        : e.key === 'ArrowLeft'
          ? Math.max(active - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    buttons.current[next]?.focus();
  };

  let index = 0;
  const renderGroup = (group: Group, className = 'ck-group') => (
    <div
      key={group.name}
      className={className}
      role="group"
      aria-label={group.name}
    >
      {group.keys.map((key) => {
        const i = index++;
        return (
          <button
            key={key.name}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            className="ck-key font-mono"
            data-kind={/^[.a-zA-Z]/.test(key.label) ? 'spell' : undefined}
            data-icon={key.icon ? '' : undefined}
            aria-label={key.name}
            tabIndex={i === active ? 0 : -1}
            onFocus={() => setActive(i)}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => press(key)}
          >
            {key.icon ?? key.label}
          </button>
        );
      })}
    </div>
  );

  const toolbar = (
    <div
      ref={bar}
      className="ck"
      role="toolbar"
      aria-label="코드 키보드"
      onKeyDown={onKeyDown}
      data-testid="code-keyboard"
      data-docked={dock === null ? undefined : ''}
      style={
        dock === null
          ? undefined
          : ({ '--vv-bottom': `${dock}px` } as CSSProperties)
      }
    >
      <div className="ck-strip">{groups.map((g) => renderGroup(g))}</div>
      {renderGroup(MOVES, 'ck-group ck-moves')}
    </div>
  );
  // 쪽(.qw-page)은 컨테이너 쿼리 상자라 fixed의 기준이 되므로, 붙을 때는 body로 옮긴다. 자리(.ck-slot)는 그대로 남아 공책이 출렁이지 않는다
  return dock === null ? toolbar : createPortal(toolbar, document.body);
}

// 폰 키보드가 가리는 높이가 이보다 크면 "열림" (주소창이 줄어드는 정도는 무시)
const KEYBOARD_MIN_PX = 120;

/**
 * 폰 키보드 위에 붙기 (P6-11). visualViewport 아래 끝(= 폰 키보드 윗변)을 layout viewport 좌표로 돌려준다(null = 붙지 않음).
 * iOS Safari는 키보드가 열려도 layout viewport가 그대로이고 visual viewport만 줄며 위로 밀리기도 해서(offsetTop),
 * `position: fixed; bottom: 0`은 키보드 뒤에 숨는다 → 위 끝(top 0)에서 offsetTop + height 만큼 transform으로 내린다.
 * 크롬 안드로이드(108+ 기본 resizes-visual)도 같은 계산. 동시에 가린 높이(폰 키보드 + 이 띠)를 에디터 scrollMargins에 알려
 * 커서 줄이 띠 위에 보이게 하고, 붙는 순간 한 번 커서 줄로 스크롤한다
 */
function useDockAboveKeyboard(
  editor: RefObject<CodeEditorHandle | null>,
  bar: RefObject<HTMLDivElement | null>,
): number | null {
  const [dock, setDock] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    let docked = false;
    const update = () => {
      raf = 0;
      const bottom = vv.offsetTop + vv.height;
      // 확대(pinch zoom)로 줄어든 visual viewport는 키보드가 아님.
      // shortcut: 확대 + 키보드가 함께면 띠가 layout 폭이라 화면 밖으로 넘침, 실제 기기 보고가 있으면 vv.offsetLeft·width로 맞춤
      const covered = window.innerHeight - vv.height * vv.scale;
      const editing = !!document.activeElement?.closest('.cm-editor');
      const open = editing && covered > KEYBOARD_MIN_PX;
      setDock(open ? bottom : null);
      setKeyboardInset(
        open
          ? window.innerHeight - bottom + (bar.current?.offsetHeight ?? 0)
          : 0,
      );
      if (open && !docked)
        requestAnimationFrame(() => editor.current?.revealCursor());
      docked = open;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      setKeyboardInset(0);
    };
  }, [editor, bar]);
  return dock;
}
