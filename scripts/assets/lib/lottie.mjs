// Lottie JSON 구조 검사 (P2-16, B32 재발 방지). 순수 함수라 단위 테스트한다. 실제 렌더 검사는 check-lottie.mjs.
//
// 앱은 일회성 이펙트 2~3종만 lottie-web의 `lottie_light`(SVG 렌더러, expressions·효과 없음, gzip 약 47KB)로 지연 로드한다 (§2.5).
// B32: 저장소의 옛 Lottie 4종은 레이어 `st`·`ks.a`(일부 `ks.r`)와 키프레임 `i`/`o`가 없어 lottie-web에서 아무것도 그리지 않았다.

/** 파일 하나 크기 예산 (원본 JSON). 일회성 이펙트라 이보다 크면 단순하게 하거나 리그·CSS로 */
export const LOTTIE_MAX_BYTES = 60 * 1024;
/** 재생 길이 상한(초). 축하 연출은 짧게 + 건너뛰기 (§12-Q28) */
export const LOTTIE_MAX_SECONDS = 4;
export const LOTTIE_MAX_FPS = 60;
/** 레이어 수(프리컴프 안 포함) 경고 기준. 많으면 저사양 기기에서 프레임이 떨어짐 */
export const LOTTIE_WARN_LAYERS = 40;

/** 레이어 종류 (ty). lottie_light에서 쓰지 않을 것은 이유와 함께 */
const LAYER_TYPES = {
  0: { name: '프리컴프' },
  1: { name: '단색' },
  2: {
    name: '이미지',
    error: '래스터 이미지 레이어 금지 (벡터만, 크기·공유 카드 경로)',
  },
  3: { name: '널' },
  4: { name: '도형' },
  5: {
    name: '텍스트',
    error: '텍스트 레이어 금지 (글꼴이 없음, 글자는 HTML이나 경로로)',
  },
  6: { name: '오디오', error: '오디오 레이어 금지 (소리는 SoundProvider)' },
  13: { name: '카메라', error: '카메라(3D) 금지' },
};

/** 도형 항목 종류. 'mm'(패스 병합)은 lottie-web 어느 렌더러도 그리지 않는다 */
const SHAPE_TYPES = new Set([
  'gr',
  'sh',
  'rc',
  'el',
  'sr',
  'fl',
  'st',
  'gf',
  'gs',
  'tr',
  'tm',
  'rd',
  'rp',
  'pb',
  'zz',
  'op',
]);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * @param {unknown} json 파싱한 Lottie
 * @param {{ bytes?: number }} [meta]
 * @returns {{ errors: string[], warnings: string[], stats: { layers: number, seconds: number, fr: number, w: number, h: number, bytes?: number } }}
 */
