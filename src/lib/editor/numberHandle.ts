// 숫자 손잡이 (world3 제안 L, P11-12). 코드 속 숫자를 누르면 그 위에 작은 슬라이더가 떠서 타자 없이 숫자를 바꾼다.
// 휴대폰에서 "각도 바꿔 보기"를 하려는 것 — 바꿀 때마다 onNudge를 불러 화면이 다시 실행한다(CodePanel이 잠깐 기다렸다가).
// 보통 편집은 그대로: 누르면 커서는 평소처럼 놓이고 손잡이만 덧붙는다. 다른 데를 누르거나 타자를 치거나 Esc면 닫힌다.
// 키보드: 숫자 위에 커서를 두고 Alt+Enter → 슬라이더로 포커스(화살표·Home·End), Esc로 에디터에 돌아옴
import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  keymap,
  showTooltip,
  type Tooltip,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

export interface NumberRange {
  /** 화면 이름 ("각도") */
  label: string;
  min: number;
  max: number;
  step: number;
  /** − / + 버튼 한 번에 바뀌는 만큼 */
  bump: number;
}

const ANGLE = ['left', 'right', 'lt', 'rt', 'setheading', 'seth', 'tilt'];
const LENGTH = ['forward', 'fd', 'back', 'bk', 'backward', 'circle', 'dot'];
const PLACE = ['goto', 'setpos', 'setposition', 'setx', 'sety', 'teleport'];

/** 숫자가 들어 있는 함수 이름(가장 안쪽 열린 괄호 앞)과 몇 번째 값인지. 괄호 밖이면 `이름 =`의 이름 */
export function callAround(before: string): { name: string; arg: number } {
  let depth = 0;
  let arg = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const c = before[i];
    if (c === ')' || c === ']') depth++;
    else if (c === '[') depth--;
    else if (c === ',' && depth === 0) arg++;
    else if (c === '(') {
      if (depth > 0) depth--;
      else {
        const name = /([A-Za-z_]\w*)\s*$/.exec(before.slice(0, i))?.[1] ?? '';
        return { name, arg };
      }
    }
  }
  return { name: /([A-Za-z_]\w*)\s*=\s*$/.exec(before)?.[1] ?? '', arg: 0 };
}

/**
 * 숫자 자리에 맞는 슬라이더 범위. before = 그 줄에서 숫자 앞 글자, value = 지금 숫자, literal = 코드에 적힌 그대로.
 * 각도 0~360 · 길이 0~300 · 자리 −300~300 · 횟수 0~36 · 굵기 1~20 · 빠르기 0~10 · 그 밖은 0~(두 배, 적어도 10).
 * 지금 값이 범위 밖이면 범위를 넓힌다. 소수점 아래 자릿수만큼 잘게 (0.05 → 0.01)
 */
export function numberRange(
  before: string,
  value: number,
  literal: string,
): NumberRange {
  const { name, arg } = callAround(before);
  const decimals = literal.split('.')[1]?.length ?? 0;
  const step = decimals ? 10 ** -decimals : 1;
  const pick = (): Omit<NumberRange, 'step'> => {
    if (ANGLE.includes(name) || (name === 'circle' && arg === 1))
      return { label: '각도', min: 0, max: 360, bump: 5 };
    if (LENGTH.includes(name))
      return { label: '길이', min: 0, max: 300, bump: 10 };
    if (PLACE.includes(name))
      return { label: '자리', min: -300, max: 300, bump: 10 };
    if (name === 'range') return { label: '횟수', min: 0, max: 36, bump: 1 };
    if (name === 'pensize' || name === 'width')
      return { label: '굵기', min: 1, max: 20, bump: 1 };
    if (name === 'speed') return { label: '빠르기', min: 0, max: 10, bump: 1 };
    if (name === 'sleep')
      return { label: '쉬는 시간', min: 0, max: 2, bump: 0.1 };
    const top = Math.max(10, Math.ceil(Math.abs(value) * 2));
    return { label: '숫자', min: value < 0 ? -top : 0, max: top, bump: 1 };
  };
  const r = pick();
  return {
    ...r,
    min: Math.min(r.min, value),
    max: Math.max(r.max, value),
    step,
    bump: Math.max(r.bump, step),
  };
}

/** 슬라이더 값 → 코드 글자 (정수는 정수로, 소수는 원래 자릿수로) */
export function formatNumber(value: number, step: number): string {
  const decimals = step < 1 ? Math.round(-Math.log10(step)) : 0;
  return decimals ? value.toFixed(decimals) : String(Math.round(value));
}

