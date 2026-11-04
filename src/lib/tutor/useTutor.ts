'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TutorRequest, TutorResponse } from './types';
import { readTutorStream } from './sse';

/** 이 시간 동안 서버에서 아무 이벤트도 오지 않으면 실패로 보고 요청을 끊는다 */
export const STREAM_IDLE_TIMEOUT_MS = 30_000;

/**
 * AI 튜터 요청 훅.
 *
 * 요청 함수는 취소된 경우 `null`을 돌려준다 (에러가 아님). 호출자는 `null`이면 아무것도 하지 않는다.
 * - 화면에 흘려 쓰는 스트림은 한 번에 하나만: 새 스트림 요청이 오면 이전 스트림을 abort (B18)
 * - 컴포넌트가 언마운트되면(퀘스트를 떠남) 진행 중인 모든 요청을 abort
 * 서버는 `request.signal`로 이를 받아 provider SDK 호출을 멈춘다.
 */
export function useTutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const inFlightRef = useRef(new Set<AbortController>());
  const activeStreamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const inFlight = inFlightRef.current;
    return () => {
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    };
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: { has_custom_keys: string[] }) => {
        setHasApiKey(data.has_custom_keys.length > 0);
      })
      .catch(() => {
        setHasApiKey(false);
      });
  }, []);

  const sendTutorRequest = useCallback(
    async (req: TutorRequest): Promise<TutorResponse | null> => {
      const controller = new AbortController();
      inFlightRef.current.add(controller);
      setIsLoading(true);
      try {
        const res = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TutorResponse = await res.json();
        if (data.no_api_key) {
          setHasApiKey(false);
        }
        return data;
      } catch {
        if (controller.signal.aborted) return null;
        throw new Error('AI 튜터 요청에 실패했습니다');
      } finally {
        inFlightRef.current.delete(controller);
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [],
  );

  const sendTutorStreamRequest = useCallback(
    async (
      req: TutorRequest,
      onDelta: (fullText: string) => void,
    ): Promise<TutorResponse | null> => {
      // 스트리밍 말풍선은 하나뿐이므로 이전 스트림은 끊는다
      activeStreamRef.current?.abort();
      const controller = new AbortController();
      activeStreamRef.current = controller;
      inFlightRef.current.add(controller);
      setIsLoading(true);

      let timedOut = false;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const touch = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, STREAM_IDLE_TIMEOUT_MS);
      };

      try {
        touch();
        const res = await fetch('/api/tutor/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error('No response body');

        // reset 이벤트가 오면 onDelta('')로 말풍선을 비우고 다시 "생각 중" 상태가 된다
        const result = await readTutorStream(
          res.body,
          (fullText) => {
            if (!controller.signal.aborted) onDelta(fullText);
          },
          touch,
        );

        // 주의: setIsLoading(false)를 여기서 호출하지 않음.
        // 호출자가 streamingContent를 정리하고 messages를 업데이트한 뒤
        // setIsLoading(false)와 동일 배치에서 처리하도록 함.
        // → 깜빡임 방지를 위해 caller에서 일괄 처리
        return {
          message: result.text,
          is_fallback: result.isFallback,
          provider_used: result.providerUsed,
        };
      } catch {
        // 새 요청이나 언마운트로 끊긴 것은 실패가 아님 → 호출자가 에러 문구를 띄우지 않게 null
        if (controller.signal.aborted && !timedOut) return null;
        // 부분 텍스트는 쓰지 않는다: 호출자가 준비한 문구로 말풍선 전체를 대신함
        throw new Error('AI 튜터 요청에 실패했습니다');
      } finally {
        clearTimeout(idleTimer);
        inFlightRef.current.delete(controller);
        if (activeStreamRef.current === controller) activeStreamRef.current = null;
      }
    },
    [],
  );

  return {
    sendTutorRequest,
    sendTutorStreamRequest,
    isLoading,
    setIsLoading,
    hasApiKey,
    refreshApiKeyStatus() {
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data: { has_custom_keys: string[] }) => {
          setHasApiKey(data.has_custom_keys.length > 0);
        })
        .catch(() => {});
    },
  };
}
