// 시안 진입점 빈 골격용 자리 표시 (시안 에이전트가 자기 화면으로 바꾸면 지운다)
import { PybaemRig } from './rig/PybaemRig';
import type { RigStyle } from './rig/params';
import { CONCEPT_NAME, type Concept } from './tokens';

export function SkeletonScreen({ concept, screen, item }: { concept: Concept; screen: string; item: string }) {
  const style: RigStyle = concept;
  return (
    <main
      style={{
        minHeight: 'var(--vp-h)',
        display: 'grid',
        placeItems: 'center',
        padding: '32px max(16px, env(safe-area-inset-right, 0px)) 96px max(16px, env(safe-area-inset-left, 0px))',
        textAlign: 'center',
      }}
    >
      <div>
        <PybaemRig style={style} state="think" size={180} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--display-weight)' as never, fontSize: 'calc(32px * var(--display-scale))', lineHeight: 1.2 }}>
          {CONCEPT_NAME[concept]} · #{screen}
        </h1>
        <p style={{ color: 'var(--c-text-muted)', maxWidth: '30em', margin: '12px auto 0' }}>
          이 화면은 {item}에서 채웁니다. 공유 모듈 사용법은 design/README.md를 보세요.
        </p>
      </div>
    </main>
  );
}
