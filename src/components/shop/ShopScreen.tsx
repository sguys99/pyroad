'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Award,
  CalendarCheck,
  Check,
  Code2,
  ListChecks,
  Map,
  ChevronLeft,
  CircleDashed,
  Coins,
  Lock,
  NotebookPen,
  Package,
  PawPrint,
  RefreshCw,
  Shirt,
  Sparkles,
  Store,
} from 'lucide-react';

import { PybaemStatic } from '@/components/characters/rig/RigStatic';
import { PetArt } from '@/components/characters/pets';
import { Button } from '@/components/ui/button';
import { HudCounter } from '@/components/ui/hud';
import { RewardIcon } from '@/components/ui/reward-icon';
import { Sheet } from '@/components/ui/sheet';
import { SegmentedTabs } from '@/components/ui/tabs';
import { Toast, ToastRegion } from '@/components/ui/toast';
import { useSfx } from '@/components/providers/soundContext';
import { useWorldCelebration } from '@/components/world/useWorldCelebration';
import { getSkin, skinFromAvatarConfig } from '@/lib/avatar/skins';
import { withObjectParticle } from '@/lib/korean';
import { PurchaseWearContext } from '@/lib/celebration/purchaseWear';
import type { PybaemState } from '@/components/characters/rig/pybaem';
import {
  RARITY_LABEL,
  SHOP_ITEMS,
  weeklyLimitOf,
  type ShopItem,
  type ShopKind,
} from '@/lib/shop/catalog';
import {
  equipItem,
  fetchShopStatus,
  purchaseItem,
  type ShopStatus,
} from '@/lib/shop/api';
import {
  KIND_LABEL,
  KIND_ORDER,
  MAX_SHIELDS,
  equipSlotOf,
  itemState,
  lookWith,
  ownedItems,
  shopErrorText,
  stateLabel,
  wearWords,
  type ItemState,
  type Look,
} from '@/lib/shop/shopView';
import { ShopItemArt, ThemeArt, FrameArt } from './ShopItemArt';
import './shop.css';

// 라이브 리그는 상점에 들어온 뒤 받는다. 받는 동안은 같은 모습의 정지 그림 (rig.md 지연 로드)
const PybaemRig = dynamic(
  () =>
    import('@/components/characters/rig/MascotRig').then((m) => m.PybaemRig),
  { ssr: false, loading: () => null },
);

/** 화면이 부르는 API (기본은 `/api/shop/*`. 카탈로그·테스트는 가짜로) */
export interface ShopApi {
  status: typeof fetchShopStatus;
  purchase: typeof purchaseItem;
  equip: typeof equipItem;
}
const REAL_API: ShopApi = {
  status: fetchShopStatus,
  purchase: purchaseItem,
  equip: equipItem,
};

const KIND_ICON: Record<ShopKind, ReactNode> = {
  costume: <Shirt aria-hidden />,
  pet: <PawPrint aria-hidden />,
  frame: <CircleDashed aria-hidden />,
  editor_theme: <NotebookPen aria-hidden />,
  consumable: <Package aria-hidden />,
};
const KIND_NOTE: Record<ShopKind, string> = {
  costume: '모자·안경·망토·배경으로 파이뱀을 꾸며요',
  pet: '지도 위를 졸졸 따라다니는 친구예요',
  frame: '프로필 아바타 둘레를 꾸며요',
  editor_theme: '코드를 쓰는 공책 색을 바꿔요',
  consumable: '한 주에 하나씩만 살 수 있어요',
};

type Tab = 'shop' | 'closet';

/** 다음 주 월요일 (소모품 한도가 다시 열리는 날) → "11월 16일" */
function nextMonday(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 7));
  return `${next.getUTCMonth() + 1}월 ${next.getUTCDate()}일`;
}

const coins = (n: number) => n.toLocaleString('ko-KR');

