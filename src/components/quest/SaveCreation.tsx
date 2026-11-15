'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { BookmarkPlus, Check, Lock, Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import type { LiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { TurtleCommand } from '@/lib/turtle/scene';
import {
  drawingTitle,
  renderThumbnail,
  saveCreation,
  type CreationDraft,
  type SaveResult,
} from '@/lib/creations/client';
import {
  CREATION_TITLE_MAX,
  clampTranscript,
  defaultCreationTitle,
} from '@/lib/creations/limits';
import { transcriptRows, type TranscriptRow } from './outputSlip';
import './outputPanel.css';
import './saveCreation.css';

export const MY_CREATIONS_HREF = '/profile/creations';

/** 저장할 수 있는 실행: 그림을 그렸거나(drawing) input()으로 대화했음(conversation, Q74 ④) */
export interface CreationSource {
  questId: string | null;
  questTitle: string;
  code: string;
  commands: readonly TurtleCommand[];
  transcript: TranscriptRow[];
}

/**
 * 결과 쪽지 아래 "작품으로 저장" 띠 (P11-06). 퀘스트 세션(useQuestSession)의 마지막 실행을 그대로 읽어
 * 끝까지 돈 실행이 그림을 그렸거나 대화(input)를 했으면 나온다. 저장은 늘 비공개(내 작품함), 공개는 갤러리(P11-07)
 */
export function SaveCreationBar({
  liveOutput,
  runResult,
  lastRunCode,
  isRunning,
  questId,
  questTitle,
  save,
}: {
  liveOutput: LiveOutputStore;
  runResult: RunResult | null;
  lastRunCode: string | null;
  isRunning: boolean;
  questId: string | null;
  questTitle: string;
  /** 카탈로그·테스트가 요청 없이 흉내 낼 때 */
  save?: (draft: CreationDraft) => Promise<SaveResult>;
}) {
  const snap = useSyncExternalStore(
    liveOutput.subscribe,
    liveOutput.getSnapshot,
    liveOutput.getSnapshot,
  );
  const commands = useSyncExternalStore(
    liveOutput.subscribeTurtle,
    liveOutput.getTurtle,
    liveOutput.getTurtle,
  );
  const [open, setOpen] = useState(false);
  const [savedFor, setSavedFor] = useState<RunResult | null>(null);

  const ready =
    !isRunning &&
    !!runResult &&
    !runResult.isStopped &&
    lastRunCode !== null &&
    (commands.length > 0 || snap.inputs.length > 0);
  if (!ready) return null;

  const saved = savedFor === runResult;
  const kind = commands.length > 0 ? 'drawing' : 'conversation';
  return (
    <>
      <div
        className="cr-bar"
        data-saved={saved || undefined}
        data-testid="save-creation-bar"
      >
        <span className="cr-bar-icon" aria-hidden>
          {saved ? <Check strokeWidth={3} /> : <Sparkles />}
        </span>
        <span className="cr-bar-text" role="status">
          <span className="cr-bar-title font-display">
            {saved
              ? '내 작품함에 저장했어요!'
              : kind === 'drawing'
                ? '멋진 그림이 나왔어요!'
                : '재미있는 대화가 나왔어요!'}
          </span>
          <span className="cr-bar-sub">
            {saved
              ? '프로필의 내 작품함에서 언제든 다시 볼 수 있어요.'
              : '작품으로 저장해 두면 나중에 다시 볼 수 있어요.'}
          </span>
        </span>
        {saved ? (
          <Button size="sm" variant="ghost" href={MY_CREATIONS_HREF}>
            작품함 보기
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon={<BookmarkPlus aria-hidden />}
            onClick={() => setOpen(true)}
            data-testid="save-creation-open"
          >
            작품으로 저장
          </Button>
        )}
      </div>
      {open && (
        <SaveCreationSheet
          open={open}
          onOpenChange={setOpen}
          source={{
            questId,
            questTitle,
            code: lastRunCode,
            commands,
            transcript: transcriptRows(snap.text, snap.inputs),
          }}
          onSaved={() => setSavedFor(runResult)}
          save={save}
        />
      )}
    </>
  );
}

type Preview =
  | { state: 'drawing'; url: string | null; blob: Blob | null }
  | { state: 'loading' };

/**
 * 저장 시트: 미리보기(그림 썸네일 · 대화 기록) + 작품 이름(20자) + "나만 보기" 안내 → 저장.
 * 썸네일은 시트를 열 때 화면 밖 캔버스로 다시 그려 만든다(400×400 그림 맞춤). 못 만들면 썸네일 없이 저장(갤러리는 명령을 재생)
 */
