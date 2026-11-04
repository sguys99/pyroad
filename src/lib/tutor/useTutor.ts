'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TutorRequest, TutorResponse } from './types';
import { readTutorStream } from './sse';
import { tutorRateLimitMessage, type TutorRateLimitScope } from './messages';

/** 이 시간 동안 서버에서 아무 이벤트도 오지 않으면 실패로 보고 요청을 끊는다 */
export const STREAM_IDLE_TIMEOUT_MS = 30_000;

/**
 * 요청 한도를 넘었음 (서버 429, P1-19). `message`는 아이에게 보여 줄 수 있는 문구다.
 * 다른 실패와 똑같이 던지므로 호출자의 기존 오류 처리(힌트 횟수 되돌리기, 준비한 문구)가 그대로 동작한다.
 * 한도 문구를 보여 주려면 `error instanceof TutorRateLimitError ? error.message : 준비한 문구`.
 */
export class TutorRateLimitError extends Error {
  constructor(
    message: string,
    /** 다시 보내도 되는 때까지 초 */
    readonly retryAfterSec: number,
    readonly scope: TutorRateLimitScope,
  ) {
    super(message);
    this.name = 'TutorRateLimitError';
  }
}

interface Cooldown {
  until: number;
  scope: TutorRateLimitScope;
}

/** 429 응답에서 대기 시간·문구를 읽는다 (본문이 없으면 Retry-After 헤더) */
async function readRateLimit(res: Response): Promise<TutorRateLimitError> {
  let body: { message?: unknown; retry_after?: unknown; scope?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // 본문 없음 → 헤더만
  }
  const fromBody = Number(body.retry_after);
  const fromHeader = Number(res.headers.get('Retry-After'));
  const retryAfterSec = Math.max(
    1,
    Math.ceil(fromBody > 0 ? fromBody : fromHeader > 0 ? fromHeader : 60),
  );
  const scope: TutorRateLimitScope = body.scope === 'day' ? 'day' : 'minute';
  const message =
    typeof body.message === 'string' && body.message
      ? body.message
      : tutorRateLimitMessage(retryAfterSec, scope);
  return new TutorRateLimitError(message, retryAfterSec, scope);
}

/**
 * AI 튜터 요청 훅.
 *
 * 요청 함수는 취소된 경우 `null`을 돌려준다 (에러가 아님). 호출자는 `null`이면 아무것도 하지 않는다.
 * - 화면에 흘려 쓰는 스트림은 한 번에 하나만: 새 스트림 요청이 오면 이전 스트림을 abort (B18)
 * - 컴포넌트가 언마운트되면(퀘스트를 떠남) 진행 중인 모든 요청을 abort
 * 서버는 `request.signal`로 이를 받아 provider SDK 호출을 멈춘다.
 *
 * 요청 한도(P1-19): 서버가 429를 주면 `TutorRateLimitError`를 던지고, 그 유형은 `Retry-After` 동안 서버에 보내지 않고
 * 바로 같은 오류를 던진다 (기다리는 동안 계속 눌러도 한도 초과가 쌓이지 않게).
 */
export function useTutor() {
  // 스트림(말풍선) 로딩과 비스트림 요청 수를 따로 센다. 비스트림 요청이 끝나도 진행 중인 스트림의
  // "생각 중" 표시가 꺼지지 않게 (B18 남은 문제)
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const isLoading = isStreamLoading || pendingRequests > 0;
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const inFlightRef = useRef(new Set<AbortController>());
  const activeStreamRef = useRef<AbortController | null>(null);
  const cooldownRef = useRef(new Map<TutorRequest['type'], Cooldown>());

  /** 한도 대기 중인 유형이면 남은 시간으로 오류를 만든다 */
  const cooldownError = useCallback((type: TutorRequest['type']) => {
    const cooldown = cooldownRef.current.get(type);
    if (!cooldown) return null;
    const left = cooldown.until - Date.now();
    if (left <= 0) {
      cooldownRef.current.delete(type);
      return null;
    }
    const sec = Math.ceil(left / 1000);
    return new TutorRateLimitError(
      tutorRateLimitMessage(sec, cooldown.scope),
      sec,
      cooldown.scope,
    );
  }, []);

  /** 429 를 받으면 그 유형의 대기 시간을 기억하고 오류를 돌려준다 */
  const rateLimited = useCallback(
    async (type: TutorRequest['type'], res: Response) => {
      const error = await readRateLimit(res);
      cooldownRef.current.set(type, {
        until: Date.now() + error.retryAfterSec * 1000,
        scope: error.scope,
      });
      return error;
    },
    [],
  );

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
      const waiting = cooldownError(req.type);
      if (waiting) throw waiting;

      const controller = new AbortController();
      inFlightRef.current.add(controller);
      setPendingRequests((n) => n + 1);
      try {
        const res = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
          signal: controller.signal,
        });
        if (res.status === 429) throw await rateLimited(req.type, res);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TutorResponse = await res.json();
        if (data.no_api_key) {
          setHasApiKey(false);
        }
        return data;
      } catch (error) {
        if (controller.signal.aborted) return null;
        if (error instanceof TutorRateLimitError) throw error;
        throw new Error('AI 튜터 요청에 실패했습니다');
      } finally {
        inFlightRef.current.delete(controller);
        setPendingRequests((n) => n - 1);
      }
    },
    [cooldownError, rateLimited],
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
      setIsStreamLoading(true);

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
        // 한도 대기 중이면 보내지 않고 429 를 받은 것처럼 끝낸다 (이전 스트림은 위에서 끊었으므로 말풍선은 호출자 문구로)
        const waiting = cooldownError(req.type);
        if (waiting) throw waiting;
        const res = await fetch('/api/tutor/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
          signal: controller.signal,
        });

        // 한도 초과는 스트림을 열기 전에 JSON 429 로 온다 (힌트는 서버가 기록하지 않았으므로 호출자가 횟수를 되돌림)
        if (res.status === 429) throw await rateLimited(req.type, res);
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

        // 주의: setIsLoading(false)를 여기서 호출하지 않음 (스트림 로딩만 끄는 함수).
        // 호출자가 streamingContent를 정리하고 messages를 업데이트한 뒤
        // setIsLoading(false)와 동일 배치에서 처리하도록 함.
        // → 깜빡임 방지를 위해 caller에서 일괄 처리
        return {
          message: result.text,
          is_fallback: result.isFallback,
          provider_used: result.providerUsed,
        };
      } catch (error) {
        // 새 요청이나 언마운트로 끊긴 것은 실패가 아님 → 호출자가 에러 문구를 띄우지 않게 null
        if (controller.signal.aborted && !timedOut) return null;
        if (error instanceof TutorRateLimitError) throw error;
        // 부분 텍스트는 쓰지 않는다: 호출자가 준비한 문구로 말풍선 전체를 대신함
        throw new Error('AI 튜터 요청에 실패했습니다');
      } finally {
        clearTimeout(idleTimer);
        inFlightRef.current.delete(controller);
        if (activeStreamRef.current === controller)
          activeStreamRef.current = null;
      }
    },
    [cooldownError, rateLimited],
  );

  return {
    sendTutorRequest,
    sendTutorStreamRequest,
    /** 스트림이든 비스트림이든 튜터 요청이 진행 중인지 */
    isLoading,
    /** 스트림 로딩 표시를 끈다. 호출자가 말풍선을 정리하는 배치 안에서 부름 (비스트림 요청 수와 무관) */
    setIsLoading: setIsStreamLoading,
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
