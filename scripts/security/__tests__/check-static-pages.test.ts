import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_NOT_FOUND,
  checkStaticPages,
  htmlFileFor,
} from '../check-static-pages';

const html = (routes: string[]) => (route: string) => routes.includes(route);

describe('정적 페이지 ↔ CSP 정적 정책 목록 (B27)', () => {
  it('랜딩만 정적이면 통과', () => {
    expect(
      checkStaticPages(
        ['/', BUILT_IN_NOT_FOUND, '/icon.svg'],
        html(['/', BUILT_IN_NOT_FOUND]),
        {
          hasCatchAll: true,
        },
      ),
    ).toEqual({ unlisted: [], notStatic: [] });
  });

  it('목록에 없는 정적 페이지는 실패 대상 (nonce가 없어 스크립트가 막힘)', () => {
    expect(
      checkStaticPages(['/', '/settings'], html(['/', '/settings']), {
        hasCatchAll: true,
      }).unlisted,
    ).toEqual(['/settings']);
  });

  it('없는 주소를 받는 라우트가 없으면 기본 404도 실패 대상', () => {
    expect(
      checkStaticPages(
        ['/', BUILT_IN_NOT_FOUND],
        html(['/', BUILT_IN_NOT_FOUND]),
        {
          hasCatchAll: false,
        },
      ).unlisted,
    ).toEqual([BUILT_IN_NOT_FOUND]);
  });

  it('HTML이 아닌 정적 라우트(아이콘)는 무시', () => {
    expect(
      checkStaticPages(['/', '/icon.svg'], html(['/']), { hasCatchAll: true }),
    ).toEqual({ unlisted: [], notStatic: [] });
  });

  it('랜딩이 동적 렌더가 되면 경고 대상', () => {
    expect(
      checkStaticPages([BUILT_IN_NOT_FOUND], html([BUILT_IN_NOT_FOUND]), {
        hasCatchAll: true,
      }).notStatic,
    ).toEqual(['/']);
  });

  it('HTML 파일 이름', () => {
    expect(htmlFileFor('/')).toBe('index.html');
    expect(htmlFileFor('/_not-found')).toBe('_not-found.html');
  });
});
