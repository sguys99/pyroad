// classic/module 겸용 프로브: SW가 이 워커의 요청(async fetch / sync XHR)을 가로채는지 순서대로 기록
const url = new URL('./__sync/ping', self.location).href;
const syncXHR = () => {
  const x = new XMLHttpRequest();
  x.open('GET', url + '?sync=' + Math.random(), false);
  x.send(null);
  return x.responseText.includes('pong') ? 'SW' : 'net' + x.status;
};
const asyncFetch = async () => ((await (await fetch(url + '?a=' + Math.random())).text()).includes('pong') ? 'SW' : 'net');
(async () => {
  const order = new URLSearchParams(self.location.search).get('order') || 'xhr-first';
  const seq = [];
  try {
    if (order === 'xhr-first') seq.push('x:' + syncXHR(), 'x:' + syncXHR(), 'f:' + (await asyncFetch()), 'x:' + syncXHR());
    else seq.push('f:' + (await asyncFetch()), 'f:' + (await asyncFetch()), 'x:' + syncXHR(), 'f:' + (await asyncFetch()));
    await new Promise((r) => setTimeout(r, 300));
    seq.push('(300ms)', 'x:' + syncXHR(), 'f:' + (await asyncFetch()));
  } catch (e) {
    seq.push('error ' + e.message);
  }
  self.postMessage({ seq: seq.join(' '), swController: !!self.navigator?.serviceWorker?.controller });
})();
