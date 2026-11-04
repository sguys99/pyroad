self.onmessage = (e) => {
  const a = new Int32Array(e.data);
  self.postMessage('waiting');
  const r = Atomics.wait(a, 0, 0, 3000);
  self.postMessage(r);
};
