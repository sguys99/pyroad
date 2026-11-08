import { ImageResponse } from 'next/og';
import { PwaIcon } from '@/lib/pwa/iconArt';

/**
 * 파비콘 (P4-11). 파이뱀 얼굴을 초록 둥근 사각형에 크게 — 16px로 줄어도 알아보게(몸·장식 없음).
 * 옛 `icon.svg`(🐍 이모지 글자, 기기 이모지 글꼴로 그려짐)를 대체. 빌드 때 정적 생성
 */
export const dynamic = 'force-static';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<PwaIcon kind="favicon" size={32} />, size);
}
