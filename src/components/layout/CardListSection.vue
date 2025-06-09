<script setup lang="ts">
import { ref, onUnmounted, watchEffect, defineAsyncComponent } from "vue";
import type { Card } from "../../types";
import { handleImageError } from "../../utils/image";
import { getCardImageUrlSafe } from "../../utils/imageHelpers";
import { useLongPress } from "../../composables/useLongPress";

const CardImageModal = defineAsyncComponent(
  () => import("../modals/CardImageModal.vue")
);

interface Props {
  availableCards: readonly Card[];
  sortedAndFilteredCards: readonly Card[];
  isLoading: boolean;
  error: string | null;
}

interface Emits {
  (e: "openFilter"): void;
  (e: "addCard", card: Card): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// モーダルの状態
const isImageModalVisible = ref(false);
const selectedCardImage = ref<string | null>(null);
const selectedCard = ref<Card | null>(null);
const selectedCardIndex = ref<number | null>(null);

// カード画像を拡大表示
const openImageModal = (card: Card, cardIndex: number) => {
  selectedCard.value = card;
  selectedCardIndex.value = cardIndex;
  selectedCardImage.value = getCardImageUrlSafe(card.id);
  isImageModalVisible.value = true;
};

// モーダルを閉じる
const closeImageModal = () => {
  isImageModalVisible.value = false;
  selectedCardImage.value = null;
  selectedCard.value = null;
  selectedCardIndex.value = null;
};

// カードナビゲーション
const handleCardNavigation = (direction: "previous" | "next") => {
  if (selectedCardIndex.value === null) return;

  let newIndex: number;
  if (direction === "previous") {
    newIndex = selectedCardIndex.value - 1;
  } else {
    newIndex = selectedCardIndex.value + 1;
  }

  if (newIndex >= 0 && newIndex < props.sortedAndFilteredCards.length) {
    const newCard = props.sortedAndFilteredCards[newIndex];
    selectedCard.value = newCard;
    selectedCardIndex.value = newIndex;
    selectedCardImage.value = getCardImageUrlSafe(newCard.id);
  }
};

// 長押し機能の設定
const longPressHandlers = new Map<string, ReturnType<typeof useLongPress>>();

// longPressHandlersのクリーンアップ関数
const cleanupLongPressHandlers = () => {
  longPressHandlers.clear();
};

// 使用されていないハンドラーをクリーンアップ
const cleanupUnusedHandlers = () => {
  const currentCardIds = new Set(
    props.sortedAndFilteredCards.map((card) => card.id)
  );
  const handlersToDelete: string[] = [];

  for (const cardId of longPressHandlers.keys()) {
    if (!currentCardIds.has(cardId)) {
      handlersToDelete.push(cardId);
    }
  }

  for (const cardId of handlersToDelete) {
    longPressHandlers.delete(cardId);
  }
};

const getLongPressHandler = (card: Card, index: number) => {
  if (!longPressHandlers.has(card.id)) {
    longPressHandlers.set(
      card.id,
      useLongPress({
        delay: 500, // 500msで長押し判定
        onLongPress: () => openImageModal(card, index),
        onPress: () => emit("addCard", card),
      })
    );
  }
  return longPressHandlers.get(card.id)!;
};

// カードリストが変更されたら使用されていないハンドラーをクリーンアップ
watchEffect(() => {
  cleanupUnusedHandlers();
});

// コンポーネントアンマウント時に全てのハンドラーをクリーンアップ
onUnmounted(() => {
  cleanupLongPressHandlers();
});
</script>

<template>
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
        @click="emit('openFilter')"
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
        v-else-if="sortedAndFilteredCards.length === 0"
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
        v-for="(card, index) in sortedAndFilteredCards"
        :key="card.id"
        class="group flex flex-col items-center cursor-pointer transition-all duration-200 active:scale-95"
        title="クリック: デッキに追加 / 長押し: 拡大表示"
      >
        <div
          class="w-full relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          @pointerdown="
            (event) => getLongPressHandler(card, index).startPress(event)
          "
          @pointerup="() => getLongPressHandler(card, index).endPress()"
          @pointerleave="() => getLongPressHandler(card, index).cancelPress()"
          @pointercancel="() => getLongPressHandler(card, index).cancelPress()"
          @contextmenu.prevent
        >
          <img
            :src="getCardImageUrlSafe(card.id)"
            @error="handleImageError"
            :alt="card.name"
            loading="lazy"
            class="block w-full h-full object-cover transition-transform duration-200 select-none"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          ></div>
        </div>
      </div>
    </div>

    <!-- カード画像拡大モーダル -->
    <CardImageModal
      :is-visible="isImageModalVisible"
      :image-src="selectedCardImage"
      :current-card="selectedCard"
      :card-index="selectedCardIndex"
      :total-cards="sortedAndFilteredCards.length"
      @close="closeImageModal"
      @navigate="handleCardNavigation"
    />
  </div>
</template>
