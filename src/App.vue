<script setup lang="ts">
import {
  onMounted,
  computed,
  nextTick,
  useTemplateRef,
  watchEffect,
  shallowRef,
  triggerRef,
} from "vue";

import { useAppStore } from "./stores";
import {
  CardListSection,
  DeckSection,
  ConfirmModal,
  DeckCodeModal,
  FilterModal,
  CardImageModal,
} from "./components";
import type { Card, DeckCard } from "./types";
import { getCardImageUrlSafe, safeSyncOperation } from "./utils";

// ストア初期化
const appStore = useAppStore();
const { cardsStore, deckStore, filterStore, deckCodeStore } = appStore;

// Vue 3.5の新機能: useTemplateRef でテンプレート参照を管理
const deckSectionRef =
  useTemplateRef<InstanceType<typeof DeckSection>>("deckSection");

// アプリケーションの初期化
onMounted(appStore.initializeApp);

// Vue 3.5の新機能: shallowRef を使用したパフォーマンス最適化
// 深い監視が不要なオブジェクトには shallowRef を使用
const imageModalState = shallowRef({
  isVisible: false,
  selectedCard: null as Card | null,
  selectedImage: null as string | null,
  selectedIndex: null as number | null,
});

// キャッシュされた計算プロパティ（再計算を最小化）
const cardListCache = new Map<string, readonly DeckCard[]>();
// LRU Cache implementation
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
}

const imageUrlCache = new LRUCache<string, string>(500);

// 画像URLを高速取得（キャッシュ利用）
const getCachedImageUrl = (cardId: string): string => {
  const cached = imageUrlCache.get(cardId);
  if (cached) {
    return cached;
  }

  const result = safeSyncOperation(
    () => getCardImageUrlSafe(cardId),
    `Failed to get image URL for card ${cardId}`
  );

  if (result.isOk()) {
    imageUrlCache.set(cardId, result.value);
    return result.value;
  }

  // エラーログは safeSyncOperation 内で処理済み
  return `${import.meta.env.BASE_URL}placeholder.avif`; // フォールバック
};

// 計算プロパティを使用した最適化（Vue 3.5の改善されたreactivity）
const sortedDeckCards = computed(() => deckStore.sortedDeckCards);
const sortedDeckCardsLength = computed(() => sortedDeckCards.value.length);

// メモ化された計算プロパティ（不要な再レンダリングを防止）
const memoizedDeckCards = computed<readonly DeckCard[]>(() => {
  const cards = sortedDeckCards.value;
  const key = cards.map((item) => `${item.card.id}:${item.count}`).join(",");

  if (cardListCache.has(key)) {
    return cardListCache.get(key)!;
  }

  // LRU戦略でキャッシュサイズ制限
  if (cardListCache.size >= 10) {
    const firstKey = cardListCache.keys().next().value;
    if (firstKey) {
      cardListCache.delete(firstKey);
    }
  }

  cardListCache.set(key, cards);
  return cards;
});

// Vue 3.5の新機能: より効率的な状態更新
const updateImageModalState = (
  updates: Partial<typeof imageModalState.value>
) => {
  Object.assign(imageModalState.value, updates);
  triggerRef(imageModalState); // 手動でリアクティブ更新をトリガー
};

