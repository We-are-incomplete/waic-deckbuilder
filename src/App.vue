<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { useCards } from "./composables/useCards";
import { useDeck } from "./composables/useDeck";
import { useExport } from "./composables/useExport";
import { useFilter } from "./composables/useFilter";

import CardListSection from "./components/layout/CardListSection.vue";
import DeckSection from "./components/layout/DeckSection.vue";
import ConfirmModal from "./components/modals/ConfirmModal.vue";
import DeckCodeModal from "./components/modals/DeckCodeModal.vue";
import FilterModal from "./components/modals/FilterModal.vue";

// ===================================
// コンポーザブル
// ===================================

const { availableCards, isLoading, error, loadCards } = useCards();

const {
  deckCards,
  deckName,
  deckCode,
  importDeckCode,
  isGeneratingCode,
  showDeckCodeModal,
  showResetConfirmModal,
  error: deckError,
  sortedDeckCards,
  totalDeckCards,
  addCardToDeck,
  incrementCardCount,
  decrementCardCount,
  resetDeck,
  confirmResetDeck,
  cancelResetDeck,
  generateAndShowDeckCode,
  copyDeckCode,
  importDeckFromCode,
  initializeDeck,
  setDeckName,
  setImportDeckCode,
} = useDeck();

const {
  isFilterModalOpen,
  filterCriteria,
  getAllTags,
  getSortedAndFilteredCards,
  openFilterModal,
  closeFilterModal,
  updateFilterCriteria,
  allKinds,
  allTypes,
} = useFilter();

const { isSaving, saveDeckAsPng: exportSaveDeckAsPng } = useExport();

// ===================================
// テンプレート参照
// ===================================

const deckSectionRef = ref<InstanceType<typeof DeckSection> | null>(null);

// ===================================
// 算出プロパティ
// ===================================

/**
 * 全タグリスト（優先タグを先頭に配置）
 */
const allTags = computed(() => getAllTags(availableCards.value));

/**
 * ソート・フィルター済みカード一覧
 */
const sortedAndFilteredAvailableCards = computed(() =>
  getSortedAndFilteredCards(availableCards.value)
);

// ===================================
// メソッド
// ===================================

/**
 * デッキをPNG画像として保存
 */
const saveDeckAsPng = async (): Promise<void> => {
  const exportContainer = deckSectionRef.value?.exportContainer;
  if (exportContainer) {
    try {
      await exportSaveDeckAsPng(deckName.value, exportContainer);
    } catch (error) {
      console.error("デッキ画像の保存中にエラーが発生しました:", error);
    }
  }
};

/**
 * デッキコードからインポート（availableCardsを渡す）
 */
const handleImportDeckFromCode = (): void => {
  importDeckFromCode(availableCards.value);
};

// ===================================
// ライフサイクル
// ===================================

/**
 * コンポーネントマウント時の処理
 */
onMounted(async () => {
  try {
    await loadCards();
    // カードが読み込まれた後にデッキを初期化
    initializeDeck(availableCards.value);
  } catch (error) {
    console.error("カードの読み込み中にエラーが発生しました:", error);
  }
});
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
        class="lg:w-1/2 lg:h-full overflow-y-auto"
      />

      <!-- カード一覧セクション -->
      <CardListSection
        :available-cards="availableCards"
        :sorted-and-filtered-cards="sortedAndFilteredAvailableCards"
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
      :error="deckError"
      @close="showDeckCodeModal = false"
      @update-import-code="setImportDeckCode"
      @copy-code="copyDeckCode"
      @import-code="handleImportDeckFromCode"
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
