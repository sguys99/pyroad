/**
 * 월드맵 앰비언트 장식 (구름·나뭇잎). 움직임은 CSS `.float-cloud`·`.drift-leaf`가 맡고
 * full 단계에서만 돈다 (lite 이하·동작 줄이기는 정지 배경, P2-15 · globals.css).
 * 시차는 `--ambient-dur`·`--ambient-delay`로 준다.
 */
const CLOUDS: Array<{
  style: React.CSSProperties;
  dur: string;
  delay?: string;
  opacity: string;
}> = [
  {
    style: { top: '8%', left: '5%', width: 40, height: 16, borderRadius: 8 },
    dur: '25s',
    opacity: 'opacity-30',
  },
  {
    style: { top: '22%', right: '8%', width: 32, height: 12, borderRadius: 6 },
    dur: '30s',
    delay: '-8s',
    opacity: 'opacity-20',
  },
  {
    style: { top: '55%', left: '10%', width: 28, height: 10, borderRadius: 5 },
    dur: '22s',
    delay: '-15s',
    opacity: 'opacity-25',
  },
];

const LEAVES: Array<{
  style: React.CSSProperties;
  dur: string;
  delay: string;
}> = [
  {
    style: {
      top: '35%',
      right: '15%',
      width: 8,
      height: 8,
      background: '#81C784',
      opacity: 0.5,
    },
    dur: '18s',
    delay: '-4s',
  },
  {
    style: {
      top: '60%',
      left: '20%',
      width: 6,
      height: 6,
      background: '#A5D6A7',
      opacity: 0.4,
    },
    dur: '22s',
    delay: '-10s',
  },
];

export function FloatingDecorations() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      {CLOUDS.map((cloud, i) => (
        <div
          key={`cloud-${i}`}
          className={`float-cloud absolute bg-white ${cloud.opacity}`}
          style={
            {
              ...cloud.style,
              '--ambient-dur': cloud.dur,
              '--ambient-delay': cloud.delay ?? '0s',
            } as React.CSSProperties
          }
        />
      ))}
      {LEAVES.map((leaf, i) => (
        <div
          key={`leaf-${i}`}
          className="drift-leaf absolute"
          style={
            {
              ...leaf.style,
              borderRadius: '0 50% 50% 50%',
              '--ambient-dur': leaf.dur,
              '--ambient-delay': leaf.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
