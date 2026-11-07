/**
 * `/licenses` 오픈소스·에셋 고지 데이터 (P3-14, §12-Q33). 원본은 생성물 `licenses.generated.json`
 * (`npm run licenses:build`, scripts/licenses/build-licenses.mjs). 의존성·에셋을 바꾸면 다시 만들어 함께 커밋하고,
 * CI(`npm run licenses:check`)가 드리프트를 잡는다.
 */
import generated from './licenses.generated.json';

export interface NpmLicensePackage {
  name: string;
  version: string;
  /** 저장소 또는 npm 페이지 */
  url: string;
  /** 라이선스 파일의 저작권 줄 (없으면 package.json 작성자 "Author: …") */
  copyright: string[];
  /** `texts`의 열쇠. 패키지에 라이선스 파일이 없으면 null (그 묶음의 표준 문구를 따름) */
  textId: string | null;
  /** Apache-2.0 NOTICE 파일 */
  noticeId?: string;
}

export interface NpmLicenseGroup {
  /** SPDX 표기 (package.json 그대로, 예: `MIT`, `(MIT OR CC0-1.0)`) */
  license: string;
  packages: NpmLicensePackage[];
}

export interface TextNotice {
  id: string;
  name: string;
  version?: string;
  /** 고친 원본 (이름을 바꾼 글꼴) */
  original?: string;
  license: string;
  copyright: string[];
  url: string;
  note: string;
  /** 라이선스 전문 */
  text: string;
}

export interface SoundCredit {
  id: string;
  name: string;
  author: string;
  license: string;
  works: { title: string; url: string }[];
}

export interface LicenseData {
  licenseNames: Record<string, string>;
  excluded: {
    roots: Record<string, string>;
    selfOnly: Record<string, string>;
    buildOnly: Record<string, string>;
    typesOnly: string[];
  };
  npm: {
    count: number;
    groups: NpmLicenseGroup[];
    /** 라이선스 이름 → 표준 문구 (MIT 허락 문구, Apache-2.0 전문) */
    standardTexts: Record<string, string>;
    /** 열쇠(sha256 앞 12자) → 전문 */
    texts: Record<string, string>;
  };
  runtime: TextNotice[];
  fonts: TextNotice[];
  sounds: SoundCredit[];
}

export const LICENSE_DATA: LicenseData = generated;

/** 화면용 라이선스 이름 (모르면 SPDX 그대로) */
export function licenseLabel(spdx: string): string {
  return LICENSE_DATA.licenseNames[spdx] ?? spdx;
}
