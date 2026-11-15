// 작품 저장 (P11-06) 브라우저 쪽: 명령 gzip · 썸네일 다시 그리기 · 저장 요청
import type { TurtleCommand } from '@/lib/turtle/scene';
import type { TranscriptRow } from '@/components/quest/outputSlip';
import {
  CREATION_THUMBNAIL_MAX,
  CREATION_THUMBNAIL_SIZE,
  type CreationKind,
} from './limits';

/** 명령 스트림의 마지막 `title("…")` (작품 이름 기본값) */
export function drawingTitle(commands: readonly TurtleCommand[]) {
  for (let i = commands.length - 1; i >= 0; i--) {
    const c = commands[i];
    if (c[0] === 't' && typeof c[1] === 'string') return c[1];
  }
  return null;
}

export async function gzipJson(value: unknown): Promise<Blob> {
  const stream = new Blob([JSON.stringify(value)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/**
 * 썸네일: 표시 목록을 화면 밖 캔버스에 "바로 완성"으로 다시 그려 400×400 그림 맞춤 PNG (P0-06,
 * `exportPNG({ fit: 'content' })`). 화면의 그림판과 따로 그려 빠르기·모눈 설정과 상관없다. 너무 크면 썸네일 없이(null)
 */
export async function renderThumbnail(
  commands: readonly TurtleCommand[],
): Promise<Blob | null> {
  const { TurtleCanvas } = await import('@/lib/turtle/TurtleCanvas');
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${CREATION_THUMBNAIL_SIZE}px;height:${CREATION_THUMBNAIL_SIZE}px;pointer-events:none;`;
  document.body.appendChild(host);
  const cv = new TurtleCanvas(host, { walk: false });
  try {
    await new Promise<void>((resolve) => {
      const off = cv.on('idle', () => {
        off();
        resolve();
      });
      cv.push(commands);
      cv.end();
      cv.skipToEnd();
      if (cv.isIdle()) resolve();
    });
    const blob = await cv.exportPNG({
      width: CREATION_THUMBNAIL_SIZE,
      height: CREATION_THUMBNAIL_SIZE,
      fit: 'content',
      // 거북이는 그림 범위 밖에 걸쳐 잘려 보여서 빼고 그림만
      turtles: false,
    });
    return blob.size <= CREATION_THUMBNAIL_MAX ? blob : null;
  } finally {
    cv.destroy();
    host.remove();
  }
}

export interface CreationDraft {
  kind: CreationKind;
  title: string;
  questId: string | null;
  code: string;
  commands?: readonly TurtleCommand[];
  transcript?: TranscriptRow[];
  thumbnail?: Blob | null;
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string; code?: string };

const FAILED = '작품을 저장하지 못했어요. 잠시 뒤에 다시 해 줘요.';

/** `POST /api/creations` (늘 비공개 저장) */
export async function saveCreation(draft: CreationDraft): Promise<SaveResult> {
  const form = new FormData();
  form.set(
    'meta',
    JSON.stringify({
      kind: draft.kind,
      title: draft.title,
      questId: draft.questId,
      code: draft.code,
      ...(draft.transcript?.length && { transcript: draft.transcript }),
    }),
  );
  if (draft.commands)
    form.set('commands', await gzipJson(draft.commands), 'commands.json.gz');
  if (draft.thumbnail) form.set('thumbnail', draft.thumbnail, 'thumbnail.png');
  try {
    const res = await fetch('/api/creations', { method: 'POST', body: form });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.id) return { ok: true, id: body.id };
    return {
      ok: false,
      message:
        typeof body?.error === 'string' && res.status < 500
          ? body.error
          : FAILED,
      code: body?.code,
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}
