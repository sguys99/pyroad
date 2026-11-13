'use client';

import { createContext } from 'react';

/**
 * 구매 축하 카드(P9-02 `PurchaseCard`)의 "바로 입기". 상점 화면이 축하 오버레이를 이 값으로 감싼다(포털도 React 트리라 닿음).
 * 아이템 id → 입혔으면 null, 못 입혔으면 아이용 오류 문구. 없으면(카탈로그 견본) 카드가 "좋아요!"만 보인다
 */
export type PurchaseWear = (itemId: string) => Promise<string | null>;

export const PurchaseWearContext = createContext<PurchaseWear | null>(null);
