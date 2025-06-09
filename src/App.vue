<script setup lang="ts">
import { onMounted, defineAsyncComponent, ref, provide } from "vue";

import { useAppStore } from "./stores";
import { CardListSection, DeckSection, ToastContainer } from "./components";
import type { Card } from "./types";
import { getCardImageUrlSafe } from "./utils/imageHelpers";
import type { ShowToastFunction } from "./utils/errorHandler";

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

// ストア初期化
const appStore = useAppStore();
const { cardsStore, deckStore, filterStore, toastStore, deckCodeStore } =
  appStore;

// トースト関数をアプリケーション全体で利用可能にする
const showToast: ShowToastFunction = (
  message: string,
  type: "success" | "error" | "warning" | "info" = "info"
) => {
  toastStore.showToast(message, type);
};

// 依存性注入でトースト関数を提供
provide("showToast", showToast);

// アプリケーションの初期化
onMounted(appStore.initializeApp);

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
  const cardIndex = deckStore.sortedDeckCards.findIndex(
    (item) => item.card.id === cardId
  );

  if (cardIndex !== -1) {
    const deckCard = deckStore.sortedDeckCards[cardIndex];
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

  if (newIndex >= 0 && newIndex < deckStore.sortedDeckCards.length) {
    const newDeckCard = deckStore.sortedDeckCards[newIndex];
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
    <!-- メインコンテンツエリア -->
    <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
      <!-- デッキセクション -->
      <DeckSection
        ref="deckSectionRef"
        :is-generating-code="deckCodeStore.isGeneratingCode"
        :is-saving="appStore.exportStore.isSaving"
        @generate-deck-code="deckCodeStore.generateAndShowDeckCode"
        @save-deck-as-png="appStore.saveDeckAsPng"
        @reset-deck="appStore.resetDeck"
        @open-image-modal="openImageModal"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />

      <!-- カード一覧セクション -->
      <CardListSection
        :available-cards="cardsStore.availableCards"
        :sorted-and-filtered-cards="filterStore.sortedAndFilteredCards"
        :is-loading="cardsStore.isLoading"
        :error="cardsStore.error?.message || null"
        @open-filter="filterStore.openFilterModal"
        @add-card="deckStore.addCardToDeck"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />
    </div>

    <!-- フィルターモーダル -->
    <FilterModal
      :is-visible="filterStore.isFilterModalOpen"
      @close="filterStore.closeFilterModal"
    />

    <!-- デッキコードモーダル -->
    <DeckCodeModal
      :is-visible="deckCodeStore.showDeckCodeModal"
      :deck-code="deckCodeStore.deckCode"
      :import-deck-code="deckCodeStore.importDeckCode"
      :error="deckCodeStore.error"
      @close="deckCodeStore.showDeckCodeModal = false"
      @update-import-code="deckCodeStore.setImportDeckCode"
      @copy-code="deckCodeStore.copyDeckCode"
      @import-code="appStore.importDeckFromCode"
    />

    <!-- デッキリセット確認モーダル -->
    <ConfirmModal
      :is-visible="appStore.showResetConfirmModal"
      title="デッキリセット"
      message="デッキ内容を全てリセットしてもよろしいですか？"
      confirm-text="リセットする"
      @confirm="appStore.confirmResetDeck"
      @cancel="appStore.cancelResetDeck"
    />

    <!-- カード画像拡大モーダル -->
    <CardImageModal
      :is-visible="imageModalState.isVisible"
      :image-src="imageModalState.selectedImage"
      :current-card="imageModalState.selectedCard"
      :card-index="imageModalState.selectedIndex"
      :total-cards="deckStore.sortedDeckCards.length"
      @close="closeImageModal"
      @navigate="handleCardNavigation"
    />

    <!-- トーストコンテナ -->
    <ToastContainer
      :toasts="toastStore.toasts"
      @remove-toast="toastStore.removeToast"
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
