export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-primary">pyRoad</h1>
      <p className="text-lg text-foreground">
        파이뱀 선생님과 함께 파이썬을 배워요!
      </p>
      <div className="flex gap-3">
        <span className="inline-block h-8 w-8 rounded-full bg-primary" />
        <span className="inline-block h-8 w-8 rounded-full bg-secondary" />
        <span className="inline-block h-8 w-8 rounded-full bg-success" />
        <span className="inline-block h-8 w-8 rounded-full bg-accent" />
      </div>
    </main>
  );
}
