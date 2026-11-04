// Rive 샘플 구조 확인 (아트보드·상태머신·입력·뷰모델)
import { Rive, RuntimeLoader } from '@rive-app/canvas';
RuntimeLoader.setWasmUrl('/dist/wasm/rive-canvas.wasm');

const files = ['avatars', 'look', 'birb', 'tiger', 'hero-v6', 'centaur'];
const out: Record<string, unknown> = {};
async function inspect(name: string) {
  return new Promise<void>((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 300;
    document.body.appendChild(canvas);
    const r = new Rive({
      src: `/assets/third-party/rive/${name}.riv`,
      canvas,
      autoplay: true,
      onLoad: () => {
        const c = r.contents as any;
        out[name] = {
          artboards: c.artboards.map((a: any) => ({
            name: a.name,
            animations: a.animations,
            stateMachines: a.stateMachines.map((s: any) => ({ name: s.name, inputs: s.inputs })),
          })),
          bounds: r.bounds,
          vm: (r as any).viewModelCount ?? null,
        };
        resolve();
      },
      onLoadError: (e: unknown) => { out[name] = { error: String(e) }; resolve(); },
    });
  });
}
(async () => {
  for (const f of files) await inspect(f);
  (window as any).__inspect = out;
  document.title = 'done';
})();
