import { describe, it, expect } from 'vitest';
import type { Event } from '@sentry/nextjs';
import {
  FILTERED,
  createBeforeSend,
  createRepeatGuard,
  isAbortError,
  scrubBreadcrumb,
  scrubEvent,
  scrubSpan,
  scrubString,
  stripUrlQuery,
} from '../scrub';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

function errorEvent(overrides: Partial<Event> = {}): Event {
  return {
    exception: { values: [{ type: 'Error', value: 'boom' }] },
    ...overrides,
  };
}

describe('scrubEvent: 요청 정보', () => {
  it('요청 본문(학생 코드)·쿠키·쿼리를 버리고 헤더는 허용 목록만 남긴다', () => {
    const event = errorEvent({
      request: {
        method: 'POST',
        url: 'https://pyroad.vercel.app/api/quest/validate?token=abc',
        data: { code: 'print("내 이름은 철수")', stdout: '내 이름은 철수' },
        cookies: { 'sb-access-token': JWT },
        query_string: 'token=abc',
        headers: {
          Authorization: `Bearer ${JWT}`,
          Cookie: 'sb=1',
          'X-Forwarded-For': '1.2.3.4',
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
        },
      },
    });

    const out = scrubEvent(event);

    expect(out.request).toEqual({
      method: 'POST',
      url: 'https://pyroad.vercel.app/api/quest/validate',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.stringify(out)).not.toContain('철수');
    expect(JSON.stringify(out)).not.toContain(JWT);
  });

  it('사용자 정보와 서버 이름을 보내지 않는다', () => {
    const out = scrubEvent(
      errorEvent({
        user: {
          id: 'u1',
          email: 'kid@example.com',
          ip_address: '1.2.3.4',
          username: '철수',
        },
        server_name: 'ip-10-0-0-1',
      }),
    );
    expect(out.user).toBeUndefined();
    expect(out.server_name).toBeUndefined();
  });

  it('원본 이벤트는 바꾸지 않는다', () => {
    const event = errorEvent({ user: { id: 'u1' } });
    scrubEvent(event);
    expect(event.user).toEqual({ id: 'u1' });
  });
});

describe('scrubEvent: extra·contexts·메시지', () => {
  it('민감한 키(학생 코드, 출력, 토큰, 키)의 값을 지운다', () => {
    const out = scrubEvent(
      errorEvent({
        extra: {
          student_code: 'print(1)',
          previousCode: 'print(0)',
          code: 'x = 1',
          stdout: '1',
          stderr: 'NameError',
          customApiKey: 'sk-ant-xxxxxxxxxxxxxxxxxxxx',
          nested: {
            access_token: 'abc',
            provider_refresh_token: 'def',
            questId: '1-1',
          },
          statusCode: 500,
        },
      }),
    );
    expect(out.extra).toEqual({
      student_code: FILTERED,
      previousCode: FILTERED,
      code: FILTERED,
      stdout: FILTERED,
      stderr: FILTERED,
      customApiKey: FILTERED,
      nested: {
        access_token: FILTERED,
        provider_refresh_token: FILTERED,
        questId: '1-1',
      },
      statusCode: 500,
    });
  });

  it('예외 메시지 속 토큰·API 키·이메일을 가린다', () => {
    const out = scrubEvent(
      errorEvent({
        exception: {
          values: [
            {
              type: 'Error',
              value: `401 for kid@example.com with sk-ant-api03-abcdefghijklmnop and ${JWT}`,
            },
          ],
        },
        message: 'Bearer abc.def.ghi',
      }),
    );
    const value = out.exception!.values![0].value!;
    expect(value).not.toContain('kid@example.com');
    expect(value).not.toContain('sk-ant-api03');
    expect(value).not.toContain(JWT);
    expect(out.message).toBe(`Bearer ${FILTERED}`);
  });

  it('브레드크럼의 콘솔 로그를 버리고 URL 쿼리를 뗀다', () => {
    const out = scrubEvent(
      errorEvent({
        breadcrumbs: [
          { category: 'console', message: '학생 출력: 안녕' },
          {
            category: 'fetch',
            data: { url: '/rest/v1/users?id=eq.123', method: 'GET' },
          },
          {
            category: 'navigation',
            data: { from: '/auth/callback?code=secret', to: '/world#x' },
          },
        ],
      }),
    );
    expect(out.breadcrumbs).toEqual([
      { category: 'fetch', data: { url: '/rest/v1/users', method: 'GET' } },
      {
        category: 'navigation',
        data: { from: '/auth/callback', to: '/world' },
      },
    ]);
  });
});

describe('scrubString / stripUrlQuery', () => {
  it('URL의 인증 파라미터를 가린다', () => {
    expect(scrubString('GET /auth/callback?code=abc123&next=/world')).toBe(
      `GET /auth/callback?code=${FILTERED}&next=/world`,
    );
    expect(scrubString('https://x.supabase.co/#access_token=abc&type=x')).toBe(
      `https://x.supabase.co/#access_token=${FILTERED}&type=x`,
    );
  });

  it('쿼리와 해시를 뗀다', () => {
    expect(stripUrlQuery('/a/b?c=1#d')).toBe('/a/b');
    expect(stripUrlQuery('/a/b')).toBe('/a/b');
  });
});

describe('scrubBreadcrumb', () => {
  it('콘솔 브레드크럼은 null', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
  });
});

