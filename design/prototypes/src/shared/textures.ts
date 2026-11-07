// 종이·수채 질감 (외부 이미지 없이 data: URI SVG). CSS background-image로 쓴다.
// 큰 면적은 한 번 래스터화되어 반복되므로 가볍다. 단, 움직이는 요소 위에는 얹지 않는다(매 프레임 다시 그림).
// 앱(P2-19 공유 카드)에서는 PNG로 미리 래스터화한다 (satori 제약).

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;

/** 종이 결: 잔 입자 (투명 배경, 어떤 바탕색 위에도) */
export function paperGrain(opacity = 0.09, size = 180): string {
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>
    <feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.16  0 0 0 ${opacity * 6} -${opacity * 2}'/></filter>
    <rect width='100%' height='100%' filter='url(#n)'/></svg>`);
}

/** 종이 섬유: 크고 부드러운 얼룩 (수채 종이 요철) */
export function paperFiber(color = '#B89B6A', opacity = 0.08, size = 360): string {
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <filter id='f'><feTurbulence type='fractalNoise' baseFrequency='0.012 0.03' numOctaves='3' seed='7' stitchTiles='stitch'/>
    <feComponentTransfer><feFuncA type='table' tableValues='0 0 ${opacity} ${opacity * 1.6}'/></feComponentTransfer></filter>
    <rect width='100%' height='100%' fill='${color}' filter='url(#f)'/></svg>`);
}

/** 수채 번짐 얼룩 하나 (배경 장식). 가장자리가 진하고 안쪽이 옅은 수채 특유의 테두리 */
export function watercolorBlob(color: string, seed = 3, w = 320, h = 220): string {
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <filter id='w' x='-20%' y='-20%' width='140%' height='140%'>
      <feTurbulence type='fractalNoise' baseFrequency='0.018' numOctaves='3' seed='${seed}'/>
      <feDisplacementMap in='SourceGraphic' scale='38'/>
      <feGaussianBlur stdDeviation='1.2'/>
    </filter>
    <g filter='url(#w)'>
      <ellipse cx='${w / 2}' cy='${h / 2}' rx='${w * 0.36}' ry='${h * 0.32}' fill='${color}' fill-opacity='0.35'/>
      <ellipse cx='${w / 2}' cy='${h / 2}' rx='${w * 0.36}' ry='${h * 0.32}' fill='none' stroke='${color}' stroke-opacity='0.45' stroke-width='5'/>
    </g></svg>`);
}

/** 공책 줄 (코드·메모 영역). lineHeight px 간격 */
export function notebookLines(line = '#C9D8E6', lineHeight = 26, margin?: string): string {
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='${lineHeight}'>
    <line x1='0' y1='${lineHeight - 0.5}' x2='40' y2='${lineHeight - 0.5}' stroke='${line}' stroke-width='1'/>
    ${margin ? `<line x1='0' y1='0' x2='0' y2='${lineHeight}' stroke='${margin}' stroke-width='2'/>` : ''}</svg>`);
}

/** 손으로 그은 듯한 밑줄 (가로로 늘려 씀) */
export function scribbleUnderline(color: string): string {
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='14' viewBox='0 0 200 14' preserveAspectRatio='none'>
    <path d='M3 9 C40 4 80 11 120 6 S180 5 197 8' fill='none' stroke='${color}' stroke-width='4' stroke-linecap='round'/>
    <path d='M12 11 C60 8 110 12 186 9' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' opacity='0.6'/></svg>`);
}

/** 찢은 종이 가장자리 (mask-image로) */
export function tornEdgeMask(): string {
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='12' viewBox='0 0 120 12' preserveAspectRatio='none'>
    <path d='M0 12 L0 5 L8 7 L15 3 L24 6 L31 2 L40 6 L48 4 L57 7 L66 3 L74 6 L83 2 L92 6 L100 3 L109 7 L120 4 L120 12Z' fill='black'/></svg>`);
}
