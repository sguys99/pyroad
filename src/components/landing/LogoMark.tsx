/** pyRoad 로고 마크: 펼친 책 위로 잉크 길이 굽이친다 (최종 시안 `LogoMark`, 색은 landing.css 토큰 클래스) */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path
        className="ld-logomark-page"
        d="M4 10c5-2 11-2 16 2 5-4 11-4 16-2v22c-5-2-11-2-16 2-5-4-11-4-16-2z"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path className="ld-logomark-spine" d="M20 12v22" strokeWidth="1.8" />
      <path
        className="ld-logomark-road"
        d="M8 27c3-5 7 0 9-5M23 20c3 4 6-3 10 1"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="0.1 4.2"
      />
      <path
        className="ld-logomark-x"
        d="M30 13l3 3m0-3l-3 3"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
