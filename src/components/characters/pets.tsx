/**
 * 동행 펫 그림 (P9-01, 카탈로그 `src/lib/shop/catalog.ts` 의 pet_* id → 그림). 월드맵 `PetSlot`·상점 썸네일이 같은 그림을 쓴다.
 * 리그 스타일 B(그림책)와 맞춤: 파스텔 면 + 몸색의 진한 톤 외곽선, 눈·입은 파이뱀과 같은 잉크, 볼터치·바닥 그림자도 같은 색.
 * 48×48 보기 상자, 바닥선 y = 44 (PetSlot 은 폭 100%로 그림). 훅·`<text>`·래스터 없음 → 서버·정지 그림·공유 카드에서도 그대로.
 * 대기 흔들림은 PetSlot 의 `.mascot-bob`(CSS)만, 그림 자체는 움직이지 않는다.
 */
import type { PetId } from '@/lib/shop/catalog';

const INK = '#3B2F25';
const SHADOW = '#8E877C';
const CHEEK = '#F2879B';

const line = (stroke: string, w = 1.3) => ({
  stroke,
  strokeWidth: w,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
});

function Eyes({ l, r, y }: { l: number; r: number; y: number }) {
  return (
    <g>
      {[l, r].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx="1.7" ry="2.1" fill={INK} />
          <circle cx={x + 0.55} cy={y - 0.75} r="0.6" fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function Cheeks({ l, r, y }: { l: number; r: number; y: number }) {
  return (
    <g fill={CHEEK} opacity="0.84">
      <ellipse cx={l} cy={y} rx="2.2" ry="1.3" />
      <ellipse cx={r} cy={y} rx="2.2" ry="1.3" />
    </g>
  );
}

const Ground = ({ rx = 14 }: { rx?: number }) => (
  <ellipse cx="24" cy="44.6" rx={rx} ry="2.4" fill={SHADOW} opacity="0.32" />
);

/** 삐약이: 노란 병아리 */
function Chick() {
  const ol = line('#B48F2E');
  return (
    <>
      <Ground rx={12} />
      <g {...line('#E08A3C', 1.4)} fill="none">
        <path d="M19.5 41v3M19.5 44l-1.8 1M19.5 44l1.8 1" />
        <path d="M28.5 41v3M28.5 44l-1.8 1M28.5 44l1.8 1" />
      </g>
      <path
        d="M22.6 12.6c-1.4-2.6-.6-5 1.6-6.2-.2 1.9.8 3.1 2.6 3.5-1.6.4-2.6 1.4-2.8 2.8"
        fill="#F6D774"
        {...ol}
      />
      <path
        d="M24 12c9.2 0 15 7 15 15.6S33 42.4 24 42.4 9 36.2 9 27.6 14.8 12 24 12Z"
        fill="#F6D774"
        {...ol}
      />
      <ellipse cx="24" cy="34.5" rx="8.5" ry="6.4" fill="#FBEDB8" />
      <path
        d="M12.2 27.6c-3 .4-4.8 4-3.4 6.6 1.3 2.2 4.6 2 6.2-.2.4-2.6-.6-5.4-2.8-6.4Z"
        fill="#EBC452"
        {...ol}
      />
      <path
        d="M35.8 27.6c3 .4 4.8 4 3.4 6.6-1.3 2.2-4.6 2-6.2-.2-.4-2.6.6-5.4 2.8-6.4Z"
        fill="#EBC452"
        {...ol}
      />
      <Eyes l={19.4} r={28.6} y={23.6} />
      <Cheeks l={15.8} r={32.2} y={27.8} />
      <path d="M21.7 27h4.6L24 30.2Z" fill="#F0965A" {...line('#B5612C', 1)} />
    </>
  );
}

/** 꼬북이: 아기 거북 (옆모습, 오른쪽을 보며 고개를 듦) */
function Turtle() {
  const skin = line('#7E9F5C');
  const shell = line('#3E7E70');
  const neck = 'M31 34.5c1.6-3.4 3.6-6 6-7.6';
  return (
    <>
      <Ground rx={17} />
      <path d="M4.6 36.4c-2 .2-3 1-3.2 2.2" fill="none" {...skin} />
      <path
        d="M8.5 38c0 4.6 1.6 6 3.6 6s3.6-1.4 3.6-6"
        fill="#C3E2A2"
        {...skin}
      />
      <path
        d="M24.5 38c0 4.6 1.6 6 3.6 6s3.6-1.4 3.6-6"
        fill="#C3E2A2"
        {...skin}
      />
      <path
        d="M4 36.5C4 26.1 11 19 20.3 19s16.3 7.1 16.3 17.5Z"
        fill="#79BFAF"
        {...shell}
      />
      <path d="M16.5 23.6h7.6l3.2 5.3-3.2 5.3h-7.6l-3.2-5.3Z" fill="#A9DACD" />
      <path d="M7.7 30.4l3.4-4.6 2 3.2-2 4.4H7.3Z" fill="#A9DACD" />
      <path d="M32.7 30.4l-3.4-4.6-2 3.2 2 4.4h3.8Z" fill="#A9DACD" />
      <path
        d="M2.9 35.6h33.8a2.2 2.2 0 0 1 0 4.4H2.9a2.2 2.2 0 0 1 0-4.4Z"
        fill="#579E8F"
        {...shell}
      />
      <path
        d={neck}
        fill="none"
        stroke="#7E9F5C"
        strokeWidth={7.6}
        strokeLinecap="round"
      />
      <path
        d={neck}
        fill="none"
        stroke="#C3E2A2"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <ellipse cx="38.8" cy="23.6" rx="6.8" ry="6.4" fill="#C3E2A2" {...skin} />
      <Eyes l={37} r={41.4} y={22.4} />
      <g fill={CHEEK} opacity="0.84">
        <ellipse cx="34.8" cy="25.8" rx="1.5" ry="1" />
        <ellipse cx="43.6" cy="25.8" rx="1.5" ry="1" />
      </g>
      <path d="M37.6 26.4q1.6 1.2 3.2 0" fill="none" {...line(INK, 1)} />
    </>
  );
}

/** 여울이: 아기 여우 (앉은 앞모습, 꼬리는 오른쪽) */
function Fox() {
  const ol = line('#A65F2C');
  const fur = '#EFA25F';
  const cream = '#FFF3E3';
  return (
    <>
      <Ground rx={15} />
      <path
        d="M31 41.6c8.6 1 13.6-5 11.6-12.4-1-4-5-6.2-7.2-4.2 2.2 3.2 1.4 8.4-4.6 10.6Z"
        fill={fur}
        {...ol}
      />
      <path
        d="M42.8 28.4c-1.2-3.6-5-5.4-7-3.6 1.4 1.8 1.8 4 1.4 6.4 2.6.4 4.6-1 5.6-2.8Z"
        fill={cream}
        {...ol}
      />
      <path
        d="M13.6 43.6c-1.2-9.2 3.2-15.4 10.4-15.4S35.6 34.4 34.4 43.6Z"
        fill={fur}
        {...ol}
      />
      <path d="M19 43.6c-.2-6.2 2.2-10.2 5-10.2s5.2 4 5 10.2Z" fill={cream} />
      <ellipse cx="19.4" cy="43" rx="2.8" ry="1.6" fill={cream} {...ol} />
      <ellipse cx="28.6" cy="43" rx="2.8" ry="1.6" fill={cream} {...ol} />
      <path d="M10.8 17.4 11.6 4.8l8.8 7.4Z" fill={fur} {...ol} />
      <path d="M37.2 17.4 36.4 4.8l-8.8 7.4Z" fill={fur} {...ol} />
      <path d="M13.2 14.2l.5-6 4.2 3.6Z" fill="#F8C9A2" />
      <path d="M34.8 14.2l-.5-6-4.2 3.6Z" fill="#F8C9A2" />
      <path
        d="M9.4 17.6Q24 9 38.6 17.6 37 30.4 24 31.6 11 30.4 9.4 17.6Z"
        fill={fur}
        {...ol}
      />
      <path
        d="M15.6 24Q24 20.4 32.4 24 30.6 31 24 31.6 17.4 31 15.6 24Z"
        fill={cream}
      />
      <Eyes l={18.4} r={29.6} y={19.6} />
      <Cheeks l={14.8} r={33.2} y={23.4} />
      <ellipse cx="24" cy="24.6" rx="1.7" ry="1.25" fill={INK} />
      <path d="M22.2 27q1.8 1.3 3.6 0" fill="none" {...line(INK, 1)} />
    </>
  );
}

/** 용용이: 아기 용 (앉은 앞모습, 날개·꼬리는 오른쪽 뒤) */
function Dragon() {
  const ol = line('#6E5AA6');
  const body = '#BBA6E6';
  return (
    <>
      <Ground rx={15} />
      <path
        d="M32 41.4c6.4.2 9.8-3 9.8-7.4 0-2-1.4-3.2-3-2.8 1 3.2-2 5.4-6.6 5.6Z"
        fill={body}
        {...ol}
      />
      <path
        d="M40.4 31.8l4.4-3.4-.8 5.2Z"
        fill="#9FD9C4"
        {...line('#4F9C84', 1.1)}
      />
      <path
        d="M31.6 26c3.4-6.8 9.6-8.6 13.4-6.8-2 1.2-2.8 3.4-2.2 5.6-2.2-.6-4.4 0-5.6 2-1.6-1.2-3.6-1.4-5.6-.8Z"
        fill="#F4B7C9"
        {...line('#B86A86', 1.2)}
      />
      <path
        d="M12.6 43.6c-1.2-9.4 3.4-16 11.4-16S36.6 34.2 35.4 43.6Z"
        fill={body}
        {...ol}
      />
      <path
        d="M18.2 43.6c-.2-6.4 2.4-10.6 5.8-10.6s6 4.2 5.8 10.6Z"
        fill="#F6EFFC"
      />
      <path d="M19.6 36.6h8.8M19 40h10" stroke="#D9CCF0" strokeWidth="1.1" />
      <ellipse cx="18.6" cy="43" rx="2.9" ry="1.6" fill={body} {...ol} />
      <ellipse cx="29.4" cy="43" rx="2.9" ry="1.6" fill={body} {...ol} />
      <path
        d="M15.6 12.4 13 5.2l6.2 4.6Z"
        fill="#F7E6B4"
        {...line('#B39A55', 1.1)}
      />
      <path
        d="M32.4 12.4 35 5.2l-6.2 4.6Z"
        fill="#F7E6B4"
        {...line('#B39A55', 1.1)}
      />
      <path
        d="M21.4 9.4 24 5.6l2.6 3.8Z"
        fill="#9FD9C4"
        {...line('#4F9C84', 1.1)}
      />
      <ellipse cx="24" cy="19.6" rx="12.6" ry="10.6" fill={body} {...ol} />
      <ellipse cx="24" cy="24.4" rx="6.4" ry="4.2" fill="#D6CAF2" />
      <circle cx="22.2" cy="23.6" r="0.75" fill={INK} />
      <circle cx="25.8" cy="23.6" r="0.75" fill={INK} />
      <Eyes l={17.8} r={30.2} y={18.4} />
      <Cheeks l={13.8} r={34.2} y={22.6} />
      <path d="M22.4 26.4q1.6 1.2 3.2 0" fill="none" {...line(INK, 1)} />
    </>
  );
}

const PET_ART: Record<PetId, () => React.ReactElement> = {
  pet_chick: Chick,
  pet_turtle: Turtle,
  pet_fox: Fox,
  pet_dragon: Dragon,
};

/** 펫 그림. `label`이 없으면 장식(aria-hidden) */
export function PetArt({
  id,
  size,
  label,
  className,
}: {
  id: PetId;
  /** px. 없으면 부모 폭 100% (PetSlot) */
  size?: number;
  label?: string;
  className?: string;
}) {
  const Art = PET_ART[id];
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      focusable="false"
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
    >
      <Art />
    </svg>
  );
}