export function inspectLottie(json, meta = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const stats = { layers: 0, seconds: 0, fr: 0, w: 0, h: 0, bytes: meta.bytes };

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { errors: ['Lottie JSON 객체가 아니에요'], warnings, stats };
  }
  const d = /** @type {Record<string, any>} */ (json);
  for (const k of ['fr', 'ip', 'op', 'w', 'h']) {
    if (!isNum(d[k])) err(`최상위 ${k}가 없거나 숫자가 아니에요`);
  }
  if (typeof d.v !== 'string') warn('최상위 v(내보낸 버전)가 없어요');
  if (!Array.isArray(d.layers) || d.layers.length === 0)
    err('layers가 비었어요');
  if (errors.length) return { errors, warnings, stats };

  stats.fr = d.fr;
  stats.w = d.w;
  stats.h = d.h;
  stats.seconds = (d.op - d.ip) / d.fr;
  if (d.op <= d.ip) err(`op(${d.op})가 ip(${d.ip})보다 커야 해요`);
  if (d.fr > LOTTIE_MAX_FPS) err(`fr ${d.fr} > ${LOTTIE_MAX_FPS}`);
  if (stats.seconds > LOTTIE_MAX_SECONDS) {
    err(
      `길이 ${stats.seconds.toFixed(2)}초 > ${LOTTIE_MAX_SECONDS}초 (일회성 이펙트는 짧게)`,
    );
  }
  if (d.w > 1024 || d.h > 1024)
    warn(`캔버스 ${d.w}×${d.h}가 커요 (1024 이하 권장)`);
  if (d.ddd === 1) err('3D(ddd: 1) 금지');
  if (meta.bytes !== undefined && meta.bytes > LOTTIE_MAX_BYTES) {
    err(`${meta.bytes}B > 예산 ${LOTTIE_MAX_BYTES}B`);
  }
  if (Array.isArray(d.fonts?.list) && d.fonts.list.length)
    err('글꼴(fonts) 금지 (텍스트 레이어 없이)');
  if (Array.isArray(d.chars) && d.chars.length) err('글리프(chars) 금지');

  // 에셋: 프리컴프(layers 있음)만 허용
  const precomps = new Map();
  for (const a of Array.isArray(d.assets) ? d.assets : []) {
    if (Array.isArray(a?.layers)) precomps.set(a.id, a);
    else if (a?.p !== undefined || a?.u !== undefined) {
      err(`에셋 ${a.id ?? '?'}: 이미지 에셋 금지 (벡터만)`);
    }
  }

  const walkLayers = (layers, where) => {
    layers.forEach((L, i) => {
      const at = `${where}레이어 ${i}${L?.nm ? ` "${L.nm}"` : ''}`;
      stats.layers++;
      if (!L || typeof L !== 'object') return err(`${at}: 객체가 아니에요`);
      const type = LAYER_TYPES[L.ty];
      if (!type) return err(`${at}: 모르는 레이어 종류 ty=${L.ty}`);
      if (type.error) err(`${at}: ${type.error}`);
      for (const k of ['ip', 'op', 'st']) {
        // st(시작 시간)가 없으면 lottie-web이 NaN 시간으로 계산해 아무것도 안 그림 (B32)
        if (!isNum(L[k]))
          err(
            `${at}: ${k}가 없어요${k === 'st' ? ' (B32: 빈 화면 원인)' : ''}`,
          );
      }
      if (L.ddd === 1) err(`${at}: 3D 레이어 금지`);
      const ks = L.ks;
      if (!ks || typeof ks !== 'object') err(`${at}: 변형(ks)이 없어요`);
      else {
        const missing = ['a', 'p', 's', 'o'].filter((k) => !ks[k]);
        if (!ks.r && !ks.rz) missing.push('r');
        if (missing.length) {
          err(
            `${at}: 변형 ks.${missing.join('·ks.')}가 없어요 (B32: 기준점·회전이 없으면 빈 화면)`,
          );
        }
      }
      if (Array.isArray(L.ef) && L.ef.length)
        err(`${at}: 효과(ef) 금지 (lottie_light에 없음)`);
      if (Array.isArray(L.sy) && L.sy.length)
        err(`${at}: 레이어 스타일(sy) 금지 (SVG 렌더러가 무시)`);
      if (L.bm && L.bm !== 0)
        warn(`${at}: 블렌드 모드 ${L.bm} (mix-blend-mode, 저사양에서 비쌈)`);
      if (L.ty === 0) {
        const pc = precomps.get(L.refId);
        if (!pc) err(`${at}: 프리컴프 ${L.refId}가 assets에 없어요`);
        else if (!pc.__seen) {
          pc.__seen = true;
          walkLayers(pc.layers, `${at} > `);
          delete pc.__seen;
        }
      }
      if (L.ty === 4) walkShapes(L.shapes ?? [], at);
    });
  };

  const walkShapes = (shapes, at) => {
    for (const s of shapes) {
      if (s?.ty === 'mm')
        err(`${at}: 패스 병합(mm) 금지 (lottie-web이 그리지 않음)`);
      else if (!SHAPE_TYPES.has(s?.ty))
        warn(`${at}: 모르는 도형 항목 ty=${s?.ty}`);
      if (s?.ty === 'gr') walkShapes(s.it ?? [], at);
    }
  };

  walkLayers(d.layers, '');

  // 모든 속성(a·k 쌍)을 훑어 expressions·키프레임 이징을 본다
  let missingEase = 0;
  let legacyEnd = 0;
  let expressions = 0;
  const walkProps = (node) => {
    if (Array.isArray(node)) return node.forEach(walkProps);
    if (!node || typeof node !== 'object') return;
    const isProp = 'k' in node && (node.a === 0 || node.a === 1);
    if (isProp) {
      if (typeof node.x === 'string') expressions++;
      if (node.a === 1 && Array.isArray(node.k)) {
        node.k.forEach((kf, i) => {
          if (!kf || typeof kf !== 'object') return;
          if ('e' in kf) legacyEnd++;
          const last = i === node.k.length - 1;
          // 마지막 키프레임과 멈춤(h: 1) 키프레임은 이징이 필요 없다
          if (!last && kf.h !== 1 && (!kf.i || !kf.o)) missingEase++;
        });
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') walkProps(v);
    }
  };
  walkProps(d.layers);
  walkProps(Array.from(precomps.values()).map((p) => p.layers));
  if (expressions)
    err(
      `expressions ${expressions}곳 금지 (lottie_light에 없음, CSP 'unsafe-eval' 필요)`,
    );
  if (missingEase)
    err(
      `이징(i/o)이 없는 키프레임 ${missingEase}개 (B32: 보간이 안 돼 빈 화면)`,
    );
  if (legacyEnd)
    warn(
      `옛 형식 키프레임 끝값(e) ${legacyEnd}개 (Bodymovin 5.5+ 형식으로 내보내기)`,
    );
  if (stats.layers > LOTTIE_WARN_LAYERS)
    warn(`레이어 ${stats.layers}개 > ${LOTTIE_WARN_LAYERS}`);

  return { errors, warnings, stats };
}

/**
 * 렌더 검사에서 볼 프레임 (ip 기준 상대 프레임). 처음·끝은 비어 있을 수 있으니(팝 등장·사라짐) 안쪽을 고르게 본다
 */
export function sampleFrames(ip, op, n = 6) {
  const len = op - ip;
  return Array.from(
    { length: n },
    (_, i) => Math.round(((i + 1) / (n + 1)) * len * 100) / 100,
  );
}

/**
 * 렌더 결과 판정. frames: 프레임별 { ratio: 칠해진 픽셀 비율, hash }
 * - 빈 화면(B32): 칠해진 프레임이 2개 미만이거나 가장 많이 칠한 프레임이 0.5% 미만
 * - 움직임 없음: 모든 프레임이 같은 그림 (경고)
 */
export function judgeRender(frames, { minRatio = 0.005, minFrames = 2 } = {}) {
  const painted = frames.filter((f) => f.ratio >= minRatio / 5).length;
  const max = Math.max(0, ...frames.map((f) => f.ratio));
  const distinct = new Set(frames.map((f) => f.hash)).size;
  return {
    blank: painted < minFrames || max < minRatio,
    still: distinct < 2,
    painted,
    max,
  };
}
