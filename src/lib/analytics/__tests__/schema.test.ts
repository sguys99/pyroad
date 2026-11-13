import { describe, it, expect } from 'vitest';
import { clientBatchSchema, parseEventProps } from '../schema';
import {
  CLIENT_EVENT_NAMES,
  SERVER_EVENT_NAMES,
  normalizePath,
} from '../events';

const SID = 'AbCdEfGhIjKlMnOpQrStUv'; // 22자 base64url
const QUEST = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

function batch(events: unknown[], extra: Record<string, unknown> = {}) {
  return { sid: SID, events, ...extra };
}

describe('clientBatchSchema — 브라우저가 보낼 수 있는 것 (P1-17)', () => {
  it('랜딩 보기·CTA 클릭을 받는다 (landing_view 속성은 비워도 됨)', () => {
    const r = clientBatchSchema.safeParse(
      batch([
        { name: 'landing_view', path: '/' },
        {
          name: 'landing_cta_click',
          props: { cta: 'hero', provider: 'google' },
        },
      ]),
    );
    expect(r.success).toBe(true);
    expect(r.data?.events[0].props).toEqual({});
  });

  it.each(SERVER_EVENT_NAMES)(
    '서버 전용 이벤트 %s 는 거부 (클라이언트가 퍼널·완료 수를 부풀리지 못하게)',
    (name) => {
      const props =
        name === 'login_success'
          ? { provider: 'google', new_user: true }
          : name === 'hint_used'
            ? { quest_id: QUEST, level: 1 }
            : name === 'onboarding_complete'
              ? { skin: 'sky', grade_given: true, returning: false }
              : { quest_id: QUEST };
      expect(
        clientBatchSchema.safeParse(batch([{ name, props }])).success,
      ).toBe(false);
    },
  );

  it.each([
    ['이메일', { cta: 'hero', provider: 'google', email: 'kid@example.com' }],
    ['이름', { cta: 'hero', provider: 'google', name: '김철수' }],
    ['사용자 id', { cta: 'hero', provider: 'google', user_id: QUEST }],
    ['학생 코드', { cta: 'hero', provider: 'google', code: 'print(1)' }],
    ['정해지지 않은 값', { cta: 'footer', provider: 'google' }],
    ['provider 자유 문자열', { cta: 'hero', provider: 'kid@example.com' }],
    ['shared 문자열', { cta: 'hero', provider: 'google', shared: 'yes' }],
  ])('속성에 %s 가 있으면 묶음 전체를 거부', (_label, props) => {
    expect(
      clientBatchSchema.safeParse(batch([{ name: 'landing_cta_click', props }]))
        .success,
    ).toBe(false);
  });

  it('landing_cta_click 공용 기기 표시 shared (P4-09): 불리언만, 없어도 됨', () => {
    for (const props of [
      { cta: 'hero', provider: 'kakao', shared: true },
      { cta: 'header', provider: 'naver', shared: false },
      { cta: 'trial', provider: 'google' },
    ]) {
      expect(
        clientBatchSchema.safeParse(
          batch([{ name: 'landing_cta_click', props }]),
        ).success,
      ).toBe(true);
    }
  });

  it('landing_view 에 아무 속성도 붙일 수 없다', () => {
    expect(
      clientBatchSchema.safeParse(
        batch([{ name: 'landing_view', props: { email: 'a@b.c' } }]),
      ).success,
    ).toBe(false);
  });

  it.each([
    ['이벤트 밖 키 (ip)', batch([{ name: 'landing_view' }], { ip: '1.2.3.4' })],
    ['이벤트 안 키 (ua)', batch([{ name: 'landing_view', ua: 'Mozilla' }])],
    [
      'sid 형식',
      { sid: 'kid@example.com', events: [{ name: 'landing_view' }] },
    ],
    ['sid 길이', { sid: `${SID}x`, events: [{ name: 'landing_view' }] }],
    ['빈 묶음', batch([])],
    [
      '11건',
      batch(Array.from({ length: 11 }, () => ({ name: 'landing_view' }))),
    ],
    ['모르는 이름', batch([{ name: 'page_view' }])],
    ['긴 경로', batch([{ name: 'landing_view', path: `/${'a'.repeat(200)}` }])],
  ])('%s → 거부', (_label, body) => {
    expect(clientBatchSchema.safeParse(body).success).toBe(false);
  });

  it('연출 단계 변경(P2-15)을 받고, 정해진 값 밖이면 거부', () => {
    const ok = {
      from: 'full',
      to: 'lite',
      cause: 'measured',
      setting: 'auto',
      reduced: 'system',
      elapsed_s: 4,
    };
    expect(
      clientBatchSchema.safeParse(
        batch([{ name: 'motion_tier_change', props: ok, path: '/world' }]),
      ).success,
    ).toBe(true);
    for (const bad of [
      { ...ok, to: 'ultra' },
      { ...ok, cause: 'static' },
      { ...ok, elapsed_s: 1.5 },
      { ...ok, elapsed_s: 90_000 },
      { ...ok, fps: 24 },
      { ...ok, device: 'iPad' },
    ]) {
      expect(
        clientBatchSchema.safeParse(
          batch([{ name: 'motion_tier_change', props: bad }]),
        ).success,
      ).toBe(false);
    }
  });

  it('홈 화면에 추가 안내(P4-11)를 받고, 정해진 값 밖이면 거부', () => {
    const ok = { via: 'world', platform: 'ios', result: 'guide' };
    expect(
      clientBatchSchema.safeParse(
        batch([
          { name: 'pwa_install_prompt', props: ok, path: '/world' },
          { name: 'pwa_installed', props: {} },
        ]),
      ).success,
    ).toBe(true);
    for (const bad of [
      { ...ok, via: 'landing' },
      { ...ok, platform: 'desktop' },
      { ...ok, result: 'maybe' },
      { ...ok, ua: 'iPhone' },
    ]) {
      expect(
        clientBatchSchema.safeParse(
          batch([{ name: 'pwa_install_prompt', props: bad }]),
        ).success,
      ).toBe(false);
    }
    expect(
      clientBatchSchema.safeParse(
        batch([{ name: 'pwa_installed', props: { standalone: true } }]),
      ).success,
    ).toBe(false);
  });

  it('이어하기 CTA(P5-10): 종류·자리만, 퀘스트 id 등 다른 값은 거부', () => {
    const ok = { kind: 'recent', place: 'float' };
    const parse = (props: unknown) =>
      clientBatchSchema.safeParse(
        batch([{ name: 'continue_click', props, path: '/world' }]),
      ).success;
    expect(parse(ok)).toBe(true);
    expect(parse({ ...ok, kind: 'later' })).toBe(false);
    expect(parse({ ...ok, place: 'hud' })).toBe(false);
    expect(parse({ ...ok, quest_id: 'q1' })).toBe(false);
  });

  it('퀴즈 직접 실행(P7-07): 종류·바꿨는지만, 코드는 거부', () => {
    const ok = { kind: 'parsons', edited: true };
    const parse = (props: unknown) =>
      clientBatchSchema.safeParse(
        batch([{ name: 'quiz_try_run', props, path: '/quest/x' }]),
      ).success;
    expect(parse(ok)).toBe(true);
    expect(parse({ ...ok, kind: 'boss' })).toBe(false);
    expect(parse({ ...ok, code: 'print(1)' })).toBe(false);
  });

  it('폰 퀴즈 추천(P7-11): 자리·동작만, 퀘스트 id는 거부', () => {
    const ok = { place: 'world', action: 'show' };
    const parse = (props: unknown) =>
      clientBatchSchema.safeParse(
        batch([{ name: 'phone_quiz_pick', props, path: '/world' }]),
      ).success;
    expect(parse(ok)).toBe(true);
    expect(parse({ ...ok, place: 'sheet' })).toBe(false);
    expect(parse({ ...ok, quest_id: 'q1' })).toBe(false);
  });

  it('오늘의 퀴즈(P7-10): 수만, 범위 밖·퀘스트 id는 거부', () => {
    const parse = (name: string, props: unknown) =>
      clientBatchSchema.safeParse(batch([{ name, props, path: '/daily' }]))
        .success;
    expect(parse('daily_quiz_open', { total: 3, done: 1 })).toBe(true);
    expect(parse('daily_quiz_open', { total: 4, done: 0 })).toBe(false);
    expect(parse('daily_quiz_finish', { correct: 2, stars: 5 })).toBe(true);
    expect(
      parse('daily_quiz_finish', { correct: 2, stars: 5, quest_id: 'q' }),
    ).toBe(false);
  });

  it('휴식 알림(P8-12): 정해 둔 값만', () => {
    const parse = (name: string, props: unknown) =>
      clientBatchSchema.safeParse(batch([{ name, props, path: '/world' }]))
        .success;
    expect(parse('rest_reminder_shown', { snoozed: false })).toBe(true);
    expect(parse('rest_reminder_choice', { choice: 'rest' })).toBe(true);
    expect(parse('rest_reminder_choice', { choice: 'later' })).toBe(false);
    expect(parse('rest_reminder_shown', { snoozed: true, minutes: 40 })).toBe(
      false,
    );
  });

  it('공유 페이지(P9-08): 카드 종류만, 카드 id·닉네임은 거부', () => {
    const parse = (name: string, props: unknown) =>
      clientBatchSchema.safeParse(
        batch([{ name, props, path: '/share/AAAAAAAAAAAAAAAAAAAAAA' }]),
      ).success;
    expect(parse('share_view', { kind: 'levelup' })).toBe(true);
    expect(parse('share_view', { kind: 'gone' })).toBe(true);
    expect(parse('share_cta_click', { kind: 'weekly' })).toBe(true);
    expect(parse('share_view', { kind: 'secret' })).toBe(false);
    expect(parse('share_view', { kind: 'stage', card_id: 'x' })).toBe(false);
    expect(parse('share_cta_click', { kind: 'stage', nickname: 'a' })).toBe(
      false,
    );
  });

  it('이벤트 목록이 events.ts 의 클라이언트 이름과 같다', () => {
    expect([...CLIENT_EVENT_NAMES].sort()).toEqual([
      'continue_click',
      'daily_quiz_finish',
      'daily_quiz_open',
      'landing_cta_click',
      'landing_view',
      'motion_tier_change',
      'phone_quiz_pick',
      'pwa_install_prompt',
      'pwa_installed',
      'quiz_try_run',
      'rest_reminder_choice',
      'rest_reminder_shown',
      'share_cta_click',
      'share_view',
      'trial_run',
      'trial_start',
      'trial_success',
    ]);
  });

  it('30초 체험 이벤트 (P4-03): 결과 종류·횟수만, 코드·출력은 거부', () => {
    const ok = (events: unknown[]) =>
      clientBatchSchema.safeParse(batch(events)).success;
    expect(
      ok([
        { name: 'trial_start' },
        { name: 'trial_run', props: { result: 'ok' } },
        { name: 'trial_run', props: { result: 'unterminated_string' } },
        { name: 'trial_run', props: { result: 'no_print' } },
        { name: 'trial_success', props: { runs: 1 } },
        {
          name: 'landing_cta_click',
          props: { cta: 'trial', provider: 'kakao' },
        },
      ]),
    ).toBe(true);
    expect(ok([{ name: 'trial_run', props: { result: 'what' } }])).toBe(false);
    expect(
      ok([{ name: 'trial_run', props: { result: 'ok', code: 'print(1)' } }]),
    ).toBe(false);
    expect(ok([{ name: 'trial_run', props: { result: 'ok', out: '1' } }])).toBe(
      false,
    );
    expect(ok([{ name: 'trial_success', props: { runs: 0 } }])).toBe(false);
    expect(ok([{ name: 'trial_success', props: { runs: 1.5 } }])).toBe(false);
    expect(ok([{ name: 'trial_start', props: { x: 1 } }])).toBe(false);
  });
});

