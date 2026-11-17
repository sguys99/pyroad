/** 공지 목록 카드 미리보기 (B145): 본문 마크다운 기호(`###`·`**`·`[글](주소)`)를 빼고 글자만 */
export function noticePreview(content: string) {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<((?:https?:|mailto:)[^>]*)>/g, '$1');
}
