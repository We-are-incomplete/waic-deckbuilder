<!--
 Component: DeckSection
 Purpose : デッキの編集/表示/エクスポートUI
 Props   : isGeneratingCode(boolean), isSaving(boolean)
 Emits   : generateDeckCode, resetDeck, openImageModal(cardId), openDeckManagementModal
 Store   : useDeckStore（deckName, deckCards, sortedDeckCards, totalDeckCards）
 Constraints: MAX_DECK_SIZE, MAX_CARD_COPIES を超えない
-->
<script setup lang="ts">
import { computed } from "vue";
import { GAME_CONSTANTS } from "../../constants";
import { getCardImageUrl, handleImageError } from "../../utils";
import { useDeckStore } from "../../stores";
import { storeToRefs } from "pinia";
import { useLongPressImageModal } from "../../composables/useLongPressImageModal";

// Vue 3.5の新機能: 改善されたdefineProps with better TypeScript support
interface Props {
  isGeneratingCode: boolean;
  isSaving: boolean;
}

// Vue 3.5の新機能: 改善されたdefineEmits with better TypeScript support
interface Emits {
  (e: "generateDeckCode"): void;
  (e: "resetDeck"): void;
  (e: "openImageModal", cardId: string): void;
  (e: "openDeckManagementModal"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// ストアとコンポーザブルの初期化
const deckStore = useDeckStore();

// デッキ操作（ストアを直接呼び出し）
const handleIncrementCard = (cardId: string) => {
  deckStore.incrementCardCount(cardId);
};
const handleDecrementCard = (cardId: string) => {
  deckStore.decrementCardCount(cardId);
};

// 計算プロパティ（ストアから直接取得）- Vue 3.5の改善されたreactivity
const { deckCards, deckName, sortedDeckCards, totalDeckCards } =
  storeToRefs(deckStore);

// デッキ名の更新（ストアメソッドを直接使用）
const updateDeckName = (value: string) => {
  deckStore.setDeckName(value);
};

// カード画像を拡大表示
const openImageModal = (cardId: string) => {
  emit("openImageModal", cardId);
};

const { setCardRef: setDeckCardRef } = useLongPressImageModal(
  openImageModal,
  computed(() => sortedDeckCards.value.map((dc) => dc.card)),
);

const resetDeck = () => {
  emit("resetDeck");
};

const getDeckCountColor = (count: number) => {
  if (count === GAME_CONSTANTS.MAX_DECK_SIZE) return "text-green-400";
  if (count > GAME_CONSTANTS.MAX_DECK_SIZE) return "text-red-400";
  if (count > (GAME_CONSTANTS.MAX_DECK_SIZE * 5) / 6) return "text-yellow-400";
  return "text-slate-100";
};

const getDeckProgressColor = (count: number) => {
  if (count === GAME_CONSTANTS.MAX_DECK_SIZE) return "bg-green-500";
  if (count > GAME_CONSTANTS.MAX_DECK_SIZE) return "bg-red-500";
  if (count > (GAME_CONSTANTS.MAX_DECK_SIZE * 5) / 6) return "bg-yellow-500";
  return "bg-blue-500";
};

// エクスポート用
defineExpose({
  resetDeck,
  updateDeckName,
});

const onDeckImageError = (e: Event) => {
  try {
    handleImageError(e);
  } catch (error) {
    console.error("Error handling image error:", error);
  }
};
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
            fill="white"
            stroke="currentColor"
            viewBox="0 -960 960 960"
          >
            <path
              d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"
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
        @click="emit('openDeckManagementModal')"
        class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded text-xs font-medium hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
        title="デッキの保存・読み込み"
      >
        <span class="flex items-center justify-center gap-1">
          <svg
            class="w-3 h-3"
            fill="white"
            stroke="currentColor"
            viewBox="0 -960 960 960"
          >
            <path
              d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"
            ></path>
          </svg>
          <span class="hidden sm:inline">デッキ保存</span>
          <span class="sm:hidden">保存</span>
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
            fill="white"
            stroke="currentColor"
            viewBox="0 -960 960 960"
          >
            <path
              d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"
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
        <span class="text-xs text-slate-400"
          >/ {{ GAME_CONSTANTS.MAX_DECK_SIZE }}</span
        >

        <div class="w-12 sm:w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full transition-all duration-300 rounded-full"
            :class="getDeckProgressColor(totalDeckCards)"
            :style="{
              width: `${Math.min((totalDeckCards / GAME_CONSTANTS.MAX_DECK_SIZE) * 100, 100)}%`,
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
          :ref="(el) => setDeckCardRef(el, item.card.id)"
          @contextmenu.prevent
          title="長押し: 拡大表示"
        >
          <img
            :src="getCardImageUrl(item.card.id)"
            @error="onDeckImageError"
            :alt="item.card.name"
            loading="lazy"
            crossorigin="anonymous"
            class="block w-full h-full object-cover transition-transform duration-200 select-none"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent pointer-events-none"
          ></div>
        </div>

        <div
          class="absolute bottom-2 w-full px-1 flex items-center justify-center gap-1"
        >
          <button
            @click="handleDecrementCard(item.card.id)"
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
            :disabled="item.count >= GAME_CONSTANTS.MAX_CARD_COPIES"
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
  </div>
</template>
