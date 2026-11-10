// 폰 키보드 + 그 위에 붙은 코드 키보드가 화면 아래를 가리는 높이 (px, P6-11).
// CodeKeyboard가 visualViewport로 재서 쓰고, CodeEditor의 scrollMargins가 읽어 커서 줄을 그 위로 올린다
let inset = 0;

export const setKeyboardInset = (px: number) => {
  inset = Math.max(0, Math.round(px));
};
export const keyboardInset = () => inset;
