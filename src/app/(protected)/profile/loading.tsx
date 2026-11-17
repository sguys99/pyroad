import '@/components/profile/profile.css';

/**
 * 프로필 불러오는 중 (B141): 프로필과 같은 틀(`.pf` — 360 한 열, 768부터 두 열 · 폭 `md:max-w-4xl`) — 위 줄 + 머리 카드
 * + 왼쪽 달력·기록 / 오른쪽 업적·자랑 카드·작품함·별과 보물 자리. 자랑 카드·작품함·업적 도감도 이 자리표시
 */
export default function ProfileLoading() {
  const card = (h: string) => <div className={`pf-card ${h}`} />;
  return (
    <div
      className="mx-auto min-h-screen max-w-lg animate-pulse px-4 py-4 reduced:animate-none sm:py-6 md:max-w-4xl"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        불러오는 중이에요
      </p>
      <div className="pf" aria-hidden>
        <div className="pf-top pf-wide">
          <div className="h-11 w-24 rounded-full bg-surface-2" />
          <div className="h-11 w-20 rounded-full bg-surface-2" />
        </div>
        <div className="pf-card pf-wide">
          <div className="flex items-center gap-5">
            <div className="size-26 shrink-0 rounded-full bg-surface-2" />
            <div className="grid flex-1 gap-3">
              <div className="h-7 w-40 rounded-full bg-surface-2" />
              <div className="h-12 w-28 rounded-xl bg-surface-2" />
            </div>
          </div>
        </div>
        <div className="pf-col">
          {card('h-120')}
          {card('h-80')}
        </div>
        <div className="pf-col">
          {card('h-56')}
          {card('h-24')}
          {card('h-24')}
          {card('h-96')}
        </div>
      </div>
    </div>
  );
}
