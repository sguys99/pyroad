// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ShopScreen, type ShopApi } from '../ShopScreen';
import type { ShopStatus } from '@/lib/shop/api';
import { SHOP_ERROR_TEXT } from '@/lib/shop/shopView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));
// 라이브 리그·축하 오버레이(지연 chunk)는 그리지 않음 — 화면 규칙만
vi.mock('next/dynamic', () => ({ default: () => () => null }));

// 상점 화면 (P9-02): 칸 → 시트 → 구매 확인 → 구매, 코인 부족 안내, 오류 문구, 입기, 빈 옷장·오류 상태

afterEach(cleanup);

const base: ShopStatus = {
  coins: 500,
  golden_keys: 1,
  shields: 0,
  week_start: '2026-11-09',
  owned: [],
  bought_this_week: {},
  equipped: { skin: 'green' },
};

function fakeApi(over: Partial<ShopApi> = {}): ShopApi {
  return {
    status: vi.fn(async () => ({ ok: true as const, data: base })),
    purchase: vi.fn(async (id: string) => ({
      ok: true as const,
      data: {
        item_id: id,
        kind: 'costume' as const,
        price: 150,
        coins_balance: 350,
        golden_keys: 1,
        shields: 0,
        bought_this_week: 0,
      },
    })),
    equip: vi.fn(async (slot, itemId) => ({
      ok: true as const,
      data: {
        slot,
        item_id: itemId,
        equipped: { skin: 'green', [slot]: itemId },
      },
    })),
    ...over,
  };
}

describe('ShopScreen', () => {
  it('칸을 누르면 시트, 사기 → 확인(가격·지금·남는 코인) → 살래요 → 서버 구매·잔액·옷장', async () => {
    const api = fakeApi();
    render(<ShopScreen initial={base} api={api} />);
    expect(screen.getByTestId('hud-coin')).toHaveTextContent('코인 500개');
    fireEvent.click(
      screen.getByRole('button', { name: '파티 고깔, 보통, 150코인' }),
    );
    fireEvent.click(await screen.findByTestId('shop-buy'));
    const confirm = screen.getByTestId('shop-confirm');
    expect(confirm).toHaveTextContent('정말 살까요?');
    expect(confirm).toHaveTextContent('사고 나면 남는 코인350');
    fireEvent.click(screen.getByTestId('shop-buy-confirm'));
    expect(api.purchase).toHaveBeenCalledWith('hat_party');
    expect(await screen.findByText(/파티 고깔을 샀어요/)).toBeInTheDocument();
    expect(screen.getByTestId('hud-coin')).toHaveTextContent('코인 350개');
    expect(screen.getByRole('tab', { name: /내 옷장/ })).toHaveTextContent('1');
  });

  it('코인이 모자라면 사기 대신 모자란 만큼과 모으는 방법', async () => {
    render(<ShopScreen initial={base} api={fakeApi()} />);
    fireEvent.click(screen.getByRole('tab', { name: '펫' }));
    fireEvent.click(screen.getByRole('button', { name: /^용용이/ }));
    const short = await screen.findByTestId('shop-short');
    expect(short).toHaveTextContent('코인이 1,000개 모자라요');
    expect(
      screen.getByRole('link', { name: '코인 모으러 가기' }),
    ).toHaveAttribute('href', '/world');
    expect(screen.queryByTestId('shop-buy')).toBeNull();
  });

  it('서버가 거절하면 이유 코드의 아이용 문구', async () => {
    const api = fakeApi({
      purchase: vi.fn(async () => ({
        ok: false as const,
        status: 409,
        error: { code: 'weekly_limit_reached' as const, error: 'x' },
      })),
    });
    render(<ShopScreen initial={base} api={api} />);
    fireEvent.click(screen.getByRole('tab', { name: '소모품' }));
    fireEvent.click(screen.getByRole('button', { name: /^스트릭 방패/ }));
    fireEvent.click(await screen.findByTestId('shop-buy'));
    fireEvent.click(screen.getByTestId('shop-buy-confirm'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      SHOP_ERROR_TEXT.weekly_limit_reached,
    );
  });

  it('가진 것은 입기 → 장착 중 칸, 지금 입은 것 줄에 이름', async () => {
    const api = fakeApi();
    render(
      <ShopScreen initial={{ ...base, owned: ['glasses_round'] }} api={api} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: '동글 안경, 보통, 가지고 있어요' }),
    );
    fireEvent.click(await screen.findByTestId('shop-equip'));
    expect(api.equip).toHaveBeenCalledWith('glasses', 'glasses_round');
    // 시트가 열린 동안 뒤 화면은 낭독기에서 숨겨짐(모달) → 칸은 속성으로
    expect(await screen.findByTestId('shop-equip')).toHaveTextContent('벗기');
    expect(
      document.querySelector('[data-item="glasses_round"]'),
    ).toHaveAttribute('data-state', 'equipped');
    expect(
      screen.getByRole('list', { name: '지금 입은 것', hidden: true }),
    ).toHaveTextContent('동글 안경');
  });

  it('빈 옷장은 안내와 상점 둘러보기, 못 읽었으면 오류 상태와 다시 열기', async () => {
    render(<ShopScreen initial={base} api={fakeApi()} />);
    fireEvent.click(screen.getByRole('tab', { name: /내 옷장/ }));
    expect(screen.getByTestId('shop-closet-empty')).toHaveTextContent(
      '아직 옷장이 비어 있어요',
    );
    cleanup();
    const api = fakeApi();
    render(<ShopScreen initial={null} api={api} />);
    expect(screen.getByTestId('shop-error')).toHaveTextContent(
      '상점 문을 열지 못했어요',
    );
    fireEvent.click(screen.getByRole('button', { name: '다시 열기' }));
    expect(await screen.findByTestId('shop-grid')).toBeInTheDocument();
  });
});
