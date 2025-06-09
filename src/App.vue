<script setup lang="ts">
import { onMounted, defineAsyncComponent, ref } from "vue";

import { useApp } from "./composables";
import { CardListSection, DeckSection, ToastContainer } from "./components";
import type { Card } from "./types";
import { getCardImageUrlSafe } from "./utils/imageHelpers";

const ConfirmModal = defineAsyncComponent(
  () => import("./components/modals/ConfirmModal.vue")
);
const DeckCodeModal = defineAsyncComponent(
  () => import("./components/modals/DeckCodeModal.vue")
);
const FilterModal = defineAsyncComponent(
  () => import("./components/modals/FilterModal.vue")
);
const CardImageModal = defineAsyncComponent(
  () => import("./components/modals/CardImageModal.vue")
);

// アプリケーション状態の初期化
const {
  // Template refs
  deckSectionRef,

  // State
  availableCards,
  isLoading,
  error,
  deckCards,
  deckName,
  sortedDeckCards,
  totalDeckCards,
  deckCode,
  importDeckCode,
  isGeneratingCode,
  showDeckCodeModal,
  deckCodeError,
  showResetConfirmModal,
  toasts,
  isFilterModalOpen,
  filterCriteria,
  allTags,
  sortedAndFilteredCards,
  allKinds,
  allTypes,
  isSaving,

  // Actions
  addCardToDeck,
  incrementCardCount,
  decrementCardCount,
  setDeckName,
  generateAndShowDeckCode,
  copyDeckCode,
  importDeckFromCode,
  setImportDeckCode,
  resetDeck,
  confirmResetDeck,
  cancelResetDeck,
  removeToast,
  openFilterModal,
  closeFilterModal,
  updateFilterCriteria,
  saveDeckAsPng,
  initializeApp,
} = useApp();

// アプリケーションの初期化
onMounted(initializeApp);

// モーダルの状態
const imageModalState = ref({
  isVisible: false,
  selectedCard: null as Card | null,
  selectedImage: null as string | null,
  selectedIndex: null as number | null,
});

// カード画像を拡大表示
const openImageModal = (cardId: string) => {
  // 単一の検索で deckCard と index を同時に取得
  const cardIndex = sortedDeckCards.value.findIndex(
    (item) => item.card.id === cardId
  );

  if (cardIndex !== -1) {
    const deckCard = sortedDeckCards.value[cardIndex];
    imageModalState.value.selectedCard = deckCard.card;
    imageModalState.value.selectedIndex = cardIndex;
    imageModalState.value.selectedImage = getCardImageUrlSafe(cardId);
    imageModalState.value.isVisible = true;
  }
};

// モーダルを閉じる
const closeImageModal = () => {
  imageModalState.value.isVisible = false;
  imageModalState.value.selectedImage = null;
  imageModalState.value.selectedCard = null;
  imageModalState.value.selectedIndex = null;
};

// カードナビゲーション
const handleCardNavigation = (direction: "previous" | "next") => {
  if (imageModalState.value.selectedIndex === null) return;

  let newIndex: number;
  if (direction === "previous") {
    newIndex = imageModalState.value.selectedIndex - 1;
  } else {
    newIndex = imageModalState.value.selectedIndex + 1;
  }

  if (newIndex >= 0 && newIndex < sortedDeckCards.value.length) {
    const newDeckCard = sortedDeckCards.value[newIndex];
    imageModalState.value.selectedCard = newDeckCard.card;
    imageModalState.value.selectedIndex = newIndex;
    imageModalState.value.selectedImage = getCardImageUrlSafe(
      newDeckCard.card.id
    );
  }
};
</script>

<template>
  <div
    class="flex flex-col lg:flex-row h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-sans relative overflow-hidden"
    @contextmenu.prevent
    @selectstart.prevent
  >
    <!-- 背景アニメーション -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        class="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-500/5 to-purple-600/5 rounded-full blur-3xl animate-pulse"
      ></div>
      <div
        class="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 rounded-full blur-3xl animate-pulse"
        style="animation-delay: 2s"
      ></div>
    </div>

    <!-- メインコンテンツエリア -->
    <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
      <!-- デッキセクション -->
      <DeckSection
        ref="deckSectionRef"
        :deck-cards="deckCards"
        :deck-name="deckName"
        :sorted-deck-cards="sortedDeckCards"
        :total-deck-cards="totalDeckCards"
        :is-generating-code="isGeneratingCode"
        :is-saving="isSaving"
        @update-deck-name="setDeckName"
        @generate-deck-code="generateAndShowDeckCode"
        @save-deck-as-png="saveDeckAsPng"
        @reset-deck="resetDeck"
        @increment-card-count="incrementCardCount"
        @decrement-card-count="decrementCardCount"
        @open-image-modal="openImageModal"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />

      <!-- カード一覧セクション -->
      <CardListSection
        :available-cards="availableCards"
        :sorted-and-filtered-cards="sortedAndFilteredCards"
        :is-loading="isLoading"
        :error="error"
        @open-filter="openFilterModal"
        @add-card="addCardToDeck"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />
    </div>

    <!-- フィルターモーダル -->
    <FilterModal
      :is-visible="isFilterModalOpen"
      :filter-criteria="filterCriteria"
      :all-kinds="allKinds"
      :all-types="allTypes"
      :all-tags="allTags"
      @close="closeFilterModal"
      @update-filter="updateFilterCriteria"
    />

    <!-- デッキコードモーダル -->
    <DeckCodeModal
      :is-visible="showDeckCodeModal"
      :deck-code="deckCode"
      :import-deck-code="importDeckCode"
      :error="deckCodeError"
      @close="showDeckCodeModal = false"
      @update-import-code="setImportDeckCode"
      @copy-code="copyDeckCode"
      @import-code="importDeckFromCode"
    />

    <!-- デッキリセット確認モーダル -->
    <ConfirmModal
      :is-visible="showResetConfirmModal"
      title="デッキリセット"
      message="デッキ内容を全てリセットしてもよろしいですか？"
      confirm-text="リセットする"
      @confirm="confirmResetDeck"
      @cancel="cancelResetDeck"
    />

    <!-- カード画像拡大モーダル -->
    <CardImageModal
      :is-visible="imageModalState.isVisible"
      :image-src="imageModalState.selectedImage"
      :current-card="imageModalState.selectedCard"
      :card-index="imageModalState.selectedIndex"
      :total-cards="sortedDeckCards.length"
      @close="closeImageModal"
      @navigate="handleCardNavigation"
    />

    <!-- トーストコンテナ -->
    <ToastContainer :toasts="toasts" @remove-toast="removeToast" />
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
