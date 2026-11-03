측정 2026-11-03T12:01:57.386Z

#### ① 기준선: 단계를 고정했을 때 장면 성능 (중앙값, 놓친 프레임 %)

| 장면 | 스로틀 | full fps / 놓침 | lite fps / 놓침 | minimal fps / 놓침 | 정답 단계 |
|---|---|---:|---:|---:|---|
| heavy | 1× | 54 / 9% | 60 / 0% | 60 / 0% | **full** |
| heavy | 4× | 41 / 32% | 59 / 1% | 60 / 0% | **lite** |
| heavy | 6× | 33 / 45% | 23 / 61% | 55 / 8% | **minimal** |
| heavy | 10× | 15 / 75% | 19 / 69% | 47 / 22% | **minimal** |
| light | 1× | 60 / 0% | 60 / 0% | 60 / 0% | **full** |
| light | 4× | 48 / 20% | 58 / 3% | 60 / 0% | **full** |
| light | 6× | 44 / 26% | 57 / 6% | 57 / 4% | **lite** |
| light | 10× | 23 / 62% | 24 / 60% | 46 / 23% | **minimal** |

#### ② 자동 감지 (각 3회 반복)

| 장면 | 프로필 | 스로틀 | 기대 단계 | 결과 (반복별) | 정착 시간 ms (중앙값) | 일치 |
|---|---|---|---|---|---:|---|
| heavy | pc | 1× | full | full, full, lite | 0 | 2/3 |
| heavy | chromebook | 1× | lite | lite, lite, lite | 84 | 3/3 |
| heavy | weak | 1× | lite | lite, lite, lite | 64 | 3/3 |
| heavy | ipad | 1× | full | lite, full, full | 0 | 2/3 |
| light | pc | 1× | full | full, full, full | 0 | 3/3 |
| heavy | pc | 4× | lite | lite, lite, lite | 2661 | 3/3 |
| heavy | chromebook | 4× | lite | lite, lite, lite | 468 | 3/3 |
| heavy | weak | 4× | lite | lite, lite, minimal | 545 | 2/3 |
| heavy | ipad | 4× | lite | lite, full, full | 0 | 1/3 |
| light | pc | 4× | full | lite, full, full | 0 | 2/3 |
| heavy | pc | 6× | minimal | lite, lite, minimal | 2798 | 1/3 |
| heavy | chromebook | 6× | minimal | minimal, lite, minimal | 2796 | 2/3 |
| heavy | weak | 6× | minimal | minimal, lite, minimal | 2789 | 2/3 |
| heavy | ipad | 6× | minimal | minimal, lite, lite | 2812 | 1/3 |
| light | pc | 6× | lite | minimal, full, lite | 3551 | 1/3 |
| heavy | pc | 10× | minimal | minimal, lite, lite | 3007 | 1/3 |
| heavy | chromebook | 10× | minimal | minimal, minimal, minimal | 3402 | 3/3 |
| heavy | weak | 10× | minimal | minimal, minimal, minimal | 3012 | 3/3 |
| heavy | ipad | 10× | minimal | minimal, minimal, minimal | 7172 | 3/3 |
| light | pc | 10× | minimal | minimal, lite, minimal | 6082 | 2/3 |

**정착 후 실제로 매끄러웠나** (감지가 끝난 뒤 3초 동안 놓친 프레임 ≤ 25%): 51/60 (85%) — 1× 15/15, 4× 14/15, 6× 14/15, 10× 8/15

일치 43/60 (72%), 기대보다 낮게 5, 높게 12, 세션 중 상향 0회. 단계가 바뀐 실행의 정착 시간 중앙값 2860ms [56–12042]

#### ③ 긴 작업 주입 (1×, light 장면: 3초에 400ms + 6·7·8초에 150ms)

| 긴 작업 | 결과 (반복별) |
|---|---|
| 없음 | full / full / full |
| 있음 | full / full / full |

#### ④ 정적 신호

| 조건 | 단계 기록 | html data-* |
|---|---|---|
| reduced-motion | full | motion=full, reduced=true |
| saveData | full→lite | motion=lite, reduced=false |
| weak(hc2,dm2) | full→lite | motion=lite, reduced=false |
| ipad UA (hc4) | full | motion=full, reduced=false |
