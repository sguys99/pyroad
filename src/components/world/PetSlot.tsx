import { PetArt } from '@/components/characters/pets';
import type { PetId } from '@/lib/shop/catalog';

/**
 * 동행 펫 자리 (P5-08 슬롯, 그림 P9-01 `PetArt`, 운영 연결 P9-05).
 * 지금 위치 파이뱀과 같은 노드 겹(`.world-node`)에서 파이뱀보다 먼저 그려져 파이뱀 뒤에 서고, 자리는 `--px`(petOffset).
 * 잠금 해제 연출에서는 `.wu-pet-walker`를 unlockFx 가 옮긴다 (full 은 조금 늦게 같은 길, lite 는 같이).
 * `pet`이 없으면 아무것도 그리지 않는다
 */
export interface PetConfig {
  /** 펫 아이템 id (`users.avatar_config.pet`, `petFromAvatarConfig`) */
  id: PetId;
}

export function PetSlot({ pet }: { pet?: PetConfig | null }) {
  if (!pet) return null;
  return (
    <div className="wu-pet-walker">
      <div
        className="wn-pet"
        data-pet={pet.id}
        data-testid="world-pet"
        aria-hidden
      >
        <div className="mascot-bob">
          <PetArt id={pet.id} />
        </div>
      </div>
    </div>
  );
}
