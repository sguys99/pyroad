import { NextResponse } from 'next/server';
import { callTutor } from '@/lib/tutor/client';
import { getCachedResponse, setCachedResponse, buildCacheKey } from '@/lib/tutor/cache';
import type { TutorResponse } from '@/lib/tutor/types';
import { prepareTutorCall, buildFallbackMessage } from './helpers';
import { getMaxTokens } from '@/lib/tutor/config';

export async function POST(request: Request) {
  const prepared = await prepareTutorCall(request);

  if (prepared instanceof Response) {
    return prepared;
  }

  const { systemPrompt, userPrompt, providerType, customApiKey, hasAnyKey, fast, fallbackProviders, quest, body } = prepared;

  // 캐시 확인
  const cacheKey = buildCacheKey(body);
  if (cacheKey) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return NextResponse.json({ message: cached, is_fallback: false } satisfies TutorResponse);
    }
  }

  // 클라이언트가 요청을 끊으면(request.signal) provider 호출·재시도도 멈춘다
  const result = await callTutor(
    systemPrompt,
    userPrompt,
    getMaxTokens(body.type, providerType),
    providerType,
    customApiKey,
    fast,
    fallbackProviders,
    { signal: request.signal },
  );

  let message: string;
  let isFallback: boolean;

  if (result.ok) {
    message = result.text;
    isFallback = result.was_fallback ?? false;

    // 성공 응답 캐시
    if (cacheKey && message) {
      setCachedResponse(cacheKey, message);
    }
  } else {
    isFallback = true;
    message = buildFallbackMessage(body, quest);
  }

  const response: TutorResponse = {
    message,
    is_fallback: isFallback,
    ...((!hasAnyKey && isFallback) && { no_api_key: true }),
    ...(result.provider_used && { provider_used: result.provider_used }),
  };
  return NextResponse.json(response);
}