export interface ShopScreenProps {
  /** 서버가 읽은 첫 상태 (못 읽었으면 null → 오류 상태 + 다시 열기) */
  initial: ShopStatus | null;
  api?: ShopApi;
  /** 위 "← 월드맵" 줄을 숨김 (카탈로그) */
  embedded?: boolean;
}

/**
 * 상점 (P9-02). `/shop` — 월드맵 HUD 상점 칩·메뉴에서.
 *
 * - 왼쪽(768+ 붙어 따라옴)·위(모바일): 줄무늬 차양 간판 + 거울 무대 = 지금 입은 모습(라이브 파이뱀 + 펫). 입으면 기뻐 뜀
 * - 탭 "상점 | 내 옷장" → 상점은 종류 탭(코스튬·펫·프레임·공책·소모품) + 진열 칸, 옷장은 가진 것(입기·벗기)과 가방(황금키·방패)
 * - 칸을 누르면 시트: 지금 입은 것 위에 덮어 미리 입어 보기(펫은 옆에) · 설명 · 상태별 버튼
 *   (사기 → 구매 확인(가격·지금·남을 코인) → 서버 구매 / 코인 부족이면 모자란 만큼과 모으는 방법 / 입기·벗기 / 이번 주 샀음·가득 참 안내)
 * - 사면 시트를 닫고 축하 시퀀서(`purchase` 카드: 빛살 + 그 물건을 입은 파이뱀 점프 + 컨페티·효과음, 연출 단계·동작 줄이기 따름)
 *   → "바로 입기"가 `PurchaseWearContext`로 장착. 결과는 화면 낭독기에도 한 줄로(aria-live)
 * - 모든 오류 코드는 `SHOP_ERROR_TEXT` 아이용 문구. 쓰기는 `/api/shop/*`만(§2.3)
 */
