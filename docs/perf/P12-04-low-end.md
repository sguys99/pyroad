# P12-04 저사양 기기 테스트 — 헤드리스로 대체 (실기기 미검증)

> - 관련: [계획서](../4.upgrade-plan.md) P12-04 · §2.10 · §12-Q78 · 스파이크 [P0-13](../spikes/P0-13-perf-baseline.md)(시나리오)·[P0-16](../spikes/P0-16-low-spec-detection.md)(임계값)·[P0-15](../spikes/P0-15-sound.md)(사운드) · 이전 기록 [P5-14](P5-14-world-map.md)·[P6-16](P6-16-quest.md)·[lighthouse.md](lighthouse.md)
> - **사용자 결정 (2026-11-16)**: "헤드리스 값으로 완료 처리". 실기기가 없으므로 헤드리스 측정(+ 출시 뒤 텔레메트리)만으로 임계값을 정하고 항목을 닫는다. 실기기로만 확인할 수 있는 것은 **미검증**으로 남기고 [v1.0 실기기 체크리스트](../release/v1.0-devices.md)로 모았다
> - 측정: 2026-11-17, 로컬 macOS arm64(Apple M5 10코어, 16GB), 헤드리스 Chromium(Playwright, GPU 없음 = 소프트웨어 합성), 앱 코드 `f85d06f`, e2e env 운영 빌드(`next build` + `next start`), 로컬 Supabase. load 1.3~3.3. 장면마다 새 사용자·새 컨텍스트, 3회 중앙값. `caffeinate -i`로 감쌈

## 1. 결론

- **P0-16 임계값 유지**: 놓친 프레임 25% · 끊김 4개 · 첫 3초 중 2초 / 이후 4초 중 3초. 근거는 §3. 바꿀 근거가 될 실측(실기기·텔레메트리)이 아직 없고, 헤드리스에서는 임계값이 §2.10 예산이 깨지는 지점과 맞게 작동했다
- **이 장비의 헤드리스 CPU 1·4·6배에서는 세 장면 모두 예산 안이고 연출 단계가 한 번도 내려가지 않았다.** 지금 앱이 가벼워졌고(P5-14·P6-13·P6-16) 장비가 빠르기 때문이다(P0-13 장비보다 훨씬 빠름). 그래서 "헤드리스 4배·6배 ≈ 어떤 기기"는 **미정**이다 — 같은 배율이라도 장비마다 기준 속도가 다르고, 이 장비를 실기기와 이어 줄 공개 벤치마크 측정을 하지 않았다
- 단계가 실제로 내려가는 지점을 보려고 **10·20배**를 참고로 더 쟀다: 지도를 계속 훑는 동안 20배에서만 full → lite(4.6~4.7초, 3/3), 그 뒤 흔들림 없음
- 월드맵 Lighthouse LCP 경고는 원인을 찾았으나 **작게 고칠 수 있는 것이 아니라** 고치지 않았다(§6)

## 2. 시나리오 × CPU 배율 (P0-13 장면, 중앙값)

| 장면 | 지표 | 1배 | 4배 | 6배 | 예산 (§2.10) |
|---|---|---:|---:|---:|---|
| 퀘스트 1-1 첫 방문 (`perf:quest`, 412×823) | "코드 돌려보기!" 켜질 때까지 | 1.19초 (다시 열기 1.00초) | 1.54초 | 1.91초 | 1배 3초·다시 열기 2초 |
| | TBT(관측, FCP → 활성) | — | 85ms | 226ms | 800ms (4배) |
| 월드맵 대기 5초 (`perf:world`, 820×1180 DPR 2, full) | 메인 스레드 바쁨 · rAF | 2.6% · 60fps | 1.2% · 60fps | 1.3% · 60fps | 50% (4배) |
| 월드맵 스크롤 (터치 800px/s 위아래 2번, full) | rAF p95 · rAF fps · 컴포지터 | 17.2ms · 60 · 59.9 | 17.6ms · 60 · 59.9 | 17.6ms · 59.6 · 59.9 | p95 33ms·컴포지터 50fps (4배) |
| 축하 오버레이 A (`perf:celebration`, 정답 실행부터 7초, full) | rAF p95 · 롱태스크 합 · 바쁨 | 17.4ms · 0ms · 7.6% | 17.6ms · 0ms · 11.1% | 17.6ms · 0ms · 16.3% | p95 50ms·롱태스크 500ms (4배) |
| 축하 오버레이 B (다음 카드 5초) | rAF p95 · 바쁨 | 17.5ms · 3.2% | 17.4ms · 1.5% | 17.4ms · 2.6% | 같음 |

