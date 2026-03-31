import { LoginButton } from '@/components/LoginButton';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold text-primary">pyRoad</h1>
        <p className="max-w-md text-lg text-foreground">
          안녕! 나는 파이뱀 선생님이야~ 함께 파이썬 모험을 떠나볼래?
        </p>
      </div>
      <LoginButton />
    </main>
  );
}