export function SaveCreationSheet({
  open,
  onOpenChange,
  source,
  onSaved,
  save = saveCreation,
  thumbnail = renderThumbnail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: CreationSource;
  onSaved?: (id: string) => void;
  save?: (draft: CreationDraft) => Promise<SaveResult>;
  thumbnail?: (commands: readonly TurtleCommand[]) => Promise<Blob | null>;
}) {
  const isDrawing = source.commands.length > 0;
  const [title, setTitle] = useState(() =>
    defaultCreationTitle(drawingTitle(source.commands), source.questTitle),
  );
  const [preview, setPreview] = useState<Preview>({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const length = Array.from(title.trim()).length;
  const over = length > CREATION_TITLE_MAX;

  useEffect(() => {
    if (!isDrawing) return;
    let alive = true;
    let url: string | null = null;
    thumbnail(source.commands)
      .catch(() => null)
      .then((blob) => {
        if (!alive) return;
        url = blob ? URL.createObjectURL(blob) : null;
        setPreview({ state: 'drawing', url, blob });
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [isDrawing, source.commands, thumbnail]);

  const transcript = clampTranscript(source.transcript);
  const submit = async () => {
    if (busy || !length || over) return;
    setBusy(true);
    setError('');
    const res = await save({
      kind: isDrawing ? 'drawing' : 'conversation',
      title: title.trim(),
      questId: source.questId,
      code: source.code,
      ...(isDrawing && {
        commands: source.commands,
        thumbnail: preview.state === 'drawing' ? preview.blob : null,
      }),
      ...(transcript.length > 0 && { transcript }),
    });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    onSaved?.(res.id);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="작품으로 저장"
      description="내 작품함에 저장해 두고 언제든 다시 볼 수 있어요."
      data-testid="save-creation-sheet"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            그만두기
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={
              !length || over || (isDrawing && preview.state === 'loading')
            }
            icon={<BookmarkPlus aria-hidden />}
            data-testid="save-creation-submit"
          >
            저장하기
          </Button>
        </>
      }
    >
      <div className="cr-sheet">
        <figure className="cr-preview" data-testid="save-creation-preview">
          {isDrawing ? (
            <div className="cr-paper">
              {preview.state === 'drawing' && preview.url ? (
                // 브라우저에서 방금 만든 PNG(blob:)라 next/image 를 거치지 않는다
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={`${title.trim() || '내 작품'} 그림 미리보기`}
                />
              ) : (
                <span className="cr-paper-wait" role="status">
                  <Palette aria-hidden />
                  {preview.state === 'loading'
                    ? '그림을 준비하고 있어요…'
                    : '미리보기는 없지만 그림은 그대로 저장돼요.'}
                </span>
              )}
            </div>
          ) : (
            <ol className="qo-lines" aria-label="저장할 대화">
              {transcript.map((row, i) =>
                row.answer ? (
                  <li key={i} className="qo-answer">
                    <span className="sr-only">내 대답: </span>
                    <span className="qo-answer-bubble">{row.text || ' '}</span>
                  </li>
                ) : (
                  <li key={i} className="qo-line font-mono">
                    {row.text || ' '}
                  </li>
                ),
              )}
            </ol>
          )}
          <figcaption className="cr-preview-cap">
            {isDrawing
              ? '저장하면 그리는 모습도 함께 남아요.'
              : transcript.length < source.transcript.length
                ? '대화가 길어서 앞부분만 저장해요.'
                : '내가 실행한 대화 그대로 저장해요.'}
          </figcaption>
        </figure>

        <div className="cr-field">
          <label htmlFor={id} className="cr-label">
            작품 이름
          </label>
          <div className="cr-input">
            <input
              id={id}
              className="cr-input-field"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
              aria-invalid={over || !length || undefined}
              aria-describedby={`${id}-hint`}
              autoComplete="off"
              enterKeyHint="done"
              data-testid="save-creation-title"
            />
            <span
              className="cr-count"
              data-over={over || undefined}
              aria-hidden
            >
              {length}/{CREATION_TITLE_MAX}
            </span>
          </div>
          <p id={`${id}-hint`} className="cr-hint">
            {over
              ? `${CREATION_TITLE_MAX}자까지 쓸 수 있어요. 조금만 줄여 줘요.`
              : !length
                ? '작품 이름을 적어 줘요.'
                : '진짜 이름 대신 별명이나 재미있는 이름으로 지어 줘요.'}
          </p>
        </div>

        <p className="cr-private">
          <Lock aria-hidden />
          <span>
            <strong>나만 볼 수 있어요.</strong> 친구들이 보는 갤러리에는 내가
            올리기로 할 때만 나가요.
          </span>
        </p>

        <p className="cr-error" role="alert" data-testid="save-creation-error">
          {error}
        </p>
      </div>
    </Sheet>
  );
}
