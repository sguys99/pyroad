// SVGO 설정 (P2-16). `npm run assets:svg`(scripts/assets/svg.mjs)가 public/ 아래 SVG(배경·일러스트·아이콘)에 쓴다.
// 마스코트 리그는 코드(geometry 상수)라 대상이 아니다 (docs/design/assets.md).
// - multipass: 한 번 더 돌려도 바뀌지 않게(멱등) → `--check`가 "최적화 안 된 파일"을 그대로 찾을 수 있다
// - SVGO 4의 preset-default는 viewBox·<title>을 지우지 않는다 (반응형 크기·접근성 이름 유지)
// - removeScripts: public/ SVG는 같은 출처에서 직접 열릴 수 있으니 <script>·on* 속성을 지운다
// - 스프라이트(<use href="x.svg#id">)를 만들면 cleanupIds가 id를 바꾸므로 그 파일만 따로 설정할 것
const config = {
  multipass: true,
  plugins: [
    'preset-default',
    'removeDimensions',
    'removeScripts',
    { name: 'removeAttrs', params: { attrs: '(data-.*)' } },
  ],
};

export default config;