/** pos 자리 숫자 글자(앞의 음수 기호 포함)의 범위. 문자열·이름 속 숫자는 아님 */
export function numberAt(
  state: EditorState,
  pos: number,
): { from: number; to: number } | null {
  const tree = syntaxTree(state);
  const node = [1, -1]
    .map((side) => tree.resolveInner(pos, side as 1 | -1))
    .find((n) => n.name === 'Number');
  if (!node) return null;
  let from = node.from;
  const text = state.sliceDoc(from, node.to);
  if (!/^\d+(\.\d+)?$/.test(text)) return null; // 16진수·1_000·3j 같은 건 손대지 않음
  // 바로 앞이 음수 기호이고 그 앞이 값이 올 자리면(괄호·쉼표·= 뒤, 줄 처음) 함께 바꾼다
  const line = state.doc.lineAt(from);
  const before = state.sliceDoc(line.from, from);
  if (/(^|[(,=[:]\s*)-$/.test(before)) from--;
  return { from, to: node.to };
}

interface Target {
  from: number;
  to: number;
  tip: Tooltip;
}

const setTarget = StateEffect.define<Target | null>();

/** 손잡이를 열고(키보드면 슬라이더로 포커스) 연 숫자 범위를 돌려준다 */
function openAt(view: EditorView, pos: number, focus: boolean): boolean {
  const at = numberAt(view.state, pos);
  if (!at) return false;
  const tip: Tooltip = {
    pos: at.from,
    above: true,
    create: (v) => handleDom(v, focus),
  };
  view.dispatch({ effects: setTarget.of({ ...at, tip }) });
  return true;
}

const targetField = StateField.define<Target | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setTarget)) return e.value;
    if (!value) return null;
    // 손잡이 말고 다른 것으로 코드가 바뀌거나 커서가 숫자 밖으로 나가면 닫는다
    if (tr.docChanged) return null;
    const head = tr.selection?.main.head;
    if (head !== undefined && (head < value.from || head > value.to))
      return null;
    return value;
  },
  provide: (f) => showTooltip.from(f, (t) => t?.tip ?? null),
});

/** 바꿀 때마다 부를 함수 (편집기마다 하나) */
const nudgeField = StateField.define<() => void>({
  create: () => () => {},
  update: (v) => v,
});

function handleDom(view: EditorView, focusOnOpen: boolean) {
  const t = view.state.field(targetField)!;
  const literal = view.state.sliceDoc(t.from, t.to);
  const line = view.state.doc.lineAt(t.from);
  const range = numberRange(
    view.state.sliceDoc(line.from, t.from),
    Number(literal),
    literal.replace('-', ''),
  );

  const dom = document.createElement('div');
  dom.className = 'cm-num font-sans';
  dom.setAttribute('role', 'group');
  dom.setAttribute('aria-label', `숫자 손잡이: ${range.label}`);
  dom.dataset.testid = 'number-handle';

  const head = document.createElement('div');
  head.className = 'cm-num-head';
  const name = document.createElement('span');
  name.textContent = range.label;
  const shown = document.createElement('output');
  shown.className = 'cm-num-v font-mono';
  shown.textContent = literal;
  head.append(name, shown);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'cm-num-range';
  slider.min = String(range.min);
  slider.max = String(range.max);
  slider.step = String(range.step);
  slider.value = literal;
  slider.setAttribute('aria-label', `${range.label} 바꾸기`);

  const set = (next: number) => {
    const cur = view.state.field(targetField);
    if (!cur) return;
    const clamped = Math.min(range.max, Math.max(range.min, next));
    const text = formatNumber(clamped, range.step);
    slider.value = text;
    shown.textContent = text;
    if (view.state.sliceDoc(cur.from, cur.to) === text) return;
    view.dispatch({
      changes: { from: cur.from, to: cur.to, insert: text },
      effects: setTarget.of({ ...cur, to: cur.from + text.length }),
      userEvent: 'input.number',
    });
    view.state.field(nudgeField)();
  };
  slider.addEventListener('input', () => set(Number(slider.value)));

  const button = (sign: -1 | 1) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cm-num-b font-mono';
    b.textContent = sign < 0 ? '−' : '+';
    b.setAttribute(
      'aria-label',
      `${formatNumber(range.bump, range.step)} ${sign < 0 ? '작게' : '크게'}`,
    );
    b.addEventListener('click', () =>
      set(Number(slider.value) + sign * range.bump),
    );
    return b;
  };
  const row = document.createElement('div');
  row.className = 'cm-num-row';
  row.append(button(-1), slider, button(1));
  dom.append(head, row);

  dom.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    view.dispatch({ effects: setTarget.of(null) });
    view.focus();
  });

  return {
    dom,
    mount() {
      if (focusOnOpen) slider.focus();
    },
  };
}

/** 숫자 손잡이 확장. onNudge = 손잡이로 숫자를 바꿀 때마다 */
export function numberHandle(onNudge: () => void): Extension {
  return [
    targetField,
    nudgeField.init(() => onNudge),
    EditorView.editorAttributes.of({ class: 'cm-num-on' }),
    EditorView.domEventHandlers({
      // 누르면 커서는 평소처럼 놓이고(mousedown), 그 자리가 숫자이고 끌어 고른 게 아니면 손잡이를 연다
      click(e, view) {
        if (!view.state.selection.main.empty) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos !== null) openAt(view, pos, false);
        return false;
      },
    }),
    keymap.of([
      {
        key: 'Alt-Enter',
        run: (view) => openAt(view, view.state.selection.main.head, true),
      },
      {
        key: 'Escape',
        run: (view) => {
          if (!view.state.field(targetField)) return false;
          view.dispatch({ effects: setTarget.of(null) });
          return true;
        },
      },
    ]),
  ];
}
