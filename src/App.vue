<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useCards } from "./composables/useCards";
import { useDeck } from "./composables/useDeck";
import { useFilter } from "./composables/useFilter";
import { useExport } from "./composables/useExport";
import { getCardImageUrl, handleImageError } from "./utils/image";

// ===================================
// コンポーザブルの使用 - Using Composables
// ===================================

const { availableCards, isLoading, error, loadCards } = useCards();

const {
  deckCards,
  deckName,
  deckCode,
  importDeckCode,
  isGeneratingCode,
  showDeckCodeModal,
  sortedDeckCards,
  totalDeckCards,
  addCardToDeck,
  incrementCardCount,
  decrementCardCount,
  resetDeck,
  generateAndShowDeckCode,
  copyDeckCode,
  importDeckFromCode,
  initializeDeck,
} = useDeck();

const {
  isFilterModalOpen,
  filterCriteria,
  getAllTags,
  getSortedAndFilteredCards,
  openFilterModal,
  closeFilterModal,
  allKinds,
  allTypes,
} = useFilter();

const {
  isSaving,
  exportContainer,
  saveDeckAsPng: exportSaveDeckAsPng,
  calculateCardWidth,
  EXPORT_CONFIG,
} = useExport();

// ===================================
// Computed Properties - 算出プロパティ
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
// メソッド - Methods
// ===================================

/**
 * デッキをPNG画像として保存
 */
const saveDeckAsPng = async (): Promise<void> => {
  await exportSaveDeckAsPng(deckName.value, deckCards.value);
};

/**
 * デッキコードからインポート（availableCardsを渡す）
 */
const handleImportDeckFromCode = (): void => {
  importDeckFromCode(availableCards.value);
};

// ===================================
// ライフサイクル - Lifecycle
// ===================================

/**
 * コンポーネントマウント時の処理
 */
onMounted(async () => {
  await loadCards();
  // カードが読み込まれた後にデッキを初期化
  initializeDeck(availableCards.value);
});
</script>

