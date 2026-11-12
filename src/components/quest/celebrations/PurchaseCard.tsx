'use client';

import { useContext, useState } from 'react';
import { Shirt } from 'lucide-react';
import { PetArt } from '@/components/characters/pets';
import { ShopItemArt } from '@/components/shop/ShopItemArt';
import { RewardIcon } from '@/components/ui/reward-icon';
import { getSkin } from '@/lib/avatar/skins';
import { PurchaseWearContext } from '@/lib/celebration/purchaseWear';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import type { MotionBudget } from '@/lib/motion/tier';
import { RARITY_LABEL, getShopItem } from '@/lib/shop/catalog';
import { wearWords } from '@/lib/shop/shopView';
import { CelebrationCta, CelebrationMascot, Kicker, delayStyle } from './parts';

type PurchaseEvent = Extract<CelebrationEvent, { type: 'purchase' }>;

/** 빛살 뒤로 물건이 톡 나오는 시각 (ms, full 기준) */
const REVEAL_MS = 260;

/**
 * 상점 구매 축하 (P9-02): 금빛 빛살이 한 번 퍼지고 산 물건이 톡 → 코스튬·펫은 그 물건을 입은 파이뱀이 기쁨 점프(펫은 옆에서 같이 톡).
 * 아래 줄에 쓴 코인과 남은 코인. 입을 수 있는 물건은 "바로 입기"(상점이 준 `PurchaseWearContext`) · "나중에 입을래요",
 * 소모품은 "좋아요!". 연출은 1회성 CSS(transform·opacity), minimal·동작 줄이기는 끝 모습 그대로
 */
export function PurchaseCard({
  event,
  budget,
  settled,
  onNext,
}: {
  event: PurchaseEvent;
  budget: MotionBudget;
  settled: boolean;
  onNext: () => void;
}) {
  const wear = useContext(PurchaseWearContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = getShopItem(event.itemId);
  if (!item) return null;
  const wearable = item.kind !== 'consumable' && wear !== null;
  const rig = event.look && (item.kind === 'costume' || item.kind === 'pet');
  const words = wearWords(item);

  const onWear = async () => {
    if (!wear) return;
    setBusy(true);
    setError(null);
    const err = await wear(item.id);
    setBusy(false);
    if (err) setError(err);
    else onNext();
  };

  return (
    <>
      <div className="cel-buy" data-rarity={item.rarity} aria-hidden>
        <span className="cel-buy-rays" />
        {rig && event.look ? (
          <span className="cel-buy-stage cel-pop" style={delayStyle(REVEAL_MS)}>
            <CelebrationMascot
              size={124}
              jumpAtMs={REVEAL_MS + 360}
              budget={budget}
              settled={settled}
              costume={event.look.costume}
              palette={getSkin(event.look.skin).palette}
            />
            {event.look.pet && (
              <span
                className="cel-buy-pet cel-pop"
                style={delayStyle(REVEAL_MS + 420)}
              >
                <PetArt id={event.look.pet} size={52} />
              </span>
            )}
          </span>
        ) : (
          <span className="cel-buy-art cel-pop" style={delayStyle(REVEAL_MS)}>
            <ShopItemArt item={item} size={96} skin={event.look?.skin} />
          </span>
        )}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="cel-buy-spark cel-pop"
            data-i={i}
            style={delayStyle(REVEAL_MS + 200 + i * 90)}
          />
        ))}
      </div>

      <div className="cel-head">
        <Kicker gold>
          {item.rarity === 'common'
            ? '새 물건'
            : `${RARITY_LABEL[item.rarity]} 물건`}
        </Kicker>
        <h2 id="celebration-title" className="cel-t font-display" data-size="m">
          {item.name}
        </h2>
        <p className="cel-sub">{item.description}</p>
      </div>

      <ul className="cel-gains" aria-label="쓴 코인">
        <li className="cel-gain">
          <RewardIcon kind="coin" size={24} />
          <b>-{event.price.toLocaleString('ko-KR')}</b>
        </li>
        <li className="cel-gain cel-buy-left">
          남은 코인
          <b className="tabular-nums">
            {event.coinsLeft.toLocaleString('ko-KR')}
          </b>
        </li>
      </ul>

      {error && (
        <p className="cel-sub" role="alert">
          {error}
        </p>
      )}

      <div className="cel-actions">
        {wearable ? (
          <>
            <CelebrationCta
              testId="purchase-wear"
              icon={<Shirt aria-hidden />}
              loading={busy}
              onClick={onWear}
            >
              바로 {words.on}
            </CelebrationCta>
            <CelebrationCta variant="ghost" focus={!!error} onClick={onNext}>
              {words.later}
            </CelebrationCta>
          </>
        ) : (
          <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
        )}
      </div>
    </>
  );
}
