'use client';

import { useEffect } from 'react';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type { MotionSettings } from '@/lib/motion/tier';

/**
 * 서버의 움직임 설정(`users.settings.motion`)을 연출 단계 Provider에 반영한다 (P2-15).
 * 첫 페인트 전 반영은 같은 레이아웃의 nonce 스크립트(`motionBootSyncScript`)가 하고,
 * 이 컴포넌트는 소프트 내비게이션(랜딩 → 로그인 화면)과 React 상태를 맡는다 (클라이언트에서 만든 `<script>`는 실행되지 않음).
 */
export function MotionSettingsSync({ settings }: { settings: MotionSettings }) {
  const { adoptSettings } = useMotionTier();
  const { tier, reduced } = settings;
  useEffect(() => {
    adoptSettings({ tier, reduced });
  }, [adoptSettings, tier, reduced]);
  return null;
}