<template>
  <div
    class="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-sans relative overflow-hidden"
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

    <!-- デッキセクション -->
    <div
      class="flex flex-col flex-grow-0 h-1/2 p-1 sm:p-2 border-b border-slate-700/50 overflow-hidden relative z-10 backdrop-blur-sm"
    >
      <!-- デッキ名入力 (モバイル優先) -->
      <div class="mb-1 px-1">
        <div class="flex items-center w-full">
          <label
            for="deckName"
            class="mr-1 sm:mr-2 text-xs font-medium text-slate-300 whitespace-nowrap"
            >デッキ名:</label
          >
          <input
            id="deckName"
            type="text"
            v-model="deckName"
            class="flex-grow px-1 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-base rounded bg-slate-800/80 border border-slate-600/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm placeholder-slate-400"
            placeholder="デッキ名を入力"
          />
        </div>
      </div>

      <!-- ボタン群 (モバイル最適化) -->
      <div class="flex flex-wrap gap-1 mb-1 px-1">
        <button
          @click="generateAndShowDeckCode"
          :disabled="isGeneratingCode"
          class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded text-xs font-medium hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          title="デッキコードの入出力"
        >
          <span
            v-if="!isGeneratingCode"
            class="flex items-center justify-center gap-1"
          >
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              ></path>
            </svg>
            <span class="hidden sm:inline">デッキコード</span>
            <span class="sm:hidden">コード</span>
          </span>
          <span v-else class="flex items-center justify-center gap-1">
            <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            生成中...
          </span>
        </button>
        <button
          @click="saveDeckAsPng"
          :disabled="deckCards.length === 0 || isSaving"
          class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded text-xs font-medium hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
          title="デッキ画像を保存"
        >
          <span v-if="!isSaving" class="flex items-center justify-center gap-1">
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <span class="hidden sm:inline">デッキ画像保存</span>
            <span class="sm:hidden">画像保存</span>
          </span>
          <span v-else class="flex items-center justify-center gap-1">
            <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            保存中...
          </span>
        </button>
        <button
          @click="resetDeck"
          :disabled="deckCards.length === 0"
          class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-red-600 to-red-700 text-white rounded text-xs font-medium hover:from-red-700 hover:to-red-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-red-500/25"
          title="デッキをリセット"
        >
          <span class="flex items-center justify-center gap-1">
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path>
            </svg>
            <span class="hidden sm:inline">リセット</span>
            <span class="sm:hidden">リセット</span>
          </span>
        </button>
      </div>

      <!-- 合計枚数表示 (モバイル最適化) -->
      <div class="text-center mb-1">
        <div
          class="inline-flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-0.5 sm:py-1 bg-slate-800/60 backdrop-blur-sm rounded border border-slate-600/50"
        >
          <span class="text-xs font-medium text-slate-300">合計枚数:</span>
          <span
            class="text-sm font-bold"
            :class="[
              totalDeckCards === 60
                ? 'text-green-400'
                : totalDeckCards > 50
                ? 'text-yellow-400'
                : 'text-slate-100',
            ]"
          >
            {{ totalDeckCards }}
          </span>
          <span class="text-xs text-slate-400">/ 60</span>
          <div
            class="w-12 sm:w-16 h-1 bg-slate-700 rounded-full overflow-hidden"
          >
            <div
              class="h-full transition-all duration-300 rounded-full"
              :class="[
                totalDeckCards === 60
                  ? 'bg-green-500'
                  : totalDeckCards > 50
                  ? 'bg-yellow-500'
                  : 'bg-blue-500',
              ]"
              :style="{ width: `${(totalDeckCards / 60) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div
        id="chosen-deck-grid"
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-4 p-1 sm:p-2 bg-slate-800/40 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
      >
        <div
          v-for="item in sortedDeckCards"
          :key="item.card.id"
          class="group flex flex-col items-center relative h-fit transition-all duration-200"
        >
          <div
            class="w-full relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <img
              :src="getCardImageUrl(item.card.id)"
              @error="handleImageError"
              :alt="item.card.name"
              class="block w-full h-full object-cover transition-transform duration-200"
            />
            <div
              class="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent rounded-b-lg"
            ></div>
          </div>

          <div
            class="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center justify-center space-x-2"
          >
            <button
              @click="decrementCardCount(item.card.id)"
              class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-red-500/25"
            >
              <svg
                class="w-3 h-3 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 12H4"
                ></path>
              </svg>
            </button>
            <div
              class="w-8 h-7 sm:w-10 sm:h-9 font-bold text-center flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-600/50 text-white text-sm sm:text-base"
            >
              {{ item.count }}
            </div>
            <button
              @click="incrementCardCount(item.card.id)"
              class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed"
              :disabled="item.count >= 4 || totalDeckCards >= 60"
            >
              <svg
                class="w-3 h-3 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                ></path>
              </svg>
            </button>
          </div>
        </div>
        <div
          v-if="deckCards.length === 0"
          class="col-span-full text-center mt-2 sm:mt-4"
        >
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700/50 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
            </div>
            <div class="text-slate-400 text-center">
              <p class="text-sm sm:text-base font-medium mb-1">
                デッキが空です
              </p>
              <p class="text-xs">
                下の一覧からカードをタップして追加してください
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- カード一覧セクション -->
    <div
      class="flex flex-col flex-grow h-1/2 p-1 sm:p-2 overflow-hidden relative z-10"
    >
      <div class="flex items-center justify-between mb-1 px-1">
        <h2
          class="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1"
        >
          <svg
            class="w-4 h-4 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
          カード一覧
        </h2>
        <button
          @click="openFilterModal"
          class="group px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded text-xs font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          title="フィルター・検索"
        >
          <span class="flex items-center gap-1">
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.586V4z"
              ></path>
            </svg>
            <span class="hidden sm:inline">検索/絞り込み</span>
            <span class="sm:hidden">検索</span>
          </span>
        </button>
      </div>

      <div
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-4 p-1 sm:p-2 bg-slate-800/40 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
      >
        <div v-if="isLoading" class="col-span-full text-center mt-2 sm:mt-4">
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-4 border-slate-600 border-t-blue-500"
            ></div>
            <div class="text-slate-400 text-center">
              <p class="text-sm sm:text-base font-medium mb-1">読み込み中...</p>
              <p class="text-xs">カードデータを取得しています</p>
            </div>
          </div>
        </div>
        <div v-else-if="error" class="col-span-full text-center mt-2 sm:mt-4">
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="w-8 h-8 sm:w-10 sm:h-10 bg-red-500/20 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <div class="text-red-400 text-center">
              <p class="text-sm sm:text-base font-medium mb-1">
                エラーが発生しました
              </p>
              <p class="text-xs">{{ error }}</p>
            </div>
          </div>
        </div>
        <div
          v-else-if="sortedAndFilteredAvailableCards.length === 0"
          class="col-span-full text-center mt-2 sm:mt-4"
        >
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700/50 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
            <div class="text-slate-400 text-center">
              <p class="text-sm sm:text-base font-medium mb-1">
                カードが見つかりません
              </p>
              <p class="text-xs">検索条件を変更してみてください</p>
            </div>
          </div>
        </div>
        <div
          v-else
          v-for="card in sortedAndFilteredAvailableCards"
          :key="card.id"
          class="group flex flex-col items-center cursor-pointer transition-all duration-200 active:scale-95"
          @click="addCardToDeck(card)"
          title="デッキに追加"
        >
          <div
            class="w-full relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <img
              :src="getCardImageUrl(card.id)"
              @error="handleImageError"
              :alt="card.name"
              class="block w-full h-full object-cover transition-transform duration-200"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- フィルターモーダル -->
    <div
      v-if="isFilterModalOpen"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeFilterModal"
    >
      <div class="bg-gray-800 p-4 w-full h-full overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold">検索・絞り込み</h3>
          <button
            @click="closeFilterModal"
            class="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div class="mb-4">
          <label for="searchText" class="block text-sm font-medium mb-1"
            >テキスト検索 (名前, ID, タグ)</label
          >
          <input
            id="searchText"
            type="text"
            v-model="filterCriteria.text"
            class="w-full px-3 py-2 text-sm sm:text-base rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
            placeholder="カード名、ID、タグを入力"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">種類で絞り込み</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <label
              v-for="kind in allKinds"
              :key="kind"
              class="flex items-center"
            >
              <input
                type="checkbox"
                :value="kind"
                v-model="filterCriteria.kind"
                class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span class="ml-2">{{ kind }}</span>
            </label>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">タイプで絞り込み</label>
          <div
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-sm"
          >
            <label
              v-for="type in allTypes"
              :key="type"
              class="flex items-center"
            >
              <input
                type="checkbox"
                :value="type"
                v-model="filterCriteria.type"
                class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span class="ml-2">{{ type }}</span>
            </label>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">タグで絞り込み</label>
          <div
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-sm max-h-[40vh] overflow-y-auto pr-2"
          >
            <label v-for="tag in allTags" :key="tag" class="flex items-center">
              <input
                type="checkbox"
                :value="tag"
                v-model="filterCriteria.tags"
                class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span class="ml-2">{{ tag }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- デッキコードモーダル -->
    <div
      v-if="showDeckCodeModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showDeckCodeModal = false"
    >
      <div class="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold">デッキコード</h3>
          <button
            @click="showDeckCodeModal = false"
            class="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div class="mb-4">
          <div
            class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2"
          >
            <input
              type="text"
              v-model="deckCode"
              readonly
              class="flex-grow px-3 py-2 text-sm rounded bg-gray-700 border border-gray-600"
            />
            <button
              @click="copyDeckCode"
              class="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition duration-200 whitespace-nowrap"
            >
              コピー
            </button>
          </div>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-medium mb-2">デッキコードをインポート</h4>
          <div
            class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2"
          >
            <input
              type="text"
              v-model="importDeckCode"
              class="flex-grow px-3 py-2 text-sm sm:text-base rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
              placeholder="デッキコードを入力"
            />
            <button
              @click="handleImportDeckFromCode"
              class="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition duration-200 whitespace-nowrap"
            >
              インポート
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- エクスポート用の隠されたコンテナ -->
    <div
      ref="exportContainer"
      v-show="isSaving"
      class="fixed pointer-events-none"
      style="left: -9999px; top: 0; z-index: -1"
      :style="{
        width: `${EXPORT_CONFIG.canvas.width}px`,
        height: `${EXPORT_CONFIG.canvas.height}px`,
        backgroundColor: EXPORT_CONFIG.canvas.backgroundColor,
        padding: EXPORT_CONFIG.canvas.padding,
      }"
    >
      <!-- デッキ名 -->
      <div
        :style="{
          position: 'absolute',
          fontSize: EXPORT_CONFIG.deckName.fontSize,
          fontWeight: EXPORT_CONFIG.deckName.fontWeight,
          color: EXPORT_CONFIG.deckName.color,
          fontFamily: EXPORT_CONFIG.deckName.fontFamily,
          textAlign: 'center',
          width: '100%',
        }"
      >
        {{ deckName }}
      </div>

      <!-- カードグリッド -->
      <div
        :style="{
          display: 'flex',
          flexWrap: 'wrap',
          gap: EXPORT_CONFIG.grid.gap,
          width: '100%',
          height: '100%',
          justifyContent: 'flex-start',
          alignItems: 'center',
          alignContent: 'center',
        }"
      >
        <div
          v-for="item in sortedDeckCards"
          :key="`export-${item.card.id}`"
          :style="{
            position: 'relative',
            width: calculateCardWidth(deckCards.length),
          }"
        >
          <!-- カード画像 -->
          <img
            :src="getCardImageUrl(item.card.id)"
            :alt="item.card.name"
            :style="{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: EXPORT_CONFIG.card.borderRadius,
            }"
            crossorigin="anonymous"
          />

          <!-- カウントバッジ -->
          <div
            :style="{
              position: 'absolute',
              bottom: '5px',
              right: '5px',
              backgroundColor: EXPORT_CONFIG.badge.backgroundColor,
              color: EXPORT_CONFIG.badge.color,
              padding: EXPORT_CONFIG.badge.padding,
              borderRadius: EXPORT_CONFIG.badge.borderRadius,
              fontSize: EXPORT_CONFIG.badge.fontSize,
              fontWeight: 'bold',
            }"
          >
            ×{{ item.count }}
          </div>
        </div>
      </div>
    </div>
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