export function ShopScreen({
  initial,
  api = REAL_API,
  embedded = false,
}: ShopScreenProps) {
  const play = useSfx();
  // 탭·패널 id (카탈로그에 여러 벌 깔려도 겹치지 않게)
  const uid = useId().replace(/:/g, '');
  const PANEL = `${uid}-panel`;
  const SHELF = `${uid}-shelf`;
  const { celebrate, layer } = useWorldCelebration();
  const [status, setStatus] = useState<ShopStatus | null>(initial);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('shop');
  const [kind, setKind] = useState<ShopKind>('costume');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [say, setSay] = useState('');
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const [cheer, setCheer] = useState(0);
  const toast = (text: string) =>
    setNote((n) => ({ id: (n?.id ?? 0) + 1, text }));

  const open = openId ? SHOP_ITEMS.find((i) => i.id === openId) : undefined;

  const reload = async () => {
    setLoading(true);
    setLoadError(null);
    const res = await api.status();
    setLoading(false);
    if (res.ok) setStatus(res.data);
    else setLoadError(shopErrorText(res.error.code));
  };

  const openItem = (id: string) => {
    play('tap');
    setConfirm(false);
    setError(null);
    setOpenId(id);
  };

  /** 입기·벗기. 성공이면 null, 실패면 아이용 문구 */
  const wear = async (item: ShopItem, on: boolean): Promise<string | null> => {
    const slot = equipSlotOf(item);
    if (!slot) return null;
    const res = await api.equip(slot, on ? item.id : null);
    if (!res.ok) return shopErrorText(res.error.code);
    setStatus((s) => s && { ...s, equipped: res.data.equipped });
    const w = wearWords(item);
    const text = on
      ? item.kind === 'pet'
        ? `${item.name}와 함께 다녀요!`
        : `${item.name} ${w.on} 완료!`
      : `${item.name} ${w.off} 완료`;
    setSay(text);
    toast(text);
    if (on) {
      play('star');
      setCheer((c) => c + 1);
    }
    return null;
  };

  const onEquip = async (item: ShopItem, on: boolean) => {
    setBusy(true);
    setError(null);
    const err = await wear(item, on);
    setBusy(false);
    if (err) setError(err);
  };

  const onBuy = async (item: ShopItem) => {
    if (!status) return;
    setBusy(true);
    setError(null);
    const res = await api.purchase(item.id);
    setBusy(false);
    if (!res.ok) {
      setConfirm(false);
      setError(shopErrorText(res.error.code));
      return;
    }
    const r = res.data;
    const next: ShopStatus = {
      ...status,
      coins: r.coins_balance,
      golden_keys: r.golden_keys,
      shields: r.shields,
      owned:
        item.kind === 'consumable' || status.owned.includes(item.id)
          ? status.owned
          : [...status.owned, item.id],
      bought_this_week:
        item.kind === 'consumable'
          ? { ...status.bought_this_week, [item.id]: r.bought_this_week }
          : status.bought_this_week,
    };
    setStatus(next);
    setSay(
      `${withObjectParticle(item.name)} 샀어요. 남은 코인 ${coins(r.coins_balance)}개.`,
    );
    // 시트를 먼저 닫고 축하 (대화 상자를 겹치지 않게, useWorldCelebration)
    setOpenId(null);
    setConfirm(false);
    const wearable = item.kind === 'costume' || item.kind === 'pet';
    celebrate([
      {
        type: 'purchase',
        itemId: item.id,
        price: item.price,
        coinsLeft: r.coins_balance,
        look: wearable
          ? {
              ...lookWith(next.equipped, item),
              skin: skinFromAvatarConfig(next.equipped),
            }
          : item.kind === 'frame'
            ? {
                costume: {},
                pet: null,
                skin: skinFromAvatarConfig(next.equipped),
              }
            : undefined,
      },
    ]);
  };

  const wearFromCard = async (itemId: string) => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    return item ? wear(item, true) : null;
  };

  if (!status) {
    return (
      <div className="shop" data-testid="shop">
        {!embedded && <TopBar coins={null} />}
        <div className="shop-state" role="alert" data-testid="shop-error">
          <PybaemStatic state="sad" size={120} label="" />
          <p className="shop-state-t font-display">상점 문을 열지 못했어요</p>
          <p className="shop-state-d">
            {loadError ?? '잠시 후 다시 열어 볼까요?'}
          </p>
          <Button
            variant="secondary"
            icon={<RefreshCw aria-hidden />}
            loading={loading}
            onClick={reload}
          >
            다시 열기
          </Button>
        </div>
      </div>
    );
  }

  const skin = skinFromAvatarConfig(status.equipped);
  const owned = ownedItems(status);

  return (
    <div className="shop" data-testid="shop">
      {!embedded && <TopBar coins={status.coins} />}
      {embedded && (
        <div className="shop-top">
          <span />
          <HudCounter kind="coin" value={status.coins} />
        </div>
      )}

      <div className="shop-body">
        <aside className="shop-side">
          <Mirror
            heading={embedded ? 'h2' : 'h1'}
            look={lookWith(status.equipped)}
            worn={owned.filter((i) => itemState(i, status) === 'equipped')}
            skin={skin}
            cheer={cheer}
            paused={open !== undefined}
          />
        </aside>

        <div className="shop-main">
          <SegmentedTabs
            items={[
              {
                value: 'shop',
                label: '상점',
                icon: <Store aria-hidden />,
                panelId: PANEL,
              },
              {
                value: 'closet',
                label: (
                  <>
                    내 옷장
                    <span className="shop-count tabular-nums">
                      {owned.length}
                    </span>
                  </>
                ),
                icon: <Shirt aria-hidden />,
                panelId: PANEL,
              },
            ]}
            value={tab}
            onValueChange={setTab}
            aria-label="상점과 내 옷장"
            idBase={`${uid}-tab`}
            className="shop-tabs"
          />

          <div
            id={PANEL}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-${tab}`}
            className="shop-panel"
          >
            {tab === 'shop' ? (
              <>
                <SegmentedTabs
                  items={KIND_ORDER.map((k) => ({
                    value: k,
                    label: <span className="shop-kind-l">{KIND_LABEL[k]}</span>,
                    icon: KIND_ICON[k],
                    panelId: SHELF,
                  }))}
                  value={kind}
                  onValueChange={setKind}
                  aria-label="물건 종류"
                  idBase={`${uid}-kind`}
                  className="shop-kinds"
                />
                <section
                  id={SHELF}
                  role="tabpanel"
                  aria-labelledby={`${uid}-kind-${kind}`}
                  className="shop-shelf"
                >
                  <p className="shop-note">{KIND_NOTE[kind]}</p>
                  <ul className="shop-grid" data-testid="shop-grid">
                    {SHOP_ITEMS.filter((i) => i.kind === kind).map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        state={itemState(item, status)}
                        short={item.price > status.coins}
                        skin={skin}
                        onOpen={() => openItem(item.id)}
                      />
                    ))}
                  </ul>
                </section>
              </>
            ) : (
              <Closet
                status={status}
                items={owned}
                skin={skin}
                onOpen={openItem}
                onShop={() => setTab('shop')}
              />
            )}
          </div>
        </div>
      </div>

      <Sheet
        title={open?.name ?? ''}
        open={open !== undefined}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            setConfirm(false);
          }
        }}
        align="center"
        media={
          open && (
            <Preview
              item={open}
              equipped={status.equipped}
              skin={skin}
              trying={itemState(open, status) !== 'equipped'}
            />
          )
        }
        className="shop-sheet"
        data-testid="shop-sheet"
      >
        {open && (
          <ItemDetail
            item={open}
            status={status}
            state={itemState(open, status)}
            confirm={confirm}
            busy={busy}
            error={error}
            onAsk={() => {
              play('tap');
              setError(null);
              setConfirm(true);
            }}
            onBack={() => setConfirm(false)}
            onBuy={() => onBuy(open)}
            onEquip={(on) => onEquip(open, on)}
          />
        )}
      </Sheet>

      <p className="sr-only" role="status" aria-live="polite">
        {say}
      </p>
      <ToastRegion className="shop-toast" label="상점 안내">
        {note && (
          <Toast key={note.id} tone="good" onClose={() => setNote(null)}>
            {note.text}
          </Toast>
        )}
      </ToastRegion>
      <PurchaseWearContext.Provider value={wearFromCard}>
        {layer}
      </PurchaseWearContext.Provider>
    </div>
  );
}

function TopBar({ coins: value }: { coins: number | null }) {
  return (
    <div className="shop-top">
      <Link href="/world" className="shop-back focus-ring">
        <ChevronLeft aria-hidden />
        월드맵
      </Link>
      {value !== null && <HudCounter kind="coin" value={value} />}
    </div>
  );
}

/** 간판 + 거울 무대: 지금 입은 모습. 입으면(cheer) 기뻐 뜀 */
function Mirror({
  heading: H,
  look,
  worn,
  skin,
  cheer,
  paused,
}: {
  heading: 'h1' | 'h2';
  look: Look;
  worn: ShopItem[];
  skin: string;
  cheer: number;
  paused: boolean;
}) {
  const [state, setState] = useState<PybaemState>('idle');
  const first = useRef(cheer);
  const titleId = `${useId().replace(/:/g, '')}-title`;
  useEffect(() => {
    if (cheer === first.current) return;
    setState('happy');
    const t = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(t);
  }, [cheer]);
  return (
    <section
      className="shop-sign"
      aria-labelledby={titleId}
      data-testid="shop-mirror"
    >
      <span className="shop-awning" aria-hidden />
      <div className="shop-sign-head">
        <H id={titleId} className="shop-title font-display">
          파이뱀 상점
        </H>
        <p className="shop-sub">모은 코인으로 파이뱀을 꾸며 봐요</p>
        <ul className="shop-worn" aria-label="지금 입은 것">
          {worn.length === 0 ? (
            <li data-none>아직 안 꾸몄어요</li>
          ) : (
            worn.map((i) => <li key={i.id}>{i.name}</li>)
          )}
        </ul>
      </div>
      <Stage
        look={look}
        skin={skin}
        state={state}
        size={176}
        paused={paused}
        label="지금 내 모습"
      />
    </section>
  );
}

/** 무대: 파이뱀(지금 모습 + 미리 입어 보기) + 펫은 옆에. 정지 그림 위에 라이브 리그가 받아지면 덮음 */
function Stage({
  look,
  skin,
  state = 'idle',
  size,
  paused,
  label,
  tag,
}: {
  look: Look;
  skin: string;
  state?: PybaemState;
  size: number;
  paused?: boolean;
  label: string;
  tag?: ReactNode;
}) {
  const palette = getSkin(skin).palette;
  const [live, setLive] = useState(false);
  return (
    <div
      className="shop-stage"
      data-bg={look.costume.bg ?? undefined}
      data-testid="shop-stage"
      data-look={JSON.stringify(look.costume)}
      data-pet={look.pet ?? undefined}
    >
      <span className="shop-floor" aria-hidden />
      <div
        className="shop-rig"
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
      >
        {!live && (
          <PybaemStatic
            state="idle"
            size={size}
            palette={palette}
            costume={look.costume}
            label=""
          />
        )}
        <PybaemRig
          onEngine={() => setLive(true)}
          state={state}
          size={size}
          palette={palette}
          costume={look.costume}
          paused={paused}
          lookAt={false}
          label=""
        />
      </div>
      {look.pet && (
        <span className="shop-pet" aria-hidden data-testid="shop-stage-pet">
          <span className="mascot-bob">
            <PetArt id={look.pet} size={Math.round(size * 0.36)} />
          </span>
        </span>
      )}
      {tag}
    </div>
  );
}

function ItemCard({
  item,
  state,
  short,
  skin,
  onOpen,
}: {
  item: ShopItem;
  state: ItemState;
  short: boolean;
  skin: string;
  onOpen: () => void;
}) {
  const label = stateLabel(item, state);
  return (
    <li
      className="shop-card"
      data-rarity={item.rarity}
      data-state={state}
      data-short={(state === 'buy' && short) || undefined}
      data-item={item.id}
    >
      <button
        type="button"
        className="shop-card-btn focus-ring"
        aria-label={`${item.name}, ${RARITY_LABEL[item.rarity]}, ${label}`}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        <span className="shop-card-shelf">
          <ShopItemArt item={item} size={96} skin={skin} />
          {item.rarity !== 'common' && (
            <span className="shop-rarity" data-rarity={item.rarity}>
              {item.rarity === 'epic' && <Sparkles aria-hidden />}
              {RARITY_LABEL[item.rarity]}
            </span>
          )}
          {state === 'equipped' && (
            <span className="shop-badge" data-on>
              <Check aria-hidden strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="shop-card-name">{item.name}</span>
        {state === 'buy' ? (
          <span className="shop-price">
            <RewardIcon kind="coin" size={20} />
            <b className="font-display tabular-nums">{coins(item.price)}</b>
          </span>
        ) : (
          <span className="shop-tag" data-state={state}>
            {state === 'owned' || state === 'equipped' ? (
              <Check aria-hidden strokeWidth={3} />
            ) : (
              <Lock aria-hidden />
            )}
            {state === 'full'
              ? '가득 찼어요'
              : state === 'week_done'
                ? '이번 주 샀어요'
                : label}
          </span>
        )}
      </button>
    </li>
  );
}

/** 시트 위 그림: 미리 입어 보기 (코스튬·펫) · 프레임 · 공책 · 소모품 */
function Preview({
  item,
  equipped,
  skin,
  trying,
}: {
  item: ShopItem;
  equipped: ShopStatus['equipped'];
  skin: string;
  /** 아직 안 입은 것 → "미리 보기" 꼬리표 */
  trying: boolean;
}) {
  if (item.kind === 'costume' || item.kind === 'pet')
    return (
      <Stage
        look={lookWith(equipped, item)}
        skin={skin}
        state="happy"
        size={150}
        label={`${withObjectParticle(item.name)} 입어 본 파이뱀`}
        tag={
          trying && (
            <span className="shop-try" aria-hidden>
              <Sparkles />
              미리 보기
            </span>
          )
        }
      />
    );
  return (
    <div className="shop-stage" data-kind={item.kind} data-testid="shop-stage">
      <span className="shop-floor" aria-hidden />
      <span className="shop-art-big">
        {item.kind === 'frame' ? (
          <FrameArt art={item.art} size={128} skin={skin} />
        ) : item.kind === 'editor_theme' ? (
          <ThemeArt art={item.art} size={176} />
        ) : (
          <ShopItemArt item={item} size={128} />
        )}
      </span>
    </div>
  );
}

function ItemDetail({
  item,
  status,
  state,
  confirm,
  busy,
  error,
  onAsk,
  onBack,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  status: ShopStatus;
  state: ItemState;
  confirm: boolean;
  busy: boolean;
  error: string | null;
  onAsk: () => void;
  onBack: () => void;
  onBuy: () => void;
  onEquip: (on: boolean) => void;
}) {
  const words = wearWords(item);
  const limit = weeklyLimitOf(item);
  const left = status.coins - item.price;
  const have =
    item.kind === 'consumable'
      ? item.id === 'golden_key'
        ? `${status.golden_keys}개`
        : `${status.shields}/${MAX_SHIELDS}`
      : null;

  return (
    <div className="shop-detail" data-state={state}>
      <p className="shop-detail-meta">
        <span className="shop-rarity" data-rarity={item.rarity}>
          {RARITY_LABEL[item.rarity]}
        </span>
        <span>{KIND_LABEL[item.kind]}</span>
        {have && (
          <span>
            가진 것 <b className="tabular-nums">{have}</b>
          </span>
        )}
      </p>
      <p className="shop-detail-text">{item.description}</p>
      {limit !== null && (
        <p className="shop-detail-limit">
          이번 주 {status.bought_this_week[item.id] ?? 0}/{limit}개 샀어요 ·
          월요일 {nextMonday(status.week_start)}에 다시 열려요
        </p>
      )}

      {error && (
        <p className="shop-err" role="alert" data-testid="shop-error-text">
          {error}
        </p>
      )}

      {state === 'buy' &&
        (left < 0 ? (
          <Shortfall need={-left} />
        ) : confirm ? (
          <div className="shop-confirm" data-testid="shop-confirm">
            <p className="shop-confirm-q font-display">정말 살까요?</p>
            <dl className="shop-bill">
              <div>
                <dt>가격</dt>
                <dd>
                  <RewardIcon kind="coin" size={18} />
                  <b className="tabular-nums">{coins(item.price)}</b>
                </dd>
              </div>
              <div>
                <dt>지금 코인</dt>
                <dd className="tabular-nums">{coins(status.coins)}</dd>
              </div>
              <div className="shop-bill-left">
                <dt>사고 나면 남는 코인</dt>
                <dd>
                  <b className="font-display tabular-nums">{coins(left)}</b>
                </dd>
              </div>
            </dl>
            <div className="shop-actions">
              <Button
                variant="reward"
                loading={busy}
                sfx={false}
                icon={<RewardIcon kind="coin" size={22} />}
                onClick={onBuy}
                data-testid="shop-buy-confirm"
              >
                살래요!
              </Button>
              <Button variant="ghost" disabled={busy} onClick={onBack}>
                다시 생각할래요
              </Button>
            </div>
          </div>
        ) : (
          <div className="shop-actions">
            <Button
              icon={<RewardIcon kind="coin" size={22} />}
              sfx={false}
              onClick={onAsk}
              data-testid="shop-buy"
            >
              {coins(item.price)}코인으로 사기
            </Button>
          </div>
        ))}

      {(state === 'owned' || state === 'equipped') && (
        <div className="shop-actions">
          {state === 'equipped' && (
            <p className="shop-now">
              <Check aria-hidden strokeWidth={3} />
              지금{' '}
              {words.now === '함께 다녀요'
                ? '함께 다니고 있어요'
                : `${words.now}이에요`}
            </p>
          )}
          <Button
            variant={state === 'equipped' ? 'secondary' : 'primary'}
            loading={busy}
            icon={state === 'owned' ? <Shirt aria-hidden /> : undefined}
            onClick={() => onEquip(state === 'owned')}
            data-testid="shop-equip"
          >
            {state === 'owned' ? words.on : words.off}
          </Button>
        </div>
      )}

      {(state === 'week_done' || state === 'full') && (
        <p className="shop-info">
          <Lock aria-hidden />
          {state === 'week_done'
            ? `이번 주에는 벌써 샀어요. 월요일(${nextMonday(status.week_start)})에 다시 살 수 있어요.`
            : `${stateLabel(item, state)}. 하나를 쓰고 나면 또 살 수 있어요.`}
        </p>
      )}
    </div>
  );
}

/** 코인 부족: 모자란 만큼 + 코인 모으는 방법 */
function Shortfall({ need }: { need: number }) {
  return (
    <div className="shop-short" data-testid="shop-short">
      <p className="shop-short-t">
        <Coins aria-hidden />
        <span>
          코인이 <b className="font-display tabular-nums">{coins(need)}</b>개
          모자라요
        </span>
      </p>
      <p className="shop-short-d">괜찮아요! 이렇게 하면 코인이 모여요.</p>
      <ul className="shop-ways">
        <li>
          <Code2 aria-hidden />
          퀘스트 풀기
        </li>
        <li>
          <ListChecks aria-hidden />
          오늘의 미션
        </li>
        <li>
          <CalendarCheck aria-hidden />
          출석 도장
        </li>
        <li>
          <Award aria-hidden />
          업적 코인
        </li>
      </ul>
      <Button href="/world" icon={<Map aria-hidden />} className="w-full">
        코인 모으러 가기
      </Button>
    </div>
  );
}

function Closet({
  status,
  items,
  skin,
  onOpen,
  onShop,
}: {
  status: ShopStatus;
  items: ShopItem[];
  skin: string;
  onOpen: (id: string) => void;
  onShop: () => void;
}) {
  const groups = useMemo(
    () =>
      KIND_ORDER.filter((k) => k !== 'consumable')
        .map((k) => ({ kind: k, list: items.filter((i) => i.kind === k) }))
        .filter((g) => g.list.length > 0),
    [items],
  );
  return (
    <div className="shop-closet" data-testid="shop-closet">
      <ul className="shop-bag" aria-label="가방">
        <li>
          <RewardIcon kind="key" size={28} />
          황금키
          <b className="font-display tabular-nums">{status.golden_keys}개</b>
        </li>
        <li>
          <RewardIcon kind="shield" size={28} />
          방패
          <b className="font-display tabular-nums">
            {status.shields}/{MAX_SHIELDS}
          </b>
        </li>
      </ul>
      {groups.length === 0 ? (
        <div className="shop-state" data-testid="shop-closet-empty">
          <PybaemStatic state="think" size={104} label="" />
          <p className="shop-state-t font-display">아직 옷장이 비어 있어요</p>
          <p className="shop-state-d">
            상점에서 마음에 드는 물건을 골라 입어 봐요!
          </p>
          <Button icon={<Store aria-hidden />} onClick={onShop}>
            상점 둘러보기
          </Button>
        </div>
      ) : (
        groups.map((g) => (
          <section
            key={g.kind}
            className="shop-shelf"
            aria-label={KIND_LABEL[g.kind]}
          >
            <h2 className="shop-shelf-t font-display">
              {KIND_ICON[g.kind]}
              {KIND_LABEL[g.kind]}
            </h2>
            <ul className="shop-grid">
              {g.list.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  state={itemState(item, status)}
                  short={false}
                  skin={skin}
                  onOpen={() => onOpen(item.id)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
