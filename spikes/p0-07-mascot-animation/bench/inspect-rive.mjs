import { launch, BASE } from './pw.mjs';
const b = await launch();
const p = await b.newPage();
p.on('console', (m) => console.log('[page]', m.text()));
await p.goto(`${BASE}/inspect.html`);
await p.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
console.log(JSON.stringify(await p.evaluate(() => window.__inspect), null, 1));
await p.screenshot({ path: '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/inspect.png', fullPage: true });
await b.close();
