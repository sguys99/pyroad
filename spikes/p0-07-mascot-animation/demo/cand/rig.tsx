import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PybaemRig } from '../../src/rig/PybaemRig';
import type { RigEngine } from '../../src/rig/engine';
import type { RigState } from '../../src/rig/params';
import type { MountFn } from './types';

// variant: rig (A, 소품 끔) | rig-full (A, 소품+모자+망토) | rig-b (B 그림책) | rig-lite | rig-minimal
export const mount: MountFn = async (el, o) => {
  o.mark('lib');
  const root = createRoot(el);
  let engine: RigEngine | null = null;
  let state: RigState = 'dance';
  const v = o.variant;
  const render = () =>
    root.render(
      <PybaemRig
        state={state}
        size={o.size}
        style={v === 'rig-b' ? 'B' : 'A'}
        tier={v === 'rig-lite' ? 'lite' : v === 'rig-minimal' ? 'minimal' : 'full'}
        props={v === 'rig-full' || v === 'rig-b'}
        costume={v === 'rig-full' ? { hat: 'party', cape: '#E53935' } : {}}
        reducedMotion={false}
        lookAt={false}
        seed={o.index + 1}
        palette={o.index === 1 ? { body: '#4FC3F7', bodyDark: '#0288D1', bodyLight: '#B3E5FC', belly: '#E1F5FE', ink: '#01579B' } : o.index === 2 ? { body: '#F48FB1', bodyDark: '#D81B60', bodyLight: '#FCE4EC', belly: '#FFF0F5', ink: '#880E4F' } : undefined}
        onEngine={(e) => (engine = e)}
      />,
    );
  flushSync(render);
  o.mark('asset');
  requestAnimationFrame(() => requestAnimationFrame(o.onFirstFrame));
  return {
    destroy: () => root.unmount(),
    setState: (s) => {
      state = s as RigState;
      engine?.setState(state);
    },
  };
};
