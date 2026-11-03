### 준비 시간 · 입력 왕복 지연 (Pyodide 314.0.7, self-host)

| 브라우저 | 방식 | 준비(ms) | input 왕복 median / p95 (ms) | 채널(메인→워커) median | 비고 |
| --- | --- | --- | --- | --- | --- |
| chromium | ① SAB | 6739 | 1 / 6.5 | 0 |  |
| chromium | ② SW+동기XHR | 6653 | 12.3 / 24.9 | 7.6 | SW 채널 ok |
| chromium | ③ 코드 변환 | 10260 | 26.2 / 74.9 | 5.5 |  |
| chromium | ④ JSPI | 4887 | 2.4 / 8 | 0.2 | can_run_sync=true |
| firefox | ① SAB | 21193 | 2.1 / 14.2 | 0.1 |  |
| firefox | ② SW+동기XHR | 21537 | 32 / 69 | 24 | SW 채널 ok |
| firefox | ③ 코드 변환 | 37639 | 25 / 59 | 2 |  |
| firefox | ④ JSPI | 17565 | 9 / 20 | 1 | can_run_sync=true |
| webkit | ① SAB | 7318 | 5.9 / 15.3 | 0.3 |  |
| webkit | ② SW+동기XHR | 6451 | 11 / 22 | 4 | SW 채널 ok |
| webkit | ③ 코드 변환 | 19229 | 32 / 66 | 3 |  |
| webkit | ④ JSPI | 7149 | 11 / 31 | 0 | can_run_sync=true |

### input() 위치별 동작 (✅ 기대 출력 / ❌ 실패, 3개 브라우저 결과가 같으면 한 칸)

| 케이스 | ① SAB | ② SW+동기XHR | ③ 코드 변환 | ④ JSPI |
| --- | --- | --- | --- | --- |
| loop | ✅ | ✅ | ✅ | ✅ |
| chain | ✅ | ✅ | ✅ | ✅ |
| method | ✅ | ✅ | ✅ | ✅ |
| init | ✅ | ✅ | ❌ TypeError: __init__() should return None, not 'coroutine' | ✅ |
| alias | ✅ | ✅ | ❌ (잘못된 출력) | ✅ |
| lambda | ✅ | ✅ | ❌ SyntaxError: 'await' outside async function | ✅ |
| generator | ✅ | ✅ | ❌ TypeError: 'async_generator' object can't be awaited | ✅ |
| comprehension | ✅ | ✅ | ✅ | ✅ |
| recursion | ✅ | ✅ | ✅ | ✅ |
| callback | ✅ | ✅ | ❌ (잘못된 출력) | ✅ |
| map | ✅ | ✅ | ❌ (잘못된 출력) | ✅ |
| collision | ✅ | ✅ | ❌ TypeError: 'int' object can't be awaited | ✅ |
| stdin | ✅ | ✅ | ❌ OSError: [Errno 29] I/O error | ✅ |
| errorline | ✅ | ✅ | ✅ | ✅ |

### 멈추기(Stop) 동작

| 브라우저 | 방식 | 입력 대기 중 | CPU 무한 루프 | time.sleep 루프 | time.sleep(0.5) 실측 |
| --- | --- | --- | --- | --- | --- |
| chromium | ① SAB | 정상 중단 19ms | 정상 중단 8ms | 정상 중단 126ms | slept 0.5 (512ms) |
| chromium | ② SW+동기XHR | 정상 중단 33ms | terminate 5500ms (재준비 4498ms) | terminate 4770ms (재준비 3769ms) | slept 0.5 (506ms) |
| chromium | ③ 코드 변환 | 정상 중단 63ms | terminate 10875ms (재준비 9873ms) | terminate 13750ms (재준비 12739ms) | slept 0.58 (561ms) |
| chromium | ④ JSPI | 정상 중단 17ms | terminate 5304ms (재준비 4302ms) | 정상 중단 27ms | slept 0.5 (507ms) |
| firefox | ① SAB | 정상 중단 19ms | 정상 중단 24ms | 정상 중단 121ms | slept 0.51 (520ms) |
| firefox | ② SW+동기XHR | 정상 중단 41ms | terminate 19353ms (재준비 18238ms) | terminate 17609ms (재준비 16607ms) | slept 0.5 (525ms) |
| firefox | ③ 코드 변환 | 정상 중단 268ms | terminate 30153ms (재준비 29144ms) | terminate 27463ms (재준비 26332ms) | slept 0.54 (561ms) |
| firefox | ④ JSPI | 정상 중단 64ms | terminate 19111ms (재준비 18109ms) | 정상 중단 69ms | slept 0.54 (571ms) |
| webkit | ① SAB | 정상 중단 7ms | 정상 중단 6ms | 정상 중단 131ms | slept 0.5 (506ms) |
| webkit | ② SW+동기XHR | 정상 중단 22ms | terminate 8297ms (재준비 7292ms) | terminate 10358ms (재준비 9357ms) | slept 0.55 (505ms) |
| webkit | ③ 코드 변환 | 정상 중단 56ms | terminate 21972ms (재준비 20923ms) | terminate 23499ms (재준비 22493ms) | slept 0.53 (554ms) |
| webkit | ④ JSPI | 정상 중단 31ms | terminate 10416ms (재준비 9412ms) | 정상 중단 45ms | slept 0.51 (513ms) |

