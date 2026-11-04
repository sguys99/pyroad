/**
 * satori/resvg 호환성 실험 시트. 타일마다 기능 하나를 그려 보고 PNG로 눈으로 확인합니다.
 *   /api/og-lab/svg       : <img src="data:image/svg+xml"> 안의 SVG 기능 (resvg가 직접 렌더)
 *   /api/og-lab/inline    : satori 인라인 <svg> JSX와 기존 컴포넌트를 그대로 넣었을 때
 *   /api/og-lab/css       : satori CSS 기능
 *   /api/og-lab/fallback  : 서브셋 밖 글자(햏·뷁·똠·됬) 처리 3가지
 *   /api/og-lab/emoji     : 이모지 (Twemoji/Noto/Fluent, 런타임 CDN 로드)
 */
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { PybaemSvg } from '@/vendor/characters/PybaemSvg';
import { ByeolttongiSvg } from '@/vendor/characters/ByeolttongiSvg';
import { characterImg } from '@/lib/characters';
import { svgDataUri } from '@/lib/svg';
import { loadFonts } from '@/lib/fonts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const S = (body: string, defs = '') =>
  svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="160" height="110" viewBox="0 0 160 110">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`);

const SVG_CASES: [string, string][] = [
  ['linearGradient', S('<rect x="10" y="10" width="140" height="90" rx="16" fill="url(#g)"/>', '<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#FF7A70"/><stop offset="1" stop-color="#FFD23F"/></linearGradient>')],
  ['radialGradient', S('<circle cx="80" cy="55" r="45" fill="url(#r)"/>', '<radialGradient id="r" cx="0.35" cy="0.3"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#5ED69A"/></radialGradient>')],
  ['pattern', S('<rect x="10" y="10" width="140" height="90" fill="url(#p)"/>', '<pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="4" fill="#7C8CF0"/></pattern>')],
  ['clipPath', S('<rect x="0" y="0" width="160" height="110" fill="#FF9FD0" clip-path="url(#c)"/>', '<clipPath id="c"><circle cx="80" cy="55" r="40"/></clipPath>')],
  ['mask', S('<rect x="10" y="10" width="140" height="90" fill="#2FA9D6" mask="url(#m)"/>', '<mask id="m"><rect width="160" height="110" fill="url(#mg)"/></mask><linearGradient id="mg"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>')],
  ['feGaussianBlur', S('<circle cx="80" cy="55" r="32" fill="#8EC5E8" filter="url(#b)"/>', '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>')],
  ['feDropShadow', S('<rect x="35" y="25" width="90" height="60" rx="14" fill="#FFE36E" filter="url(#d)"/>', '<filter id="d"><feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#000" flood-opacity="0.35"/></filter>')],
  ['feTurbulence', S('<rect width="160" height="110" fill="#FBF3E2"/><rect width="160" height="110" filter="url(#t)" opacity="0.5"/>', '<filter id="t" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter>')],
  ['feDisplacementMap', S('<circle cx="80" cy="55" r="38" fill="none" stroke="#C8553D" stroke-width="6" filter="url(#x)"/>', '<filter id="x"><feTurbulence baseFrequency="0.06" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="8"/></filter>')],
  ['<text> (SVG 안 글자)', S('<text x="12" y="70" font-size="40" fill="#22324F" font-family="sans-serif">Zz 가</text>')],
  ['<use href>', S('<use href="#s" x="0"/><use href="#s" x="50"/><use href="#s" x="100"/>', '<circle id="s" cx="30" cy="55" r="18" fill="#FF7A70"/>')],
  ['<animate> (첫 프레임)', S('<circle cx="80" cy="55" r="30" fill="#5ED69A"><animate attributeName="r" values="30;10;30" dur="1s" repeatCount="indefinite"/></circle>')],
  ['stroke-dasharray', S('<path d="M15 80 Q80 0 145 80" stroke="#7A5C3E" stroke-width="5" stroke-dasharray="10 8" stroke-linecap="round" fill="none"/>')],
  ['mix-blend-mode', S('<circle cx="60" cy="55" r="35" fill="#FF7A70"/><circle cx="100" cy="55" r="35" fill="#2FA9D6" style="mix-blend-mode:multiply"/>')],
  ['<foreignObject>', S('<foreignObject x="10" y="10" width="140" height="90"><div xmlns="http://www.w3.org/1999/xhtml" style="background:#FFE36E;width:140px;height:90px">HTML</div></foreignObject><rect x="10" y="10" width="140" height="90" fill="none" stroke="#999"/>')],
  ['중첩 <image> PNG', S('<image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGElEQVR4nGP4X1UQd20DhGSAs4AkA04ZABjZHmki9OvdAAAAAElFTkSuQmCC" x="30" y="10" width="100" height="90" preserveAspectRatio="none" style="image-rendering:pixelated"/>')],
];

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ width: 280, height: 132, margin: 6, padding: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFFFFF', borderRadius: 14, border: '2px solid #E2E8F0' }}>
      <div style={{ display: 'flex', fontSize: 17, color: '#334155', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 98 }}>{children}</div>
    </div>
  );
}

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: '#F1F5F9', padding: '8px 12px', fontFamily: 'Pretendard, Fallback' }}>
      <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 6px 0' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

// KS X 1001(EUC-KR 2바이트)로 인코딩되지 않는 한글 음절을 '빠진 글자'로 표시
const ksDecoder = (() => {
  const set = new Set<number>();
  const dec = new TextDecoder('euc-kr');
  for (let hi = 0xb0; hi <= 0xc8; hi++) for (let lo = 0xa1; lo <= 0xfe; lo++) {
    const ch = dec.decode(new Uint8Array([hi, lo]));
    if (ch.length === 1) set.add(ch.codePointAt(0)!);
  }
  return set;
})();
function splitRuns(t: string): { text: string; missing: boolean }[] {
  const out: { text: string; missing: boolean }[] = [];
  for (const ch of Array.from(t)) {
    const c = ch.codePointAt(0)!;
    const missing = c >= 0xac00 && c <= 0xd7a3 && !ksDecoder.has(c);
    const last = out[out.length - 1];
    if (last && last.missing === missing) last.text += ch;
    else out.push({ text: ch, missing });
  }
  return out;
}

const unwrap = <P,>(m: unknown) => (m as { type: (p: P) => ReactNode }).type;

export async function GET(req: Request, { params }: { params: Promise<{ case: string }> }) {
  const { case: c } = await params;
  const q = new URL(req.url).searchParams;
  let el: ReactNode;
  let families: Parameters<typeof loadFonts>[0] = ['Pretendard'];
  let fallback = true;
  let emoji: 'twemoji' | 'noto' | 'fluent' | 'openmoji' | undefined;
  const restoreFetch = globalThis.fetch;

  if (c === 'svg') {
    el = (
      <Sheet title="SVG 기능 (data URI <img> → resvg 직접 렌더)">
        {SVG_CASES.map(([label, src]) => (
          <Tile key={label} label={label}><img src={src} width={140} height={96} /></Tile>
        ))}
      </Sheet>
    );
  } else if (c === 'inline') {
    const mode = q.get('mode') ?? 'all';
    const tiles: ReactNode[] = [];
    if (mode === 'all' || mode === 'datauri') {
      tiles.push(<Tile key="a" label="직렬화→img sleeping (Zzz=<text>)"><img src={characterImg({ character: 'pybaem', expression: 'sleeping', size: 100 })} width={100} height={100} /></Tile>);
      tiles.push(<Tile key="b" label="직렬화→img confused (?=<text>)"><img src={characterImg({ character: 'pybaem', expression: 'confused', size: 100 })} width={100} height={100} /></Tile>);
      tiles.push(<Tile key="c" label="직렬화 + 레이어 합성"><img src={characterImg({ character: 'pybaem', expression: 'happy', size: 100, costumes: ['explorer-hat', 'scarf'] })} width={100} height={100} /></Tile>);
    }
    if (mode === 'all' || mode === 'unwrapped') {
      // memo를 벗긴 내부 함수를 호출해 순수 <svg> 엘리먼트 트리를 satori에 그대로 넘김
      tiles.push(<Tile key="d" label="인라인 JSX (memo 벗김) happy">{unwrap<object>(PybaemSvg)({ expression: 'happy', size: 100 })}</Tile>);
      tiles.push(<Tile key="e" label="인라인 JSX (memo 벗김) sleeping">{unwrap<object>(PybaemSvg)({ expression: 'sleeping', size: 100 })}</Tile>);
      tiles.push(<Tile key="h" label="직렬화→img 버그버그·별똥이"><img src={characterImg({ character: 'bugbug', expression: 'searching', size: 96 })} width={96} height={96} /><img src={characterImg({ character: 'byeolttongi', expression: 'flying', size: 96 })} width={96} height={96} /></Tile>);
      tiles.push(<Tile key="f" label="인라인 JSX 별똥이 x2 (id 충돌)">{unwrap<object>(ByeolttongiSvg)({ size: 90 })}{unwrap<object>(ByeolttongiSvg)({ size: 90, expression: 'flying' })}</Tile>);
    }
    if (mode === 'all' || mode === 'memo') {
      tiles.push(<Tile key="g" label="인라인 <PybaemSvg/> (memo)"><PybaemSvg expression="happy" size={100} /></Tile>);
    }
    el = <Sheet title={`캐릭터 합성 방식 비교 (mode=${mode})`}>{tiles}</Sheet>;
  } else if (c === 'css') {
    const box = { width: 150, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16 } as const;
    el = (
      <Sheet title="satori CSS 기능">
        <Tile label="box-shadow 2겹 (클레이)"><div style={{ ...box, background: '#FF8F80', boxShadow: '0 8px 0 #D9534F, 0 16px 20px rgba(0,0,0,0.2)' }} /></Tile>
        <Tile label="inset box-shadow"><div style={{ ...box, background: '#BDE6F5', boxShadow: 'inset 0 -10px 0 rgba(0,0,0,0.15), inset 0 8px 12px rgba(255,255,255,0.8)' }} /></Tile>
        <Tile label="text-shadow + stroke"><div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: '#fff', WebkitTextStroke: '6px #22324F', textShadow: '0 6px 0 #22324F' }}>Lv.12</div></Tile>
        <Tile label="linear + radial 배경"><div style={{ ...box, backgroundImage: 'radial-gradient(circle at 30% 30%, #ffffff 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg, #7BE3B5, #3FC48C)' }} /></Tile>
        <Tile label="repeating-linear-gradient"><div style={{ ...box, backgroundImage: 'repeating-linear-gradient(45deg, #FFE36E 0px, #FFE36E 10px, #FFF6C2 10px, #FFF6C2 20px)' }} /></Tile>
        <Tile label="dashed border + rotate"><div style={{ ...box, border: '3px dashed #7A5C3E', transform: 'rotate(-6deg)', background: '#FFFDF6' }} /></Tile>
        <Tile label="backgroundClip: text"><div style={{ display: 'flex', fontSize: 52, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #FF7A70, #7C8CF0)', backgroundClip: 'text', color: 'transparent' }}>무지개</div></Tile>
        <Tile label="filter: blur (div)"><div style={{ ...box, background: '#8EC5E8', filter: 'blur(6px)' }} /></Tile>
        <Tile label="opacity + mixBlendMode"><div style={{ display: 'flex' }}><div style={{ width: 70, height: 70, borderRadius: 99, background: '#FF7A70' }} /><div style={{ width: 70, height: 70, borderRadius: 99, background: '#2FA9D6', marginLeft: -30, opacity: 0.8, mixBlendMode: 'multiply' }} /></div></Tile>
        <Tile label="textOverflow: ellipsis"><div style={{ display: 'block', width: 220, fontSize: 26, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>엄청나게긴닉네임을가진모험가</div></Tile>
        <Tile label="lineClamp 2"><div style={{ display: 'block', width: 220, fontSize: 22, lineClamp: 2 }}>아주아주 긴 이름의 신비한 조건문 갈림길 대모험 이야기 그리고 또</div></Tile>
        <Tile label="textWrap: balance"><div style={{ display: 'flex', width: 220, fontSize: 22, textWrap: 'balance', textAlign: 'center' }}>아주아주 긴 이름의 신비한 조건문 갈림길</div></Tile>
        <Tile label="clipPath (CSS)"><div style={{ ...box, background: '#B9A3E3', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} /></Tile>
        <Tile label="maskImage (CSS)"><div style={{ ...box, background: '#5ED69A', maskImage: 'linear-gradient(90deg, black, transparent)' }} /></Tile>
        <Tile label="position absolute + zIndex"><div style={{ display: 'flex', position: 'relative', width: 150, height: 80 }}><div style={{ position: 'absolute', left: 0, top: 0, width: 90, height: 60, background: '#FFE36E', zIndex: 2 }} /><div style={{ position: 'absolute', left: 50, top: 20, width: 90, height: 60, background: '#FF7A70', zIndex: 1 }} /></div></Tile>
        <Tile label="display: grid (미지원)"><div style={{ display: 'flex', fontSize: 18, color: '#94A3B8' }}>flex만 지원 (문서)</div></Tile>
      </Sheet>
    );
  } else if (c === 'fallback') {
    const mode = q.get('mode') ?? 'bundled';
    families = ['Jua', 'Pretendard'];
    fallback = mode === 'bundled';
    if (mode === 'offline') {
      // 외부 네트워크 차단 상황 흉내: @vercel/og의 Google Fonts 자동 대체 요청을 실패시킴
      globalThis.fetch = (async () => {
        throw new Error('offline (spike)');
      }) as typeof fetch;
    }
    const label = { bundled: '번들 Fallback(Pretendard 11,172자)', google: '@vercel/og 자동 대체 (Google Noto Sans KR)', offline: '외부 네트워크 차단' }[mode];
    el = (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 60, background: '#FFF8E7', fontFamily: fallback ? 'Pretendard, Fallback' : 'Pretendard' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#64748B' }}>{`KS X 1001 밖 글자 처리: ${label}`}</div>
        <div style={{ display: 'flex', marginTop: 30, fontFamily: fallback ? 'Jua, Fallback' : 'Jua', fontSize: 110, color: '#22324F' }}>{q.get('line1') ?? '햏햏 뷁 똠방각하'}</div>
        <div style={{ display: 'flex', marginTop: 10, fontFamily: fallback ? 'Jua, Fallback' : 'Jua', fontSize: 80, color: '#22324F' }}>{q.get('line2') ?? '됬다! 코딩왕 민준'}</div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 26, color: '#64748B' }}>윗줄: Jua 서브셋(2,350자) 지정 · 빠진 글자만 대체 폰트로 그려짐</div>
      </div>
    );
  } else if (c === 'stack') {
    // 같은 글자를 폰트 스택별로 나란히: 빠진 글자만 대체되는지, 단어 전체가 대체되는지 확인
    families = ['Jua', 'Pretendard'];
    const t = q.get('t') ?? '코딩햏햏 똠방각하 민준됬';
    const row = (ff: string, label: string) => (
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
        <div style={{ display: 'flex', width: 250, fontSize: 24, color: '#64748B' }}>{label}</div>
        <div style={{ display: 'flex', fontFamily: ff, fontSize: 84, color: '#22324F' }}>{t}</div>
      </div>
    );
    el = (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 40, background: '#FFF8E7', fontFamily: 'Pretendard, Fallback' }}>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, color: '#64748B' }}>폰트 스택별 렌더 (Jua 서브셋 2,350자 + Fallback = Pretendard 11,172자)</div>
        {row('Jua', "'Jua' 단독")}
        {row('Jua, Fallback', "'Jua, Fallback'")}
        {row('Fallback', "'Fallback' 단독")}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
          <div style={{ display: 'flex', width: 250, fontSize: 24, color: '#64748B' }}>글자별 span 분리</div>
          <div style={{ display: 'flex', fontFamily: 'Jua', fontSize: 84, color: '#22324F' }}>
            {splitRuns(t).map((r, i) => (
              <span key={i} style={{ fontFamily: r.missing ? 'Fallback' : 'Jua', color: r.missing ? '#C8553D' : '#22324F' }}>{r.text}</span>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (c === 'emoji') {
    emoji = (q.get('set') as typeof emoji) ?? 'twemoji';
    el = (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#F0F9FF', fontFamily: 'Pretendard, Fallback' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#64748B' }}>{`emoji: '${emoji}' (렌더 시 jsDelivr CDN에서 SVG를 받아 옴)`}</div>
        <div style={{ display: 'flex', fontSize: 120, marginTop: 30 }}>⭐🎉🐍🐞🌠🔥</div>
        <div style={{ display: 'flex', fontSize: 60, marginTop: 20, fontWeight: 700 }}>별 ⭐⭐⭐ 클리어!</div>
      </div>
    );
  } else {
    return new Response('unknown case', { status: 404 });
  }

  try {
    const { fonts } = await loadFonts(families, 'ks', { fallback });
    const t = performance.now();
    const png = await new ImageResponse(el as React.ReactElement, { width: 1200, height: 630, fonts, emoji }).arrayBuffer();
    return new Response(png, {
      headers: { 'content-type': 'image/png', 'cache-control': 'no-store', 'server-timing': `render;dur=${(performance.now() - t).toFixed(1)}` },
    });
  } catch (e) {
    return new Response(`render error: ${(e as Error).stack ?? e}`, { status: 500 });
  } finally {
    globalThis.fetch = restoreFetch;
  }
}
