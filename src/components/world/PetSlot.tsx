/**
 * 동행 펫 자리 (P5-08 슬롯, 그림·데이터는 Phase 9 P9-01·P9-05).
 * 지금 위치 파이뱀과 같은 노드 겹(`.world-node`)에서 파이뱀보다 먼저 그려져 파이뱀 뒤에 서고, 자리는 `--px`(petOffset).
 * 잠금 해제 연출에서는 `.wu-pet-walker`를 unlockFx 가 옮긴다 (full 은 조금 늦게 같은 길, lite 는 같이).
 * `pet`이 없으면 아무것도 그리지 않는다 (운영은 아직 항상 null)
 */
export interface PetConfig {
  /** 펫 종류 id (Phase 9 아이템 카탈로그, `users.avatar_config.pet` 예정) */
  id: string;
  /** 그림. Phase 9 전에는 카탈로그 견본만 넘긴다 (shortcut: Phase 9에 id → 그림 표로 바꿈) */
  art?: React.ReactNode;
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
        <div className="mascot-bob">{pet.art}</div>
      </div>
    </div>
  );
}
