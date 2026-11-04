import { useState } from 'react';
import { SoundProvider, SoundToggle, useBgm, useSfx, useSoundSnapshot, useSoundSettings } from '../src/react/SoundProvider';
import { STARTER_MANIFEST, STAR_RATES, type BgmId, type SfxId } from '../src/manifest';

function QuestPanel() {
  const playRun = useSfx<SfxId>('run');
  const playCorrect = useSfx<SfxId>('correct');
  const playStar = useSfx<SfxId>('star');
  return (
    <div>
      <button id="r-run" onPointerDown={() => playRun()}>실행</button>
      <button id="r-correct" onPointerDown={() => playCorrect()}>정답</button>
      <button id="r-stars" onPointerDown={() => STAR_RATES.forEach((rate, i) => setTimeout(() => playStar({ rate }), i * 220))}>
        별 1→3
      </button>
    </div>
  );
}

function WorldMap({ world }: { world: BgmId }) {
  useBgm<BgmId>(world);
  return <p id="r-world">월드맵: {world}</p>;
}

function Status() {
  const snap = useSoundSnapshot<BgmId>();
  const [settings, set] = useSoundSettings();
  return (
    <div>
      <p id="r-state">
        {snap.state} · bgm {snap.playingBgm ?? '-'} (원함 {snap.desiredBgm ?? '-'})
      </p>
      <label>
        <input id="r-bgm" type="checkbox" checked={settings.bgm.enabled} onChange={(e) => set({ bgm: { enabled: e.target.checked } })} /> BGM
      </label>
      <SoundToggle />
    </div>
  );
}

export function DemoApp() {
  const [world, setWorld] = useState<BgmId | null>(null);
  return (
    <SoundProvider manifest={STARTER_MANIFEST}>
      <Status />
      <QuestPanel />
      <button id="r-w1" onClick={() => setWorld('world1')}>월드1 진입</button>
      <button id="r-w2" onClick={() => setWorld('world2')}>월드2 진입</button>
      <button id="r-leave" onClick={() => setWorld(null)}>월드맵 나가기</button>
      {world && <WorldMap world={world} />}
    </SoundProvider>
  );
}
