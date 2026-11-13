'use client';

import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics/track';

/**
 * 보호자 리포트의 인쇄 버튼 + 열람 기록 (P9-15). 열람은 브라우저에서 주(이번·지난)만 남긴다 —
 * 토큰·닉네임·수치는 보내지 않음, 미리보기 수집기는 세지 않음(공유 페이지 `share_view`와 같은 방식)
 */
export function GuardianReportActions({ offset }: { offset: 0 | 1 }) {
  useEffect(() => {
    track('guardian_report_view', { week: offset === 0 ? 'this' : 'last' });
  }, [offset]);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<Printer aria-hidden />}
      className="w-fit print:hidden"
      onClick={() => window.print()}
      sfx={false}
    >
      인쇄하기
    </Button>
  );
}
