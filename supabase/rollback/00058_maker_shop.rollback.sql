-- ============================================================
-- 00058 되돌리기: 메이커 상점 물건 4종을 그만 팔기   (P11-14)
-- 마이그레이션 실행 대상이 아님. 산 학생의 인벤토리·꾸민 모습(avatar_config·settings)에 id 가 남으므로 지우지 않고 is_active = false
-- (이전 앱은 모르는 id 를 버리고 그림), 이미 쓴 코인은 그대로
-- ============================================================

UPDATE public.shop_items SET is_active = false
 WHERE id IN ('hat_beret', 'hat_detective', 'theme_arcade', 'pet_neurit');
