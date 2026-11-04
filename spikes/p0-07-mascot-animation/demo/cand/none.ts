import type { MountFn } from './types';
// 기준선: 아무 애니메이션 없이 지금 앱의 정적 SVG만 (busy면 confetti만 돈다)
export const mount: MountFn = async (el, o) => {
  o.mark('lib');
  el.innerHTML = `<div style="width:${o.size}px;height:${o.size}px;border-radius:50%;background:#C8E6C9"></div>`;
  requestAnimationFrame(() => requestAnimationFrame(o.onFirstFrame));
  return { destroy: () => (el.innerHTML = '') };
};
