import { Children, type ReactNode } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 공지 본문 (B145). 관리자만 쓰는 글이라 마크다운 일부(소제목 `###`·목록·굵게·링크·자동 링크)를 그린다.
 * 서버 컴포넌트라 react-markdown은 클라이언트 JS에 실리지 않는다. 게시판(학생 글)은 일반 텍스트 그대로.
 *
 * - raw HTML은 react-markdown 기본대로 글자로 보인다(요소가 되지 않음). 그림·표·코드 등은 허용 목록 밖 → 내용만 남김
 * - 링크는 http(s)·mailto만. 외부 링크는 새 탭 + `noopener noreferrer`
 * - 옛 공지(일반 텍스트)의 줄바꿈 한 번을 살리려고 문단·목록 항목에 `white-space: pre-line`
 * - `~` 하나 취소선은 끔("3~4분"이 지워지지 않게)
 */
const remarkPlugins: Options['remarkPlugins'] = [
  [remarkGfm, { singleTilde: false }],
];
const allowedElements = [
  ...['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'],
  ...['strong', 'em', 'del', 'a', 'br'],
];

export function safeNoticeUrl(url: string) {
  return /^(https?:|mailto:)/i.test(url) ? url : null;
}

function Heading({ children }: { children?: ReactNode }) {
  return (
    <h2 className="mt-8 font-sans text-body font-bold text-foreground first:mt-0">
      {children}
    </h2>
  );
}

const components: Components = {
  p: ({ children }) => (
    <p className="mt-4 whitespace-pre-line first:mt-0">{children}</p>
  ),
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-muted-foreground first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 marker:text-muted-foreground first:mt-0">
      {children}
    </ol>
  ),
  // 블록 사이 "\n" 글자는 빼야 pre-line에서 빈 줄이 생기지 않는다
  li: ({ children }) => (
    <li className="whitespace-pre-line">
      {Children.toArray(children).filter((c) => c !== '\n')}
    </li>
  ),
  a: ({ href, children }) =>
    href ? (
      <a
        href={href}
        className="focus-ring rounded-sm text-primary-text underline underline-offset-4"
        {...(href.startsWith('mailto:')
          ? {}
          : { target: '_blank', rel: 'noopener noreferrer' })}
      >
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
};

export function NoticeBody({ content }: { content: string }) {
  return (
    <div
      data-testid="notice-body"
      className="text-body text-foreground [overflow-wrap:anywhere] [&_h2+*]:mt-2"
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        allowedElements={allowedElements}
        unwrapDisallowed
        urlTransform={safeNoticeUrl}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
