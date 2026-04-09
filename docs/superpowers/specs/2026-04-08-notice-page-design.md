# 공지사항(Notice) 페이지 설계

## 배경

pyRoad는 초등학생 대상 Python 학습 플랫폼으로, 관리자가 사용자에게 공지사항을 전달할 수 있는 기능이 필요하다. 랜딩 페이지 방문자(비로그인)와 로그인 사용자 모두 공지사항을 읽을 수 있어야 하며, 관리자(sguys99@gmail.com)만 작성/수정/삭제할 수 있어야 한다.

## 설계 결정

- **별도 `notices` 테이블** 생성 (Board와 분리) — RLS 정책이 근본적으로 다름 (비로그인 조회 vs 인증 필수)
- **관리자 식별**: 환경변수 `ADMIN_EMAIL` 하드코딩 방식
- **댓글 없음** — 일방향 공지 전달

---

## 1. DB 마이그레이션

파일: `supabase/migrations/00002_notices.sql`

### 테이블

```sql
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notices_created_at ON public.notices(created_at DESC);
```

### RLS 정책

```sql
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 (anon + authenticated)
CREATE POLICY "notices_select_public" ON public.notices
  FOR SELECT USING (true);

-- 인증 사용자만 쓰기 (관리자 검증은 API에서)
CREATE POLICY "notices_insert_authenticated" ON public.notices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notices_update_own" ON public.notices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notices_delete_own" ON public.notices
  FOR DELETE USING (auth.uid() = user_id);
```

핵심 차이: `board_posts`는 `auth.role() = 'authenticated'`로 SELECT를 제한하지만, `notices`는 `USING (true)`로 비로그인 사용자도 읽을 수 있도록 한다.

---

## 2. 환경변수

`.env.example`과 `.env.local`에 추가:

```
ADMIN_EMAIL=sguys99@gmail.com
```

서버 전용 변수 (`NEXT_PUBLIC_` 접두사 없음). Vercel 배포 시에도 설정 필요.

---

## 3. 관리자 검증 유틸리티

파일: `src/lib/admin.ts`

```typescript
import { getAuthUser } from '@/lib/supabase/auth';

export async function isAdmin(): Promise<boolean> {
  const { user } = await getAuthUser();
  if (!user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}
```

`getAuthUser()`가 `React.cache`로 래핑되어 있으므로 동일 요청에서 여러 번 호출해도 Auth 요청 1회만 발생.

---

## 4. 타입 정의

파일: `src/lib/types/database.ts`에 추가

```typescript
export interface Notice {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}
```

작성자 프로필 조인 불필요 (관리자 한 명만 작성).

---

## 5. API 라우트

기존 Board API 패턴 기반, 소유권 검증 → 관리자 이메일 검증으로 대체.

### 5-1. `src/app/api/notice/route.ts` — GET + POST

**GET**: 인증 불필요. `createClient()`로 anon key 접근, `notices` 테이블 조회. 페이지네이션 지원 (`?page=N`, 10개/페이지).

**POST**: `getAuthUser()` → `user.email === process.env.ADMIN_EMAIL` 검증. 아니면 403. 입력 검증: title 100자, content 5000자.

### 5-2. `src/app/api/notice/[noticeId]/route.ts` — PATCH + DELETE

Board의 `[postId]/route.ts` 패턴 기반. 소유권 검증 대신 관리자 이메일 검증:

```typescript
// Board: post.user_id !== user.id → 403
// Notice: user.email !== process.env.ADMIN_EMAIL → 403
```

---

## 6. 페이지 라우트

`/notice`는 `(protected)` 라우트 그룹 **바깥**에 배치 → 미들웨어 수정 불필요.

### 6-1. `src/app/notice/page.tsx` — 목록

- 서버 컴포넌트
- `createClient()`로 notices 조회 (비로그인도 가능)
- `getAuthUser()`로 로그인 상태 확인 (redirect 하지 않음)
- 관리자면 "공지 작성" 버튼 노출
- 뒤로가기: 로그인 상태면 `/world`, 비로그인이면 `/`
- 페이지네이션 (Board 패턴 동일)

### 6-2. `src/app/notice/[noticeId]/page.tsx` — 상세

- 서버 컴포넌트
- 비로그인 허용
- 관리자면 수정/삭제 버튼 노출
- 댓글 섹션 없음

### 6-3. `src/app/notice/create/page.tsx` — 작성

- 서버 컴포넌트에서 `isAdmin()` 검증 → 실패 시 `/notice`로 redirect
- `CreateNoticeForm` 렌더링

### 6-4. `src/app/notice/[noticeId]/edit/page.tsx` — 수정

