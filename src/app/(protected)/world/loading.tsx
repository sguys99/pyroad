/**
 * 월드맵 불러오는 중 (B141): 위에 붙는 HUD 띠(`.wh`와 같은 면·아랫선·폭) + 지도 머리 + 지도 카드 자리.
 * 지도는 1024px 미만 세로, 넓으면 가로(실제 지도 비율과 비슷하게). 반복은 투명도만, 동작 줄이기에서 멈춤
 */
export default function WorldLoading() {
  return (
    <div
      className="min-h-screen animate-pulse reduced:animate-none"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        지도를 펼치는 중이에요
      </p>
      <div
        className="sticky top-0 z-40 border-b border-line bg-surface"
        aria-hidden
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2 lg:max-w-5xl">
          <div className="size-8 rounded-full bg-surface-2" />
          <div className="h-4 w-20 rounded-full bg-surface-2" />
          <div className="ml-auto h-11 w-24 rounded-full bg-surface-2" />
          <div className="size-11 rounded-full bg-surface-2" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-6 lg:max-w-5xl" aria-hidden>
        <div className="h-4 w-20 rounded-full bg-surface-2" />
        <div className="mt-2 h-8 w-48 rounded-full bg-surface-2" />
        <div className="mt-4 aspect-[3/4] rounded-2xl bg-surface-2 lg:aspect-[5/3]" />
      </div>
    </div>
  );
}
