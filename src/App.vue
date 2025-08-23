<script setup lang="ts">
import { onMounted, computed, useTemplateRef, watchEffect } from "vue";
import { useIntervalFn } from "@vueuse/core";

import { useAppStore } from "./stores";
import {
  CardListSection,
  DeckSection,
  ConfirmModal,
  DeckCodeModal,
  FilterModal,
  CardImageModal,
  DeckManagementModal,
} from "./components";
import { cleanupStaleEntries } from "./utils";
import { CACHE_CLEANUP_INTERVAL } from "./utils/image";

// コンポーザブル
import { useImageModal } from "./composables/useImageModal";
import { useDeckCards } from "./composables/useDeckCards";
import { useAppProps } from "./composables/useAppProps";

// ストア初期化
const appStore = useAppStore();
const {
  cardsStore,
  deckStore,
  filterStore,
  deckCodeStore,
  deckManagementStore,
  exportStore,
} = appStore;

// Vue 3.5の新機能: useTemplateRef でテンプレート参照を管理
const deckSectionRef = useTemplateRef<InstanceType<typeof DeckSection>>("deckSection");

// コンポーザブルの初期化
const sortedDeckCards = computed(() => deckStore.sortedDeckCards);
const { memoizedDeckCards, sortedDeckCardsLength } = useDeckCards(sortedDeckCards);

const {
  isVisible: imageModalVisible,
  selectedCard,
  selectedImage,
  selectedIndex,
  openImageModal: openModal,
  closeImageModal,
  handleCardNavigation,
} = useImageModal();

const {
  modalVisibility,
  deckSectionProps,
  cardListSectionProps,
  deckCodeModalProps,
} = useAppProps(
  cardsStore,
  deckStore,
  filterStore,
  deckCodeStore,
  exportStore,
  deckManagementStore,
  appStore,
);

// アプリケーションの初期化
onMounted(appStore.initializeApp);

// 画像キャッシュの定期的なクリーンアップ
useIntervalFn(cleanupStaleEntries, CACHE_CLEANUP_INTERVAL, { immediate: true });

// 画像モーダルを開く（デッキカードを渡す）
const openImageModal = (cardId: string) => {
  openModal(cardId, memoizedDeckCards.value);
};

// カードナビゲーション（デッキカードを渡す）
const navigateCard = (direction: "previous" | "next") => {
  handleCardNavigation(direction, memoizedDeckCards.value);
};

// Vue 3.5の新機能: watchEffect を使用した副作用の管理
watchEffect(() => {
  const element = deckSectionRef.value;
  if (element) {
    if (appStore.deckSectionRef !== element) {
      appStore.deckSectionRef = element;
    }
  } else if (appStore.deckSectionRef !== null) {
    appStore.deckSectionRef = null;
  }
});

// カード画像モーダルのプロパティを計算
const cardImageModalProps = computed(() => ({
  isVisible: imageModalVisible.value,
  imageSrc: selectedImage.value,
  currentCard: selectedCard.value,
  cardIndex: selectedIndex.value,
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
        @open-deck-management-modal="
          deckManagementStore.openDeckManagementModal
        "
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />

      <!-- カード一覧セクション -->
      <CardListSection
        v-bind="cardListSectionProps"
        @open-filter="filterStore.openFilterModal"
        @add-card="deckStore.addCardToDeck"
        @increment-card="deckStore.incrementCardCount"
        @decrement-card="deckStore.decrementCardCount"
        @open-image-modal="openImageModal"
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />
    </div>

    <!-- フィルターモーダル -->
    <FilterModal
      v-if="modalVisibility.filter"
      :is-visible="modalVisibility.filter"
      @close="filterStore.closeFilterModal"
    />

    <!-- デッキコードモーダル -->
    <DeckCodeModal
      v-if="modalVisibility.deckCode"
      v-bind="deckCodeModalProps"
      @close="deckCodeStore.showDeckCodeModal = false"
      @update-import-code="deckCodeStore.setImportDeckCode"
      @copy-slash-code="deckCodeStore.copyDeckCode('slash')"
      @copy-kcg-code="deckCodeStore.copyDeckCode('kcg')"
      @import-code="appStore.importDeckFromCode"
    />

    <!-- デッキリセット確認モーダル -->
    <ConfirmModal
      v-if="modalVisibility.resetConfirm"
      :is-visible="modalVisibility.resetConfirm"
      title="デッキリセット"
      message="デッキ内容を全てリセットしてもよろしいですか？"
      confirm-text="リセットする"
      @confirm="appStore.confirmResetDeck"
      @cancel="appStore.cancelResetDeck"
    />

    <!-- カード画像拡大モーダル -->
    <CardImageModal
      v-if="imageModalVisible"
      v-bind="cardImageModalProps"
      @close="closeImageModal"
      @navigate="navigateCard"
    />

    <!-- デッキ管理モーダル -->
    <DeckManagementModal v-if="modalVisibility.deckManagement" />
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
