/** 상점 불러오는 중 (P9-02): 간판 + 진열 칸 자리 (움직임은 동작 줄이기에서 멈춤) */
export default function ShopLoading() {
  return (
    <div
      className="mx-auto min-h-screen max-w-lg animate-pulse px-4 py-4 reduced:animate-none sm:py-6 md:max-w-5xl"
      aria-busy="true"
      aria-label="상점을 여는 중"
    >
      <div className="mb-5 flex justify-between">
        <div className="h-11 w-24 rounded-lg bg-muted" />
        <div className="h-11 w-24 rounded-full bg-muted" />
      </div>
      <div className="grid gap-5 md:grid-cols-[18rem_1fr] lg:grid-cols-[20rem_1fr]">
        <div className="h-44 rounded-2xl bg-muted md:h-80" />
        <div className="space-y-4">
          <div className="h-14 rounded-full bg-muted" />
          <div className="h-14 rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
