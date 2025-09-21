<script setup lang="ts">
// App.vue
// 画面全体のレイアウトと各ストア/セクション/モーダルの配線を担うコンテナ。
// 初期化（カード読込・デッキ生成）とキャッシュ掃除などの副作用を集約し、
// 画像モーダルには deckCards を外部参照として渡してスワイプナビゲーションの基準を統一する。
import { onMounted, computed } from "vue";

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

// コンポーザブル
import { useImageModal } from "./composables/useImageModal";

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

// コンポーザブルの初期化
const {
  isVisible: imageModalVisible,
  selectedCard,
  selectedImage,
  selectedIndex,
  openImageModal,
  closeImageModal,
  handleCardNavigation,
} = useImageModal(computed(() => deckStore.sortedDeckCards));

// アプリケーションの初期化
onMounted(appStore.initializeApp);

// モーダル表示の条件
const modalVisibility = computed(() => ({
  filter: filterStore.isFilterModalOpen,
  deckCode: deckCodeStore.showDeckCodeModal,
  resetConfirm: appStore.showResetConfirmModal,
  deckManagement: deckManagementStore.isDeckManagementModalOpen,
}));

// デッキセクションのプロパティ
const deckSectionProps = computed(() => ({
  isGeneratingCode: deckCodeStore.isGeneratingCode,
  isSaving: exportStore.isSaving,
}));

// カード一覧セクションのプロパティ
const cardListSectionProps = computed(() => ({
  availableCards: cardsStore.availableCards,
  sortedAndFilteredCards: filterStore.sortedAndFilteredCards,
  deckCards: deckStore.deckCards,
  isLoading: cardsStore.isLoading,
  error: cardsStore.error?.message || null,
}));

// デッキコードモーダルのプロパティ
const deckCodeModalProps = computed(() => ({
  isVisible: deckCodeStore.showDeckCodeModal,
  slashDeckCode: deckCodeStore.slashDeckCode,
  kcgDeckCode: deckCodeStore.kcgDeckCode,
  importDeckCode: deckCodeStore.importDeckCode,
  error: deckCodeStore.error?.message || null,
}));

// カード画像モーダルのプロパティを計算
const cardImageModalProps = computed(() => ({
  isVisible: imageModalVisible.value,
  imageSrc: selectedImage.value,
  currentCard: selectedCard.value,
  cardIndex: selectedIndex.value,
  totalCards: deckStore.sortedDeckCards.length,
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
      :is-visible="modalVisibility.filter"
      @close="filterStore.closeFilterModal"
    />

    <!-- デッキコードモーダル -->
    <DeckCodeModal
      v-bind="deckCodeModalProps"
      @close="deckCodeStore.showDeckCodeModal = false"
      @update-import-code="deckCodeStore.setImportDeckCode"
      @copy-slash-code="deckCodeStore.copyDeckCode('slash')"
      @copy-kcg-code="deckCodeStore.copyDeckCode('kcg')"
      @import-code="appStore.importDeckFromCode"
    />

    <!-- デッキリセット確認モーダル -->
    <ConfirmModal
      :is-visible="modalVisibility.resetConfirm"
      title="デッキリセット"
      message="デッキ内容を全てリセットしてもよろしいですか？"
      confirm-text="リセットする"
      @confirm="appStore.confirmResetDeck"
      @cancel="appStore.cancelResetDeck"
    />

    <!-- カード画像拡大モーダル -->
    <CardImageModal
      v-bind="cardImageModalProps"
      @close="closeImageModal"
      @navigate="handleCardNavigation"
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
