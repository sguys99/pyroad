export type Character = 'pybaem' | 'bugbug' | 'byeolttongi';

export type PybaemExpression =
  | 'happy'
  | 'thinking'
  | 'celebrating'
  | 'encouraging'
  | 'surprised'
  | 'teaching'
  | 'waving'
  | 'sleeping'
  | 'confused'
  | 'proud';

export type BugBugExpression = 'searching' | 'found' | 'fixed';

export type ByeolttongiExpression = 'flying' | 'landing' | 'sparkling';

export type Expression =
  | PybaemExpression
  | BugBugExpression
  | ByeolttongiExpression;

export type AvatarSize = 'sm' | 'md' | 'lg';

export const AVATAR_SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 64,
  lg: 128,
};
