/**
 * 테스트용 가짜 Web Audio (P2-14). 엔진이 쓰는 만큼만 흉내 낸다: 상태 전이(resume·suspend·statechange), GainNode 값,
 * 버퍼 소스의 시작·멈춤·loop, decodeAudioData. 실제 소리·시간은 없다.
 */

export class FakeParam {
  constructor(public value: number) {}
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}

export class FakeNode {
  outputs: FakeNode[] = [];
  connect<T extends FakeNode>(n: T): T {
    this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs = [];
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

export class FakeBuffer {
  constructor(
    public duration = 0.5,
    public label = '',
  ) {}
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  playbackRate = new FakeParam(1);
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor(private ctx: FakeAudioContext) {
    super();
  }
  start() {
    this.started = true;
    this.ctx.sources.push(this);
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    queueMicrotask(() => this.onended?.());
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  /** true면 resume()이 끝나지 않는다 (iOS 복귀 버그 흉내) */
  static resumeHangs = false;
  state: AudioContextState | 'interrupted' = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  closed = false;
  private listeners = new Map<string, Array<() => void>>();

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBufferSource() {
    return new FakeSource(this);
  }
  createBuffer() {
    return new FakeBuffer(0, 'silent');
  }
  createMediaElementSource() {
    return new FakeNode();
  }
  decodeAudioData(ab: ArrayBuffer & { label?: string }) {
    return Promise.resolve(new FakeBuffer(0.5, ab.label ?? ''));
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener() {}
  private setState(s: FakeAudioContext['state']) {
    if (s === this.state) return;
    this.state = s;
    for (const fn of this.listeners.get('statechange') ?? []) fn();
  }
  resume() {
    if (FakeAudioContext.resumeHangs) return new Promise<void>(() => {});
    this.setState('running');
    return Promise.resolve();
  }
  suspend() {
    this.setState('suspended');
    return Promise.resolve();
  }
  close() {
    this.closed = true;
    this.setState('closed');
    return Promise.resolve();
  }
  /** iOS 전화·화면 꺼짐 흉내 */
  interrupt() {
    this.setState('interrupted');
  }
  /** 지금 소리가 나는(시작했고 멈추지 않은) 소스 중 이 라벨의 버퍼 */
  playing(label: string) {
    return this.sources.filter(
      (s) => s.started && !s.stopped && s.buffer?.label === label,
    );
  }
}

/** URL → 라벨 달린 ArrayBuffer (가짜 디코드가 라벨을 버퍼에 옮김) */
export function fakeLoadBytes(url: string): Promise<ArrayBuffer> {
  const ab = new ArrayBuffer(8) as ArrayBuffer & { label?: string };
  ab.label = url.replace(/^.*\/([^/.]+)\.v\d+\.\w+$/, '$1');
  return Promise.resolve(ab);
}

export async function flush(times = 12) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}
