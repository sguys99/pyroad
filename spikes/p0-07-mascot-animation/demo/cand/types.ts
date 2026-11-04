export interface MountOpts {
  size: number;
  index: number;
  variant: string;
  /** 첫 프레임을 그렸을 때 호출 */
  onFirstFrame: () => void;
  /** 런타임·에셋 준비 완료 시점 기록용 */
  mark: (name: string) => void;
}
export interface Mounted {
  destroy(): void;
  /** 상태 전환 (지원하는 후보만) */
  setState?(s: string): void;
}
export type MountFn = (el: HTMLElement, o: MountOpts) => Promise<Mounted>;
