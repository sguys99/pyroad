// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { keepsKey, tkKeyName } from '../keyNames';

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('tkKeyName (P11-04)', () => {
  it('화살표·스페이스·엔터는 Tk 이름, 글자·숫자는 그대로', () => {
    expect(
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].map(
        (k) => tkKeyName(key(k)),
      ),
    ).toEqual(['Left', 'Right', 'Up', 'Down', 'space', 'Return']);
    expect(tkKeyName(key('a'))).toBe('a');
    expect(tkKeyName(key('Z'))).toBe('Z');
    expect(tkKeyName(key('7'))).toBe('7');
  });

  it('단축키 조합·Tab·Esc·한글은 보내지 않음', () => {
    expect(tkKeyName(key('Enter', { ctrlKey: true }))).toBeNull();
    expect(tkKeyName(key('r', { metaKey: true }))).toBeNull();
    expect(tkKeyName(key('Tab'))).toBeNull();
    expect(tkKeyName(key('Escape'))).toBeNull();
    expect(tkKeyName(key('ㄱ'))).toBeNull();
  });
});

describe('keepsKey', () => {
  it('글자 칸·에디터는 모든 키를, 버튼은 스페이스·엔터만 지킴', () => {
    document.body.innerHTML =
      '<input id="i"><div contenteditable="true"><span id="e"></span></div><button id="b"></button><div id="d"></div>';
    const el = (id: string) => document.getElementById(id);
    expect(keepsKey(el('i'), 'Left')).toBe(true);
    expect(keepsKey(el('e'), 'a')).toBe(true);
    expect(keepsKey(el('b'), 'space')).toBe(true);
    expect(keepsKey(el('b'), 'Left')).toBe(false);
    expect(keepsKey(el('d'), 'space')).toBe(false);
    expect(keepsKey(null, 'Up')).toBe(false);
  });
});
