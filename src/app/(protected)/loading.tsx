export default function ProtectedLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-6 animate-pulse">
      {/* 헤더 스켈레톤 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-muted" />
          <div className="h-8 w-20 rounded-full bg-muted" />
        </div>
      </div>
      {/* 프로필 요약 스켈레톤 */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
          </div>
        </div>
      </div>
      {/* 콘텐츠 스켈레톤 */}
      <div className="space-y-4">
        <div className="h-48 rounded-2xl bg-muted" />
        <div className="h-48 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
