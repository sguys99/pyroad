import { NextResponse } from 'next/server';
import { callTutor } from '@/lib/tutor/client';
import { getCachedResponse, setCachedResponse, buildCacheKey } from '@/lib/tutor/cache';
import type { TutorResponse } from '@/lib/tutor/types';
import { prepareTutorCall, buildFallbackMessage } from './helpers';
import { getMaxTokens } from '@/lib/tutor/config';
import { withHintTracking } from '@/lib/analytics/server';

export async function POST(request: Request) {
  const prepared = await prepareTutorCall(request);

  if (prepared instanceof Response) {
    return prepared;
  }

  const { systemPrompt, userPrompt, providerType, customApiKey, hasAnyKey, fast, fallbackProviders, quest, answerKey, body } = prepared;
  // 힌트를 실제로 보냈을 때 hint_used 분석 이벤트도 남긴다 (P1-17)
  const recordHint = withHintTracking(prepared.recordHint, request, {
    questId: body.quest_id,
    level: body.hint_level,
  });

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
    // 서버 키 전역 예산(P1-22)은 캐시를 지나 실제로 provider 를 부를 때만 센다
    { signal: request.signal, allowServerKey: prepared.allowServerKey },
  );

  let message: string;
  let isFallback: boolean;

  if (result.ok) {
    message = result.text;
    // AI가 답했으면 다른 provider로 폴백했더라도(was_fallback) "저장된 답변"이 아니다 (B18 남은 문제).
    // is_fallback 은 서버의 저장된 답변을 보냈을 때만 true (스트림 route 와 같은 뜻)
    isFallback = false;

    // 성공 응답 캐시
    if (cacheKey && message) {
      setCachedResponse(cacheKey, message);
    }
  } else {
    isFallback = true;
    message = buildFallbackMessage(body, quest, answerKey);
  }

  // 힌트를 내줄 때 hints_used 를 기록 (P1-04, B05). 응답을 받지 못하는(끊긴) 요청은 세지 않음
  if (recordHint && !request.signal.aborted) {
    await recordHint();
  }

  const response: TutorResponse = {
    message,
    is_fallback: isFallback,
    ...((!hasAnyKey && isFallback) && { no_api_key: true }),
    ...(result.provider_used && { provider_used: result.provider_used }),
  };
  return NextResponse.json(response);
}
