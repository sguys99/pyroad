'use client';

import { LazyMotion } from 'framer-motion';

/** 기능 묶음은 첫 로드 JS 밖 따로 받는다 (P6-16). 오기 전 `m.*`은 처음 모습으로 그려지고, 오면 움직인다 */
const loadFeatures = () => import('./motionFeatures').then((r) => r.default);

/**
 * Framer Motion `m.*` 컴포넌트용 기능 묶음.
 * 루트 레이아웃이 아니라 Framer를 쓰는 화면 틀(`LoggedInShell`·공지 레이아웃)에서만 감싼다 (P4-12):
 * 루트에 두면 Framer를 쓰지 않는 랜딩 첫 JS에도 LazyMotion·기능 묶음 약 25KB(gzip)가 실린다.
 * 새 화면에서 `m.*`을 쓰면 그 화면 틀에도 감싼다 (감싸지 않으면 애니메이션 없이 정지 상태로만 그려진다).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
