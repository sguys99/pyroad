import type { MountFn } from './types';
// variant: rive-avatar (avatars.riv 기쁨 루프, 벡터) | rive-birb (birb.riv 춤, PNG 메시)
export const mount: MountFn = async (el, o) => {
  const mod = await import('@rive-app/canvas');
  const { Rive, RuntimeLoader, Layout, Fit } = ((mod as { default?: unknown }).default ?? mod) as typeof import('@rive-app/canvas');
  RuntimeLoader.setWasmUrl('/dist/wasm/rive-canvas.wasm');
  (Rive as unknown as { suppressDeprecationWarnings: string[] }).suppressDeprecationWarnings = ['state-machine-inputs'];
  o.mark('lib');
  const canvas = document.createElement('canvas');
  canvas.style.width = canvas.style.height = `${o.size}px`;
  canvas.width = canvas.height = Math.round(o.size * devicePixelRatio);
  el.appendChild(canvas);
  const birb = o.variant === 'rive-birb';
  const sm = birb ? 'birb' : 'avatar';
  return new Promise((resolve) => {
    const r = new Rive({
      src: `/assets/third-party/rive/${birb ? 'birb' : 'avatars'}.riv`,
      canvas,
      artboard: birb ? 'birb' : 'Avatar 1',
      stateMachine: sm,
      autoplay: true,
      layout: new Layout({ fit: Fit.Contain }),
      onLoad: () => {
        o.mark('asset');
        const inputs = r.stateMachineInputs(sm) ?? [];
        for (const i of inputs) {
          if (i.name === 'dance' || i.name === 'isHappy') i.value = true;
        }
        requestAnimationFrame(() => requestAnimationFrame(o.onFirstFrame));
        resolve({
          destroy: () => r.cleanup(),
          setState: (s) => {
            for (const i of r.stateMachineInputs(sm) ?? []) {
              if (i.name === 'isHappy') i.value = s === 'happy';
              if (i.name === 'isSad') i.value = s === 'sad';
            }
          },
        });
      },
    });
  });
};
