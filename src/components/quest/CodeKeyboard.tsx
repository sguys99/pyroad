'use client';

import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, IndentIncrease, Undo2 } from 'lucide-react';
import type { CodeEditorHandle } from './CodeEditor';
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
const GROUPS: Group[] = [
  {
    name: '자주 쓰는 것',
    keys: [
      { label: 'print()', name: 'print 주문 넣기', text: 'print()', caret: 6 },
      { label: '" "', name: '따옴표 한 쌍 넣기', text: '""', caret: 1 },
      { label: '( )', name: '괄호 한 쌍 넣기', text: '()', caret: 1 },
      { label: '=', name: '같다 기호 넣기', text: '=' },
    ],
  },
  {
    name: '기호',
    keys: [
      { label: '+', name: '더하기 기호 넣기', text: '+' },
      { label: '-', name: '빼기 기호 넣기', text: '-' },
      { label: '_', name: '밑줄 넣기', text: '_' },
      { label: ',', name: '쉼표 넣기', text: ',' },
      { label: ':', name: '쌍점 넣기', text: ':' },
      { label: "'", name: '작은따옴표 넣기', text: "'" },
      { label: '#', name: '메모 기호 넣기', text: '#' },
      { label: '\\n', name: '줄바꿈 글자 넣기', text: '\\n' },
      { label: ')', name: '닫는 괄호 넣기', text: ')' },
    ],
  },
  {
    name: '주문',
    keys: [
      { label: 'str()', name: 'str 주문 넣기', text: 'str()', caret: 4 },
      { label: 'int()', name: 'int 주문 넣기', text: 'int()', caret: 4 },
      { label: 'input()', name: 'input 주문 넣기', text: 'input()', caret: 6 },
    ],
  },
  {
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
  },
];

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

const KEY_COUNT = [...GROUPS, MOVES].reduce((n, g) => n + g.keys.length, 0);

/**
 * 모바일 코드 키보드 (P6-04, 최종 시안 NotebookPage `.f-keys`). 공책 에디터 바로 아래에 붙어,
 * 폰 키보드에서 찾기 어려운 기호와 주문을 한 번 눌러 커서 자리에 넣는다.
 * 누를 때 포커스를 뺏지 않아(pointerdown 기본 동작 막기) 폰 키보드가 닫히지 않고, 닫혀 있으면 에디터에 포커스를 주며 넣는다.
 * role=toolbar + 화살표 키 roving(Home·End), 각 키는 한국어 이름. CodePanel이 좁은 화면·터치에서만 지연 로드
 */
export default function CodeKeyboard({
  editor,
}: {
  editor: RefObject<CodeEditorHandle | null>;
}) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const press = (key: Key) => {
    const handle = editor.current;
    if (!handle) return;
    if (key.run) key.run(handle);
    else handle.insert(key.text!, key.caret);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = KEY_COUNT - 1;
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
            data-kind={key.label.endsWith('()') ? 'spell' : undefined}
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

  return (
    <div
      className="ck"
      role="toolbar"
      aria-label="코드 키보드"
      onKeyDown={onKeyDown}
      data-testid="code-keyboard"
    >
      <div className="ck-strip">{GROUPS.map((g) => renderGroup(g))}</div>
      {renderGroup(MOVES, 'ck-group ck-moves')}
    </div>
  );
}