- lite·minimal·동작 줄이기도 모든 배율에서 60fps 근처(원본: `build/perf/p12-04/*.json`, 커밋하지 않음). 6배 축하 A의 롱태스크는 세 번 중 한 번 50ms 한 개
- 월드맵 대기 1배가 4배보다 높게 나온 것은 CDP `TaskDuration` 집계 잡음 수준(모두 예산의 1/15 이하)
- 축하 B에서 rAF fps 120이 섞이는 회차가 있음(헤드리스 rAF 이중 호출, p95는 정상) — 판정은 p95로

**참고: 10·20배** (월드맵 `perf:world -- --rates 10,20`)

| 배율 | 대기 바쁨 | 스크롤 full rAF p95 · fps | 스크롤 lite rAF p95 · fps | 컴포지터 (full) |
|---|---:|---|---|---:|
| 10배 | 2.6% | **33.9ms · 45fps** (놓친 프레임 약 25%) | 17.6ms · 60 | 59.9 |
| 20배 | 3.2% | **51.0ms · 29fps** (약 52%) | 17.6ms · 59 | 59.9 |

대기는 20배에서도 바쁘지 않습니다(앰비언트는 컴포지터). 메인 스레드를 쓰는 것은 full의 **패럴랙스 스크롤**이고, 10배에서 rAF p95가 §2.10 예산(33ms) 경계, 20배에서 확실히 넘습니다. lite(패럴랙스 끔)는 20배에서도 60fps입니다.

## 3. 자동 연출 단계 정착

| 조건 | 배율 | 프로필 (`hardwareConcurrency`/`deviceMemory` 덮어쓰기) | 결과 (각 3회) | 정착 |
|---|---|---|---|---|
| 지도 가만히 15초 (`perf:world` detect, MutationObserver로 `<html data-motion>` 변화 기록) | 1·4·6·10·20배 | pc(그대로) | full ×15 | 첫 페인트 전(부트 스크립트), 이후 변화 0 |
| | | chromebook(2/4) · weak(2/2) | lite ×30 | 첫 페인트 전(정적 추정), 이후 변화 0 |
| | | tiny(4/1) | minimal ×15 | 첫 페인트 전, 이후 변화 0 |
| 지도를 15초 동안 계속 위아래로 훑음 (스크래치 스크립트, 태블릿) | 4·6·10배 | pc | full ×9 | 변화 0 |
| | **20배** | pc | **full → lite ×3** | **4.6 · 4.6 · 4.7초**, 그 뒤 15초까지 변화 0 |

- 60회 + 12회 모두 정적 추정(상한) 이하에서 끝났고(`tierOk`), **세션 중 오르내림(히스테리시스) 0회** — 설계상 하향만 하고(세션 중 상향 없음) 바뀐 직후 1.5초 창을 버리며, 이번 측정에서도 lite로 내린 뒤 다시 바뀐 적이 없음
- 20배 4.6초 = 첫 페이지 로드 동안의 창(하이드레이션) + 스크롤로 나쁜 창 2~3개 + 판정. P0-16 스파이크의 full → lite 2.5~3.5초보다 조금 길다(로드 구간 포함)
- iOS 저전력 모드(rAF 30fps 고정 → 30Hz 판정으로 lite)는 헤드리스로 재현 불가(단위 테스트 `detect.test.ts`가 합성 30Hz 기록으로만 확인) → **실기기 미검증**, 체크리스트 R-22

## 4. 임계값 결정: 유지