- `isAdmin()` 검증 → 실패 시 redirect
- 기존 데이터 로드 후 `CreateNoticeForm`에 `initialData` 전달

---

## 7. 컴포넌트

디렉토리: `src/components/notice/`

### 7-1. `NoticeCard.tsx`

Board의 `BoardCard.tsx` 기반, 간소화:
- 댓글 카운트 제거
- 작성자 이름 대신 "관리자" 표시 (또는 생략)
- 링크: `/notice/[id]`

### 7-2. `NoticeDetail.tsx`

Board의 `PostDetail.tsx` 기반:
- `isOwner` prop → `isAdmin` prop
- 수정 링크: `/notice/[id]/edit`
- `DeleteNoticeButton` 사용
- 댓글 섹션 없음

### 7-3. `CreateNoticeForm.tsx`

Board의 `CreatePostForm.tsx` 기반:
- API 엔드포인트: `/api/notice`, `/api/notice/[id]`
- 리다이렉트: `/notice`, `/notice/[id]`
- content maxLength: 5000 (공지는 더 긴 내용 허용)

### 7-4. `DeleteNoticeButton.tsx`

Board의 `DeletePostButton.tsx` 기반:
- API 엔드포인트: `/api/notice/[id]`
- 삭제 후 `/notice`로 redirect
- 다이얼로그: "이 공지사항을 삭제하시겠습니까? 복구할 수 없습니다."

---

## 8. 진입점 수정

### 8-1. `src/components/landing/LandingHeader.tsx`

About 링크와 GitHub 링크 사이에 "공지사항" 링크 추가:

```tsx
<Link
  href="/notice"
  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[13px] text-muted-foreground hover:text-foreground transition-colors"
>
  공지사항
</Link>
```

### 8-2. `src/app/(protected)/world/page.tsx`

게시판 버튼 옆에 공지사항 버튼 추가 (Bell 아이콘, lucide-react):

```tsx
<Link
  href="/notice"
  aria-label="공지사항"
  className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-primary/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
>
  <Bell className="h-4 w-4" />
  <span className="hidden sm:inline">공지사항</span>
</Link>
```

---

## 9. 미들웨어

수정 불필요. 현재 보호 경로 목록:

```typescript
const protectedPaths = ['/world', '/quest', '/profile', '/board', '/settings'];
```

`/notice`는 포함되지 않으므로 비로그인 사용자도 자연스럽게 접근 가능.

---

## 10. 파일 목록

### 신규 생성

| 파일 | 용도 |
|------|------|
| `supabase/migrations/00002_notices.sql` | DB 마이그레이션 |
| `src/lib/admin.ts` | 관리자 검증 유틸리티 |
| `src/app/api/notice/route.ts` | GET (목록) + POST (작성) |
| `src/app/api/notice/[noticeId]/route.ts` | PATCH (수정) + DELETE (삭제) |
| `src/app/notice/page.tsx` | 공지 목록 페이지 |
| `src/app/notice/[noticeId]/page.tsx` | 공지 상세 페이지 |
| `src/app/notice/create/page.tsx` | 공지 작성 페이지 |
| `src/app/notice/[noticeId]/edit/page.tsx` | 공지 수정 페이지 |
| `src/components/notice/NoticeCard.tsx` | 공지 카드 컴포넌트 |
| `src/components/notice/NoticeDetail.tsx` | 공지 상세 컴포넌트 |
| `src/components/notice/CreateNoticeForm.tsx` | 공지 작성/수정 폼 |
| `src/components/notice/DeleteNoticeButton.tsx` | 공지 삭제 버튼 |

### 수정

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/types/database.ts` | `Notice` 인터페이스 추가 |
| `src/components/landing/LandingHeader.tsx` | 공지사항 링크 추가 |
| `src/app/(protected)/world/page.tsx` | 공지사항 버튼 추가 |
| `.env.example` | `ADMIN_EMAIL` 추가 |

---

## 11. 검증 방법

1. **DB 마이그레이션**: Supabase CLI로 `supabase db push` 또는 Dashboard에서 마이그레이션 적용 확인
2. **비로그인 조회**: 시크릿 모드에서 `/notice` 접근 → 공지 목록 표시 확인
3. **관리자 CRUD**: sguys99@gmail.com 로그인 → 작성/수정/삭제 버튼 노출 및 동작 확인
4. **비관리자 접근 제한**: 다른 계정 로그인 → 작성/수정/삭제 버튼 미노출, API 직접 호출 시 403 확인
5. **진입점**: 랜딩 헤더 "공지사항" 클릭 → `/notice` 이동, World 페이지 Bell 버튼 → `/notice` 이동
6. **빌드**: `npm run build` 성공 확인
7. **린트**: `npm run lint` 통과 확인
