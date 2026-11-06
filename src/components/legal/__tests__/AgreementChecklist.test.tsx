// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AgreementChecklist } from '../AgreementChecklist';
import { hasRequiredAgreements, AGREEMENT_ITEMS } from '@/lib/legal/agreements';

// 동의 체크 목록 (P3-14): 진짜 체크박스·라벨, "모두 동의"와 중간 상태, 필수 안내, 보기 링크

afterEach(cleanup);

describe('AgreementChecklist (P3-14)', () => {
  it('항목마다 라벨이 붙은 체크박스와 새 창 "보기" 링크가 있다', () => {
    render(<AgreementChecklist />);
    expect(
      screen.getByRole('group', { name: '약관 동의' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: '모두 동의해요' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {
        name: /^\(필수\) ?pyRoad 이용약관에 동의해요$/,
      }),
    ).not.toBeChecked();
    const terms = screen.getByRole('link', { name: /이용약관 동의 내용/ });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(
      screen.getByRole('link', { name: /개인정보 수집·이용 동의 내용/ }),
    ).toHaveAttribute('href', '/privacy');
  });

  it('"모두 동의"를 누르면 모든 항목이 체크되고 다시 누르면 풀린다', () => {
    const onChange = vi.fn();
    render(<AgreementChecklist onChange={onChange} />);
    const all = screen.getByTestId('agreement-all');
    fireEvent.click(all);
    expect(screen.getByTestId('agreement-terms')).toBeChecked();
    expect(screen.getByTestId('agreement-privacy')).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith({ terms: true, privacy: true });
    fireEvent.click(all);
    expect(screen.getByTestId('agreement-terms')).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith({ terms: false, privacy: false });
  });

  it('하나만 체크하면 "모두 동의"가 중간 상태, 둘 다면 체크', () => {
    render(<AgreementChecklist />);
    const all = screen.getByTestId('agreement-all') as HTMLInputElement;
    fireEvent.click(screen.getByTestId('agreement-terms'));
    expect(all.indeterminate).toBe(true);
    expect(all).not.toBeChecked();
    fireEvent.click(screen.getByTestId('agreement-privacy'));
    expect(all.indeterminate).toBe(false);
    expect(all).toBeChecked();
  });

  it('제어 모드: value를 따르고 onChange로 다음 상태를 알린다', () => {
    const onChange = vi.fn();
    render(
      <AgreementChecklist
        value={{ terms: true, privacy: false }}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('agreement-terms')).toBeChecked();
    fireEvent.click(screen.getByTestId('agreement-privacy'));
    const next = onChange.mock.calls.at(-1)![0];
    expect(next).toEqual({ terms: true, privacy: true });
    expect(hasRequiredAgreements(AGREEMENT_ITEMS, next)).toBe(true);
    // 부모가 value를 바꾸지 않았으므로 화면은 그대로
    expect(screen.getByTestId('agreement-privacy')).not.toBeChecked();
  });

  it('필수 안내는 켰을 때 빠진 항목만 알린다', () => {
    const { rerender } = render(
      <AgreementChecklist value={{ terms: true, privacy: false }} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(
      <AgreementChecklist
        value={{ terms: true, privacy: false }}
        showRequiredError
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '개인정보 수집·이용 동의에 동의해야 다음으로 갈 수 있어요.',
    );
    rerender(
      <AgreementChecklist
        value={{ terms: true, privacy: true }}
        showRequiredError
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