| 근거 | 내용 |
|---|---|
| 오판(괜히 내림) 없음 | 대기 60회(1~20배)·스크롤 9회(4~10배) 동안 실측 하향 0회. 한두 번의 로딩·하이드레이션 긴 작업으로 내려가지 않음 (P0-16 §4.4와 같음) |
| 필요할 때는 내림 | 예산이 확실히 깨지는 20배 스크롤(놓친 프레임 약 52%)에서 3/3 lite, 4.6초 안. lite는 그 배율에서 60fps → 내린 결과가 맞음 |
| 경계가 예산과 맞음 | 25%는 10배 스크롤(rAF 45fps, p95 33.9ms = §2.10 예산 경계)과 같은 자리. 25%를 낮추면(예: 15%) 컴포지터는 60fps인데 rAF만 조금 느린 기기를 내리고, 높이면(예: 40%) 20배처럼 rAF 29fps인 기기를 full에 남길 위험 |
| 흔들림 없음 | 하향만이라 히스테리시스 문제 자체가 없음, 측정에서도 0회 |
| 바꿀 근거 없음 | 실기기 측정·운영 텔레메트리가 아직 없음. 헤드리스 소프트웨어 합성은 GPU·래스터·Worker 속도가 실기기와 달라(P0-13) 숫자를 미세 조정할 근거가 못 됨 |

**출시 뒤 다시 볼 기준 (P12-14 회고)**: 아래 SQL ①에서 태블릿·모바일의 **자동 하향 비율이 로그인 학생의 30%를 넘거나**, ②에서 **하향된 학생 중 10% 넘게 직접 "풍성하게"로 되돌리면** 너무 민감 → 놓친 프레임 25% → 33% 검토. 반대로 하향이 거의 없는데 설정에서 "가볍게·최소로"를 직접 고르는 학생이 많으면 너무 둔감 → 20% 검토. 실기기 체크리스트 R-15·R-22 결과가 오면 함께 본다.

## 5. 헤드리스 배율 ↔ 실기기

| 기기 | 퀘스트 1-1 활성 (R-11) | 헤드리스 대응 배율 |
|---|---:|---|
| 학교 크롬북 | 미측정 | **미정** |
| 구형 안드로이드 태블릿 | 미측정 | **미정** |
| 구형 iPad | 미측정 | **미정** |

- 실기기 값이 오면: 이 장비 헤드리스 "활성까지" 1배 1.19초 · 4배 1.54초 · 6배 1.91초 사이(또는 바깥)에 놓아 배율을 정한다. 활성 시간은 Pyodide 다운로드·Worker 준비가 섞여 CPU 배율에 선형이 아니므로(1배 → 6배 1.6배만 늘어남) **스크롤 끊김(R-13)·단계 이름(R-15)과 함께** 본다
- 공개 벤치마크(예: Speedometer)로 "4배 ≈ 셀러론급"을 추정하는 방법도 있으나, 이 장비에서 같은 벤치마크를 같은 배율로 재지 않았으므로 적지 않는다

## 6. 월드맵 Lighthouse LCP 경고 (Perf 77, 시뮬레이션 LCP 6.5초)

**원인** (관측 측정: 스크래치 스크립트로 Slow 4G 150ms·1.6Mbps + CPU 4배, 412×823, 3회)

| | 빠른 회선 (CPU 4배만) | Slow 4G + CPU 4배 |
|---|---:|---:|
| FCP (머리 제목) | 0.42~0.84초 | 1.26~1.33초 |
| 첫 LCP 후보 = 지도 종이 결(`div.world-map` 배경 `paper-fiber.v1.png`, 7KB) | 0.48~0.94초 | **4.0~4.1초** |
| 마지막 LCP 후보 (같은 요소, 화면에 보이는 넓이가 커짐) | — | 5.2초 (3회 중 1회) |
| 글꼴 조각 22개 475KB 끝 | 0.42~0.84초 | 4.3~4.4초 |
| JS 24개 315KB 끝 | 0.58~1.04초 | 5.7~5.8초 |

