'use client';

import { useState } from 'react';
import type { TutorRequest, TutorResponse } from './types';

export function useTutor() {
  const [isLoading, setIsLoading] = useState(false);

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
      return await res.json();
    } catch {
      throw new Error('AI 튜터 요청에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }

  return { sendTutorRequest, isLoading };
}
