import Link from 'next/link';

export default function WorldPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-primary">월드맵</h1>
      <p className="text-lg text-foreground/70">
        모험 지도를 준비하고 있어요! 곧 만나요 🗺️
      </p>
      <Link href="/profile" className="text-sm text-primary underline">
        내 프로필 보기
      </Link>
    </main>
  );
}
