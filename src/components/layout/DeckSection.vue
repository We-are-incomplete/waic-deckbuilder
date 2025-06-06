<script setup lang="ts">
import { computed, ref } from "vue";
import type { DeckCard } from "../../types";
import DeckExportContainer from "./DeckExportContainer.vue";
import { getCardImageUrl, handleImageError } from "../../utils/image";

interface Props {
  deckCards: readonly DeckCard[];
  deckName: string;
  sortedDeckCards: readonly DeckCard[];
  totalDeckCards: number;
  isGeneratingCode: boolean;
  isSaving: boolean;
}

interface Emits {
  (e: "updateDeckName", value: string): void;
  (e: "generateDeckCode"): void;
  (e: "saveDeckAsPng"): void;
  (e: "resetDeck"): void;
  (e: "incrementCardCount", cardId: string): void;
  (e: "decrementCardCount", cardId: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const deckExportContainerRef = ref<InstanceType<
  typeof DeckExportContainer
> | null>(null);

const exportContainer = computed(
  () => deckExportContainerRef.value?.exportContainer || null
);

defineExpose({
  exportContainer,
});
</script>

<template>
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
          :value="deckName"
          @input="
            emit('updateDeckName', ($event.target as HTMLInputElement).value)
          "
          class="flex-grow px-1 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-base rounded bg-slate-800/80 border border-slate-600/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm placeholder-slate-400"
          placeholder="デッキ名を入力"
        />
      </div>
    </div>

    <!-- ボタン群 (モバイル最適化) -->
    <div class="flex flex-wrap gap-1 mb-1 px-1">
      <button
        @click="emit('generateDeckCode')"
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
        @click="emit('saveDeckAsPng')"
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
        @click="emit('resetDeck')"
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
        <div class="w-12 sm:w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
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
            @click="emit('decrement-card', item.card.id)"
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
            @click="emit('increment-card', item.card.id)"
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
      :is-saving="isSaving"
    />
  </div>
</template>
