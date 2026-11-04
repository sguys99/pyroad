import { describe, it, expect, vi } from 'vitest';
import {
  encodeSseEvent,
  readTutorStream,
  TutorStreamError,
  type TutorStreamEvent,
} from '../sse';

function streamOf(
  chunks: (TutorStreamEvent | string)[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(
          typeof c === 'string' ? encoder.encode(c) : encodeSseEvent(c),
        );
      }
      controller.close();
    },
  });
}

describe('readTutorStream', () => {
  it('delta를 이어 붙이고 done에서 끝난다', async () => {
    const onText = vi.fn();
    const result = await readTutorStream(
      streamOf([
        { delta: '안녕' },
        { delta: '하세요' },
        { done: true, provider_used: 'gemini' },
      ]),
      onText,
    );
    expect(result).toEqual({
      text: '안녕하세요',
      providerUsed: 'gemini',
      isFallback: false,
    });
    expect(onText.mock.calls.map((c) => c[0])).toEqual(['안녕', '안녕하세요']);
  });

  it('reset을 받으면 앞부분을 버리고 새 답만 남긴다 (부분 응답 + 폴백이 이어 붙지 않음)', async () => {
    const onText = vi.fn();
    const result = await readTutorStream(
      streamOf([
        { delta: '변수는 상자' },
        { reset: true },
        { delta: '저장된 힌트예요' },
        { done: true, is_fallback: true },
      ]),
      onText,
    );
    expect(result.text).toBe('저장된 힌트예요');
    expect(result.isFallback).toBe(true);
    expect(onText.mock.calls.map((c) => c[0])).toEqual([
      '변수는 상자',
      '',
      '저장된 힌트예요',
    ]);
  });

  it('이벤트가 청크 경계에서 나뉘어도 파싱한다', async () => {
    const raw = new TextDecoder().decode(encodeSseEvent({ delta: '파이썬' }));
    const result = await readTutorStream(
      streamOf([raw.slice(0, 7), raw.slice(7), { done: true }]),
      () => {},
    );
    expect(result.text).toBe('파이썬');
  });

  it('error 이벤트면 TutorStreamError', async () => {
    await expect(
      readTutorStream(
        streamOf([{ delta: '반쯤' }, { reset: true }, { error: true }]),
        () => {},
      ),
    ).rejects.toBeInstanceOf(TutorStreamError);
  });

  it('done 없이 끊긴 스트림의 부분 텍스트는 쓰지 않고 실패로 본다', async () => {
    await expect(
      readTutorStream(streamOf([{ delta: '문장이 중간에서 잘' }]), () => {}),
    ).rejects.toBeInstanceOf(TutorStreamError);
  });
});
