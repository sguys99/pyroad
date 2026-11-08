import type { MetadataRoute } from 'next';
import { buildManifest } from '@/lib/pwa/manifest';

/** 웹 앱 매니페스트 `/manifest.webmanifest` (P4-11, 빌드 때 정적 생성). 내용은 `src/lib/pwa/manifest.ts` */
export default function manifest(): MetadataRoute.Manifest {
  return buildManifest();
}
