import type { WorldId } from '@/lib/design/tokens';

interface MapBackgroundProps {
  children: React.ReactNode;
  className?: string;
  /** 월드 번호 → `data-world` (월드 틴트 토큰을 바꾼다). 없으면 감싼 요소의 월드, 그것도 없으면 월드 1 */
  world?: WorldId;
}

/**
 * 월드맵 바탕. 월드 틴트 토큰(`--world`·`--world-soft`)만 쓴다 → 감싸는 요소의 `data-world`가 바꾸면 월드마다 색이 바뀐다
 * (P2-09, §6 "같은 디자인 시스템 위에서 배경·지도만 교체"). 최종 시안처럼 격자·빗금 없이 옅은 틴트 한 겹.
 * 지도 그림 자체는 Phase 5에서 다시 그린다
 */
export function MapBackground({
  children,
  className,
  world,
}: MapBackgroundProps) {
  return (
    <div
      className={className}
      data-world={world}
      style={{ position: 'relative' }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: `linear-gradient(
            to top,
            color-mix(in srgb, var(--world) 55%, var(--world-soft)) 0%,
            var(--world-soft) 55%,
            var(--background) 100%
          )`,
          borderRadius: 'inherit',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
