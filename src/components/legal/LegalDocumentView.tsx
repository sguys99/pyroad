import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { PybaemStatic } from '@/components/characters/rig';
import { Card } from '@/components/ui/card';
import { formatLegalDate } from '@/lib/legal/meta';
import type { LegalBlock, LegalDocument, LegalInline } from '@/lib/legal/types';

/**
 * 약관·개인정보처리방침 본문 (P3-14, 서버 컴포넌트·JS 없음).
 * 맨 위 아이용 "쉬운 말 요약" 카드 → 시행일·버전 → 목차 → 본문 → 개정 이력.
 * 표는 넓은 화면에서 표, 좁은 화면(< 768px)에서 칸마다 이름표를 붙인 카드로 보여 준다(360px 가로 스크롤 없음).
 */
export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="space-y-8" aria-labelledby="legal-title">
      <header className="space-y-2">
        <h1 id="legal-title" className="font-display text-h1 text-foreground">
          {doc.title}
        </h1>
        <p className="text-small text-muted-foreground">
          시행일 {formatLegalDate(doc.effectiveDate)} · 버전 {doc.version}
        </p>
      </header>

      <KidSummary title={doc.title} items={doc.summary} />

      <div className="space-y-4 text-body text-foreground">
        {doc.preamble.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>

      <nav aria-labelledby="legal-toc" className="rounded-xl bg-surface-2 p-4">
        <h2 id="legal-toc" className="mb-2 font-display text-h3">
          목차
        </h2>
        <ol className="grid gap-x-6 gap-y-1 text-small sm:grid-cols-2">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="focus-ring inline-flex min-h-9 items-center rounded-md text-primary-text underline-offset-4 hover:underline"
              >
                {s.title}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#history"
              className="focus-ring inline-flex min-h-9 items-center rounded-md text-primary-text underline-offset-4 hover:underline"
            >
              개정 이력
            </a>
          </li>
        </ol>
      </nav>

      {doc.sections.map((s) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-title`}
          className="scroll-mt-6 space-y-3"
        >
          <h2
            id={`${s.id}-title`}
            className="font-display text-h2 text-foreground"
          >
            {s.title}
          </h2>
          {s.blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </section>
      ))}

      <section
        id="history"
        aria-labelledby="history-title"
        className="scroll-mt-6 space-y-3 border-t border-line pt-6"
      >
        <h2 id="history-title" className="font-display text-h2 text-foreground">
          개정 이력
        </h2>
        <ul className="space-y-1 text-small text-muted-foreground">
          {doc.history.map((h) => (
            <li key={h.date}>
              {formatLegalDate(h.date)} (버전 {h.date}) — {h.note}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

/** 아이용 쉬운 말 요약 (파이뱀이 알려 주는 말투). 효력은 본문에 있다는 안내를 함께 둔다 */
function KidSummary({ title, items }: { title: string; items: string[] }) {
  return (
    <Card
      radius="l"
      padding="lg"
      className="bg-primary-soft"
      aria-labelledby="kid-summary-title"
      role="region"
    >
      <div className="flex items-start gap-3">
        <PybaemStatic
          state="happy"
          size={56}
          filters={false}
          label=""
          className="shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <h2
            id="kid-summary-title"
            className="font-display text-h3 text-foreground"
          >
            쉬운 말 요약
          </h2>
          <p className="text-small text-muted-foreground">
            파이뱀이 {title}에서 중요한 것만 골라 알려 줄게요.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-body text-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-primary-text">
              •
            </span>
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-muted-foreground">
        이 요약은 이해를 돕기 위한 것이고, 정확한 내용은 아래 본문이 기준이에요.
        보호자와 함께 읽어 보세요.
      </p>
    </Card>
  );
}

function InlineView({ content }: { content: LegalInline | LegalInline[] }) {
  const parts = Array.isArray(content) ? content : [content];
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <LegalLink key={i} href={p.href}>
            {p.text}
          </LegalLink>
        ),
      )}
    </>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const cls =
    'focus-ring rounded-sm text-primary-text underline underline-offset-4 [overflow-wrap:anywhere]';
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      className={cls}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

function BlockView({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'p':
      return (
        <p className="text-body text-foreground">
          <InlineView content={block.content} />
        </p>
      );
    case 'note':
      return (
        <p className="text-small text-muted-foreground">
          <InlineView content={block.content} />
        </p>
      );
    case 'ul':
    case 'ol': {
      const List = block.type;
      return (
        <List
          className={
            block.type === 'ol'
              ? 'list-decimal space-y-2 pl-6 text-body text-foreground marker:text-muted-foreground'
              : 'list-disc space-y-2 pl-6 text-body text-foreground marker:text-muted-foreground'
          }
        >
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineView content={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'table':
      return <LegalTable block={block} />;
  }
}

function LegalTable({
  block,
}: {
  block: Extract<LegalBlock, { type: 'table' }>;
}) {
  return (
    <>
      {/* 좁은 화면: 행마다 카드, 칸마다 이름표 */}
      <ul aria-label={block.caption} className="space-y-3 md:hidden">
        {block.rows.map((row, r) => (
          <li key={r} className="rounded-xl bg-surface p-4 shadow-card">
            <dl className="space-y-2">
              {row.map((cell, c) => (
                <div key={c}>
                  <dt className="text-caption font-semibold text-muted-foreground">
                    {block.head[c]}
                  </dt>
                  <dd className="text-small text-foreground [overflow-wrap:anywhere]">
                    <InlineView content={cell} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {/* 넓은 화면: 표 */}
      <div className="hidden overflow-x-auto rounded-xl bg-surface shadow-card md:block">
        <table className="w-full border-collapse text-left text-small">
          <caption className="sr-only">{block.caption}</caption>
          <thead className="bg-surface-2">
            <tr>
              {block.head.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3 py-2 align-bottom font-semibold text-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r} className="border-t border-line align-top">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="px-3 py-2 text-foreground [overflow-wrap:anywhere]"
                  >
                    <InlineView content={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
