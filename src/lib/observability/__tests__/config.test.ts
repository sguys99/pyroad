import { describe, it, expect } from 'vitest';
import {
  MAX_TRACES_SAMPLE_RATE,
  getSentryDsn,
  getServerTracesSampleRate,
  isSentryEnabled,
} from '../config';

describe('DSN이 없으면 Sentry는 꺼진다', () => {
  it.each([undefined, '', '   '])('DSN %j → 비활성', (dsn) => {
    expect(getSentryDsn(dsn)).toBeUndefined();
    expect(isSentryEnabled(dsn)).toBe(false);
  });

  it('DSN이 있으면 앞뒤 공백을 빼고 켠다', () => {
    expect(getSentryDsn(' https://key@o1.ingest.sentry.io/1 ')).toBe(
      'https://key@o1.ingest.sentry.io/1',
    );
    expect(isSentryEnabled('https://key@o1.ingest.sentry.io/1')).toBe(true);
  });

  it('테스트 환경(env 없음)에서는 비활성', () => {
    expect(process.env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(isSentryEnabled()).toBe(false);
  });
});

describe('getServerTracesSampleRate', () => {
  it.each([undefined, '', '0', '-1', 'abc'])('%j → 트레이싱 끔', (value) => {
    expect(getServerTracesSampleRate(value)).toBeUndefined();
  });

  it('0.05 이하는 그대로, 넘으면 상한으로 자른다 (무료 티어)', () => {
    expect(getServerTracesSampleRate('0.01')).toBe(0.01);
    expect(getServerTracesSampleRate('1')).toBe(MAX_TRACES_SAMPLE_RATE);
  });
});