1. **preload 문제가 아님**: 앱 화면에는 글꼴 preload가 없다(postbuild `check-build.mjs`가 막음). 글꼴 22개는 지도·HUD·머리에 **실제로 그린 한글 글자**가 `unicode-range` 조각을 부른 것(Jua 10 · pyRoad Sans 12). 단, 그린 글자 중 Jua 49자 가운데 25자, pyRoad Sans 112자 가운데 37자는 **화면 밖(3화면 아래)이나 visibility:hidden 요소에만** 있다 — 조각 수를 줄일 여지는 여기
2. **LCP 요소는 7KB 배경 그림**이고, CSS를 읽은 뒤에야 발견되어 저속 회선에서 글꼴 475KB·JS 315KB와 대역폭을 나눠 4초에 그려진다. Lighthouse(lantern)는 관측 LCP 전에 시작한 요청을 모두 LCP 경로로 보고 1.6Mbps로 늘려 6.5초가 된다
3. **고쳐 본 것 (되돌림)**: 이 그림을 `react-dom` `preload(…, { fetchPriority: 'high' })`로 HTML 머리에서 먼저 받게 하면 첫 LCP 후보가 FCP와 같은 1.3초로 당겨졌지만, **3회 중 2회는 하이드레이션 뒤 `WorldMap`의 지금 위치 스크롤(`scrollToCurrent`)이 지도를 더 넓게 보이게 해 새 LCP 후보가 5.2초**에 다시 생겼고, Lighthouse는 Perf 75(74~77)·LCP 6.47초로 그대로였다. 지표가 안 움직이고 화면 차이(종이 결이 그 전엔 단색 바탕)도 작아 B-ID로 커밋하지 않았다

**제안 (작지 않음, 사용자 판단)**: ① 지금 위치 스크롤을 하이드레이션 전에(부트 스크립트처럼 인라인으로) 하거나 서버가 처음부터 그 자리를 그리게 해 LCP가 JS를 기다리지 않게 + 위 preload ② 화면 밖·숨은 요소(닫힌 시트·다음 책 등)의 글자를 첫 화면 뒤에 그리게 해 Jua 조각 수를 줄임 ③ 월드맵 경고 문턱을 시뮬레이션 대신 관측 LCP로 보기. ①+preload가 저속 회선 체감(지도 결이 늦게 뜸, 첫 자리 잡기 늦음)에 가장 직접적

## 7. 미검증 (실기기로만, [체크리스트](../release/v1.0-devices.md))

| 항목 | 헤드리스·코드로 확인한 것 | 체크리스트 |
|---|---|---|
| 헤드리스 배율 ↔ 크롬북·안드로이드 태블릿·iPad | 없음(미정) | R-11~R-16 |
| 중급 안드로이드 태블릿 지도 스크롤 50fps (P5-14 완료 기준) | 하네스 게이트만(4배 컴포지터 59.9fps·rAF p95 17.6ms) | R-13 |
| iOS 저전력 모드 → lite | 단위 테스트(합성 30Hz 기록 → lite)만 | R-22 |
| iPadOS 15~17.3 AAC 폴백 | **단위 테스트 추가**: WebM을 `canPlayType`이 거절하거나 디코드가 실패하면 `.m4a`로 재생(`webAudioEngine.test.ts`). 매니페스트 순서 WebM → AAC는 `manifest.test.ts` | R-31 |
| BGM 버퍼 메모리(곡당 약 26MB) | "지금 곡만 보관, 이전 곡은 페이드 뒤 버림"은 단위 테스트(`webAudioEngine.test.ts`). 실제 메모리·디코드 시간은 미검증(디코드는 메인 스레드 밖이라 CPU 스로틀로 재현 불가, P0-15) | R-32 |
| 블루투스 이어폰 지연 | "출력 지연이 크면 대사 블립만 끔"은 단위 테스트 | R-33 |
| iOS 홈 화면 앱 로그인 유지·OAuth 복귀 (P4-11) | 없음 | R-41·R-42 |
| iOS `input()` (P0-05) | Chromium e2e만 (`project-quest` 등) | R-43 |
| Windows 맑은 고딕 폴백·14px D2Coding (P2-10), browserslist(Q46), 예비 Worker(Q74 ②) | 판단 보류 그대로 — 실기기 결과가 오면 다시 봄 | (해당 기기가 생기면) |

## 8. 텔레메트리 (운영 SQL Editor, 읽기 전용)

