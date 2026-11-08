import { ImageResponse } from 'next/og';
import { PwaIcon } from '@/lib/pwa/iconArt';

/**
 * iPhone·iPad 홈 화면 아이콘 (P4-11, `<link rel="apple-touch-icon">`). 180×180 **불투명** 정사각형:
 * iOS가 모서리를 깎고, 투명한 곳은 검게 칠하기 때문. iOS는 manifest 아이콘보다 이 링크를 쓴다. 빌드 때 정적 생성
 */
export const dynamic = 'force-static';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<PwaIcon kind="apple" size={180} />, size);
}
