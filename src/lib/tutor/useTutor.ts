'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TutorRequest, TutorResponse } from './types';

export function useTutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

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

  async function sendTutorRequest(
    req: TutorRequest,
  ): Promise<TutorResponse> {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TutorResponse = await res.json();
      if (data.no_api_key) {
        setHasApiKey(false);
      }
      return data;
    } catch {
      throw new Error('AI 튜터 요청에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }

  const sendTutorStreamRequest = useCallback(
    async (
      req: TutorRequest,
      onDelta: (fullText: string) => void,
    ): Promise<TutorResponse> => {
      setIsLoading(true);
      let fullText = '';
      let providerUsed: string | undefined;

      try {
        const res = await fetch('/api/tutor/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE 파싱: "data: {...}\n\n" 형태
          const lines = buffer.split('\n\n');
          // 마지막 요소는 불완전할 수 있으므로 buffer에 유지
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const json = trimmed.slice(6);
            try {
              const data = JSON.parse(json) as {
                delta?: string;
                done?: boolean;
                error?: boolean;
                provider_used?: string;
              };

              if (data.delta) {
                fullText += data.delta;
                onDelta(fullText);
              } else if (data.error) {
                throw new Error('스트리밍 에러');
              }
              if (data.provider_used) {
                providerUsed = data.provider_used;
              }
              // data.done → 정상 완료, loop가 끝남
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }

        // 주의: setIsLoading(false)를 여기서 호출하지 않음.
        // 호출자가 streamingContent를 정리하고 messages를 업데이트한 뒤
        // setIsLoading(false)와 동일 배치에서 처리하도록 함.
        // → 깜빡임 방지를 위해 caller에서 일괄 처리

        return {
          message: fullText,
          is_fallback: false,
          provider_used: providerUsed,
        };
      } catch {
        // 부분 텍스트가 충분하면 그대로 사용
        if (fullText.length > 50) {
          return { message: fullText, is_fallback: false };
        }
        throw new Error('AI 튜터 요청에 실패했습니다');
      }
      // finally에서 setIsLoading(false) 제거 — caller가 직접 관리
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
