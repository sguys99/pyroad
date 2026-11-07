import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  LICENSE_DATA,
  licenseLabel,
  type NpmLicenseGroup,
  type TextNotice,
} from '@/lib/legal/licenses';

/**
 * 오픈소스·에셋 고지 (P3-14, §12-Q33, docs/assets-license.md §8). 서버 컴포넌트·JS 없음.
 * 데이터는 빌드 전에 만들어 커밋한 `licenses.generated.json`. 전문은 `<details>`로 접어 두어 화면을 짧게 한다.
 */
export function LicensesView() {
  const { npm, runtime, fonts, sounds, excluded } = LICENSE_DATA;
  return (
    <article className="space-y-8" aria-labelledby="licenses-title">
      <header className="space-y-3">
        <h1
          id="licenses-title"
          className="font-display text-h1 text-foreground"
        >
          오픈소스·에셋 고지
        </h1>
        <p className="text-body text-foreground">
          pyRoad는 많은 사람이 함께 만든 오픈소스 소프트웨어와 글꼴, 소리를 써서
          만들었어요. 만들어 주신 분들께 고마운 마음을 담아, 각 라이선스가 정한
          대로 저작권과 라이선스 전문을 여기에 적습니다.
        </p>
        <nav aria-label="고지 목차">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small">
            {[
              ['runtime', '브라우저 파이썬'],
              ['fonts', '글꼴'],
              ['sounds', '소리'],
              ['npm', `라이브러리 (${npm.count}개)`],
            ].map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="focus-ring inline-flex min-h-9 items-center rounded-md text-primary-text underline underline-offset-4"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <NoticeSection id="runtime" title="브라우저 파이썬">
        <p className="text-small text-muted-foreground">
          코드를 실행하는 파이썬은 내 브라우저 안에서 돌아가는 Pyodide예요.
        </p>
        {runtime.map((n) => (
          <TextNoticeCard key={n.id} notice={n} />
        ))}
      </NoticeSection>

      <NoticeSection id="fonts" title="글꼴">
        {fonts.map((n) => (
          <TextNoticeCard key={n.id} notice={n} />
        ))}
      </NoticeSection>

      <NoticeSection id="sounds" title="소리">
        <p className="text-small text-muted-foreground">
          모두 CC0(퍼블릭 도메인)라 표시 의무는 없지만, 고마운 마음으로 적어요.
        </p>
        <ul className="space-y-3">
          {sounds.map((s) => (
            <li key={s.id} className="rounded-xl bg-surface p-4 shadow-card">
              <p className="font-semibold text-foreground">
                {s.name} — {s.author}
              </p>
              <p className="text-small text-muted-foreground">
                {licenseLabel(s.license)}
              </p>
              <ul className="mt-1 space-y-1 text-small">
                {s.works.map((w) => (
                  <li key={w.url}>
                    <ExtLink href={w.url}>{w.title}</ExtLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </NoticeSection>

      <NoticeSection id="npm" title={`라이브러리 (${npm.count}개)`}>
        <p className="text-small text-muted-foreground">
          앱에 들어가는 npm 패키지를 라이선스별로 묶었어요. 묶음을 누르면
          패키지와 저작권, 라이선스 전문을 볼 수 있어요. 빌드할 때만 쓰는 도구(
          {Object.keys(excluded.buildOnly).join(', ')})와 타입 정의는 앱에
          들어가지 않아 뺐어요.
        </p>
        <div className="space-y-3">
          {npm.groups.map((g) => (
            <NpmGroup key={g.license} group={g} />
          ))}
        </div>
      </NoticeSection>
    </article>
  );
}

function NoticeSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-6 space-y-3"
    >
      <h2 id={`${id}-title`} className="font-display text-h2 text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring inline-flex items-center gap-1 rounded-sm text-primary-text underline underline-offset-4 [overflow-wrap:anywhere]"
    >
      {children}
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">(새 창)</span>
    </a>
  );
}

function FullText({ summary, text }: { summary: string; text: string }) {
  return (
    <details className="group rounded-lg bg-surface-2">
      <summary className="focus-ring flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-small font-semibold text-foreground">
        {summary}
      </summary>
      <pre className="max-h-96 overflow-auto px-3 pb-3 font-mono text-caption whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
        {text}
      </pre>
    </details>
  );
}

function TextNoticeCard({ notice }: { notice: TextNotice }) {
  return (
    <div className="space-y-2 rounded-xl bg-surface p-4 shadow-card">
      <p className="font-semibold text-foreground">
        {notice.name}
        {notice.version && (
          <span className="font-normal text-muted-foreground">
            {' '}
            {notice.version}
          </span>
        )}
      </p>
      {notice.original && (
        <p className="text-small text-muted-foreground">
          원본: {notice.original}
        </p>
      )}
      <p className="text-small text-foreground">
        {licenseLabel(notice.license)}
      </p>
      {notice.copyright.map((c) => (
        <p
          key={c}
          className="text-small text-muted-foreground [overflow-wrap:anywhere]"
        >
          {c}
        </p>
      ))}
      <p className="text-small text-foreground">{notice.note}</p>
      <p className="text-small">
        <ExtLink href={notice.url}>소스·원본 보기</ExtLink>
      </p>
      <FullText summary="라이선스 전문 보기" text={notice.text} />
    </div>
  );
}

function NpmGroup({ group }: { group: NpmLicenseGroup }) {
  const { standardTexts, texts } = LICENSE_DATA.npm;
  const standard = standardTexts[group.license];
  return (
    <details className="rounded-xl bg-surface shadow-card">
      <summary className="focus-ring flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-4 font-semibold text-foreground">
        <span>{licenseLabel(group.license)}</span>
        <span className="text-small font-normal text-muted-foreground">
          {group.packages.length}개
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        {standard && (
          <FullText
            summary={`${licenseLabel(group.license)} 표준 문구`}
            text={standard}
          />
        )}
        <ul className="divide-y divide-line">
          {group.packages.map((p) => (
            <li key={`${p.name}@${p.version}`} className="space-y-1 py-3">
              <p className="text-small">
                <ExtLink href={p.url}>
                  {p.name} {p.version}
                </ExtLink>
              </p>
              {p.copyright.map((c) => (
                <p
                  key={c}
                  className="text-caption text-muted-foreground [overflow-wrap:anywhere]"
                >
                  {c}
                </p>
              ))}
              {p.textId ? (
                <FullText summary="라이선스 전문" text={texts[p.textId]} />
              ) : (
                <p className="text-caption text-muted-foreground">
                  {standard
                    ? '패키지에 라이선스 파일이 없어 위 표준 문구를 따릅니다.'
                    : '패키지에 라이선스 파일이 없어요. 위 저장소에서 확인할 수 있어요.'}
                </p>
              )}
              {p.noticeId && (
                <FullText summary="NOTICE" text={texts[p.noticeId]} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
