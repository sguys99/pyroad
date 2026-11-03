// Verdict = what the app decides after a run.
//  - prodVerdict(): exactly QuestShell / ProjectQuestShell + /api/quest/validate:
//      run not successful (stderr non-empty or timeout) -> fail, else validateResult() from src/ (unchanged import)
//  - proposed extensions (spike only, NOT in src/):
//      strict code_check (B25): comments and string literals are blanked before `includes`
//      contains_any (B09):      stdout contains at least one of several strings
//      all:                     every sub-rule passes (e.g. code_check + contains_any)

import { validateResult } from '../../../src/lib/quest/validation.ts';
import type { RunResult } from './sandbox.ts';

export type ProdType = 'output_match' | 'contains' | 'code_check';
export type Rule =
  | { validation_type: ProdType; expected_output: string }
  | { validation_type: 'contains_any'; expected_output: string[] }
  | { validation_type: 'all'; rules: Rule[] };

export interface Verdict {
  passed: boolean;
  reason: null | 'timeout' | 'stderr' | 'mismatch';
}

const PROD_TYPES = new Set(['output_match', 'contains', 'code_check']);

/** With only prod rule types and strictCodeCheck=false this is exactly the app's decision. */
export function verdict(rule: Rule, run: RunResult, code: string, opts: { strictCodeCheck?: boolean } = {}): Verdict {
  if (run.isTimeout) return { passed: false, reason: 'timeout' };
  if (!run.success) return { passed: false, reason: 'stderr' };
  const passed = ruleMatches(rule, run.stdout, code, opts);
  return { passed, reason: passed ? null : 'mismatch' };
}

export function ruleMatches(rule: Rule, stdout: string, code: string, opts: { strictCodeCheck?: boolean } = {}): boolean {
  if (rule.validation_type === 'all') return rule.rules.every((r) => ruleMatches(r, stdout, code, opts));
  if (rule.validation_type === 'contains_any') return rule.expected_output.some((s) => stdout.includes(s));
  if (!PROD_TYPES.has(rule.validation_type)) throw new Error(`unknown validation_type ${rule.validation_type}`);
  const studentCode = rule.validation_type === 'code_check' && opts.strictCodeCheck ? blankCommentsAndStrings(code) : code;
  return validateResult({ validationType: rule.validation_type, expectedOutput: rule.expected_output, stdout, studentCode }).passed;
}

/**
 * B25 proposal: replace Python comments and string-literal contents with spaces so that
 * `code_check "while"` cannot be satisfied by `# while` or `print("while")`.
 * Small state machine (no Python needed, so it can run in the Next.js API route too).
 */
export function blankCommentsAndStrings(code: string): string {
  const out = code.split('');
  let i = 0;
  const n = code.length;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < n) {
    const c = code[i];
    if (c === '#') {
      const end = code.indexOf('\n', i);
      blank(i, end === -1 ? n : end);
      i = end === -1 ? n : end;
    } else if (c === '"' || c === "'") {
      const triple = code.startsWith(c.repeat(3), i);
      const q = triple ? c.repeat(3) : c;
      let j = i + q.length;
      while (j < n) {
        if (code[j] === '\\') { j += 2; continue; }
        if (!triple && code[j] === '\n') break; // unterminated single-line string
        if (code.startsWith(q, j)) { j += q.length; break; }
        j++;
      }
      blank(i + q.length, Math.max(i + q.length, j - (code.startsWith(q, j - q.length) ? q.length : 0)));
      i = j;
    } else i++;
  }
  return out.join('');
}

export function describeRule(rule: Rule): string {
  if (rule.validation_type === 'all') return rule.rules.map(describeRule).join(' AND ');
  if (rule.validation_type === 'contains_any') return `contains_any ${JSON.stringify(rule.expected_output)}`;
  const e = rule.expected_output.replace(/\n/g, '⏎');
  return `${rule.validation_type} "${e.length > 28 ? e.slice(0, 27) + '…' : e}"`;
}
