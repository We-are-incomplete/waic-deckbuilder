<script setup lang="ts">
import { computed, ref, inject } from "vue";
import DeckExportContainer from "./DeckExportContainer.vue";
import { handleImageError } from "../../utils/image";
import { getCardImageUrlSafe } from "../../utils/imageHelpers";
import { useLongPress } from "../../composables/useLongPress";
import { useDeckOperations } from "../../composables/useDeckOperations";
import { useDeckStore } from "../../stores/deck";
import type { ShowToastFunction } from "../../utils/errorHandler";

// Props（必要最小限に削減）
interface Props {
  isGeneratingCode: boolean;
  isSaving: boolean;
}

// Emits（ビジネスロジック以外のUIイベントのみ）
interface Emits {
  (e: "generateDeckCode"): void;
  (e: "saveDeckAsPng"): void;
  (e: "resetDeck"): void;
  (e: "openImageModal", cardId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// ストアとコンポーザブルの初期化
const deckStore = useDeckStore();

// トースト関数を注入（アプリケーション全体で利用）
const showToast = inject<ShowToastFunction>("showToast");

// デッキ操作のコンポーザブル
const {
  deckState,
  incrementCardCount: handleIncrementCard,
  decrementCardCount: handleDecrementCard,
  clearDeck,
} = useDeckOperations(showToast);

// 計算プロパティ（ストアから直接取得）
const deckCards = computed(() => deckStore.deckCards);
const deckName = computed(() => deckStore.deckName);
const sortedDeckCards = computed(() => deckStore.sortedDeckCards);
const totalDeckCards = computed(() => deckStore.totalDeckCards);

// デッキ名の更新（ストアメソッドを直接使用）
const updateDeckName = (value: string) => {
  deckStore.setDeckName(value);
};

// エクスポート用参照
const deckExportContainerRef = ref<InstanceType<
  typeof DeckExportContainer
> | null>(null);

const exportContainer = computed(
  () => deckExportContainerRef.value?.exportContainer || null
);

// カード画像を拡大表示
const openImageModal = (cardId: string) => {
  emit("openImageModal", cardId);
};

// 長押し機能の設定（デッキカード用）
const deckCardLongPressHandlers = new Map<
  string,
  ReturnType<typeof useLongPress>
>();

const getDeckCardLongPressHandler = (cardId: string) => {
  if (!deckCardLongPressHandlers.has(cardId)) {
    deckCardLongPressHandlers.set(
      cardId,
      useLongPress({
        delay: 500,
        onLongPress: () => openImageModal(cardId),
      })
    );
  }
  return deckCardLongPressHandlers.get(cardId)!;
};

// ハンドラーのクリーンアップ機能
const cleanupCardHandler = (cardId: string) => {
  deckCardLongPressHandlers.delete(cardId);
};

const cleanupAllHandlers = () => {
  deckCardLongPressHandlers.clear();
};

// カードデクリメント処理（ハンドラークリーンアップ付き）
const decrementCard = (cardId: string) => {
  // 現在のカードの情報を取得
  const currentCard = deckCards.value.find((card) => card.card.id === cardId);

  // カウントが1の場合、デクリメント後に削除されるためハンドラーもクリーンアップ
  if (currentCard && currentCard.count === 1) {
    cleanupCardHandler(cardId);
  }

  handleDecrementCard(cardId);
};

// デッキリセット処理（ハンドラークリーンアップ付き）
const resetDeck = () => {
  if (clearDeck()) {
    cleanupAllHandlers();
    emit("resetDeck");
  }
};

// デッキ枚数の色分け計算
const getDeckCountColor = (count: number) => {
  if (count === 60) return "text-green-400";
  if (count > 60) return "text-red-400";
  if (count > 50) return "text-yellow-400";
  return "text-slate-100";
};

const getDeckProgressColor = (count: number) => {
  if (count === 60) return "bg-green-500";
  if (count > 60) return "bg-red-500";
  if (count > 50) return "bg-yellow-500";
  return "bg-blue-500";
};

// エクスポート用
defineExpose({
  exportContainer,
});
</script>

<template>
  <div
    class="flex flex-col flex-grow-0 h-1/2 p-1 sm:p-2 border-b border-slate-700/50 relative z-10 backdrop-blur-sm"
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
          :value="deckName"
          @input="updateDeckName(($event.target as HTMLInputElement).value)"
          class="flex-grow px-1 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-base rounded bg-slate-800/80 border border-slate-600/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm placeholder-slate-400"
          placeholder="デッキ名を入力"
        />
      </div>
    </div>

    <!-- ボタン群 (モバイル最適化) -->
    <div class="flex flex-wrap gap-1 mb-1 px-1">
      <button
        @click="emit('generateDeckCode')"
        :disabled="props.isGeneratingCode"
        class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded text-xs font-medium hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
        title="デッキコードの入出力"
      >
        <span
          v-if="!props.isGeneratingCode"
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
        @click="emit('saveDeckAsPng')"
        :disabled="deckCards.length === 0 || props.isSaving"
        class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded text-xs font-medium hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
        title="デッキ画像を保存"
      >
        <span
          v-if="!props.isSaving"
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

    <!-- 合計枚数表示とデッキ状態 (モバイル最適化) -->
    <div class="text-center mb-1">
      <div
        class="inline-flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-0.5 sm:py-1 bg-slate-800/60 backdrop-blur-sm rounded border border-slate-600/50"
      >
        <span class="text-xs font-medium text-slate-300">合計枚数:</span>
        <span
          class="text-sm font-bold"
          :class="getDeckCountColor(totalDeckCards)"
        >
          {{ totalDeckCards }}
        </span>
        <span class="text-xs text-slate-400">/ 60</span>

        <!-- デッキ状態インジケーター -->
        <div
          v-if="!deckState.isValid"
          class="ml-1 text-xs text-red-400"
          :title="deckState.validationErrors.join(', ')"
        >
          ⚠️
        </div>

        <div class="w-12 sm:w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full transition-all duration-300 rounded-full"
            :class="getDeckProgressColor(totalDeckCards)"
            :style="{
              width: `${Math.min((totalDeckCards / 60) * 100, 100)}%`,
            }"
          ></div>
        </div>
      </div>
    </div>