// カード画像を拡大表示（Vue 3.5最適化版）
const openImageModal = async (cardId: string) => {
  const cards = memoizedDeckCards.value;

  // より効率的な検索
  const cardIndex = cards.findIndex((item) => item.card.id === cardId);

  if (cardIndex !== -1) {
    const deckCard = cards[cardIndex];

    // 次の更新まで待つ
    await nextTick();

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

// モーダルを閉じる（Vue 3.5最適化版）
const closeImageModal = () => {
  updateImageModalState({
    isVisible: false,
    selectedImage: null,
    selectedCard: null,
    selectedIndex: null,
  });
};

// カードナビゲーション（Vue 3.5最適化版）
const handleCardNavigation = async (direction: "previous" | "next") => {
  const currentIndex = imageModalState.value.selectedIndex;
  if (currentIndex === null) return;

  const cards = memoizedDeckCards.value;
  let newIndex: number;

  if (direction === "previous") {
    newIndex = currentIndex - 1;
  } else {
    newIndex = currentIndex + 1;
  }

  // 境界チェック
  if (newIndex < 0 || newIndex >= cards.length) {
    return;
  }

  const newDeckCard = cards[newIndex];

  // 次の更新まで待つ
  await nextTick();

  // Vue 3.5の新機能を使用した状態更新
  updateImageModalState({
    selectedCard: newDeckCard.card,
    selectedIndex: newIndex,
    selectedImage: getCachedImageUrl(newDeckCard.card.id),
  });
};

// Vue 3.5の新機能: watchEffect を使用した副作用の管理
watchEffect(() => {
  const element = deckSectionRef.value;
  if (element) {
    const domElement = (element as any).$el || element;
    if (appStore.deckSectionRef !== domElement) {
      appStore.deckSectionRef = domElement;
    }
  }
});

// 条件付きレンダリングのための計算プロパティ（Vue 3.5の改善されたreactivity）
const shouldShowFilterModal = computed(() => filterStore.isFilterModalOpen);
const shouldShowDeckCodeModal = computed(() => deckCodeStore.showDeckCodeModal);
const shouldShowResetConfirmModal = computed(
  () => appStore.showResetConfirmModal
);
const shouldShowImageModal = computed(() => imageModalState.value.isVisible);

// デッキセクションのプロパティを計算（Vue 3.5の最適化されたcomputed）
const deckSectionProps = computed(() => ({
  isGeneratingCode: deckCodeStore.isGeneratingCode,
  isSaving: appStore.exportStore.isSaving,
}));

// カード一覧セクションのプロパティを計算（Vue 3.5の最適化されたcomputed）
const cardListSectionProps = computed(() => ({
  availableCards: cardsStore.availableCards,
  sortedAndFilteredCards: filterStore.sortedAndFilteredCards,
  deckCards: deckStore.deckCards,
  isLoading: cardsStore.isLoading,
  error: cardsStore.error?.message || null,
}));

// デッキコードモーダルのプロパティを計算（Vue 3.5の最適化されたcomputed）
const deckCodeModalProps = computed(() => ({
  isVisible: deckCodeStore.showDeckCodeModal,
  deckCode: deckCodeStore.deckCode,
  importDeckCode: deckCodeStore.importDeckCode,
  error: deckCodeStore.error?.message || null, // error オブジェクトから message を抽出
}));

// カード画像モーダルのプロパティを計算（Vue 3.5の最適化されたcomputed）
const cardImageModalProps = computed(() => ({
  isVisible: imageModalState.value.isVisible,
  imageSrc: imageModalState.value.selectedImage,
  currentCard: imageModalState.value.selectedCard,
  cardIndex: imageModalState.value.selectedIndex,
  totalCards: sortedDeckCardsLength.value,
}));
</script>

<template>
  <div
    class="flex flex-col lg:flex-row h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-sans relative overflow-hidden"
    @contextmenu.prevent
    @selectstart.prevent
  >
    <!-- メインコンテンツエリア -->
    <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
      <!-- デッキセクション -->
      <DeckSection
        ref="deckSection"
        v-bind="deckSectionProps"
        @generate-deck-code="deckCodeStore.generateAndShowDeckCode"
        @reset-deck="appStore.resetDeck"
        @open-image-modal="openImageModal"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />

      <!-- カード一覧セクション -->
      <CardListSection
        v-bind="cardListSectionProps"
        @open-filter="filterStore.openFilterModal"
        @add-card="deckStore.addCardToDeck"
        @increment-card="deckStore.incrementCardCount"
        @decrement-card="deckStore.decrementCardCount"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />
    </div>

    <!-- フィルターモーダル -->
    <FilterModal
      v-if="shouldShowFilterModal"
      :is-visible="shouldShowFilterModal"
      @close="filterStore.closeFilterModal"
    />

    <!-- デッキコードモーダル -->
    <DeckCodeModal
      v-if="shouldShowDeckCodeModal"
      v-bind="deckCodeModalProps"
      @close="deckCodeStore.showDeckCodeModal = false"
      @update-import-code="deckCodeStore.setImportDeckCode"
      @copy-code="deckCodeStore.copyDeckCode"
      @import-code="appStore.importDeckFromCode"
    />

    <!-- デッキリセット確認モーダル -->
    <ConfirmModal
      v-if="shouldShowResetConfirmModal"
      :is-visible="shouldShowResetConfirmModal"
      title="デッキリセット"
      message="デッキ内容を全てリセットしてもよろしいですか？"
      confirm-text="リセットする"
      @confirm="appStore.confirmResetDeck"
      @cancel="appStore.cancelResetDeck"
    />

    <!-- カード画像拡大モーダル -->
    <CardImageModal
      v-if="shouldShowImageModal"
      v-bind="cardImageModalProps"
      @close="closeImageModal"
      @navigate="handleCardNavigation"
    />
  </div>
</template>

<style scoped>
/* Tailwindで対応できない特殊なスタイルのみ残す */

/* デフォルトのスクロールバーを隠す */
::-webkit-scrollbar {
  display: none;
}
* {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* タッチデバイス向けのタップハイライト除去 */
@media (hover: none) {
  button {
    -webkit-tap-highlight-color: transparent;
  }
}
</style>
