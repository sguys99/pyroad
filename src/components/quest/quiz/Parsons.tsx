'use client';

import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Plus,
} from 'lucide-react';
import { QuizCode } from './QuizCode';
import type { QuizInputDef, QuizInputProps, QuizValueMap } from './types';
import './parsons.css';

export interface Placed {
  id: string;
  indent: number;
}
type Value = QuizValueMap['parsons'];

export const MAX_INDENT = 4;

/** 값(줄 id 배열 또는 {id, indent} 배열) → 내 코드 줄 목록 */
export function toPlaced(v: Value | null): Placed[] {
  return ((v ?? []) as (string | Placed)[]).map((x) =>
    typeof x === 'string' ? { id: x, indent: 0 } : x,
  );
}

/** 내 코드 줄 목록 → 제출 정규형 (indent 퀴즈만 {id, indent}) */
export function toValue(p: Placed[], indent: boolean): Value {
  return indent
    ? p.map(({ id, indent }) => ({ id, indent }))
    : p.map((x) => x.id);
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

interface Drag {
  id: string;
  from: number;
  to: number;
  dy: number;
  startY: number;
  /** 끌기 시작할 때 잰 줄 위치 (가운데 y) */
  mids: number[];
  step: number;
}

/**
 * 코드 순서 맞추기 (P7-05). 위 "내 코드"(정답 칸) · 아래 "줄 조각"(서버가 섞은 순서).
 * 탭이 기본: 조각을 누르면 내 코드 맨 아래에 붙고, 내 코드의 줄을 누르면 조각으로 돌아감.
 * 내 코드 안에서는 손잡이를 끌어 순서 바꾸기(포인터 이벤트 + transform, 손잡이만 touch-action:none 이라 나머지는 스크롤)
 * + 줄마다 위/아래 버튼(키보드·낭독기). indent 퀴즈면 줄마다 들여쓰기 0~4 버튼과 안내선.
 * dnd-kit(@dnd-kit/core+sortable, gzip 약 15KB)은 탭·버튼이 이미 키보드·낭독기를 맡아 끌기만 남으므로 쓰지 않음
 */
export function Parsons({
  quiz,
  value,
  onChange,
  disabled,
  result,
  labelledBy,
}: QuizInputProps<'parsons'>) {
  const indentOn = !!quiz.indent;
  const byId = new Map(quiz.lines.map((l) => [l.id, l.code]));
  const shownValue =
    result?.status === 'revealed' && result.answer
      ? result.answer
      : (result?.submitted ?? value);
  const placed = toPlaced(shownValue);
  const placedIds = new Set(placed.map((p) => p.id));
  const tray = quiz.lines.filter((l) => !placedIds.has(l.id));
  const locked = disabled || !!result;

  const headId = useId();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [say, setSay] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** 줄이 옮겨지거나 사라진 뒤 초점을 둘 곳 (다음 그리기에서 찾음) */
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    const el =
      rootRef.current?.querySelector<HTMLElement>(focusNext.current) ??
      rootRef.current?.querySelector<HTMLElement>('[data-ps-fallback]');
    focusNext.current = null;
    el?.focus();
  });

  const commit = (next: Placed[], message: string, focus: string | null) => {
    focusNext.current = focus;
    setSay(message);
    onChange(toValue(next, indentOn));
  };
  const code = (id: string) => byId.get(id) ?? '';

  const add = (id: string, trayIndex: number) => {
    const next = [...placed, { id, indent: 0 }];
    const after = tray[trayIndex + 1] ?? tray[trayIndex - 1];
    commit(
      next,
      `${next.length}번째 줄에 넣었어요: ${code(id)}`,
      // 마지막 조각이면 방금 넣은 줄로 (조각 칸이 사라져 초점이 빠지지 않게)
      after ? `[data-tray="${after.id}"]` : `[data-row="${id}"] .qz-ps-code`,
    );
  };
  const remove = (i: number) => {
    const next = placed.filter((_, j) => j !== i);
    const after = next[i] ?? next[i - 1];
    commit(
      next,
      `줄 조각으로 돌려놓았어요: ${code(placed[i].id)}`,
      after ? `[data-row="${after.id}"] .qz-ps-code` : null,
    );
  };
  const move = (from: number, to: number, focus: string | null = null) => {
    if (to < 0 || to >= placed.length || to === from) return;
    commit(moveItem(placed, from, to), `${to + 1}번째 줄로 옮겼어요`, focus);
  };
  const shift = (i: number, d: 1 | -1) => {
    const indent = Math.min(MAX_INDENT, Math.max(0, placed[i].indent + d));
    commit(
      placed.map((p, j) => (j === i ? { ...p, indent } : p)),
      `들여쓰기 ${indent}칸`,
      null,
    );
  };

  const onDown = (e: PointerEvent<HTMLSpanElement>, i: number) => {
    if (locked || e.button !== 0) return;
    const rows = [...(listRef.current?.children ?? [])].map((r) =>
      r.getBoundingClientRect(),
    );
    if (!rows[i]) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({
      id: placed[i].id,
      from: i,
      to: i,
      dy: 0,
      startY: e.clientY,
      mids: rows.map((r) => r.top + r.height / 2),
      step: rows[1] ? rows[1].top - rows[0].top : rows[0].height,
    });
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const mid = drag.mids[drag.from] + dy;
    const to = drag.mids.filter((m, j) => j !== drag.from && m < mid).length;
    setDrag({ ...drag, dy, to });
  };
  const onUp = () => {
    if (!drag) return;
    setDrag(null);
    move(drag.from, drag.to);
  };
  /** 끄는 동안 다른 줄이 비켜 설 거리 */
  const offset = (i: number) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < i && i <= drag.to) return -drag.step;
    if (drag.to <= i && i < drag.from) return drag.step;
    return 0;
  };

  const status = result?.status;
  return (
    <div className="qz-ps" ref={rootRef}>
      <section
        className="qz-ps-box"
        data-status={status}
        aria-labelledby={`${labelledBy} ${headId}`}
      >
        <h3 className="qz-ps-h" id={headId}>
          {status === 'revealed' ? '정답 순서' : '내 코드'}
          {status === 'correct' && (
            <span className="qz-ps-tag" data-tone="ok">
              <Check aria-hidden strokeWidth={3} /> 정답
            </span>
          )}
          {!result && (
            <span className="qz-ps-count">
              <span aria-hidden>
                {placed.length} / {quiz.lines.length}
              </span>
              <span className="sr-only">
                , {quiz.lines.length}줄 중 {placed.length}줄 놓음
              </span>
            </span>
          )}
        </h3>
        {placed.length === 0 ? (
          <p className="qz-ps-empty">
            아래 줄 조각을 눌러 순서대로 쌓아 보세요
          </p>
        ) : (
          <ol
            ref={listRef}
            className="qz-ps-list"
            data-dragging={drag ? true : undefined}
            data-indent={(indentOn && !locked) || undefined}
            data-testid="parsons-mine"
          >
            {placed.map((p, i) => (
              <li
                key={p.id}
                className="qz-ps-row"
                data-row={p.id}
                data-drag={drag?.id === p.id || undefined}
                style={
                  drag ? { transform: `translateY(${offset(i)}px)` } : undefined
                }
                data-testid="parsons-row"
              >
                {!locked && (
                  <span
                    className="qz-ps-grip"
                    aria-hidden
                    onPointerDown={(e) => onDown(e, i)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={() => setDrag(null)}
                  >
                    <GripVertical />
                  </span>
                )}
                <button
                  type="button"
                  className="qz-ps-code"
                  disabled={locked}
                  onClick={() => remove(i)}
                  aria-label={`${i + 1}번째 줄${indentOn ? `, 들여쓰기 ${p.indent}칸` : ''}: ${code(p.id)}. 누르면 줄 조각으로 돌려놓아요`}
                >
                  {indentOn &&
                    Array.from({ length: p.indent }, (_, k) => (
                      <span key={k} className="qz-ps-guide" aria-hidden />
                    ))}
                  <QuizCode code={code(p.id)} inline />
                </button>
                {!locked && indentOn && (
                  <span className="qz-ps-tools">
                    <button
                      type="button"
                      className="qz-ps-tool"
                      disabled={p.indent === 0}
                      onClick={() => shift(i, -1)}
                      aria-label={`${i + 1}번째 줄 들여쓰기 줄이기`}
                    >
                      <IndentDecrease aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="qz-ps-tool"
                      disabled={p.indent === MAX_INDENT}
                      onClick={() => shift(i, 1)}
                      aria-label={`${i + 1}번째 줄 들여쓰기 늘리기`}
                    >
                      <IndentIncrease aria-hidden />
                    </button>
                  </span>
                )}
                {!locked && (
                  <span className="qz-ps-tools">
                    <button
                      type="button"
                      className="qz-ps-tool"
                      data-act="up"
                      disabled={i === 0}
                      onClick={() =>
                        move(i, i - 1, `[data-row="${p.id}"] [data-act="up"]`)
                      }
                      aria-label={`${i + 1}번째 줄 위로`}
                    >
                      <ChevronUp aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="qz-ps-tool"
                      data-act="down"
                      disabled={i === placed.length - 1}
                      onClick={() =>
                        move(i, i + 1, `[data-row="${p.id}"] [data-act="down"]`)
                      }
                      aria-label={`${i + 1}번째 줄 아래로`}
                    >
                      <ChevronDown aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        {status === 'wrong' && (
          <p className="qz-ps-note" data-testid="parsons-wrong">
            어딘가 {indentOn ? '순서나 들여쓰기가' : '순서가'} 달라요
          </p>
        )}
      </section>

      {!result && tray.length > 0 && (
        <section className="qz-ps-tray" aria-labelledby={`${headId}-tray`}>
          <h3 className="qz-ps-h" id={`${headId}-tray`}>
            줄 조각
          </h3>
          <ul className="qz-ps-chips" data-testid="parsons-tray">
            {tray.map((l, i) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="qz-ps-chip"
                  data-tray={l.id}
                  data-ps-fallback={i === 0 || undefined}
                  disabled={disabled}
                  onClick={() => add(l.id, i)}
                  aria-label={`내 코드에 넣기: ${l.code}`}
                >
                  <Plus aria-hidden className="qz-ps-plus" />
                  <QuizCode code={l.code} inline />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="sr-only" aria-live="polite">
        {say}
      </p>
    </div>
  );
}

export const parsonsInput: QuizInputDef<'parsons'> = {
  Input: Parsons,
  isComplete: (value, quiz) => {
    const ids = toPlaced(value).map((p) => p.id);
    return (
      ids.length === quiz.lines.length &&
      quiz.lines.every((l) => ids.includes(l.id))
    );
  },
  label: '순서 맞추기',
};
