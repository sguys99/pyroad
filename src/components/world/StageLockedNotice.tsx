'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Toast, ToastRegion } from '@/components/ui/toast';
import { STAGE_LOCKED_MESSAGE } from '@/lib/world/stageLock';

/** 이 시간이 지나면 안내가 스스로 닫힌다 */
export const STAGE_LOCKED_NOTICE_MS = 5_000;

/**
 * 잠긴 스테이지의 퀘스트를 URL 로 열어 월드맵으로 돌아왔을 때의 안내 (B38, `/world?notice=stage-locked`).
 * 주소에서 안내 값을 바로 지워 새로 고침·뒤로 가기에서 다시 뜨지 않게 한다 (서버 컴포넌트를 다시 받지 않도록 history 만 바꿈).
 */
export function StageLockedNotice() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('notice');
      window.history.replaceState(
        null,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    } catch {
      // 주소를 못 바꿔도 안내는 보여 준다
    }
  }, []);

  // 공통 토스트 (P2-11): 늘 떠 있는 status 영역 안에 쪽지 한 장. 등장 연출은 단계·동작 줄이기를 따른다
  return (
    <ToastRegion>
      {open && (
        <Toast
          tone="warn"
          icon={<Lock className="size-4" aria-hidden="true" />}
          duration={STAGE_LOCKED_NOTICE_MS}
          onClose={() => setOpen(false)}
          closeLabel="안내 닫기"
          data-testid="stage-locked-notice"
        >
          {STAGE_LOCKED_MESSAGE}
        </Toast>
      )}
    </ToastRegion>
  );
}
