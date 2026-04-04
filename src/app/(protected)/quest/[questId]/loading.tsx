export default function QuestLoading() {
  return (
    <div className="flex h-screen flex-col animate-pulse">
      {/* 퀘스트 헤더 스켈레톤 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="h-8 w-8 rounded bg-muted" />
        <div className="h-5 w-48 rounded bg-muted" />
      </div>

      {/* 탭 바 스켈레톤 */}
      <div className="flex gap-1 border-b border-border px-4 py-2">
        <div className="h-8 w-16 rounded-lg bg-muted" />
        <div className="h-8 w-16 rounded-lg bg-muted" />
        <div className="h-8 w-16 rounded-lg bg-muted" />
      </div>

      {/* 메인 콘텐츠 스켈레톤 */}
      <div className="flex-1 p-4 space-y-4">
        {/* 대화 패널 스켈레톤 */}
        <div className="flex gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* 하단 상태 바 스켈레톤 */}
      <div className="border-t border-border px-4 py-3">
        <div className="h-3 w-full rounded-full bg-muted" />
      </div>
    </div>
  );
}
