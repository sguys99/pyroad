'use client';

import { useState, useEffect } from 'react';
import type { TutorRequest, TutorResponse } from './types';

export function useTutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: { available_providers: string[] }) => {
        setHasApiKey(data.available_providers.length > 0);
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

  function refreshApiKeyStatus() {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: { available_providers: string[] }) => {
        setHasApiKey(data.available_providers.length > 0);
      })
      .catch(() => {});
  }

  return { sendTutorRequest, isLoading, hasApiKey, refreshApiKeyStatus };
}
