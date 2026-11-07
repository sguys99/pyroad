import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { COLOR } from '@/lib/design/tokens';
import { LEGAL_OPERATOR } from '@/lib/legal/meta';
import { SITE_TITLE } from '@/lib/seo/site';
import manifest from '@/app/manifest';
import * as favicon from '@/app/icon';
import * as appleIcon from '@/app/apple-icon';
import * as pwaRoute from '@/app/pwa/[file]/route';
import { findForbiddenSvg } from '@/lib/share-card/svg';
import { PwaIcon, pybaemIconSvg, MASKABLE_SAFE_RATIO } from '../iconArt';
import {
  PWA_ICON_VERSION,
  PWA_MANIFEST_ICONS,
  buildManifest,
} from '../manifest';

describe('웹 앱 매니페스트 (P4-11)', () => {
  const m = manifest();

  it('이름·언어·시작 주소·표시 방식', () => {
    expect(m).toEqual(buildManifest());
    expect(m).toMatchObject({
      id: '/',
      name: SITE_TITLE,
      short_name: 'pyRoad',
      lang: 'ko',
      start_url: '/world',
      scope: '/',
      display: 'standalone',
    });
    expect(m.categories).toContain('education');
  });

  it('색은 단색 바탕 토큰 (메타 theme-color와 같음)', () => {
    expect(m.theme_color).toBe(COLOR.bg);
    expect(m.background_color).toBe(COLOR.bg);
  });

  it('방향을 고정하지 않는다 (태블릿 가로·세로)', () => {
    expect(m).not.toHaveProperty('orientation');
  });

  it('아이콘: 192·512 일반 + 512 maskable, 버전 붙은 /pwa/ 주소', () => {
    expect(m.icons).toEqual([
      expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]);
    for (const icon of m.icons ?? []) {
      expect(icon.src).toMatch(
        new RegExp(`^/pwa/[a-z0-9-]+\\.v${PWA_ICON_VERSION}\\.png$`),
      );
      expect(icon.type).toBe('image/png');
    }
  });

  it('개인정보 없음', () => {
    const text = JSON.stringify(m);
    expect(text).not.toContain(LEGAL_OPERATOR.name);
    expect(text).not.toContain('@');
  });
});

describe('아이콘 라우트 (빌드 때 정적 생성)', () => {
  it('파비콘 32 · apple-icon 180, PNG, force-static', () => {
    expect(favicon.size).toEqual({ width: 32, height: 32 });
    expect(appleIcon.size).toEqual({ width: 180, height: 180 });
    for (const mod of [favicon, appleIcon, pwaRoute]) {
      expect(mod.dynamic).toBe('force-static');
    }
    expect(favicon.contentType).toBe('image/png');
    expect(appleIcon.contentType).toBe('image/png');
  });

  it('manifest 아이콘: 목록만 미리 만들고 나머지는 404', async () => {
    expect(pwaRoute.dynamicParams).toBe(false);
    expect(pwaRoute.generateStaticParams()).toEqual(
      Object.keys(PWA_MANIFEST_ICONS).map((file) => ({ file })),
    );
    const res = await pwaRoute.GET(new Request('http://x/pwa/nope.png'), {
      params: Promise.resolve({ file: 'nope.png' }),
    });
    expect(res.status).toBe(404);
  });

  it('manifest 아이콘을 실제로 그린다 (192 PNG)', async () => {
    const file = `icon-192.v${PWA_ICON_VERSION}.png`;
    const res = await pwaRoute.GET(new Request(`http://x/pwa/${file}`), {
      params: Promise.resolve({ file }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG 머리 + IHDR 폭·높이
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
    expect(buf.readUInt32BE(16)).toBe(192);
    expect(buf.readUInt32BE(20)).toBe(192);
  });
});

// satori 트리 펼치기
interface Host {
  type: string;
  props: Record<string, unknown>;
}
function hosts(node: ReactNode): Host[] {
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<Record<string, unknown>>;
  if (typeof el.type === 'function') {
    return hosts((el.type as (p: unknown) => ReactNode)(el.props));
  }
  const kids = ([] as ReactNode[]).concat(
    (el.props.children as ReactNode) ?? [],
  );
  return [
    { type: String(el.type), props: el.props },
    ...kids.flatMap((k) => hosts(k)),
  ];
}

describe('아이콘 그림', () => {
  it('리그 정지 그림은 resvg가 그릴 수 있다 (<text>·<image> 없음)', () => {
    expect(findForbiddenSvg(pybaemIconSvg('head'))).toBeNull();
    expect(findForbiddenSvg(pybaemIconSvg('body'))).toBeNull();
  });

  it('글자 없음 (이모지·기기 글꼴과 무관)', () => {
    for (const kind of ['favicon', 'apple', 'any', 'maskable'] as const) {
      const all = hosts(<PwaIcon kind={kind} size={512} />);
      for (const h of all) {
        const kids = ([] as unknown[]).concat(h.props.children ?? []);
        expect(kids.some((k) => typeof k === 'string')).toBe(false);
      }
    }
  });

  it('apple·maskable은 불투명 정사각형(모서리 둥글리기 없음), 파비콘·일반은 둥근 사각형', () => {
    const root = (kind: 'favicon' | 'apple' | 'any' | 'maskable') =>
      hosts(<PwaIcon kind={kind} size={512} />)[0].props.style as {
        borderRadius: number;
        backgroundColor: string;
      };
    expect(root('apple').borderRadius).toBe(0);
    expect(root('maskable').borderRadius).toBe(0);
    expect(root('favicon').borderRadius).toBeGreaterThan(0);
    expect(root('any').borderRadius).toBeGreaterThan(0);
    expect(root('apple').backgroundColor).toBe(COLOR.primary);
  });

  it('maskable: 그림(파이뱀·반짝이)이 가운데 80% 원 안에 있다', () => {
    const size = 512;
    const imgs = hosts(<PwaIcon kind="maskable" size={size} />).filter(
      (h) => h.type === 'img' && h.props.width !== size,
    );
    const r = (size * MASKABLE_SAFE_RATIO) / 2;
    for (const img of imgs) {
      const { left, top } = img.props.style as { left: number; top: number };
      const w = img.props.width as number;
      const cx = left + w / 2 - size / 2;
      const cy = top + w / 2 - size / 2;
      // 반짝이는 전체가, 파이뱀 상자는 가운데가 원 안
      expect(Math.hypot(cx, cy) + (w < size * 0.3 ? w / 2 : 0)).toBeLessThan(r);
    }
    // 파이뱀 상자 폭은 지름보다 작다
    const art = imgs.find((i) => (i.props.width as number) > size * 0.3)!;
    expect(art.props.width as number).toBeLessThan(r * 2);
  });
});
