// 래스터 정지 그림 목록 (P2-16). 규칙·예산: docs/design/assets.md "래스터 정지 그림"
//
// 래스터는 "진짜 질감이 필요한 정지 그림"에만 쓴다 (§12-Q28): 히어로 일러스트·공유 카드 배경·스캔 질감.
// 움직이는 화면·캐릭터는 코드 기반 SVG(리그)라 여기에 넣지 않는다.
//
// 항목 모양:
//   {
//     id: 'hero-island',                       // kebab-case, 파일 이름이 됨
//     version: 1,                              // 원본·설정을 바꾸면 올린다 (immutable 캐시)
//     kind: 'hero',                            // hero | still | card-bg | texture (lib/raster.mjs KIND_DEFAULTS)
//     source: 'assets-src/raster/hero-island.png', // 원본 (git, 가장 큰 출력의 2배 폭 이하 무손실 PNG·WebP)
//     // 선택: widths, formats(['webp','avif','png']), quality({ webp: 78 }), png({ palette: false }), maxBytes, setBytes
//   }
//
// 바꾼 뒤: npm run assets:raster → 생성물(public/images 등) + raster.lock.json을 같은 커밋에

/** @type {Array<Record<string, unknown>>} */
export const RASTER_ASSETS = [];
