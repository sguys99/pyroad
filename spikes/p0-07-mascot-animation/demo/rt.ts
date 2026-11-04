// 상태 전환 비교용 단일 런타임 페이지: ?rt=baked-sm|baked-sm-instant|baked-marker|lottie-seg|rive-avatar
// window.__rt.setState(name) / window.__rt.ready
const q = new URLSearchParams(location.search);
const RT = q.get('rt') ?? 'baked-sm';
const SIZE = Number(q.get('size') ?? 200);
const host = document.getElementById('cap')!;
const w = window as unknown as { __rt: { ready: boolean; setState(s: string): void; info?: () => unknown } };
w.__rt = { ready: false, setState: () => {} };

async function main() {
  if (RT.startsWith('baked')) {
    const { DotLottie } = await import('@lottiefiles/dotlottie-web');
    DotLottie.setWasmUrl('/dist/wasm/dotlottie-player.wasm');
    const canvas = document.createElement('canvas');
    canvas.style.width = canvas.style.height = `${SIZE}px`;
    host.appendChild(canvas);
    const data = await (await fetch('/assets/generated/pybaem-rig-baked.json')).text();
    const sm = RT === 'baked-marker' ? null : await (await fetch(`/assets/generated/${RT === 'baked-sm-instant' ? 'pybaem-rig-sm-instant' : 'pybaem-rig-sm'}.json`)).text();
    const d = new DotLottie({ canvas, data, autoplay: true, loop: true, marker: 'idle', renderConfig: { autoResize: true } });
    d.addEventListener('load', () => {
      if (sm) {
        d.stateMachineLoadData(sm);
        d.stateMachineStart();
      }
      w.__rt = {
        ready: true,
        setState: (s) => {
          if (sm) d.stateMachineSetStringInput('state', s);
          else {
            d.setMarker(s);
            d.setLoop(s !== 'happy');
            d.play();
          }
        },
        info: () => ({ cur: sm ? d.stateMachineGetCurrentState() : d.marker, frame: d.currentFrame }),
      };
    });
  } else if (RT === 'lottie-seg') {
    const mod = await import('lottie-web/build/player/lottie_svg');
    const lottie = ((mod as { default?: unknown }).default ?? mod) as typeof import('lottie-web').default;
    const data = await (await fetch('/assets/generated/pybaem-rig-baked.json')).json();
    const box = document.createElement('div');
    box.style.width = box.style.height = `${SIZE}px`;
    host.appendChild(box);
    const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: false, animationData: data });
    const seg = (s: string) => {
      const m = data.markers.find((x: { cm: string }) => x.cm === s);
      return [m.tm, m.tm + m.dr] as [number, number];
    };
    anim.addEventListener('DOMLoaded', () => {
      anim.playSegments(seg('idle'), true);
      w.__rt = {
        ready: true,
        setState: (s) => {
          anim.loop = s !== 'happy';
          anim.playSegments(seg(s), true);
        },
        info: () => ({ frame: anim.currentFrame }),
      };
    });
  } else if (RT === 'rive-avatar') {
    const mod = await import('@rive-app/canvas');
    const { Rive, RuntimeLoader } = ((mod as { default?: unknown }).default ?? mod) as typeof import('@rive-app/canvas');
    RuntimeLoader.setWasmUrl('/dist/wasm/rive-canvas.wasm');
    const canvas = document.createElement('canvas');
    canvas.style.width = canvas.style.height = `${SIZE}px`;
    canvas.width = canvas.height = SIZE * devicePixelRatio;
    host.appendChild(canvas);
    const r = new Rive({
      src: '/assets/third-party/rive/avatars.riv',
      canvas,
      artboard: 'Avatar 1',
      stateMachine: 'avatar',
      autoplay: true,
      onLoad: () => {
        w.__rt = {
          ready: true,
          setState: (s) => {
            for (const i of r.stateMachineInputs('avatar') ?? []) {
              if (i.name === 'isHappy') i.value = s === 'happy';
              if (i.name === 'isSad') i.value = s === 'sad';
            }
          },
        };
      },
    });
  }
}
main();