describe('isAbortError: 사용자 취소는 에러가 아니다', () => {
  it.each([
    [
      'DOMException AbortError',
      new DOMException('The operation was aborted.', 'AbortError'),
    ],
    [
      'Next.js ResponseAborted',
      Object.assign(new Error('aborted'), { name: 'ResponseAborted' }),
    ],
    [
      'Anthropic/OpenAI APIUserAbortError',
      Object.assign(new Error('Request was aborted.'), {
        name: 'APIUserAbortError',
      }),
    ],
    ['Node http aborted', new Error('aborted')],
  ])('%s', (_label, error) => {
    expect(isAbortError(error)).toBe(true);
  });

  it('원본 에러가 없어도 이벤트 예외 타입으로 판단한다', () => {
    expect(
      isAbortError(
        undefined,
        errorEvent({ exception: { values: [{ type: 'AbortError' }] } }),
      ),
    ).toBe(true);
  });

  it('일반 에러는 abort가 아니다', () => {
    expect(isAbortError(new Error('Request failed'))).toBe(false);
    expect(isAbortError(new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('createBeforeSend', () => {
  it('abort는 버린다', () => {
    const beforeSend = createBeforeSend();
    const abort = new DOMException('aborted', 'AbortError');
    expect(beforeSend(errorEvent(), { originalException: abort })).toBeNull();
  });

  it('일반 에러는 민감값을 지운 뒤 보낸다', () => {
    const beforeSend = createBeforeSend();
    const out = beforeSend(
      errorEvent({ user: { id: 'u1' }, extra: { code: 'print(1)' } }),
      {
        originalException: new Error('boom'),
      },
    );
    expect(out).not.toBeNull();
    expect(out!.user).toBeUndefined();
    expect(out!.extra).toEqual({ code: FILTERED });
  });

  it('같은 에러가 폭주하면 창마다 max번까지만 보낸다', () => {
    let t = 0;
    const beforeSend = createBeforeSend({
      max: 2,
      windowMs: 1000,
      now: () => t,
    });
    const results = [1, 2, 3, 4].map(() => beforeSend(errorEvent()));
    expect(results.map(Boolean)).toEqual([true, true, false, false]);

    // 다른 에러는 따로 센다
    expect(
      beforeSend(
        errorEvent({
          exception: { values: [{ type: 'TypeError', value: 'x' }] },
        }),
      ),
    ).not.toBeNull();

    // 창이 지나면 다시 보낸다
    t = 1000;
    expect(beforeSend(errorEvent())).not.toBeNull();
  });
});

describe('createRepeatGuard', () => {
  it('fingerprint가 있으면 그것으로 묶는다', () => {
    const allow = createRepeatGuard({ max: 1 });
    expect(allow(errorEvent({ fingerprint: ['pyodide-worker', 'init'] }))).toBe(
      true,
    );
    expect(
      allow(
        errorEvent({
          fingerprint: ['pyodide-worker', 'init'],
          message: 'other',
        }),
      ),
    ).toBe(false);
    expect(
      allow(errorEvent({ fingerprint: ['pyodide-worker', 'worker'] })),
    ).toBe(true);
  });

  it('기억할 종류 수 상한을 넘으면 오래된 것부터 잊는다', () => {
    const allow = createRepeatGuard({ max: 1, maxKeys: 2 });
    const ev = (m: string) => ({ message: m });
    expect(allow(ev('a'))).toBe(true);
    expect(allow(ev('b'))).toBe(true);
    expect(allow(ev('c'))).toBe(true); // a를 잊음
    expect(allow(ev('a'))).toBe(true);
    expect(allow(ev('c'))).toBe(false);
  });
});

describe('scrubSpan (beforeSendSpan)', () => {
  it('스팬 이름·URL 속성의 쿼리를 떼고 쿼리 속성·민감 키를 지운다', () => {
    const out = scrubSpan({
      name: 'GET /auth/callback?code=secret',
      attributes: {
        'http.url': 'https://x.supabase.co/rest/v1/users?id=eq.1',
        'url.query': '?id=eq.1',
        'http.request.header.authorization': `Bearer ${JWT}`,
        'http.method': 'GET',
      },
    });
    expect(out.name).toBe('GET /auth/callback');
    expect(out.attributes).toEqual({
      'http.url': 'https://x.supabase.co/rest/v1/users',
      'http.request.header.authorization': FILTERED,
      'http.method': 'GET',
    });
  });
});

describe('scrubEvent: 트랜잭션 스팬', () => {
  it('스팬 URL의 쿼리를 떼고 쿼리 속성을 지운다', () => {
    const out = scrubEvent({
      type: 'transaction',
      transaction: 'GET /api/tutor?x=1',
      spans: [
        {
          span_id: '1',
          trace_id: '2',
          start_timestamp: 0,
          status: 'ok',
          data: {
            'http.url': 'https://x.supabase.co/rest/v1/users?id=eq.1',
            'http.query': '?id=eq.1',
          },
          description: 'GET https://x.supabase.co/rest/v1/users?id=eq.1',
        },
      ],
    });
    expect(out.transaction).toBe('GET /api/tutor');
    expect(out.spans![0].data).toEqual({
      'http.url': 'https://x.supabase.co/rest/v1/users',
    });
    expect(out.spans![0].description).toBe(
      'GET https://x.supabase.co/rest/v1/users',
    );
  });
});
