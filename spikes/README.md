# spikes/

업그레이드 계획서 [Phase 0](../docs/4.upgrade-plan.md#phase-0-결정-확정--기술-스파이크)의 기술 스파이크 코드입니다.

- 디렉토리: `spikes/p0-XX-<주제>/` (스파이크 1개당 1개)
- 결과 보고서: [`docs/spikes/P0-XX-<주제>.md`](../docs/spikes/)
- 앱 코드가 아닙니다. `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`에서 제외되어 빌드·lint·테스트에 영향을 주지 않습니다.
- 스파이크에 필요한 추가 패키지는 루트 `package.json`에 넣지 않고, 각 디렉토리의 `package.json`이나 임시 디렉토리에 설치합니다 (`node_modules`는 커밋하지 않음).
- 결론이 채택되면 해당 Phase에서 `src/`로 옮겨 정식 구현합니다. 스파이크 코드를 그대로 import하지 않습니다.
