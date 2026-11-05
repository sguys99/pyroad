import { startClientMonitoring } from '@/lib/observability/client';

// 브라우저 에러 보고 (P1-16). DSN이 없으면 아무것도 하지 않고,
// 있어도 Sentry SDK는 첫 에러가 날 때 불러온다 (`src/lib/observability/client.ts`)
startClientMonitoring();
