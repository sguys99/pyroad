# Phase 0 스파이크 보고서

[업그레이드 계획서 Phase 0](../4.upgrade-plan.md#phase-0-결정-확정--기술-스파이크)의 기술 스파이크 결과입니다. 각 보고서는 **채택 / 대안 / 불가** 결론과 근거(실측 또는 문서 확인), 이후 Phase에 주는 영향을 담습니다. 코드는 [`spikes/`](../../spikes/)에 있습니다.

| ID | 주제 | 결론 | 보고서 |
|---|---|---|---|
| P0-02 | MCP 연결 | 설정 완료 (인증 대기) | [P0-02-mcp.md](P0-02-mcp.md) |
| P0-09 | Node Pyodide 정답 자동 검증 | **채택** | [P0-09-solution-check.md](P0-09-solution-check.md) |
| P0-03 | Naver 로그인 | **채택** (커스텀 OIDC provider, 방식 변경) | [P0-03-naver-login.md](P0-03-naver-login.md) |
| P0-04 | Kakao 로그인 | **대안** (내장 provider + scope 덮어쓰기, 비즈앱 불필요) | [P0-04-kakao-login.md](P0-04-kakao-login.md) |
