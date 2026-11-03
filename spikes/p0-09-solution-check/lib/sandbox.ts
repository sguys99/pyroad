// Main-thread client for lib/host-worker.mjs. Mirrors src/lib/pyodide/usePyodide.ts:
//  - EXECUTION_TIMEOUT_MS per run, result { stdout:'', stderr:'', success:false, isTimeout:true } on timeout
//  - stdout/stderr truncated to MAX_OUTPUT_LENGTH
// Difference: on timeout we first raise KeyboardInterrupt through Pyodide's interrupt buffer (keeps the
// warm instance); only if that does not return within a grace period do we terminate + recreate the
// worker, which is what the browser always does.

import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { BLOCKED_MODULES, EXECUTION_TIMEOUT_MS, MAX_OUTPUT_LENGTH } from '../../../src/lib/pyodide/constants.ts';
import type { WorkerResponse } from '../../../src/lib/pyodide/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '../../..');
export const WORKER_FILE = resolve(REPO, 'public/workers/pyodide-worker.js');
const require = createRequire(import.meta.url);

export type Mode = 'prod' | 'fresh';
export const PYODIDE_PACKAGES: Record<string, string> = {
  '0.29.3': 'pyodide', // repo root dependency
  '0.27.5': 'pyodide-0.27.5', // spike-local alias = version the worker loads from the CDN
};

/** B15 proposal: also block the JS bridge modules in the fresh sandbox */
export const PROPOSED_EXTRA_BLOCKED = ['js', 'pyodide', 'pyodide_js', '_pyodide', 'micropip'];

export interface RunResult {
  stdout: string;
  stderr: string;
  success: boolean;
  isTimeout?: boolean;
  ms: number;
}

export interface SandboxStats {
  loadMs: number;
  version: string;
  python: string;
  cdnUrls: string[];
  rssMB: number;
  heapUsedMB: number;
  wasmHeapMB: number | null;
}

// copy of the non-exported truncateOutput() in usePyodide.ts
function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT_LENGTH) return output.slice(0, MAX_OUTPUT_LENGTH) + '\n\n...출력이 너무 길어서 잘렸어요';
  return output;
}

export interface SandboxOptions {
  version: string;
  mode: Mode;
  extraBlocked?: string[];
  timeoutMs?: number;
  graceMs?: number;
}

export class Sandbox {
  private worker!: Worker;
  private interrupt = new Int32Array(new SharedArrayBuffer(4));
  private seq = 0;
  readonly opts: Required<SandboxOptions>;
  readonly pkgVersion: string;
  recreated = 0;

  private constructor(opts: SandboxOptions) {
    this.opts = { extraBlocked: [], timeoutMs: EXECUTION_TIMEOUT_MS, graceMs: 2000, ...opts };
    const pkg = PYODIDE_PACKAGES[opts.version];
    if (!pkg) throw new Error(`unknown pyodide version ${opts.version} (have ${Object.keys(PYODIDE_PACKAGES)})`);
    this.pkgVersion = require(`${pkg}/package.json`).version;
    if (this.pkgVersion !== opts.version) throw new Error(`${pkg} resolves to ${this.pkgVersion}, expected ${opts.version}`);
  }

  static async create(opts: SandboxOptions): Promise<Sandbox> {
    const sb = new Sandbox(opts);
    await sb.spawn();
    return sb;
  }

  private spawn(): Promise<void> {
    this.worker = new Worker(resolve(HERE, 'host-worker.mjs'), {
      workerData: {
        pyodidePkg: PYODIDE_PACKAGES[this.opts.version],
        mode: this.opts.mode,
        workerFile: WORKER_FILE,
        interruptBuffer: this.interrupt.buffer,
        blockedModules: [...BLOCKED_MODULES],
        extraBlocked: this.opts.extraBlocked,
        captureLimit: MAX_OUTPUT_LENGTH + 1000, // fresh mode only
      },
    });
    return new Promise((ok, fail) => {
      const onMsg = (m: WorkerResponse) => {
        if (m.type !== 'init-status' || m.status === 'loading') return;
        this.worker.off('message', onMsg);
        if (m.status === 'ready') ok();
        else fail(new Error(`pyodide init failed: ${m.error}`));
      };
      this.worker.on('message', onMsg);
      this.worker.once('error', fail);
      this.worker.postMessage({ type: 'init' });
    });
  }

  private request<T>(msg: object, match: (m: any) => boolean): Promise<T> {
    return new Promise((ok) => {
      const onMsg = (m: any) => {
        if (!match(m)) return;
        this.worker.off('message', onMsg);
        ok(m);
      };
      this.worker.on('message', onMsg);
      this.worker.postMessage(msg);
    });
  }

  stats(): Promise<SandboxStats> {
    return this.request({ type: 'stats' }, (m) => m.type === 'stats');
  }

  /** random.seed(seed) on the shared `random` module, outside the user's code ('entropy' = random.seed()) */
  async seed(seed: number | 'entropy'): Promise<void> {
    await this.request({ type: 'seed', seed }, (m) => m.type === 'seeded');
  }

  async run(code: string, opts: { seed?: number | 'entropy' | null } = {}): Promise<RunResult> {
    const id = `r${++this.seq}`;
    Atomics.store(this.interrupt, 0, 0);
    const t0 = performance.now();
    let timedOut = false;
    // seed (if any) travels with the run message: one round trip instead of two
    const reply = this.request<WorkerResponse>({ type: 'run', id, code, seed: opts.seed ?? null }, (m) => m.id === id);
    const timer = setTimeout(() => {
      timedOut = true;
      Atomics.store(this.interrupt, 0, 2); // SIGINT -> KeyboardInterrupt inside Python
    }, this.opts.timeoutMs);
    const hardKill = new Promise<'hang'>((ok) => {
      const t = setTimeout(() => ok('hang'), this.opts.timeoutMs + this.opts.graceMs);
      reply.finally(() => clearTimeout(t));
    });
    const m = await Promise.race([reply, hardKill]);
    clearTimeout(timer);
    const ms = performance.now() - t0;
    if (m === 'hang') {
      // same as the browser: terminate and recreate
      await this.worker.terminate();
      this.recreated++;
      await this.spawn();
      return { stdout: '', stderr: '', success: false, isTimeout: true, ms };
    }
    if (timedOut) return { stdout: '', stderr: '', success: false, isTimeout: true, ms };
    if (m.type === 'run-error') return { stdout: '', stderr: m.error, success: false, ms };
    if (m.type !== 'run-result') throw new Error(`unexpected message ${m.type}`);
    return { stdout: truncateOutput(m.stdout), stderr: truncateOutput(m.stderr), success: m.success, ms };
  }

  async close(): Promise<void> {
    await this.worker.terminate();
  }
}
