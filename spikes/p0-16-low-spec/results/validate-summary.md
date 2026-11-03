측정 2026-11-03T12:50:02.647Z

#### ① 기준선: 단계를 고정했을 때 장면 성능 (중앙값, 놓친 프레임 %)

| 장면 | 스로틀 | full fps / 놓침 | lite fps / 놓침 | minimal fps / 놓침 | 정답 단계 |
|---|---|---:|---:|---:|---|
| heavy | 1× | 57 / 6% | 60 / 0% | 60 / 0% | **full** |
| heavy | 4× | 28 / 54% | 53 / 11% | 56 / 7% | **lite** |
| heavy | 6× | 26 / 57% | 44 / 26% | 55 / 9% | **minimal** |
| heavy | 10× | 8 / 87% | 11 / 81% | 34 / 43% | **minimal** |
| light | 1× | 60 / 0% | 60 / 0% | 60 / 0% | **full** |
| light | 4× | 46 / 24% | 57 / 5% | 59 / 2% | **full** |
| light | 6× | 37 / 39% | 35 / 42% | 53 / 12% | **minimal** |
| light | 10× | 12 / 80% | 12 / 80% | 31 / 48% | **minimal** |

#### ② 자동 감지 (각 3회 반복)

| 장면 | 프로필 | 스로틀 | 기대 단계 | 결과 (반복별) | 정착 시간 ms (중앙값) | 일치 |
|---|---|---|---|---|---:|---|
| heavy | pc | 1× | full | full, full, full | 0 | 3/3 |
| heavy | chromebook | 1× | lite | lite, lite, lite | 115 | 3/3 |
| heavy | weak | 1× | lite | lite, lite, lite | 85 | 3/3 |
| heavy | ipad | 1× | full | full, lite, full | 0 | 2/3 |
| light | pc | 1× | full | full, full, full | 0 | 3/3 |
| heavy | pc | 4× | lite | lite, lite, lite | 3523 | 3/3 |
| heavy | chromebook | 4× | lite | lite, lite, lite | 526 | 3/3 |
| heavy | weak | 4× | lite | lite, minimal, lite | 465 | 2/3 |
| heavy | ipad | 4× | lite | full, lite, lite | 2354 | 2/3 |
| light | pc | 4× | full | full, minimal, full | 0 | 2/3 |
| heavy | pc | 6× | minimal | minimal, minimal, minimal | 5661 | 3/3 |
| heavy | chromebook | 6× | minimal | minimal, lite, minimal | 3080 | 2/3 |
| heavy | weak | 6× | minimal | minimal, minimal, minimal | 3226 | 3/3 |
| heavy | ipad | 6× | minimal | minimal, minimal, minimal | 5819 | 3/3 |
| light | pc | 6× | minimal | full, minimal, minimal | 5740 | 2/3 |
| heavy | pc | 10× | minimal | minimal, minimal, minimal | 6280 | 3/3 |
| heavy | chromebook | 10× | minimal | minimal, minimal, minimal | 3157 | 3/3 |
| heavy | weak | 10× | minimal | minimal, minimal, minimal | 3831 | 3/3 |
| heavy | ipad | 10× | minimal | minimal, minimal, minimal | 7152 | 3/3 |
| light | pc | 10× | minimal | minimal, minimal, minimal | 6782 | 3/3 |

**정착 후 실제로 매끄러웠나** (감지가 끝난 뒤 3초 동안 놓친 프레임 ≤ 25%): 44/60 (73%) — 1× 15/15, 4× 15/15, 6× 13/15, 10× 1/15

일치 54/60 (90%), 기대보다 낮게 3, 높게 3, 세션 중 상향 0회. 단계가 바뀐 실행의 정착 시간 중앙값 3609ms [72–9188]

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
