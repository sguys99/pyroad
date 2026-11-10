'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPlugins = [remarkGfm];

/** 힌트 쪽지 본문 마크다운. 첫 로드 JS에서 빼려고 따로 둔다 (P6-16: react-markdown + gfm 약 46KB gzip) */
export default function HintMarkdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={remarkPlugins}>{text}</ReactMarkdown>;
}