    <!-- デッキカードグリッド -->
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
          @pointerdown="getDeckCardLongPressHandler(item.card.id).startPress"
          @pointerup="getDeckCardLongPressHandler(item.card.id).endPress"
          @pointerleave="getDeckCardLongPressHandler(item.card.id).cancelPress"
          @pointercancel="getDeckCardLongPressHandler(item.card.id).cancelPress"
          @contextmenu.prevent
          title="長押し: 拡大表示"
        >
          <img
            :src="getCardImageUrlSafe(item.card.id)"
            @error="handleImageError"
            :alt="item.card.name"
            loading="lazy"
            class="block w-full h-full object-cover transition-transform duration-200 select-none"
          />
          <div
            class="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent rounded-b-lg"
          ></div>
        </div>

        <div
          class="absolute bottom-2 w-full px-1 flex items-center justify-center gap-1"
        >
          <button
            @click="decrementCard(item.card.id)"
            class="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-red-500/25"
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
            class="w-7 h-6 sm:w-9 sm:h-8 font-bold text-center flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-600/50 text-white text-sm sm:text-base"
          >
            {{ item.count }}
          </div>
          <button
            @click="handleIncrementCard(item.card.id)"
            class="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed"
            :disabled="item.count >= 4"
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
            <p class="text-sm sm:text-base font-medium mb-1">デッキが空です</p>
            <p class="text-xs">
              下の一覧からカードをタップして追加してください
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- エクスポート用の非表示コンテナ -->
    <DeckExportContainer
      ref="deckExportContainerRef"
      :deck-name="deckName"
      :deck-cards="deckCards"
      :sorted-deck-cards="sortedDeckCards"
      :is-saving="props.isSaving"
    />
  </div>
</template>
