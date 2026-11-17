/**
 * 로그인 화면 불러오는 중 (B141): 지금 화면 틀과 같은 짜임 — 위 줄(‹ 뒤로 · 코인 칩) + 제목 + 테두리 없는 카드
 * (`bg-surface` + `shadow-card`, 반경 20). 자리 칸은 `bg-surface-2`. 폭은 읽는 화면 폭(B142)이라 설정·게시판과 같고,
 * 월드맵·책장(`world/loading.tsx`)·퀘스트·상점·갤러리는 자기 것. 반복은 투명도만(animate-pulse), 동작 줄이기에서 멈춤
 */
export default function ProtectedLoading() {
  return (
    <div
      className="mx-auto min-h-screen max-w-lg animate-pulse px-4 py-4 reduced:animate-none sm:py-6 md:max-w-2xl"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        불러오는 중이에요
      </p>
      <div className="flex items-center justify-between" aria-hidden>
        <div className="h-11 w-24 rounded-full bg-surface-2" />
        <div className="h-11 w-20 rounded-full bg-surface-2" />
      </div>
      <div
        className="mt-2 mb-5 h-8 w-32 rounded-full bg-surface-2"
        aria-hidden
      />
      <div className="space-y-4" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl bg-surface p-4 shadow-card">
            <div className="h-6 w-28 rounded-full bg-surface-2" />
            <div className="mt-3 h-4 w-3/4 rounded-full bg-surface-2" />
            <div className="mt-4 h-24 rounded-xl bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
