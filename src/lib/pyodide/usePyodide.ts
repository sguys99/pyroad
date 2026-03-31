'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { EXECUTION_TIMEOUT_MS, MAX_OUTPUT_LENGTH } from './constants';
import type { WorkerRequest, WorkerResponse } from './types';

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RunResult {
  stdout: string;
  stderr: string;
  success: boolean;
  isTimeout?: boolean;
}

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT_LENGTH) {
    return (
      output.slice(0, MAX_OUTPUT_LENGTH) +
      '\n\n...출력이 너무 길어서 잘렸어요'
    );
  }
  return output;
}

export function usePyodide() {
  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const resolverRef = useRef<((result: RunResult) => void) | null>(null);

  const createWorker = useCallback(() => {
    const worker = new Worker('/workers/pyodide-worker.js');

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'init-status':
          if (msg.status === 'ready') setStatus('ready');
          else if (msg.status === 'loading') setStatus('loading');
          else if (msg.status === 'error') setStatus('error');
          break;
        case 'run-result':
          if (resolverRef.current) {
            resolverRef.current({
              stdout: truncateOutput(msg.stdout),
              stderr: truncateOutput(msg.stderr),
              success: msg.success,
            });
            resolverRef.current = null;
          }
          setIsRunning(false);
          break;
        case 'run-error':
          if (resolverRef.current) {
            resolverRef.current({
              stdout: '',
              stderr: msg.error,
              success: false,
            });
            resolverRef.current = null;
          }
          setIsRunning(false);
          break;
      }
    };

    worker.onerror = () => {
      setStatus('error');
      setIsRunning(false);
      if (resolverRef.current) {
        resolverRef.current({
          stdout: '',
          stderr: '코드 실행기에 오류가 발생했어요.',
          success: false,
        });
        resolverRef.current = null;
      }
    };

    workerRef.current = worker;
    return worker;
  }, []);

  // 마운트 시 Worker 생성 + Pyodide 초기화
  useEffect(() => {
    const worker = createWorker();
    setStatus('loading');
    const msg: WorkerRequest = { type: 'init' };
    worker.postMessage(msg);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [createWorker]);

  const runCode = useCallback(
    (code: string): Promise<RunResult> => {
      return new Promise((resolve) => {
        if (!workerRef.current || status !== 'ready') {
          resolve({
            stdout: '',
            stderr: '코드 실행기가 아직 준비되지 않았어요.',
            success: false,
          });
          return;
        }

        setIsRunning(true);
        const id = crypto.randomUUID();

        // 타임아웃 타이머
        const timer = setTimeout(() => {
          // Worker를 종료하고 새로 생성 (유일한 중단 방법)
          workerRef.current?.terminate();
          resolverRef.current = null;
          setIsRunning(false);
          setStatus('loading');

          resolve({
            stdout: '',
            stderr: '',
            success: false,
            isTimeout: true,
          });

          // 새 Worker 생성 및 재초기화
          const newWorker = createWorker();
          const initMsg: WorkerRequest = { type: 'init' };
          newWorker.postMessage(initMsg);
        }, EXECUTION_TIMEOUT_MS);

        resolverRef.current = (result) => {
          clearTimeout(timer);
          resolve(result);
        };

        const msg: WorkerRequest = { type: 'run', id, code };
        workerRef.current.postMessage(msg);
      });
    },
    [status, createWorker],
  );

  const retry = useCallback(() => {
    workerRef.current?.terminate();
    const worker = createWorker();
    setStatus('loading');
    const msg: WorkerRequest = { type: 'init' };
    worker.postMessage(msg);
  }, [createWorker]);

  return { status, runCode, isRunning, retry };
}
