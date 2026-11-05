'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { Lock, X } from 'lucide-react';
import { STAGE_LOCKED_MESSAGE } from '@/lib/world/stageLock';

/** 이 시간이 지나면 안내가 스스로 닫힌다 */
export const STAGE_LOCKED_NOTICE_MS = 5_000;

/**
 * 잠긴 스테이지의 퀘스트를 URL 로 열어 월드맵으로 돌아왔을 때의 안내 (B38, `/world?notice=stage-locked`).
 * 주소에서 안내 값을 바로 지워 새로 고침·뒤로 가기에서 다시 뜨지 않게 한다 (서버 컴포넌트를 다시 받지 않도록 history 만 바꿈).
 */
export function StageLockedNotice() {
  const [open, setOpen] = useState(true);
  // 동작 줄이기: 기기 설정 + 사용자 설정 (P2-15)
  const { reduced: reduceMotion } = useMotionTier();

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
    const timer = setTimeout(() => setOpen(false), STAGE_LOCKED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          role="status"
          aria-live="polite"
          data-testid="stage-locked-notice"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-700 dark:bg-amber-950"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
            <Lock className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="flex-1 text-sm font-medium text-amber-900 dark:text-amber-100">
            {STAGE_LOCKED_MESSAGE}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="안내 닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