### 입력 대기 중 새로고침 후

| 브라우저 | ① SAB | ② SW+동기XHR | ③ 코드 변환 | ④ JSPI |
| --- | --- | --- | --- | --- |
| chromium | ✅ (4315ms) | ✅ (5042ms, SW ok) | ✅ (10158ms) | ✅ (5099ms) |
| firefox | ✅ (19276ms) | ✅ (17019ms, SW ok) | ✅ (27291ms) | ✅ (15445ms) |
| webkit | ✅ (6140ms) | ✅ (7580ms, SW ok) | ✅ (18640ms) | ✅ (10815ms) |

### Pyodide 0.27.5(현재 앱 버전) 비교 (module worker)

| 브라우저 | 방식 | 준비(ms) | loop/init/stdin 케이스 | time.sleep 루프 멈추기 | time.sleep(0.5) |
| --- | --- | --- | --- | --- | --- |
| chromium | ① SAB | 3997 | loop:✅ init:✅ stdin:✅ | 정상 중단 118ms | slept 0.52 |
| chromium | ④ JSPI | 7594 | loop:✅ init:✅ stdin:✅ | 정상 중단 41ms | slept 0.5 |
| firefox | ① SAB | 11040 | loop:✅ init:✅ stdin:✅ | 정상 중단 141ms | slept 0.51 |
| firefox | ④ JSPI | 15013 | loop:✅ init:✅ stdin:✅ | 정상 중단 27ms | slept 0.51 |
| webkit | ① SAB | 7644 | loop:✅ init:✅ stdin:✅ | 정상 중단 134ms | slept 0.5 |
| webkit | ④ JSPI | 7603 | loop:✅ init:✅ stdin:✅ | 정상 중단 64ms | slept 0.51 |

### jsdelivr CDN에서 로드 (COEP require-corp, 방식 ①)

| 브라우저 | 결과 |
| --- | --- |
| chromium | ✅ 준비 11540ms, 실행 ✅ |
| firefox | ✅ 준비 19984ms, 실행 ✅ |
| webkit | ❌ Importing a module script failed. |

### 헤더 모드별 격리 여부와 교차 출처 리소스 (각 칸: Chromium·Firefox·WebKit, O=됨 / X=안 됨)

| 항목 | 헤더 없음 | COOP만 | COOP+COEP<br>require-corp | COOP+COEP<br>credentialless | Document-<br>Isolation-Policy |
| --- | --- | --- | --- | --- | --- |
| crossOriginIsolated | X X X | X X X | O O O | O O X | O X X |
| img 헤더 없음 | O O O | O O O | X X X | O O O | O O O |
| script ACAO:* (속성 없음) | O O O | O O O | X X X | O O O | O O O |
| script ACAO:* + crossorigin 속성 | O O O | O O O | O O O | O O O | O O O |
| img ACAO:* + crossorigin 속성 | O O O | O O O | O O O | O O O | O O O |
| img CORP: cross-origin | O O O | O O O | O O O | O O O | O O O |
| img ACAO:* (crossorigin 속성 없음) | O O O | O O O | X X X | O O O | O O O |
| 네이버 이미지 ssl.pstatic.net | O O X | O O X | X X X | O O X | O O X |
| 네이버 이미지 + crossorigin | O O X | O O X | O O X | O O X | O O X |
| Kakao SDK + crossorigin | O O X | O O X | O O X | O O X | O O X |
| Kakao SDK (속성 없음) | O O X | O O X | X X X | O O X | O O X |
| Google 아바타 lh3.googleusercontent.com | O O X | O O X | O O X | O O X | X O X |
| fetch CORS (Supabase API 같은 경우) | O O O | O O O | O O O | O O O | O O O |
| 교차 출처 팝업과 postMessage(opener) | O O O | X X X | X X X | X X X | O O O |

### 엄격한 CSP (`script-src 'self' 'wasm-unsafe-eval'`, `unsafe-eval` 없음)

| 브라우저 | ② SW @ csp | ④ JSPI @ csp | ① SAB @ csp+COOP/COEP |
| --- | --- | --- | --- |
| chromium | ✅ | ✅ | ✅ |
| firefox | ✅ | ✅ | ✅ |
| webkit | ✅ | ✅ | ✅ |
