// 저사양 감지 신호의 브라우저 지원 표 (MDN browser-compat-data 기준, 문서 확인)
import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import { writeFileSync } from 'node:fs';
const get = (path) => path.split('.').reduce((o, k) => o?.[k], bcd)?.__compat;
const BROWSERS = ['chrome', 'chrome_android', 'edge', 'firefox', 'firefox_android', 'safari', 'safari_ios', 'samsunginternet_android', 'webview_android'];
const FEATURES = [
  ['navigator.hardwareConcurrency', 'api.Navigator.hardwareConcurrency'],
  ['navigator.deviceMemory', 'api.Navigator.deviceMemory'],
  ['navigator.connection', 'api.Navigator.connection'],
  ['connection.saveData', 'api.NetworkInformation.saveData'],
  ['connection.effectiveType', 'api.NetworkInformation.effectiveType'],
  ['prefers-reduced-motion', 'css.at-rules.media.prefers-reduced-motion'],
  ['prefers-reduced-data', 'css.at-rules.media.prefers-reduced-data'],
  ['Long Tasks (PerformanceLongTaskTiming)', 'api.PerformanceLongTaskTiming'],
  ['Long Animation Frames (PerformanceLongAnimationFrameTiming)', 'api.PerformanceLongAnimationFrameTiming'],
  ['navigator.getBattery()', 'api.Navigator.getBattery'],
  ['requestAnimationFrame', 'api.Window.requestAnimationFrame'],
  ['navigator.userAgentData.mobile', 'api.NavigatorUAData.mobile'],
  ['matchMedia', 'api.Window.matchMedia'],
];
const ver = (s) => {
  const e = Array.isArray(s) ? s[0] : s;
  if (!e) return '?';
  if (e.version_added === false) return '✗';
  if (e.version_added === null) return '?';
  let v = String(e.version_added);
  if (e.version_removed) v += `–${e.version_removed}(제거)`;
  if (e.flags) v += ' (플래그)';
  if (e.partial_implementation) v += ' (부분)';
  return v;
};
const rows = [];
console.log(`| 신호 | ${BROWSERS.join(' | ')} |\n|---|${BROWSERS.map(() => '---').join('|')}|`);
for (const [name, path] of FEATURES) {
  const c = get(path);
  const cells = BROWSERS.map((b) => (c ? ver(c.support[b]) : 'n/a'));
  rows.push({ name, path, cells });
  console.log(`| ${name} | ${cells.join(' | ')} |`);
}
writeFileSync(new URL('../results/support.json', import.meta.url), JSON.stringify({ bcd: bcd.__meta, browsers: BROWSERS, rows }, null, 1));
console.log('\nbcd', bcd.__meta.version, bcd.__meta.timestamp);
