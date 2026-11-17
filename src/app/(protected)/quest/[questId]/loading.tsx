/**
 * 퀘스트 불러오는 중 (B141): 지금 퀘스트 화면 틀 — 머리 줄(‹ 월드맵 · 단계 · 소리) + 책 한 권 카드
 * (1024px 이상은 왼쪽 이야기 · 오른쪽 공책 두 쪽) + 아래 레벨 줄. 반복은 투명도만, 동작 줄이기에서 멈춤
 */
export default function QuestLoading() {
  return (
    <div
      className="flex h-screen flex-col animate-pulse reduced:animate-none"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        퀘스트를 펼치는 중이에요
      </p>
      <div
        className="flex items-center gap-3 border-b border-border bg-background px-4 py-2"
        aria-hidden
      >
        <div className="h-12 w-24 rounded-full bg-surface-2" />
        <div className="h-4 w-40 rounded-full bg-surface-2" />
        <div className="ml-auto size-11 rounded-full bg-surface-2" />
      </div>
      <div className="min-h-0 flex-1 p-4 lg:p-6" aria-hidden>
        <div className="h-full rounded-2xl bg-surface p-5 shadow-card lg:grid lg:grid-cols-2 lg:gap-12 lg:p-8">
          <div>
            <div className="h-4 w-40 rounded-full bg-surface-2" />
            <div className="mt-2 h-8 w-56 max-w-full rounded-full bg-surface-2" />
            <div className="mt-4 h-40 rounded-xl bg-surface-2" />
            <div className="mt-4 h-4 w-5/6 rounded-full bg-surface-2" />
            <div className="mt-6 h-32 rounded-xl bg-surface-2" />
          </div>
          <div className="hidden lg:block">
            <div className="h-6 w-40 rounded-full bg-surface-2" />
            <div className="mt-6 h-44 rounded-xl bg-surface-2" />
            <div className="mt-4 h-14 w-48 rounded-xl bg-surface-2" />
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-surface px-4 py-3" aria-hidden>
        <div className="h-6 w-28 rounded-full bg-surface-2" />
      </div>
    </div>
  );
}
