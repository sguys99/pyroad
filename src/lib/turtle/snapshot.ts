/**
 * 마지막 화면만 남긴 명령 스트림 (P11-05, P11-04 질문의 저장 정책).
 * 게임은 명령 상한을 프레임마다 세므로(P11-04) 긴 게임은 실행 전체가 5만 개를 넘을 수 있고, 작품 저장(P11-06)은
 * 5만 개·gzip 100KB를 넘으면 거절한다. 그래서 너무 긴 스트림은 끝난 화면(남은 선·채우기·점·글씨·도장 + 거북이 마지막 모습)을
 * 다시 그리는 짧은 스트림으로 바꿔 저장한다. 갤러리 재생은 움직임 대신 완성 화면을 바로 보여 준다.
 */
import { Scene, type TurtleCommand, type TurtleState } from './scene';

type Item =
  | {
      k: 'line';
      tid: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      color: string;
      width: number;
    }
  | { k: 'fill'; tid: number; points: number[][]; color: string }
  | { k: 'dot'; tid: number; x: number; y: number; size: number; color: string }
  | {
      k: 'text';
      tid: number;
      x: number;
      y: number;
      args: unknown[];
      color: string;
    }
  | {
      k: 'stamp';
      tid: number;
      sid: number;
      x: number;
      y: number;
      h: number;
      look: Record<string, unknown>;
    };

/** 상태 키 (shim 'n'·'s'와 같은 이름) */
const lookOf = (t: TurtleState) => ({
  d: t.d,
  pc: t.pc,
  fc: t.fc,
  w: t.w,
  sp: t.sp,
  v: t.v,
  sh: t.sh,
  sz: t.sz,
});

/** 명령 스트림의 끝 화면을 다시 그리는 짧은 스트림. 읽을 수 없는 명령은 건너뛴다 */
export function finalFrame(
  commands: readonly TurtleCommand[],
): TurtleCommand[] {
  const scene = new Scene();
  let items: Item[] = [];
  for (const c of commands) {
    if (!Array.isArray(c)) continue;
    let op;
    try {
      op = scene.apply(c);
    } catch {
      continue;
    }
    switch (op.k) {
      case 'move':
        if (op.draw && (op.x0 !== op.x1 || op.y0 !== op.y1))
          items.push({
            k: 'line',
            tid: op.t.id,
            x0: op.x0,
            y0: op.y0,
            x1: op.x1,
            y1: op.y1,
            color: op.color,
            width: op.width,
          });
        break;
      case 'endFill':
        if (op.points)
          items.push({
            k: 'fill',
            tid: op.t.id,
            points: op.points,
            color: op.color,
          });
        break;
      case 'dot':
        items.push({
          k: 'dot',
          tid: op.t.id,
          x: op.x,
          y: op.y,
          size: op.size,
          color: op.color,
        });
        break;
      case 'text':
        items.push({
          k: 'text',
          tid: op.t.id,
          x: op.x,
          y: op.y,
          args: [op.text, op.align, op.family, op.size, op.style],
          color: op.color,
        });
        break;
      case 'stamp':
        items.push({
          k: 'stamp',
          tid: op.t.id,
          sid: op.sid,
          x: op.x,
          y: op.y,
          h: op.h,
          look: { sh: op.shape, pc: op.pc, fc: op.fc, sz: op.sz },
        });
        break;
      case 'clearStamp':
        items = items.filter((x) => !(x.k === 'stamp' && x.sid === op.sid));
        break;
      case 'clear':
        items = items.filter((x) => x.tid !== op.t.id);
        break;
      case 'clearScreen':
        items = [];
        break;
    }
  }

  const out: TurtleCommand[] = [];
  if (scene.view) out.push(['v', scene.view.w, scene.view.h]);
  if (scene.bg) out.push(['bg', scene.bg]);
  if (scene.title) out.push(['t', scene.title]);
  // 한 번에 그린다 (렌더러는 tracer 0이면 update 때 보여 줌)
  out.push(['tr', 0]);
  for (const t of scene.turtles.values())
    out.push([
      'n',
      t.id,
      { x: t.x, y: t.y, h: t.h, ...lookOf(t), d: 0, sp: 0 },
    ]);
  for (const it of items) {
    const id = it.tid;
    switch (it.k) {
      case 'line':
        out.push(
          ['j', id, it.x0, it.y0],
          ['s', id, { d: 1, pc: it.color, w: it.width }],
          ['m', id, it.x1, it.y1],
          ['s', id, { d: 0 }],
        );
        break;
      case 'fill':
        out.push(
          ['s', id, { fc: it.color }],
          ['j', id, ...it.points[0]],
          ['bf', id],
        );
        for (const p of it.points.slice(1)) out.push(['j', id, p[0], p[1]]);
        out.push(['ef', id]);
        break;
      case 'dot':
        out.push(['j', id, it.x, it.y], ['d', id, it.size, it.color]);
        break;
      case 'text':
        out.push(
          ['j', id, it.x, it.y],
          ['s', id, { pc: it.color }],
          ['w', id, ...it.args],
        );
        break;
      case 'stamp':
        out.push(
          ['j', id, it.x, it.y, it.h],
          ['s', id, it.look],
          ['sp', id, it.sid],
        );
        break;
    }
  }
  // 거북이 마지막 자리·모습
  for (const t of scene.turtles.values())
    out.push(['j', t.id, t.x, t.y, t.h], ['s', t.id, lookOf(t)]);
  out.push(['u']);
  return out;
}
