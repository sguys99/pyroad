// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LegalDocumentView } from '../LegalDocumentView';
import { LegalPageShell } from '../LegalPageShell';
import { LicensesView } from '../LicensesView';
import { PRIVACY } from '@/lib/legal/privacy';
import { TERMS } from '@/lib/legal/terms';
import { LICENSE_DATA } from '@/lib/legal/licenses';

// 법적 고지 화면 (P3-14): 요약 카드·목차·표(좁은 화면 카드 + 넓은 화면 표)·고지 묶음이 그려지는지

afterEach(cleanup);

describe('LegalDocumentView', () => {
  it.each([TERMS, PRIVACY])(
    '$title: 제목·시행일·쉬운 말 요약·목차·개정 이력',
    (doc) => {
      render(
        <LegalPageShell current={doc.kind === 'terms' ? '/terms' : '/privacy'}>
          <LegalDocumentView doc={doc} />
        </LegalPageShell>,
      );
      expect(
        screen.getByRole('heading', { level: 1, name: doc.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(/시행일 2026년 11월 6일/)).toBeInTheDocument();
      const summary = screen.getByRole('region', { name: '쉬운 말 요약' });
      expect(within(summary).getAllByRole('listitem')).toHaveLength(
        doc.summary.length,
      );
      const toc = screen.getByRole('navigation', { name: '목차' });
      expect(within(toc).getAllByRole('link')).toHaveLength(
        doc.sections.length + 1,
      );
      for (const s of doc.sections) {
        expect(document.getElementById(s.id)).not.toBeNull();
      }
      expect(
        screen.getByRole('heading', { name: '개정 이력' }),
      ).toBeInTheDocument();
      // 지금 페이지 표시
      const nav = screen.getByRole('navigation', { name: '약관과 정책' });
      expect(
        within(nav).getByRole('link', { name: doc.title }),
      ).toHaveAttribute('aria-current', 'page');
    },
  );

  it('표는 이름표 붙은 카드와 caption 있는 표 두 가지로 그린다', () => {
    render(<LegalDocumentView doc={PRIVACY} />);
    expect(
      screen.getByRole('list', { name: '국외 이전 내역' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: '국외 이전 내역' }),
    ).toBeInTheDocument();
    // 바깥 링크는 새 창
    const kisa = screen.getAllByRole('link', { name: 'privacy.kisa.or.kr' })[0];
    expect(kisa).toHaveAttribute('target', '_blank');
  });
});

describe('LicensesView', () => {
  it('런타임·글꼴·소리·npm 묶음과 접힌 전문', () => {
    const { container } = render(<LicensesView />);
    expect(
      screen.getByRole('heading', { level: 1, name: '오픈소스·에셋 고지' }),
    ).toBeInTheDocument();
    for (const id of ['runtime', 'fonts', 'sounds', 'npm']) {
      expect(container.querySelector(`section#${id}`)).not.toBeNull();
    }
    const npm = container.querySelector('section#npm')!;
    expect(npm.querySelectorAll(':scope > div > details')).toHaveLength(
      LICENSE_DATA.npm.groups.length,
    );
    expect(screen.getByText('pyRoad Sans')).toBeInTheDocument();
    expect(screen.getByText('원본: Pretendard 1.3.9')).toBeInTheDocument();
    expect(container.querySelector('section#sounds')).toHaveTextContent(
      'Kenney',
    );
  });
});
