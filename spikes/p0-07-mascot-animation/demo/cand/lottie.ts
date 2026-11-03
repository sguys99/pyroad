import type { MountFn } from './types';
// variant: lottie-svg | lottie-canvas  (같은 baked 춤 구간 JSON)
export const mount: MountFn = async (el, o) => {
  const mod =
    o.variant === 'lottie-canvas'
      ? await import('lottie-web/build/player/lottie_canvas')
      : await import('lottie-web/build/player/lottie_svg');
  const lottie = ((mod as { default?: unknown }).default ?? mod) as typeof import('lottie-web').default;
  o.mark('lib');
  const data = await (await fetch('/assets/generated/pybaem-rig-baked-dance-only.json')).json();
  o.mark('asset');
  el.style.width = el.style.height = `${o.size}px`;
  const anim = lottie.loadAnimation({
    container: el,
    renderer: o.variant === 'lottie-canvas' ? 'canvas' : 'svg',
    loop: true,
    autoplay: true,
    animationData: data,
    rendererSettings: o.variant === 'lottie-canvas' ? { clearCanvas: true, dpr: devicePixelRatio } as never : undefined,
  });
  let first = true;
  anim.addEventListener('enterFrame', () => {
    if (first) {
      first = false;
      requestAnimationFrame(o.onFirstFrame);
    }
  });
  return { destroy: () => anim.destroy() };
};
