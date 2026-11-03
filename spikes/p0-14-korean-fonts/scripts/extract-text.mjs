// 랜딩 문구(content.js)에서 역할별 텍스트를 뽑아 "페이지 텍스트 서브셋"의 입력으로 쓴다.
//   node extract-text.mjs <content.js 경로> <출력 디렉터리>
//   → landing-title.txt (제목 폰트로 그리는 글자), landing-body.txt (본문), landing-code.txt (코드), landing-all.txt
// 실제 앱에서는 랜딩 문구를 상수/콘텐츠 파일로 두고 prebuild 단계에서 같은 방식으로 서브셋을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [contentPath, outDir = '.'] = process.argv.slice(2);
const c = await import(pathToFileURL(path.resolve(contentPath)).href);
const flat = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : v == null ? [] : [String(v)]);

// Landing.jsx에서 제목 폰트(--font-title)로 그리는 요소: h1/h2/h3, 버튼, HUD, 칩, 로고, 말풍선 이름표
const UI_TITLE = ['오늘의 모험 현황', 'pyRoad에서는 이렇게 배워요', '첫 줄은 이렇게 시작해요', '자주 묻는 질문', '로그인', 'pyRoad', 'py'];
const title = [
  ...c.hero.title, c.hero.ctaPrimary, c.hero.ctaSecondary, c.parents.title, ...c.features.map((f) => f.title), c.quest.title, c.quest.cta,
  c.quest.reward, c.quest.coins, ...flat(c.hud), `${c.hud.xp} / ${c.hud.xpMax} XP`, c.tutor.name, ...UI_TITLE,
].join('\n');
const code = [...c.codeDemo, c.codeDemoOutput, '▶ main.py'].join('\n');
const all = ['hero', 'hud', 'tutor', 'quest', 'features', 'codeDemo', 'codeDemoOutput', 'parents', 'faq', 'footer'].flatMap((k) => flat(c[k])).concat(UI_TITLE).join('\n');
const body = all; // 본문 폰트는 페이지 전체 글자를 덮도록(제목 폰트가 늦을 때의 폴백 포함) 전체로 만든다

fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of Object.entries({ title, body, code, all })) fs.writeFileSync(path.join(outDir, `landing-${name}.txt`), text);
const hangul = (s) => new Set([...s].filter((ch) => /[가-힣]/.test(ch))).size;
console.log(JSON.stringify({ title: hangul(title), body: hangul(body), code: hangul(code) }));
