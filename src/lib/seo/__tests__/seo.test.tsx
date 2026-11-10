import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { COLOR } from '@/lib/design/tokens';
import { LEGAL_OPERATOR } from '@/lib/legal/meta';
import { STATIC_PAGE_PATHS } from '@/lib/security/csp';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { StructuredData } from '@/components/landing/StructuredData';
import { publicPageMetadata, rootMetadata, rootViewport } from '../metadata';
import {
  DEFAULT_SITE_URL,
  NOINDEX_PATHS,
  OG_IMAGE_ALT,
  PUBLIC_PATHS,
  SITE_DESCRIPTION,
  SITE_TITLE,
  absoluteUrl,
  resolveSiteUrl,
} from '../site';
import { buildStructuredData, serializeJsonLd } from '../structuredData';

/** 운영자 실명·이메일, 그리고 이메일 모양 글자가 없어야 한다 (§2.6, §12-Q37: 운영자 정보는 약관·처리방침 화면에만) */
function expectNoPersonalInfo(value: unknown) {
  const text = JSON.stringify(value);
  expect(text).not.toContain(LEGAL_OPERATOR.name);
  expect(text).not.toContain(LEGAL_OPERATOR.email);
  expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
}

afterEach(() => vi.unstubAllEnvs());

describe('사이트 주소 (NEXT_PUBLIC_SITE_URL)', () => {
  it('없거나 비면 운영 주소', () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl('  ')).toBe(DEFAULT_SITE_URL);
    expect(DEFAULT_SITE_URL).toBe(LEGAL_OPERATOR.serviceUrl);
  });

  it('출처만 쓴다 (끝 슬래시·경로·쿼리 버림)', () => {
    expect(resolveSiteUrl('https://example.com/')).toBe('https://example.com');
    expect(resolveSiteUrl(' https://example.com/a/b?x=1 ')).toBe(
      'https://example.com',
    );
    expect(resolveSiteUrl('http://localhost:3300')).toBe(
      'http://localhost:3300',
    );
  });

  it('잘못된 값·http(s)가 아닌 값은 운영 주소 (빌드를 멈추지 않음)', () => {
    expect(resolveSiteUrl('pyroad')).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl('javascript:alert(1)')).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl('ftp://example.com')).toBe(DEFAULT_SITE_URL);
  });

  it('env를 읽는다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.example.com');
    expect(resolveSiteUrl()).toBe('https://preview.example.com');
  });

  it('절대 주소: 홈은 출처만, 나머지는 경로를 붙인다', () => {
    expect(absoluteUrl('/', 'https://a.com')).toBe('https://a.com');
    expect(absoluteUrl('/terms', 'https://a.com')).toBe('https://a.com/terms');
    expect(absoluteUrl('terms', 'https://a.com')).toBe('https://a.com/terms');
  });
});

describe('루트 메타데이터 (P4-10)', () => {
  const meta = rootMetadata('https://pyroad.vercel.app');

  it('제목 틀·설명·이름·키워드', () => {
    expect(meta.title).toEqual({
      default: SITE_TITLE,
      template: '%s - pyRoad',
    });
    expect(meta.description).toBe(SITE_DESCRIPTION);
    expect(meta.applicationName).toBe('pyRoad');
    expect(meta.keywords).toContain('파이썬');
    expect(meta.metadataBase?.href).toBe('https://pyroad.vercel.app/');
  });

  it('설명은 쉬운 말 한두 문장, 검색 결과에 잘리지 않을 길이', () => {
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(90);
    expect(SITE_DESCRIPTION).toContain('초등학생');
    expect(SITE_DESCRIPTION).toContain('무료');
  });

  it('canonical·og:url은 페이지 자기 주소 (./)', () => {
    expect(meta.alternates?.canonical).toBe('./');
    expect(meta.openGraph).toMatchObject({
      type: 'website',
      locale: 'ko_KR',
      siteName: 'pyRoad',
      url: './',
    });
  });

  it('공유 그림은 파일 규칙(opengraph-image)에 맡긴다: images를 적지 않음 (옛 /og-image.png 참조 없음)', () => {
    expect(meta.openGraph).not.toHaveProperty('images');
    expect(meta.twitter).not.toHaveProperty('images');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(JSON.stringify(meta)).not.toContain('og-image.png');
  });

  it('루트는 robots를 적지 않는다 (404의 noindex와 겹치지 않게)', () => {
    expect(meta).not.toHaveProperty('robots');
  });

  it('테마 색 = 단색 바탕 토큰', () => {
    expect(rootViewport.themeColor).toBe(COLOR.bg);
  });

  it('공개 하위 페이지: 제목은 틀로, 공유 제목·설명은 그 페이지 것', () => {
    const m = publicPageMetadata({ title: '이용약관', description: '약관' });
    expect(m.title).toBe('이용약관');
    expect(m.openGraph).toMatchObject({
      title: '이용약관 - pyRoad',
      description: '약관',
      url: './',
    });
    expect(m.openGraph).not.toHaveProperty('images');
    expect(m.twitter).toMatchObject({ title: '이용약관 - pyRoad' });
  });

  it('개인정보 없음', () => {
    expectNoPersonalInfo(meta);
    expectNoPersonalInfo(OG_IMAGE_ALT);
  });
});

