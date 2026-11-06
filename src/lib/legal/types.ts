/**
 * 약관·개인정보처리방침 문서 구조 (P3-14). 내용은 `terms.ts`·`privacy.ts`, 화면은 `src/components/legal/LegalDocumentView.tsx`.
 * 문서를 데이터로 두면 온보딩(P3-11)·보호자 동의(P3-15) 화면이 같은 버전·요약을 함께 쓸 수 있다.
 */

/** 글 조각: 그냥 글자 또는 링크 */
export type LegalInline = string | { text: string; href: string };

export type LegalBlock =
  | { type: 'p'; content: LegalInline | LegalInline[] }
  | { type: 'ul' | 'ol'; items: (LegalInline | LegalInline[])[] }
  | {
      type: 'table';
      /** 표 이름 (스크린 리더 caption) */
      caption: string;
      head: string[];
      rows: (LegalInline | LegalInline[])[][];
    }
  /** 덧붙임 안내 (조금 작은 글자) */
  | { type: 'note'; content: LegalInline | LegalInline[] };

export interface LegalSection {
  /** 목차 anchor (영문 소문자·숫자·하이픈) */
  id: string;
  /** 예: "제1조 (목적)" 또는 "1. 개인정보의 처리 목적" */
  title: string;
  blocks: LegalBlock[];
}

export interface LegalRevision {
  /** YYYY-MM-DD */
  date: string;
  note: string;
}

export interface LegalDocument {
  kind: 'terms' | 'privacy';
  title: string;
  /** 동의 기록에 남기는 버전 (YYYY-MM-DD) */
  version: string;
  /** 시행일 (YYYY-MM-DD) */
  effectiveDate: string;
  /** 아이용 "쉬운 말 요약" (5~7줄). 법적 효력은 본문에 있다 */
  summary: string[];
  /** 본문 앞 머리말 */
  preamble: LegalBlock[];
  sections: LegalSection[];
  /** 개정 이력 (최신이 위) */
  history: LegalRevision[];
}
