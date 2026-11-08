/**
 * 공용 기기 모드 (P4-09, §12-Q44). 학교·도서관 컴퓨터처럼 여러 아이가 같은 브라우저를 쓰는 기기.
 *
 * 왜: pyRoad에서 로그아웃해도 카카오·네이버·Google **사이트** 로그인은 브라우저에 남는다(네이버는 로그아웃 API도 없음).
 * 그러면 다음 아이가 버튼만 눌러 앞 아이 계정으로 들어온다. 켜 두면 로그인할 때마다 provider가 다시 묻게 한다
 * (`getOAuthCredentials`의 `sharedDevice`, 파라미터 근거는 그 함수 주석).
 *
 * - 저장소: 이 기기 `localStorage`(쿠키 아님, 서버에 보내지 않음). 값은 `'1'`만. 꺼면 키를 지운다
 * - 기본 꺼짐. 저장소를 못 쓰면(사파리 개인 정보 보호 모드 등) 켜기는 이 페이지 안에서만 유지된다(새로 열면 꺼짐)
 * - 개인정보처리방침 10절 "웹 저장소"에 적혀 있다
 */
export const SHARED_DEVICE_STORAGE_KEY = 'pyroad.sharedDevice.v1';

/** 저장소를 못 쓸 때를 위한 이 페이지 안의 값 (마지막으로 고른 것) */
let memory: boolean | null = null;

/** 테스트용: 페이지 안의 값을 비운다 */
export function resetSharedDeviceMemory() {
  memory = null;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 이 기기가 공용 기기로 표시돼 있나 */
export function readSharedDevice(store: Storage | null = storage()): boolean {
  try {
    if (store?.getItem(SHARED_DEVICE_STORAGE_KEY) === '1') return true;
  } catch {
    // 막힌 저장소: 아래 페이지 안의 값
  }
  // 저장소에 없으면(저장 실패 포함) 이 페이지에서 마지막으로 고른 값
  return memory ?? false;
}

/** 공용 기기 표시를 켜고 끈다. 이 기기에 저장하지 못하면 false (이 페이지 안에서는 그래도 유지) */
export function writeSharedDevice(
  on: boolean,
  store: Storage | null = storage(),
): boolean {
  memory = on;
  if (!store) return false;
  try {
    if (on) store.setItem(SHARED_DEVICE_STORAGE_KEY, '1');
    else store.removeItem(SHARED_DEVICE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
