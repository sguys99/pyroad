'use client';

import Link from 'next/link';
import { KeyRound } from 'lucide-react';

/**
 * 본인 API 키가 없을 때 안내 한 줄 (P6-10: 책 위를 가로지르던 띠 → 파이뱀 대화 안 옅은 쪽지).
 * 키가 없어도 기본 튜터(또는 저장된 답변)가 대답하므로 막는 안내가 아니라 알려 주는 안내.
 * v1.0 운영은 서버 Gemini 키가 없어(§12-Q80, B117) 기본 튜터 = 준비해 둔 답 — 서버 AI 튜터가 생기면 문구를 되돌림
 */
export function ApiKeyBanner() {
  return (
    <p className="qc-key" data-testid="api-key-note">
      <KeyRound aria-hidden />
      <span>
        지금은 파이뱀이 준비해 둔 답으로 도와줘요.{' '}
        <Link href="/settings">나만의 API 키 등록하기</Link>
      </span>
    </p>
  );
}