`motion_tier_change`는 **바뀔 때만** 보냅니다. 정적 추정으로 처음부터 lite·minimal인 기기와 계속 full인 기기는 이벤트가 없으므로, 분모는 같은 기간에 브라우저 이벤트를 보낸 로그인 학생 수로 잡습니다(정적 추정 분포는 알 수 없음 — 한계). 기존 [analytics.md](../analytics.md) SQL 7(원인·기기별 횟수·정착 시간 중앙값)과 함께 봅니다.

```sql
-- ① 기기 유형별 자동 하향 비율과 정착 시간 (최근 28일, 로그인 학생)
with active as (
  select device, count(distinct anon_id) as ids
    from public.analytics_events
   where occurred_at >= now() - interval '28 days' and source = 'client' and actor = 'user'
   group by 1),
down as (
  select device, anon_id,
         bool_or(props->>'to' = 'minimal') as to_minimal,
         min((props->>'elapsed_s')::int) as first_s
    from public.analytics_events
   where name = 'motion_tier_change' and props->>'cause' = 'measured' and actor = 'user'
     and occurred_at >= now() - interval '28 days'
   group by 1, 2)
select a.device, a.ids as active_ids,
       count(d.anon_id) as downgraded_ids,
       round(100.0 * count(d.anon_id) / nullif(a.ids, 0), 1) as downgraded_pct,
       count(d.anon_id) filter (where d.to_minimal) as to_minimal_ids,
       percentile_cont(0.5) within group (order by d.first_s) as median_first_s,
       percentile_cont(0.9) within group (order by d.first_s) as p90_first_s
  from active a left join down d using (device)
 group by a.device, a.ids order by a.ids desc;

-- ② 자동 하향 뒤 학생이 직접 되돌렸나 (너무 민감하다는 신호, 최근 28일)
with m as (
  select anon_id, device, min(occurred_at) as at
    from public.analytics_events
   where name = 'motion_tier_change' and props->>'cause' = 'measured' and actor = 'user'
     and occurred_at >= now() - interval '28 days'
   group by 1, 2)
select m.device, count(*) as downgraded_ids,
       count(*) filter (where exists (
         select 1 from public.analytics_events u
          where u.anon_id = m.anon_id and u.name = 'motion_tier_change'
            and u.props->>'cause' = 'user' and u.occurred_at > m.at
            and (u.props->>'setting' = 'full' or u.props->>'to' = 'full'))) as back_to_full_ids
  from m group by 1 order by 2 desc;

-- ③ 학생이 직접 고른 움직임 설정 분포 (둔감하다는 신호, 최근 28일)
select device, props->>'setting' as setting, count(distinct anon_id) as ids
  from public.analytics_events
 where name = 'motion_tier_change' and props->>'cause' = 'user' and actor = 'user'
   and occurred_at >= now() - interval '28 days'
 group by 1, 2 order by 1, 3 desc;
```

## 9. 재현

```bash
npm run db:start
caffeinate -i npm run perf:world -- --build --rates 1,4,6        # 대기(4배 + 1·6배 full)·스크롤·단계(× runs회, 15초 변화 기록)
caffeinate -i npm run perf:world -- --rates 10,20                # 참고 배율
caffeinate -i npm run perf:quest -- --rate 4                      # 1배 첫 방문·다시 열기 + 4배 (기본)
caffeinate -i npm run perf:quest -- --rate 6                      # 6배는 참고(예산 판정은 4배 기준)
for r in 1 4 6; do caffeinate -i npm run perf:celebration -- --rate $r; done
```

"지도를 계속 훑는 동안의 단계"와 §6의 Slow 4G 관측은 일회성 스크래치 스크립트로 쟀다(저장소에 넣지 않음). 다시 잴 일이 생기면 `world-map-bench.ts`의 detect에 스크롤 옵션을 더하는 것이 가장 작다.

## 10. 한계

- 실기기 0대. GPU 없는 소프트웨어 합성, CDP CPU 스로틀은 메인 스레드에만 걸림(Worker·래스터·디코드는 그대로)
- 이 장비는 P0-13·P0-16 장비보다 훨씬 빨라 같은 "4배"라도 그때보다 가벼운 기기를 흉내 낸다 — 배율 숫자를 기기 등급으로 읽지 말 것
- 텔레메트리는 출시 전이라 운영 데이터 없음(쿼리만 준비)
