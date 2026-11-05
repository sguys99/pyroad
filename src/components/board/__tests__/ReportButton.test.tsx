// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LazyMotion, domAnimation } from 'framer-motion';

let reduceMotion = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reduceMotion };
});

import { ReportButton } from '../ReportButton';
import { BoardFormMessage } from '../BoardFormMessage';

const POST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fetchMock = vi.fn();

function renderButton() {
  return render(
    <LazyMotion features={domAnimation}>
      <ReportButton targetType="post" targetId={POST_ID} />
    </LazyMotion>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  reduceMotion = false;
});

describe('ReportButton (P1-18)', () => {
  it('사유를 고르지 않으면 보내지 않고, 고르면 신고 → 고마워요 안내', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          status: 'reported',
          message: '알려 줘서 고마워요! 어른이 살펴볼게요.',
        }),
        {
          status: 200,
        },
      ),
    );
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: '이 글 신고하기' }));
    expect(await screen.findByText('이 글을 신고할까요?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      '신고하는 까닭을 골라 주세요.',
    );
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: /개인정보/ }));
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    expect(
      await screen.findByText('알려 줘서 고마워요! 어른이 살펴볼게요.'),
    ).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target_type: 'post',
      target_id: POST_ID,
      reason: 'personal_info',
    });

    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '이 글은 신고했어요' }),
      ).toHaveTextContent('신고함'),
    );
  });

  it('서버 안내 문구를 그대로 보여 주고 다시 시도할 수 있음 (reduced-motion)', async () => {
    reduceMotion = true;
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: '내가 쓴 글은 신고할 수 없어요.' }),
        { status: 400 },
      ),
    );
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: '이 글 신고하기' }));
    fireEvent.click(await screen.findByRole('radio', { name: /욕설/ }));
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '내가 쓴 글은 신고할 수 없어요.',
    );
    expect(screen.getByRole('button', { name: '신고하기' })).toBeEnabled();
  });
});

describe('BoardFormMessage', () => {
  it('금칙어 안내는 부드러운 안내, 그 밖은 오류', () => {
    render(
      <BoardFormMessage
        error={{ message: '다른 말로 바꿔 볼까요?', code: 'moderation' }}
      />,
    );
    expect(screen.getByRole('alert').className).toContain('bg-accent');
    cleanup();
    render(<BoardFormMessage error={{ message: '앗' }} />);
    expect(screen.getByRole('alert').className).toContain('text-destructive');
  });
});
