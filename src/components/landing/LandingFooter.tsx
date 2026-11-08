import Link from 'next/link';
import { LEGAL_LINKS, LEGAL_OPERATOR } from '@/lib/legal/meta';
import { LogoMark } from './LogoMark';

/** 바닥 글 링크. 개인정보처리방침은 법(개인정보 보호법 제30조)에 따라 눈에 띄게 굵게 */
const LINKS: readonly { href: string; label: string; strong?: boolean }[] = [
  ...LEGAL_LINKS.filter((l) => l.href !== '/licenses').map((l) => ({
    ...l,
    strong: l.href === '/privacy',
  })),
  { href: '/notice', label: '공지사항' },
  ...LEGAL_LINKS.filter((l) => l.href === '/licenses'),
];

/**
 * 랜딩 바닥 글 (P4-08, 최종 시안 `Footer`): 로고 · 약관·방침·공지·오픈소스 고지·문의 · 저작권 한 줄.
 * 서버 컴포넌트, 값은 토큰 유틸리티만. 로고 마크 색은 landing.css(`ld-logomark-*`).
 *
 * - 문의는 약관·처리방침에 적힌 연락처(`LEGAL_OPERATOR.email`)와 같은 메일 주소
 * - 예전 `#about`(없는 앵커)·GitHub 링크는 뺐다: 아이가 보는 화면에서 바깥 개발 사이트로 나가는 길을 두지 않는다.
 *   오픈소스 정보는 `/licenses`에 있다
 * - 약관·방침·공지·고지는 앱 CSS·글꼴 조각 CSS(원본 약 200KB)를 쓰는 화면이라, 미리 받으면 랜딩에서 쓰지 않는 CSS를
 *   preload해 콘솔 경고와 모바일 데이터 낭비가 생긴다 → 미리 받기 끔 (P4-13). 누르면 그때 받는다
 * - 링크 터치 대상 44px. 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function LandingFooter() {
  const link =
    'inline-flex min-h-11 items-center rounded-sm px-2.5 text-small transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto flex max-w-[72rem] flex-col gap-4 px-gutter py-8 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-8">
        <div className="flex flex-wrap items-center gap-x-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="pyRoad 처음 화면"
          >
            <LogoMark size={28} />
            <span className="font-display text-h3 leading-none">pyRoad</span>
          </Link>
          <span className="text-small text-text-muted">
            초등학생을 위한 파이썬 모험
          </span>
        </div>
        <nav aria-label="사이트 정보" className="-mx-2.5">
          <ul className="flex flex-wrap items-center">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  prefetch={false}
                  className={`${link} ${l.strong ? 'font-bold text-text' : 'text-text-muted'}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${LEGAL_OPERATOR.email}`}
                className={`${link} text-text-muted`}
              >
                문의하기
              </a>
            </li>
          </ul>
        </nav>
        <p className="w-full text-caption text-text-muted">© 2026 pyRoad</p>
      </div>
    </footer>
  );
}
