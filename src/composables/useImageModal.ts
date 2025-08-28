/**
 * useImageModal: 画像モーダルの状態管理と（デッキ基準の）ナビゲーションを提供するコンポーザブル
 * 仕様:
 * - selectedIndex: デッキに存在しないカードは null
 * - ナビゲーション対象: 引数で受け取る sortedDeckCards（外部から提供されるリアクティブ配列）
 * - 外部I/O: 画像URLキャッシュ(globalImageUrlCache)のみ／例外は発生させない
 */
import { shallowRef, computed, triggerRef, watch, type Ref } from "vue";
import type { Card, DeckCard } from "../types";
import { getCardImageUrlSafe, globalImageUrlCache, logger } from "../utils";
import { useCardsStore } from "../stores";

/**
 * 画像モーダル状態の型定義
 */
interface ImageModalState {
  isVisible: boolean;
  selectedCard: Card | null;
  selectedImage: string | null;
  selectedIndex: number | null;
}

/**
 * 画像モーダル関連の状態管理とロジックを提供するコンポーザブル
 */
export function useImageModal(sortedDeckCards: Ref<readonly DeckCard[]>) {
  // Vue 3.5の新機能: shallowRef を使用したパフォーマンス最適化
  const imageModalState = shallowRef<ImageModalState>({
    isVisible: false,
    selectedCard: null,
    selectedImage: null,
    selectedIndex: null,
  });

  // ストアはコンポーザブル初期化時に1度だけ取得
  const cardsStore = useCardsStore();

  /**
   * 画像URLをキャッシュから高速取得
   */
  const getCachedImageUrl = (cardId: string): string => {
    const cached = globalImageUrlCache.get(cardId);
    if (cached) {
      return cached;
    }

    // getCardImageUrlSafe は内部でフォールバックを処理するため直接呼び出し
    const imageUrl = getCardImageUrlSafe(cardId);
    globalImageUrlCache.set(cardId, imageUrl);
    return imageUrl;
  };

  /**
   * Vue 3.5の新機能: より効率的な状態更新
   */
  const updateImageModalState = (updates: Partial<ImageModalState>) => {
    Object.assign(imageModalState.value, updates);
    triggerRef(imageModalState); // 手動でリアクティブ更新をトリガー
  };

  /**
   * カード画像を拡大表示
   */
  const openImageModal = (cardId: string) => {
    const card = cardsStore.getCardById(cardId);

    if (card) {
      // デッキ内に存在すればそのインデックス、無ければnull
      const idxInDeck = sortedDeckCards.value.findIndex(
        (dc) => dc.card.id === cardId,
      );
      updateImageModalState({
        selectedCard: card,
        selectedIndex: idxInDeck >= 0 ? idxInDeck : null,
        selectedImage: getCachedImageUrl(cardId),
        isVisible: true,
      });
    } else {
      logger.warn("[useImageModal] カード未検出", { cardId });
    }
  };

  /**
   * モーダルを閉じる
   */
  const closeImageModal = () => {
    updateImageModalState({
      isVisible: false,
      selectedImage: null,
      selectedCard: null,
      selectedIndex: null,
    });
  };

  /**
   * カードナビゲーション
   */
  const handleCardNavigation = (direction: "previous" | "next") => {
    const deckCards = sortedDeckCards.value; // 引数で受け取ったデッキから取得
    const currentIndex = imageModalState.value.selectedIndex;
    if (currentIndex === null) return;

    let newIndex: number;

    if (direction === "previous") {
      newIndex = currentIndex - 1;
    } else {
      newIndex = currentIndex + 1;
    }

    // 境界チェック
    if (newIndex < 0 || newIndex >= deckCards.length) {
      return;
    }

    const newDeckCard = deckCards[newIndex];

    // Vue 3.5の新機能を使用した状態更新
    updateImageModalState({
      selectedCard: newDeckCard.card,
      selectedIndex: newIndex,
      selectedImage: getCachedImageUrl(newDeckCard.card.id),
    });
  };

  // 計算プロパティ
  const isVisible = computed(() => imageModalState.value.isVisible);
  const selectedCard = computed(() => imageModalState.value.selectedCard);
  const selectedImage = computed(() => imageModalState.value.selectedImage);
  const selectedIndex = computed(() => imageModalState.value.selectedIndex);

  // モーダル表示中にデッキが変わった場合の追従
  watch(
    sortedDeckCards,
    (cards) => {
      if (
        !imageModalState.value.isVisible ||
        !imageModalState.value.selectedCard
      )
        return;
      const id = imageModalState.value.selectedCard.id;
      const idx = cards.findIndex((dc) => dc.card.id === id);
      if (idx === -1) {
        // 現在のカードがデッキから消えた場合はクローズ（または最寄りに移動する等の仕様も可）
        closeImageModal();
      } else {
        updateImageModalState({ selectedIndex: idx });
      }
    },
    { deep: false },
  );

  return {
    // 状態
    isVisible,
    selectedCard,
    selectedImage,
    selectedIndex,

    // アクション
    openImageModal,
    closeImageModal,
    handleCardNavigation,
  };
}
