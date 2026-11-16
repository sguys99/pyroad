-- ============================================================
-- 00056 되돌리기: 작품 자랑 카드   (P11-08)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P11-08 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: 작품 자랑 카드(kind = 'creation') 행 전부 — 보낸 링크는 404. 다른 4종 카드는 그대로
-- 실행 후 상태 = 00055 까지 적용된 상태 (share_card_public 은 00043 정의로)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00056_creation_share_card.rollback.sql
-- ============================================================

DROP TRIGGER IF EXISTS sync_creation_share_cards ON public.creations;
DROP TRIGGER IF EXISTS share_cards_creation_guard ON public.share_cards;
DROP FUNCTION IF EXISTS public.sync_creation_share_cards();
DROP FUNCTION IF EXISTS public.share_cards_creation_guard();
DROP FUNCTION IF EXISTS public.create_creation_share_card(UUID, UUID);
DROP FUNCTION IF EXISTS public.share_card_creation_thumbnail(TEXT);
DROP INDEX IF EXISTS public.share_cards_creation_idx;

DELETE FROM public.share_cards WHERE kind = 'creation';

ALTER TABLE public.share_cards DROP CONSTRAINT IF EXISTS share_cards_kind_check;
ALTER TABLE public.share_cards ADD CONSTRAINT share_cards_kind_check
  CHECK (kind IN ('levelup', 'stage', 'achievement', 'weekly'));
ALTER TABLE public.share_cards DROP CONSTRAINT IF EXISTS share_cards_snapshot_check;
ALTER TABLE public.share_cards ADD CONSTRAINT share_cards_snapshot_check CHECK (
  pg_catalog.jsonb_typeof(snapshot) = 'object'
  AND snapshot ? 'nickname'
  AND snapshot - ARRAY['nickname', 'avatar', 'world', 'level', 'worldName', 'stageNo', 'stageName', 'stars',
                       'maxStars', 'name', 'desc', 'tier', 'icon', 'weekLabel', 'quests', 'xp'] = '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.share_card_public(p_id TEXT)
RETURNS TABLE (id TEXT, kind TEXT, snapshot JSONB, version INTEGER, expires_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.kind, c.snapshot, c.version, c.expires_at
    FROM public.share_cards c
   WHERE c.id = p_id AND c.is_public AND c.expires_at > NOW();
$$;

DO $$
BEGIN
  RAISE NOTICE '[00056 rollback] 작품 자랑 카드 함수·트리거·행 삭제, share_cards CHECK·share_card_public 00043 으로';
END $$;