describe('robots.txt · sitemap.xml', () => {
  it('robots: 공개는 허용, 로그인 화면·API·개발 전용·인증·관리 화면은 막음', () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.userAgent).toBe('*');
    expect(rule.allow).toBe('/');
    const disallow = [rule.disallow].flat();
    for (const p of [
      '/world',
      '/daily',
      '/quest',
      '/profile',
      '/board',
      '/settings',
      '/onboarding',
      '/dev/',
      '/api/',
      '/auth/',
      '/notice/create',
    ]) {
      expect(disallow).toContain(p);
    }
    // 공개 페이지를 막는 규칙이 없다 (Disallow는 접두사 일치)
    for (const p of PUBLIC_PATHS) {
      const blocked = disallow.some(
        (d) => d && !d.includes('*') && p.startsWith(d) && d !== '/',
      );
      expect(blocked, p).toBe(false);
    }
    expect(r.sitemap).toBe(`${DEFAULT_SITE_URL}/sitemap.xml`);
  });

  it('sitemap: 공개 페이지 5개만, 절대 주소', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual([
      DEFAULT_SITE_URL,
      `${DEFAULT_SITE_URL}/notice`,
      `${DEFAULT_SITE_URL}/terms`,
      `${DEFAULT_SITE_URL}/privacy`,
      `${DEFAULT_SITE_URL}/licenses`,
    ]);
    for (const p of NOINDEX_PATHS) {
      const prefix = p.replace(/\*.*$/, '');
      expect(
        urls.some((u) => u.includes(prefix)),
        p,
      ).toBe(false);
    }
  });

  it('sitemap: 정적 공개 페이지(CSP 정적 목록)를 모두 담는다', () => {
    for (const p of STATIC_PAGE_PATHS) {
      expect(PUBLIC_PATHS as readonly string[]).toContain(p);
    }
  });

  it('sitemap: 날짜는 시행일이 있는 약관·처리방침만 (빌드 시각을 쓰지 않음)', () => {
    const dated = sitemap().filter((e) => e.lastModified);
    expect(dated.map((e) => e.url)).toEqual([
      `${DEFAULT_SITE_URL}/terms`,
      `${DEFAULT_SITE_URL}/privacy`,
    ]);
  });

  it('env 주소를 따른다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://pyroad.example');
    expect(sitemap()[0].url).toBe('https://pyroad.example');
    expect(robots().sitemap).toBe('https://pyroad.example/sitemap.xml');
  });
});

describe('구조화 데이터 (JSON-LD)', () => {
  const data = buildStructuredData('https://pyroad.vercel.app');
  const graph = data['@graph'] as Record<string, unknown>[];
  const byType = (t: string) => graph.find((n) => n['@type'] === t)!;

  it('WebSite + WebApplication (회사·학교 유형 없음)', () => {
    expect(data['@context']).toBe('https://schema.org');
    expect(graph.map((n) => n['@type'])).toEqual(['WebSite', 'WebApplication']);
    expect(JSON.stringify(data)).not.toMatch(/Organization|Person/);
    expect(byType('WebSite')).toMatchObject({
      url: 'https://pyroad.vercel.app',
      name: 'pyRoad',
      inLanguage: 'ko-KR',
    });
    expect(byType('WebApplication').isPartOf).toEqual({
      '@id': byType('WebSite')['@id'],
    });
  });

  it('무료·대상(초등학생)·교육 앱', () => {
    const app = byType('WebApplication');
    expect(app.isAccessibleForFree).toBe(true);
    expect(app.offers).toEqual({
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KRW',
    });
    expect(app.applicationCategory).toBe('EducationalApplication');
    expect(app.audience).toMatchObject({
      '@type': 'EducationalAudience',
      audienceType: '초등학생',
    });
    expect(app.typicalAgeRange).toBe('7-12');
    expect(app.image).toMatchObject({
      url: 'https://pyroad.vercel.app/opengraph-image',
      width: 1200,
      height: 630,
    });
  });

  it('운영자 실명·이메일 없음', () => {
    expectNoPersonalInfo(data);
  });

  it('직렬화: <·>·&·줄 구분 문자를 이스케이프하고 그대로 되읽힌다', () => {
    const tricky = { a: '</script><b>&\u2028\u2029' };
    const s = serializeJsonLd(tricky);
    expect(s).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(s)).toEqual(tricky);
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('컴포넌트: 실행되지 않는 데이터 블록 하나 (nonce 없음 → 정적 랜딩·nonce 페이지 모두 CSP와 무관)', () => {
    const html = renderToStaticMarkup(<StructuredData />);
    expect(html).toMatch(/^<script type="application\/ld\+json">/);
    expect(html).not.toContain('nonce');
    expect(html).not.toContain(' src=');
    const json = html
      .replace(/^<script type="application\/ld\+json">/, '')
      .replace(/<\/script>$/, '');
    expect(JSON.parse(json)).toEqual(buildStructuredData(DEFAULT_SITE_URL));
  });
});