describe('parseEventProps — 서버 이벤트 속성', () => {
  it('정상 값', () => {
    expect(
      parseEventProps('quest_complete', {
        quest_id: QUEST,
        hints_used: 2,
        used_golden_key: false,
        level_up: true,
        stage_cleared: false,
      }),
    ).not.toBeNull();
    expect(
      parseEventProps('hint_used', { quest_id: QUEST, level: 3 }),
    ).not.toBeNull();
    expect(
      parseEventProps('onboarding_complete', {
        skin: 'berry',
        grade_given: false,
        returning: true,
      }),
    ).not.toBeNull();
  });

  it.each([
    ['quest_start', { quest_id: 'not-a-uuid' }],
    ['quest_start', { quest_id: QUEST, email: 'a@b.c' }],
    ['hint_used', { quest_id: QUEST, level: 4 }],
    ['login_success', { provider: 'google', new_user: true, nickname: '철수' }],
    // 온보딩: 닉네임·학년 값은 보내지 않음 (P3-11), 스킨은 6종 id 만
    [
      'onboarding_complete',
      {
        skin: 'sky',
        grade_given: true,
        returning: false,
        nickname: '용감한여우',
      },
    ],
    [
      'onboarding_complete',
      { skin: 'sky', grade_given: true, returning: false, grade: 3 },
    ],
    [
      'onboarding_complete',
      { skin: 'gold', grade_given: false, returning: false },
    ],
    ['onboarding_complete', { skin: 'sky', grade_given: false }],
    [
      'quest_complete',
      {
        quest_id: QUEST,
        hints_used: -1,
        used_golden_key: false,
        level_up: false,
        stage_cleared: false,
      },
    ],
  ] as const)('%s %j → null', (name, props) => {
    expect(parseEventProps(name, props)).toBeNull();
  });
});

describe('normalizePath — 쿼리·id 를 남기지 않음', () => {
  it.each([
    ['/', '/'],
    ['/?error=auth', '/'],
    ['/auth/callback?code=secret#x', '/auth/callback'],
    [`/quest/${QUEST}`, '/quest/[id]'],
    [`/quest/${QUEST.toUpperCase()}/`, '/quest/[id]'],
    ['/quest/[id]', '/quest/[id]'],
    ['/board/kid@example.com', '/board/[x]'],
    ['/notice/%EA%B3%B5%EC%A7%80', '/notice/[x]'],
    [`/a/${'b'.repeat(41)}`, '/a/[x]'],
    ['/share/Ab3_-Ab3_-Ab3_-Ab3_-Ab', '/share/[id]'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  it('상대 경로·빈 값은 null', () => {
    expect(normalizePath('quest')).toBeNull();
    expect(normalizePath(undefined)).toBeNull();
    expect(normalizePath('https://evil.com/')).toBeNull();
  });

  it('100자로 자름 (DB CHECK)', () => {
    const p = normalizePath(
      `/${Array.from({ length: 30 }, () => 'abcde').join('/')}`,
    );
    expect(p!.length).toBeLessThanOrEqual(100);
  });
});
