# 게시판 기능 설계 스펙

## 개요

사용자 의견 수집을 위한 자유 게시판 페이지를 추가한다. World 페이지 상단 제목 옆에 링크를 배치하고, 클릭 시 게시판으로 이동한다.

## 요구사항

- 자유 게시판 형태 (제목 + 본문 + 댓글)
- 게시글 작성/수정/삭제 (본인 글만)
- 댓글 작성/삭제 (본인 댓글만)
- 최신순 정렬, 페이지네이션 (10개씩)
- 초등학생 대상이므로 단순한 UI

## 접근 방식

서버 컴포넌트 중심. 기존 프로젝트 패턴(world, profile 페이지)과 동일하게 서버 컴포넌트에서 Supabase 직접 조회하고, 인터랙션이 필요한 부분만 클라이언트 컴포넌트로 분리한다.

## 라우팅 구조

```
src/app/(protected)/board/
├── page.tsx              # 게시판 목록 (서버 컴포넌트)
├── create/page.tsx       # 글 작성 (클라이언트 컴포넌트)
└── [postId]/page.tsx     # 글 상세 + 댓글 (서버 + 클라이언트 혼합)
```

## 데이터베이스 스키마

### board_posts

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID FK → users(id) | ON DELETE CASCADE |
| title | TEXT NOT NULL | 게시글 제목 |
| content | TEXT NOT NULL | 게시글 본문 |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

### board_comments

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | gen_random_uuid() |
| post_id | UUID FK → board_posts(id) | ON DELETE CASCADE |
| user_id | UUID FK → users(id) | ON DELETE CASCADE |
| content | TEXT NOT NULL | 댓글 내용 |
| created_at | TIMESTAMPTZ | now() |

### 인덱스

- `idx_board_posts_user_id` ON board_posts(user_id)
- `idx_board_posts_created_at` ON board_posts(created_at DESC)
- `idx_board_comments_post_id` ON board_comments(post_id)
- `idx_board_comments_user_id` ON board_comments(user_id)

### RLS 정책

**board_posts / board_comments 공통:**

- SELECT: `auth.role() = 'authenticated'` (모든 인증 사용자)
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id` (board_posts만)
- DELETE: `auth.uid() = user_id`

## 컴포넌트 구조

```
src/components/board/
├── BoardCard.tsx          # 목록 카드 (서버 컴포넌트)
├── PostDetail.tsx         # 글 상세 표시 (서버 컴포넌트)
├── CreatePostForm.tsx     # 글 작성 폼 ('use client')
├── CommentSection.tsx     # 댓글 목록 + 입력 ('use client')
└── DeletePostButton.tsx   # 삭제 확인 다이얼로그 ('use client')
```

### BoardCard

- 제목, 작성자 display_name, 작성일, 댓글 수 표시
- 클릭 시 `/board/[postId]`로 이동
- 기존 카드 스타일(`rounded-xl border border-border bg-card p-4 shadow-sm`) 재사용

### PostDetail

- 제목, 본문, 작성자, 작성일 표시
- 본인 글일 경우 수정/삭제 버튼 노출

### CreatePostForm

- 제목 input + 본문 textarea
- 제목 최대 100자, 본문 최대 2000자
- 게시 후 목록 페이지로 redirect

### CommentSection

- 댓글 목록 표시 (작성자, 내용, 시간)
- 댓글 입력 textarea + 등록 버튼
- 본인 댓글 삭제 가능

### DeletePostButton

- 기존 AlertDialog 컴포넌트 활용
- 확인 후 API 호출 → 목록으로 redirect

## API 라우트

```
src/app/api/board/
├── posts/route.ts                    # POST: 글 작성
├── posts/[postId]/route.ts           # PATCH: 수정, DELETE: 삭제
├── comments/route.ts                 # POST: 댓글 작성
└── comments/[commentId]/route.ts     # DELETE: 댓글 삭제
```

### POST /api/board/posts

- 인증 확인
- body: `{ title, content }`
- title/content 빈 값 검증
- board_posts에 INSERT
- 생성된 post 반환

### PATCH /api/board/posts/[postId]

- 인증 확인 + 소유권 검증
- body: `{ title?, content? }`
- updated_at을 now()로 갱신

### DELETE /api/board/posts/[postId]

- 인증 확인 + 소유권 검증
- board_posts에서 DELETE (댓글은 CASCADE 삭제)

### POST /api/board/comments

- 인증 확인
- body: `{ post_id, content }`
- post 존재 여부 확인
- board_comments에 INSERT

### DELETE /api/board/comments/[commentId]

- 인증 확인 + 소유권 검증
- board_comments에서 DELETE

## World 페이지 네비게이션 수정

`src/app/(protected)/world/page.tsx` 상단 제목 영역에 게시판 링크 추가:

```tsx
<div className="flex items-center gap-3">
  <h1 className="text-2xl font-bold text-foreground">모험 지도</h1>
  <Link href="/board" className="text-sm text-primary underline">게시판</Link>
</div>
```

## TypeScript 타입

`src/lib/types/database.ts`에 추가:

```typescript
export interface BoardPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface BoardComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface BoardPostWithAuthor extends BoardPost {
  users: { display_name: string; avatar_url: string | null };
  comment_count: number;
}

export interface BoardCommentWithAuthor extends BoardComment {
  users: { display_name: string; avatar_url: string | null };
}
```

## 검증 방법

1. Supabase 마이그레이션 실행 후 테이블/RLS 확인
2. 개발 서버에서 게시판 목록 → 글 작성 → 상세 → 댓글 → 수정 → 삭제 전체 흐름 테스트
3. 다른 사용자의 글/댓글 수정/삭제 시도 시 차단되는지 확인
4. World 페이지에서 게시판 링크 동작 확인
5. `npm run build` 빌드 성공 확인
