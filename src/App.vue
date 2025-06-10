<script setup lang="ts">
import { onMounted, defineAsyncComponent, ref, computed, nextTick } from "vue";

import { useAppStore } from "./stores";
import { CardListSection, DeckSection } from "./components";
import type { Card } from "./types";
import { getCardImageUrlSafe } from "./utils/imageHelpers";

// 遅延ロードコンポーネント（プリフェッチ設定付き）
const ConfirmModal = defineAsyncComponent({
  loader: () => import("./components/modals/ConfirmModal.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 200,
  timeout: 3000,
});

const DeckCodeModal = defineAsyncComponent({
  loader: () => import("./components/modals/DeckCodeModal.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 200,
  timeout: 3000,
});

const FilterModal = defineAsyncComponent({
  loader: () => import("./components/modals/FilterModal.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 200,
  timeout: 3000,
});

const CardImageModal = defineAsyncComponent({
  loader: () => import("./components/modals/CardImageModal.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 200,
  timeout: 3000,
});

// ストア初期化
const appStore = useAppStore();
const { cardsStore, deckStore, filterStore, deckCodeStore } = appStore;

// アプリケーションの初期化
onMounted(appStore.initializeApp);

// モーダルの状態（最適化版）
const imageModalState = ref({
  isVisible: false,
  selectedCard: null as Card | null,
  selectedImage: null as string | null,
  selectedIndex: null as number | null,
});

// 計算プロパティを使用した最適化
const sortedDeckCards = computed(() => deckStore.sortedDeckCards);
const sortedDeckCardsLength = computed(() => sortedDeckCards.value.length);

// カード画像を拡大表示（最適化版）
const openImageModal = async (cardId: string) => {
  const cards = sortedDeckCards.value;

  // より効率的な検索
  const cardIndex = cards.findIndex((item) => item.card.id === cardId);

  if (cardIndex !== -1) {
    const deckCard = cards[cardIndex];

    // 次の更新まで待つ
    await nextTick();

    // 状態を一括更新
    Object.assign(imageModalState.value, {
      selectedCard: deckCard.card,
      selectedIndex: cardIndex,
      selectedImage: getCardImageUrlSafe(cardId),
      isVisible: true,
    });
  }
};

// モーダルを閉じる（最適化版）
const closeImageModal = () => {
  // 状態を一括でリセット
  Object.assign(imageModalState.value, {
    isVisible: false,
    selectedImage: null,
    selectedCard: null,
    selectedIndex: null,
  });
};

// カードナビゲーション（最適化版）
const handleCardNavigation = async (direction: "previous" | "next") => {
  const currentIndex = imageModalState.value.selectedIndex;
  if (currentIndex === null) return;

  const cards = sortedDeckCards.value;
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

  // 状態を一括更新
  Object.assign(imageModalState.value, {
    selectedCard: newDeckCard.card,
    selectedIndex: newIndex,
    selectedImage: getCardImageUrlSafe(newDeckCard.card.id),
  });
};

// 条件付きレンダリングのための計算プロパティ
const shouldShowFilterModal = computed(() => filterStore.isFilterModalOpen);
const shouldShowDeckCodeModal = computed(() => deckCodeStore.showDeckCodeModal);
const shouldShowResetConfirmModal = computed(
  () => appStore.showResetConfirmModal
);
const shouldShowImageModal = computed(() => imageModalState.value.isVisible);

// デッキセクションのプロパティを計算
const deckSectionProps = computed(() => ({
  isGeneratingCode: deckCodeStore.isGeneratingCode,
  isSaving: appStore.exportStore.isSaving,
}));

// カード一覧セクションのプロパティを計算
const cardListSectionProps = computed(() => ({
  availableCards: cardsStore.availableCards,
  sortedAndFilteredCards: filterStore.sortedAndFilteredCards,
  isLoading: cardsStore.isLoading,
  error: cardsStore.error?.message || null,
}));

// デッキコードモーダルのプロパティを計算
const deckCodeModalProps = computed(() => ({
  isVisible: deckCodeStore.showDeckCodeModal,
  deckCode: deckCodeStore.deckCode,
  importDeckCode: deckCodeStore.importDeckCode,
  error: deckCodeStore.error,
}));

// カード画像モーダルのプロパティを計算
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
        ref="deckSectionRef"
        v-bind="deckSectionProps"
        @generate-deck-code="deckCodeStore.generateAndShowDeckCode"
        @save-deck-as-png="appStore.saveDeckAsPng"
        @reset-deck="appStore.resetDeck"
        @open-image-modal="openImageModal"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />

      <!-- カード一覧セクション -->
      <CardListSection
        v-bind="cardListSectionProps"
        @open-filter="filterStore.openFilterModal"
        @add-card="deckStore.addCardToDeck"
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
