import { shallowRef, computed, triggerRef } from "vue";
import type { Card, DeckCard } from "../types";
import { getCardImageUrlSafe } from "../utils";
import { globalImageUrlCache } from "../utils/cache";

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
export function useImageModal() {
  // Vue 3.5の新機能: shallowRef を使用したパフォーマンス最適化
  const imageModalState = shallowRef<ImageModalState>({
    isVisible: false,
    selectedCard: null,
    selectedImage: null,
    selectedIndex: null,
  });

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
   * カード画像を拡大表示（Vue 3.5最適化版）
   */
  const openImageModal = (cardId: string, deckCards: readonly DeckCard[]) => {
    // より効率的な検索
    const cardIndex = deckCards.findIndex((item) => item.card.id === cardId);

    if (cardIndex !== -1) {
      const deckCard = deckCards[cardIndex];

      // Vue 3.5の新機能を使用した状態更新
      updateImageModalState({
        selectedCard: deckCard.card,
        selectedIndex: cardIndex,
        selectedImage: getCachedImageUrl(cardId),
        isVisible: true,
      });
    } else {
      console.warn(`Card with ID ${cardId} not found in deck`);
    }
  };

  /**
   * モーダルを閉じる（Vue 3.5最適化版）
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
   * カードナビゲーション（Vue 3.5最適化版）
   */
  const handleCardNavigation = (
    direction: "previous" | "next",
    deckCards: readonly DeckCard[],
  ) => {
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
    getCachedImageUrl,
  };
}
