// 프레임 스트립·베이크용 단일 리그 페이지. ?state=&style=&hat=&glasses=&cape=&bg=&size=&tier=&reduced=&skin=
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PybaemRig, type PybaemRigHandle } from '../src/rig/PybaemRig';
import type { MotionTier, RigState, RigStyle } from '../src/rig/params';
import type { Costume } from '../src/rig/costumes';
import type { RigEngine } from '../src/rig/engine';

const q = new URLSearchParams(location.search);
const ref: { current: PybaemRigHandle | null } = { current: null };
let engine: RigEngine | null = null;
function App() {
  const [state, setState] = useState<RigState>((q.get('state') as RigState) ?? 'idle');
  const [talking, setTalking] = useState(q.get('talk') === '1');
  const costume: Costume = {
    hat: (q.get('hat') as Costume['hat']) || undefined,
    glasses: (q.get('glasses') as Costume['glasses']) || undefined,
    cape: q.get('cape') ? `#${q.get('cape')}` : undefined,
    bg: (q.get('bg') as Costume['bg']) || undefined,
  };
  Object.assign(window as object, {
    __cap: {
      setState,
      setTalking,
      poke: () => ref.current?.poke(),
      engine: () => engine,
      snapshot: () => engine?.snapshot(),
    },
  });
  return (
    <div id="cap" style={{ display: 'inline-block', padding: 4, background: q.get('bgc') ?? '#ffffff' }}>
      <PybaemRig
        ref={(h) => {
          ref.current = h;
        }}
        onEngine={(e) => (engine = e)}
        state={state}
        talking={talking}
        style={(q.get('style') as RigStyle) ?? 'A'}
        tier={(q.get('tier') as MotionTier) ?? 'full'}
        reducedMotion={q.get('reduced') === '1'}
        static={q.get('static') === '1'}
        lookAt={q.get('look') !== '0'}
        props={q.get('props') !== '0'}
        costume={costume}
        size={Number(q.get('size') ?? 200)}
        seed={Number(q.get('seed') ?? 7)}
      />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
