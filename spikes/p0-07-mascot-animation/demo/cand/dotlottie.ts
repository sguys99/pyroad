import type { MountFn } from './types';
export const mount: MountFn = async (el, o) => {
  const { DotLottie } = await import('@lottiefiles/dotlottie-web');
  DotLottie.setWasmUrl('/dist/wasm/dotlottie-player.wasm');
  o.mark('lib');
  const canvas = document.createElement('canvas');
  canvas.style.width = canvas.style.height = `${o.size}px`;
  el.appendChild(canvas);
  const d = new DotLottie({
    canvas,
    src: '/assets/generated/pybaem-rig-baked-dance-only.json',
    loop: true,
    autoplay: true,
    renderConfig: { autoResize: true, freezeOnOffscreen: true },
  });
  d.addEventListener('load', () => o.mark('asset'));
  let first = true;
  d.addEventListener('render', () => {
    if (first) {
      first = false;
      requestAnimationFrame(o.onFirstFrame);
    }
  });
  return { destroy: () => d.destroy() };
};
